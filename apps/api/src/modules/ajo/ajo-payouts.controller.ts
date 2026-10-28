/**
 * HTTP layer for payouts (T5). Thin on purpose: every rule lives in ajo-payout.service.ts. Route-level permission checks are in
 * ajo.routes.ts. SocietyLedger never initiates a transfer: these routes prepare, approve and RECORD what the group paid from its own account.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../lib/permissions';
import { uploadProof } from './ajo-contributions.controller';
import { passwordConfirmed } from './ajo-reauth';
import { actor, fail, hasAjoPermission } from './ajo-members.controller';
import { approvePayout, completeGroup, getPayout, listOwnPayouts, listPayouts, preparePayout, prepareAllReady, previewPayout, recordPayoutPaid, reversePaidPayout, voidPayout } from './ajo-payout.service';
import { listAssociationLevy } from './ajo-levy.service';

export { uploadProof };

const id = z.coerce.number().int().positive();
const flag = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional());
const target = z.object({ round: z.coerce.number().int().positive().optional(), membershipId: z.coerce.number().int().positive().optional() });

export const ajoPayoutsController = {
  async preview(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      return res.json({ success: true, data: await previewPayout({ associationId, groupId: id.parse(req.params.id), ...target.parse(req.query) }) });
    } catch (error) {
      return fail(res, error, 'Could not work out the payout.');
    }
  },

  async list(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const q = z.object({ status: z.enum(['PREPARED', 'APPROVED', 'PAID', 'VOID', 'REVERSED']).optional(), round: z.coerce.number().int().positive().optional() }).parse(req.query);
      return res.json({ success: true, data: await listPayouts({ associationId, groupId: id.parse(req.params.id), ...q }) });
    } catch (error) {
      return fail(res, error, 'Could not load the payouts.');
    }
  },

  async mine(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      return res.json({ success: true, data: await listOwnPayouts({ associationId, userId }) });
    } catch (error) {
      return fail(res, error, 'Could not load your payouts.');
    }
  },

  async get(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      return res.json({ success: true, data: await getPayout({ associationId, payoutId: id.parse(req.params.id) }) });
    } catch (error) {
      return fail(res, error, 'Could not load the payout.');
    }
  },

  async prepare(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const result = await preparePayout({ associationId, groupId: id.parse(req.params.id), actorUserId: userId, ...target.parse(req.body ?? {}) });
      return res.status(result.replayed ? 200 : 201).json({ success: true, message: result.replayed ? 'A payout for this is already waiting.' : 'Prepared. An admin has to approve it.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not prepare the payout.');
    }
  },

  async prepareAll(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const result = await prepareAllReady({ associationId, groupId: id.parse(req.params.id), actorUserId: userId });
      return res.status(201).json({ success: true, message: `${result.prepared.length} prepared, ${result.notReady.length} not ready.`, data: result });
    } catch (error) {
      return fail(res, error, 'Could not prepare the payouts.');
    }
  },

  async approve(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      if (!(await passwordConfirmed(res, userId, req.body))) return;
      const body = z.object({ confirmSelfApproval: flag, note: z.string().max(500).optional() }).parse(req.body ?? {});
      const result = await approvePayout({ associationId, payoutId: id.parse(req.params.id), actorUserId: userId, ...body });
      return res.json({ success: true, message: result.replayed ? 'Already approved.' : 'Approved. An officer can now pay it and record the bank reference.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not approve the payout.');
    }
  },

  async void(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const { reason } = z.object({ reason: z.string() }).parse(req.body ?? {});
      const result = await voidPayout({ associationId, payoutId: id.parse(req.params.id), actorUserId: userId, actorIsAdmin: await hasAjoPermission(req, PERMISSIONS.AJO_APPROVE_PAYOUT), reason });
      return res.json({ success: true, message: result.replayed ? 'Already cancelled.' : 'Cancelled. The round is back to pending.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not cancel the payout.');
    }
  },

  async fail(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const { reason } = z.object({ reason: z.string() }).parse(req.body ?? {});
      const result = await voidPayout({ associationId, payoutId: id.parse(req.params.id), actorUserId: userId, actorIsAdmin: await hasAjoPermission(req, PERMISSIONS.AJO_APPROVE_PAYOUT), reason, failed: true });
      return res.json({ success: true, message: result.replayed ? 'Already cancelled.' : 'Marked as failed. The round is back to pending and the admins have been told.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not mark the payout as failed.');
    }
  },

  async recordPaid(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const body = z.object({ reference: z.string().max(120), confirmOwn: flag, note: z.string().max(500).optional() }).parse(req.body ?? {});
      const result = await recordPayoutPaid({ associationId, payoutId: id.parse(req.params.id), actorUserId: userId, reference: body.reference, proof: req.file ? { buffer: req.file.buffer, mimeType: req.file.mimetype } : undefined, confirmOwn: body.confirmOwn, note: body.note });
      return res.json({ success: true, message: result.replayed ? 'Already recorded.' : 'Recorded as paid.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not record the payout.');
    }
  },

  async reverse(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      if (!(await passwordConfirmed(res, userId, req.body))) return;
      const { reason } = z.object({ reason: z.string() }).parse(req.body ?? {});
      const result = await reversePaidPayout({ associationId, payoutId: id.parse(req.params.id), actorUserId: userId, reason });
      return res.json({ success: true, message: result.replayed ? 'Already reversed.' : 'Reversed. The round is back to pending and the reason stays on the record.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not reverse the payout.');
    }
  },

  async complete(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const result = await completeGroup({ associationId, groupId: id.parse(req.params.id), actorUserId: userId });
      return res.json({ success: true, message: result.replayed ? 'This group is already complete.' : 'The group is complete. Its records stay readable.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not complete the group.');
    }
  },

  /** The levy SocietyLedger has charged this association's groups, each with its calculation. For the group admin. */
  async levy(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      return res.json({ success: true, data: await listAssociationLevy(associationId) });
    } catch (error) {
      return fail(res, error, 'Could not load the levy.');
    }
  },
};

