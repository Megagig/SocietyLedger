/**
 * HTTP layer for late fees, disputes, default cases, repayment plans and the trust score (T6). Thin on purpose: every rule lives in the
 * services. Route-level permission checks are in ajo.routes.ts; checks that depend on whose record it is are made here.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { PERMISSIONS } from '../../lib/permissions';
import { RuleError } from '../finance/rule-error';
import { assertMembershipViewer } from './ajo-contributions.controller';
import { addCaseNote, agreePlan, cancelPlan, closeCase, getCase, listCases, openCase, proposePlan } from './ajo-default.service';
import { getEvidenceLink, listDisputes, raiseDispute, resolveDispute } from './ajo-dispute.service';
import { listLateFees, markFeeNotified, reverseWaiver, waiveLateFee } from './ajo-latefee.service';
import { actor, canManage, fail, hasAjoPermission } from './ajo-members.controller';
import { passwordConfirmed } from './ajo-reauth';
import { getMembershipTrust, listGroupTrust } from './ajo-trust.service';

const id = z.coerce.number().int().positive();

async function isOfficer(req: Request): Promise<boolean> {
  return (await canManage(req)) || (await hasAjoPermission(req, PERMISSIONS.AJO_RECONCILE));
}

export const ajoRiskController = {
  // ---- late fees
  async memberLateFees(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      await assertMembershipViewer(req, membershipId);
      return res.json({ success: true, data: await listLateFees({ associationId, membershipId }) });
    } catch (error) {
      return fail(res, error, 'Could not load the late fees.');
    }
  },

  async groupLateFees(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const { status } = z.object({ status: z.enum(['PENDING', 'PAYABLE', 'WAIVED', 'PAID']).optional() }).parse(req.query);
      return res.json({ success: true, data: await listLateFees({ associationId, groupId: id.parse(req.params.id), status }) });
    } catch (error) {
      return fail(res, error, 'Could not load the late fees.');
    }
  },

  async waive(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const { reason } = z.object({ reason: z.string() }).parse(req.body ?? {});
      const r = await waiveLateFee({ associationId, feeId: id.parse(req.params.id), actorUserId: userId, reason });
      return res.json({ success: true, message: r.replayed ? 'Already waived.' : 'Waived. It is never counted or charged.', data: r });
    } catch (error) {
      return fail(res, error, 'Could not waive the late fee.');
    }
  },

  async reverseWaiver(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const { reason } = z.object({ reason: z.string() }).parse(req.body ?? {});
      return res.json({ success: true, message: 'The waiver was reversed. The reason stays on the record.', data: await reverseWaiver({ associationId, feeId: id.parse(req.params.id), actorUserId: userId, reason }) });
    } catch (error) {
      return fail(res, error, 'Could not reverse the waiver.');
    }
  },

  async told(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const { note } = z.object({ note: z.string() }).parse(req.body ?? {});
      const r = await markFeeNotified({ associationId, feeId: id.parse(req.params.id), actorUserId: userId, note });
      return res.json({ success: true, message: r.replayed ? 'Already recorded.' : 'Recorded. It becomes payable after the notice window.', data: r });
    } catch (error) {
      return fail(res, error, 'Could not record that the member was told.');
    }
  },

  // ---- disputes
  async raiseDispute(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const body = z.object({ installmentId: id, claim: z.string() }).parse(req.body ?? {});
      const dispute = await raiseDispute({ associationId, membershipId: id.parse(req.params.id), installmentId: body.installmentId, claim: body.claim, evidence: req.file ? { buffer: req.file.buffer, mimeType: req.file.mimetype } : undefined, actorUserId: userId, actorCanManage: await canManage(req) });
      return res.status(201).json({ success: true, message: 'Your claim was sent. An officer will look at it and decide.', data: dispute });
    } catch (error) {
      return fail(res, error, 'Could not raise the dispute.');
    }
  },

  async memberDisputes(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      await assertMembershipViewer(req, membershipId);
      return res.json({ success: true, data: await listDisputes({ associationId, membershipId }) });
    } catch (error) {
      return fail(res, error, 'Could not load the disputes.');
    }
  },

  async groupDisputes(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const { status } = z.object({ status: z.enum(['OPEN', 'RESOLVED', 'REJECTED']).optional() }).parse(req.query);
      return res.json({ success: true, data: await listDisputes({ associationId, groupId: id.parse(req.params.id), status }) });
    } catch (error) {
      return fail(res, error, 'Could not load the disputes.');
    }
  },

  async resolveDispute(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const body = z.object({ outcome: z.enum(['UPHELD', 'NOT_UPHELD']), reason: z.string() }).parse(req.body ?? {});
      return res.json({ success: true, message: 'Decided. The member has been told.', data: await resolveDispute({ associationId, disputeId: id.parse(req.params.id), actorUserId: userId, ...body }) });
    } catch (error) {
      return fail(res, error, 'Could not decide the dispute.');
    }
  },

  async evidence(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const link = await getEvidenceLink({ associationId, disputeId: id.parse(req.params.id), viewerUserId: userId, viewerIsOfficer: await isOfficer(req), host: req.hostname });
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, data: link });
    } catch (error) {
      return fail(res, error, 'Could not open the evidence.');
    }
  },

  // ---- cases and plans
  async groupCases(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const { status } = z.object({ status: z.enum(['OPEN', 'PLAN_AGREED', 'RESOLVED', 'CLOSED_UNRESOLVED']).optional() }).parse(req.query);
      return res.json({ success: true, data: await listCases({ associationId, groupId: id.parse(req.params.id), status }) });
    } catch (error) {
      return fail(res, error, 'Could not load the cases.');
    }
  },

  async memberCases(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      await assertMembershipViewer(req, membershipId);
      return res.json({ success: true, data: await listCases({ associationId, membershipId }) });
    } catch (error) {
      return fail(res, error, 'Could not load the cases.');
    }
  },

  async getCase(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      return res.json({ success: true, data: await getCase({ associationId, caseId: id.parse(req.params.id) }) });
    } catch (error) {
      return fail(res, error, 'Could not load the case.');
    }
  },

  async openCase(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const r = await openCase({ associationId, membershipId: id.parse(req.params.id), actorUserId: userId });
      return res.status(r.created ? 201 : 200).json({ success: true, message: r.created ? 'A case was opened.' : 'There is already an open case for this person.', data: r });
    } catch (error) {
      return fail(res, error, 'Could not open the case.');
    }
  },

  async note(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const { note } = z.object({ note: z.string().max(1000) }).parse(req.body ?? {});
      return res.status(201).json({ success: true, data: await addCaseNote({ associationId, caseId: id.parse(req.params.id), actorUserId: userId, note }) });
    } catch (error) {
      return fail(res, error, 'Could not add the note.');
    }
  },

  /** The member’s own explanation, added to their case file. */
  async memberResponse(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const caseId = id.parse(req.params.id);
      const c = await prisma.ajoDefaultCase.findFirst({ where: { id: caseId, associationId }, select: { membership: { select: { member: { select: { userId: true } } } } } });
      if (!c || c.membership.member.userId !== userId) throw new RuleError('That case was not found.', 404, 'CASE_NOT_FOUND');
      const { note } = z.object({ note: z.string().max(1000) }).parse(req.body ?? {});
      return res.status(201).json({ success: true, message: 'Your explanation was added to the file.', data: await addCaseNote({ associationId, caseId, actorUserId: userId, note, fromMember: true }) });
    } catch (error) {
      return fail(res, error, 'Could not add your explanation.');
    }
  },

  async draftPlan(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const { periods } = z.object({ periods: z.number().int().min(1).max(24).optional() }).parse(req.body ?? {});
      return res.status(201).json({ success: true, message: 'A plan was drafted and offered to the member.', data: await proposePlan({ associationId, caseId: id.parse(req.params.id), actorUserId: userId, periods }) });
    } catch (error) {
      return fail(res, error, 'Could not draft the plan.');
    }
  },

  async agree(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const { note } = z.object({ note: z.string().max(500).optional() }).parse(req.body ?? {});
      const r = await agreePlan({ associationId, planId: id.parse(req.params.id), actorUserId: userId, actorCanManage: await canManage(req), note });
      return res.json({ success: true, message: r.replayed ? 'Already agreed.' : 'The plan is agreed.', data: r });
    } catch (error) {
      return fail(res, error, 'Could not agree the plan.');
    }
  },

  async cancelPlan(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      const { reason } = z.object({ reason: z.string() }).parse(req.body ?? {});
      return res.json({ success: true, message: 'The plan was cancelled.', data: await cancelPlan({ associationId, planId: id.parse(req.params.id), actorUserId: userId, reason }) });
    } catch (error) {
      return fail(res, error, 'Could not cancel the plan.');
    }
  },

  async close(req: Request, res: Response) {
    try {
      const { associationId, userId } = actor(req);
      if (!(await passwordConfirmed(res, userId, req.body))) return;
      const body = z.object({ outcome: z.enum(['RESOLVED', 'CLOSED_UNRESOLVED']), reason: z.string() }).parse(req.body ?? {});
      const r = await closeCase({ associationId, caseId: id.parse(req.params.id), actorUserId: userId, ...body });
      return res.json({ success: true, message: r.replayed ? 'Already closed.' : 'The case is closed. The reason stays on the record.', data: r });
    } catch (error) {
      return fail(res, error, 'Could not close the case.');
    }
  },

  // ---- trust
  async memberTrust(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      await assertMembershipViewer(req, membershipId);
      return res.json({ success: true, data: await getMembershipTrust({ associationId, membershipId }) });
    } catch (error) {
      return fail(res, error, 'Could not load the trust score.');
    }
  },

  async groupTrust(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      return res.json({ success: true, data: await listGroupTrust({ associationId, groupId: id.parse(req.params.id) }) });
    } catch (error) {
      return fail(res, error, 'Could not load the trust scores.');
    }
  },
};
