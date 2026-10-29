/**
 * HTTP layer for contributions, collections and receipts (T4). Thin on purpose: every rule lives in the services. Route-level permission
 * checks are in ajo.routes.ts; checks that depend on whose record it is are made here.
 *
 * Every record route needs an `Idempotency-Key` header. Repeating a request with the same key returns the original and changes nothing.
 */
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { PERMISSIONS } from '../../lib/permissions';
import { RuleError } from '../finance/rule-error';
import { MAX_PROOF_BYTES, PROOF_TYPES } from './ajo-collections';
import { confirmTransfer, getProofLink, listGroupContributions, listMembershipContributions, recordCash, rejectContribution, reportTransfer, reverseContribution } from './ajo-contribution.service';
import { collectorDaySummary, createHandover, getHandover, listHandovers, reconcileHandover } from './ajo-handover.service';
import { actor, canManage, fail, hasAjoPermission } from './ajo-members.controller';
import { flushQueuedReceipts, listReceipts, queuedReceiptCount } from './ajo-receipt.service';

const id = z.coerce.number().int().positive();
const kobo = z.union([z.number().int().positive(), z.string().regex(/^[0-9]+$/)]).transform((v) => BigInt(v));
const koboOrZero = z.union([z.number().int().nonnegative(), z.string().regex(/^[0-9]+$/)]).transform((v) => BigInt(v));
const flag = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional());

const key = (req: Request): string => String(req.header('Idempotency-Key') ?? '');

// The proof goes to memory and straight on to storage: no file lands on the server's disk.
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => ((PROOF_TYPES as readonly string[]).includes(file.mimetype) ? cb(null, true) : cb(new Error('INVALID_PROOF_TYPE'))),
});

/** `proof` is optional; a request with no file (JSON, or a bank reference only) passes straight through. */
export function uploadProof(req: Request, res: Response, next: NextFunction): void {
  uploader.single('proof')(req, res, (error: unknown) => {
    if (!error) return next();
    const tooBig = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
    const message = tooBig ? 'The proof must be no bigger than 5 MB.' : 'The proof must be a JPEG, PNG or WebP picture, or a PDF.';
    res.status(400).json({ success: false, code: 'INVALID_PROOF', message });
  });
}

/** Self, an officer, or the collector this person is currently assigned to. Anyone else is told the membership does not exist. */
export async function assertMembershipViewer(req: Request, membershipId: number): Promise<{ officer: boolean }> {
  const { userId, associationId } = actor(req);
  const m = await prisma.ajoMembership.findFirst({ where: { id: membershipId, associationId }, select: { member: { select: { userId: true } } } });
  if (!m) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  const officer = (await canManage(req)) || (await hasAjoPermission(req, PERMISSIONS.AJO_RECONCILE));
  if (officer || m.member.userId === userId) return { officer };
  const today = new Date();
  const assigned = await prisma.ajoCollectorAssignment.findFirst({ where: { membershipId, collectorUserId: userId, startsOn: { lte: today }, OR: [{ endsOn: null }, { endsOn: { gte: today } }] }, select: { id: true } });
  if (!assigned) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  return { officer: false };
}

async function membershipOfContribution(associationId: number, contributionId: number): Promise<number> {
  const c = await prisma.ajoContribution.findFirst({ where: { id: contributionId, associationId }, select: { membershipId: true } });
  if (!c) throw new RuleError('That payment was not found.', 404, 'CONTRIBUTION_NOT_FOUND');
  return c.membershipId;
}

const toDate = (value: string | undefined): Date | undefined => (value ? new Date(`${value}T00:00:00.000Z`) : undefined);

export const ajoContributionsController = {
  // ---- recording
  async cash(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ membershipId: id, amountKobo: kobo }).parse(req.body);
      const result = await recordCash({ associationId, groupId: id.parse(req.params.id), membershipId: body.membershipId, amountKobo: body.amountKobo, idempotencyKey: key(req), actorUserId: userId, actorCanManage: await canManage(req) });
      return res.status(result.replayed ? 200 : 201).json({ success: true, message: result.replayed ? 'Already recorded.' : 'Cash recorded. It counts once the officer confirms your handover.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not record the cash.');
    }
  },

  async transfer(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ membershipId: id, amountKobo: kobo, bankReference: z.string().max(80).optional(), paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.body ?? {});
      const result = await reportTransfer({
        associationId,
        groupId: id.parse(req.params.id),
        membershipId: body.membershipId,
        amountKobo: body.amountKobo,
        idempotencyKey: key(req),
        actorUserId: userId,
        actorCanManage: await canManage(req),
        proof: req.file ? { buffer: req.file.buffer, mimeType: req.file.mimetype } : undefined,
        bankReference: body.bankReference,
        paidOn: toDate(body.paidOn),
      });
      return res.status(result.replayed ? 200 : 201).json({ success: true, message: result.replayed ? 'Already reported.' : 'Reported. It counts once an officer confirms it against the bank statement.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not report the transfer.');
    }
  },

  // ---- deciding
  async confirm(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ acknowledgeDuplicate: flag, note: z.string().max(300).optional(), confirmOwn: flag }).parse(req.body ?? {});
      const result = await confirmTransfer({ associationId, contributionId: id.parse(req.params.id), actorUserId: userId, ...body });
      return res.json({ success: true, message: result.replayed ? 'Already confirmed.' : 'Confirmed.', data: jsonSafe(result) });
    } catch (error) {
      return fail(res, error, 'Could not confirm the payment.');
    }
  },

  async reject(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const { reason } = z.object({ reason: z.string() }).parse(req.body ?? {});
      const result = await rejectContribution({ associationId, contributionId: id.parse(req.params.id), actorUserId: userId, reason });
      return res.json({ success: true, message: result.replayed ? 'Already rejected.' : 'Rejected. The contributor has been told why.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not reject the payment.');
    }
  },

  async reverse(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const { reason } = z.object({ reason: z.string() }).parse(req.body ?? {});
      const result = await reverseContribution({ associationId, contributionId: id.parse(req.params.id), actorUserId: userId, reason });
      return res.json({ success: true, message: result.replayed ? 'Already reversed.' : 'Reversed. The reason stays on the record.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not reverse the payment.');
    }
  },

  // ---- reading
  async membershipHistory(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      const { officer } = await assertMembershipViewer(req, membershipId);
      return res.json({ success: true, data: await listMembershipContributions({ associationId, membershipId, officer }) });
    } catch (error) {
      return fail(res, error, 'Could not load the payments.');
    }
  },

  async groupQueue(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const q = z.object({ status: z.enum(['REPORTED', 'CASH_RECEIVED', 'CONFIRMED', 'REVERSED', 'REJECTED']).optional(), method: z.enum(['CASH', 'TRANSFER']).optional(), take: z.coerce.number().int().min(1).max(200).optional(), skip: z.coerce.number().int().min(0).optional() }).parse(req.query);
      return res.json({ success: true, data: await listGroupContributions({ associationId, groupId: id.parse(req.params.id), ...q }) });
    } catch (error) {
      return fail(res, error, 'Could not load the payments.');
    }
  },

  async proof(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const officer = (await canManage(req)) || (await hasAjoPermission(req, PERMISSIONS.AJO_RECONCILE));
      const link = await getProofLink({ associationId, contributionId: id.parse(req.params.id), viewerUserId: userId, viewerIsOfficer: officer, host: req.hostname });
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, data: link });
    } catch (error) {
      return fail(res, error, 'Could not open the proof.');
    }
  },

  async receipts(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const contributionId = id.parse(req.params.id);
      await assertMembershipViewer(req, await membershipOfContribution(associationId, contributionId));
      return res.json({ success: true, data: await listReceipts({ associationId, contributionId }) });
    } catch (error) {
      return fail(res, error, 'Could not load the receipts.');
    }
  },

  async sendQueuedReceipts(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const result = await flushQueuedReceipts({ associationId });
      return res.json({ success: true, message: result.stillQueued ? `${result.stillQueued} still waiting (check your SMS credits).` : 'Every waiting receipt was sent.', data: { ...result, waiting: await queuedReceiptCount(associationId) } });
    } catch (error) {
      return fail(res, error, 'Could not send the waiting receipts.');
    }
  },

  // ---- the collector's day
  async day(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), collectorUserId: id.optional() }).parse(req.query);
      let collectorUserId = userId;
      if (q.collectorUserId && q.collectorUserId !== userId) {
        // Officers can look at any collector's day; a collector sees only their own.
        const officer = (await canManage(req)) || (await hasAjoPermission(req, PERMISSIONS.AJO_RECONCILE));
        if (!officer) throw new RuleError('You can only see your own collections.', 403, 'FORBIDDEN');
        collectorUserId = q.collectorUserId;
      }
      return res.json({ success: true, data: await collectorDaySummary({ associationId, groupId: id.parse(req.params.id), collectorUserId, forDate: toDate(q.date) }) });
    } catch (error) {
      return fail(res, error, 'Could not load the day.');
    }
  },

  async handOver(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ handedOverKobo: koboOrZero, note: z.string().max(300).optional(), forDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.body ?? {});
      const result = await createHandover({ associationId, groupId: id.parse(req.params.id), collectorUserId: userId, handedOverKobo: body.handedOverKobo, note: body.note, forDate: toDate(body.forDate), idempotencyKey: key(req) });
      return res.status(result.replayed ? 200 : 201).json({ success: true, message: result.replayed ? 'Already handed over.' : 'Handed over. An officer will reconcile it.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not record the handover.');
    }
  },

  async handovers(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const q = z.object({ reconciled: flag, take: z.coerce.number().int().min(1).max(200).optional(), skip: z.coerce.number().int().min(0).optional() }).parse(req.query);
      return res.json({ success: true, data: await listHandovers({ associationId, groupId: id.parse(req.params.id), ...q }) });
    } catch (error) {
      return fail(res, error, 'Could not load the handovers.');
    }
  },

  async handover(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      return res.json({ success: true, data: await getHandover({ associationId, handoverId: id.parse(req.params.id) }) });
    } catch (error) {
      return fail(res, error, 'Could not load the handover.');
    }
  },

  async reconcile(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ countedKobo: koboOrZero, receivedContributionIds: z.array(id).optional(), note: z.string().max(300).optional(), confirmOwn: flag }).parse(req.body ?? {});
      const result = await reconcileHandover({ associationId, handoverId: id.parse(req.params.id), actorUserId: userId, ...body });
      return res.json({ success: true, message: result.replayed ? 'Already reconciled.' : 'Reconciled.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not reconcile the handover.');
    }
  },
};

/** Kobo comes out of the services as bigint; JSON cannot carry it, so it goes out as a string. */
function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}
