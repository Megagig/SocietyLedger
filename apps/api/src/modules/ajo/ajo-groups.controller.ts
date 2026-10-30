/**
 * HTTP layer for Ajo groups, rules, schedules, payout order, guarantors and collectors (T3). Thin on purpose: every rule lives in the
 * services. Route-level permission checks are in ajo.routes.ts; checks that depend on whose record it is (the member themselves, or an
 * officer) are made here.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { ModuleFeatureService } from '../../services/module-feature.service';
import { RuleError } from '../finance/rule-error';
import { assignCollector, listAssignedContributors, listGroupAssignments, unassignCollector } from './ajo-collector.service';
import { createGuarantorLink } from './ajo-guarantor-link.service';
import { bulkAddContributors, MAX_BULK_ROWS } from './ajo-bulk.service';
import { acceptRules, previewGuarantorWording, recordGuarantorConsent, rulesToAccept } from './ajo-consent.service';
import { cancelGroup, createGroup, getGroupBankAccount, getGroupDetail, listGroups, openGroup, startGroup, updateGroup, assertGroupVisible } from './ajo-group.service';
import { actor, assertSelfOrManager, canManage, fail } from './ajo-members.controller';
import { addMember, leaveMembership, setShares } from './ajo-membership.service';
import { decideSwap, emergencyException, getOrder, listSwapRequests, requestSwap, runDraw } from './ajo-order.service';
import { acceptanceStats, listRuleVersions, publishRuleVersion } from './ajo-rules.service';
import { listGroupMembers, listMembershipInstallments, listCollectorCandidates, listGroupPeople, listMyMemberships, searchPeople } from './ajo-views.service';

const id = z.coerce.number().int().positive();

/** Kobo may arrive as a JSON number or as a string (a large amount). Both become a bigint. */
const kobo = z.union([z.number().int().nonnegative(), z.string().regex(/^[0-9]+$/)]).transform((v) => BigInt(v));
const koboNullable = kobo.nullable();

const bankSchema = z.object({ bankName: z.string(), accountNumber: z.string(), accountName: z.string() });

const rulesSchema = z
  .object({
    lateFeeType: z.enum(['NONE', 'FIXED', 'PERCENT']),
    lateFeeValue: kobo,
    lateFeeCapKobo: koboNullable,
    graceDays: z.number().int(),
    guarantorPolicy: z.enum(['NOT_REQUIRED', 'OPTIONAL', 'REQUIRED']),
    defaultProcedure: z.enum(['NOTIFY_ADMIN', 'REPAYMENT_PLAN', 'CASE_AND_PLAN']),
    remindersEnabled: z.boolean(),
    blockAtRiskEarly: z.boolean(),
    memberVisibility: z.enum(['FULL', 'OFF']),
    nameDisplay: z.enum(['FIRST_INITIAL', 'FULL']),
  })
  .partial();

const fieldsSchema = z
  .object({
    name: z.string(),
    model: z.enum(['COLLECTOR_THRIFT', 'ROTATING_POT']),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'CUSTOM']),
    intervalCount: z.number().int().nullable(),
    intervalUnit: z.enum(['DAYS', 'WEEKS', 'MONTHS']).nullable(),
    contributionKobo: kobo,
    startDate: z.string(),
    cycleLength: z.number().int().nullable(),
    maxParticipants: z.number().int(),
    collectorFeeType: z.enum(['NONE', 'FIXED', 'PERCENT', 'DAYS']),
    collectorFeeValue: kobo,
    timezone: z.string(),
    cutoffTime: z.string(),
    requirePhoneConfirm: z.boolean(),
    maxSharesPerMember: z.number().int(),
    allowLateJoin: z.boolean(),
  })
  .partial();

const createSchema = fieldsSchema.extend({ bank: bankSchema.optional(), rules: rulesSchema.optional() });
const updateSchema = fieldsSchema.extend({ bank: bankSchema.optional() });

const MODEL_FEATURE = { COLLECTOR_THRIFT: 'ajo.collector_thrift', ROTATING_POT: 'ajo.rotating_pot' } as const;

/** A tier that does not include the model's feature cannot create or run groups of that kind. Read access is never affected. */
async function assertModelEntitled(associationId: number, model: keyof typeof MODEL_FEATURE): Promise<void> {
  if (!(await ModuleFeatureService.isFeatureEnabled(associationId, MODEL_FEATURE[model]))) {
    throw new RuleError(`Your Ajo plan does not include ${model === 'ROTATING_POT' ? 'the rotating pot' : 'collector thrift'}. Move to a tier that does.`, 403, 'FEATURE_NOT_IN_PLAN');
  }
}

async function groupModelOf(associationId: number, groupId: number) {
  const group = await prisma.ajoGroup.findFirst({ where: { id: groupId, associationId }, select: { model: true } });
  if (!group) throw new RuleError('That circle was not found.', 404, 'GROUP_NOT_FOUND');
  return group.model;
}

async function viewer(req: Request) {
  const { userId, associationId } = actor(req);
  return { userId, associationId, isManager: await canManage(req) };
}

const jsonSafe = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));

export const ajoGroupsController = {
  // ---- groups
  async list(req: Request, res: Response) {
    try {
      return res.json({ success: true, data: await listGroups(await viewer(req)) });
    } catch (error) {
      return fail(res, error, 'Could not load the groups.');
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const { bank, rules, ...fields } = createSchema.parse(req.body);
      if (fields.model) await assertModelEntitled(associationId, fields.model);
      const group = await createGroup({ associationId, actorUserId: userId, fields, bank, rules });
      return res.status(201).json({ success: true, message: 'Group created as a draft.', data: group });
    } catch (error) {
      return fail(res, error, 'Could not create the group.');
    }
  },

  async detail(req: Request, res: Response) {
    try {
      return res.json({ success: true, data: await getGroupDetail({ ...(await viewer(req)), groupId: id.parse(req.params.id) }) });
    } catch (error) {
      return fail(res, error, 'Could not load the group.');
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const { bank, ...fields } = updateSchema.parse(req.body);
      const result = await updateGroup({ associationId, groupId: id.parse(req.params.id), actorUserId: userId, fields, bank });
      return res.json({ success: true, message: result.replayed ? 'Nothing changed.' : 'Group updated.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not update the group.');
    }
  },

  async open(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const groupId = id.parse(req.params.id);
      await assertModelEntitled(associationId, await groupModelOf(associationId, groupId));
      return res.json({ success: true, message: 'The group is open. You can add people now.', data: await openGroup({ associationId, groupId, actorUserId: userId }) });
    } catch (error) {
      return fail(res, error, 'Could not open the group.');
    }
  },

  async start(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const groupId = id.parse(req.params.id);
      await assertModelEntitled(associationId, await groupModelOf(associationId, groupId));
      const body = z.object({ confirmSmallerGroup: z.boolean().optional() }).parse(req.body ?? {});
      const result = await startGroup({ associationId, groupId, actorUserId: userId, confirmSmallerGroup: body.confirmSmallerGroup });
      return res.json({ success: true, message: result.replayed ? 'This group has already started.' : 'The group has started and every schedule is ready.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not start the group.');
    }
  },

  async cancel(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const { reason } = z.object({ reason: z.string() }).parse(req.body ?? {});
      return res.json({ success: true, message: 'The group was cancelled.', data: await cancelGroup({ associationId, groupId: id.parse(req.params.id), actorUserId: userId, reason }) });
    } catch (error) {
      return fail(res, error, 'Could not cancel the group.');
    }
  },

  /** The group's full account number, for members and officers who pay into it. Never cached. */
  async bankAccount(req: Request, res: Response) {
    try {
      const data = await getGroupBankAccount({ ...(await viewer(req)), groupId: id.parse(req.params.id) });
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Could not show the bank account.');
    }
  },

  // ---- people
  async members(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      return res.json({ success: true, data: await listGroupMembers({ associationId, groupId: id.parse(req.params.id) }) });
    } catch (error) {
      return fail(res, error, 'Could not load the people in this group.');
    }
  },

  async addMember(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ memberId: id, shares: z.number().int().optional(), amountKobo: kobo.optional() }).parse(req.body);
      const membership = await addMember({ associationId, groupId: id.parse(req.params.id), memberId: body.memberId, actorUserId: userId, shares: body.shares, amountKobo: body.amountKobo });
      return res.status(201).json({ success: true, message: 'Added. They need the group to approve them.', data: { membershipId: membership.id, status: membership.status, shares: membership.shares } });
    } catch (error) {
      return fail(res, error, 'Could not add this person.');
    }
  },

  /** Add a list of people to a group, creating them if they are new (setup and onboarding). Each row is answered on its own. */
  async bulkAdd(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ items: z.array(z.record(z.unknown())).min(1).max(MAX_BULK_ROWS), approve: z.boolean().default(false), acceptRulesOnBehalf: z.boolean().default(false) }).parse(req.body);
      const result = await bulkAddContributors({ associationId, groupId: id.parse(req.params.id), actorUserId: userId, items: body.items, approve: body.approve, acceptRulesOnBehalf: body.acceptRulesOnBehalf });
      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      return fail(res, error, 'Could not add these people.');
    }
  },

  async setShares(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const { shares } = z.object({ shares: z.number().int() }).parse(req.body);
      return res.json({ success: true, data: await setShares({ associationId, membershipId: id.parse(req.params.id), shares, actorUserId: userId }) });
    } catch (error) {
      return fail(res, error, 'Could not change the shares.');
    }
  },

  async leave(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      await assertSelfOrManager(req, membershipId);
      const { reason } = z.object({ reason: z.string().max(300).optional() }).parse(req.body ?? {});
      const result = await leaveMembership({ associationId, membershipId, actorUserId: userId, reason });
      return res.json({ success: true, message: result.replayed ? 'Already left.' : 'They have left the group.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not remove this person.');
    }
  },

  /** The signed-in person’s own memberships, with what is next for each (the start of every member screen). */
  async mine(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      return res.json({ success: true, data: await listMyMemberships({ associationId, userId }) });
    } catch (error) {
      return fail(res, error, 'Could not load your groups.');
    }
  },

  /** Every circle one person is, or was, in (officers only): the "Circles" view on a person's page. */
  async memberCircles(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      return res.json({ success: true, data: await listMyMemberships({ associationId, memberId: id.parse(req.params.memberId) }) });
    } catch (error) {
      return fail(res, error, "Could not load this person's circles.");
    }
  },

  /** Association members who can be added to a group (officers only). */
  async people(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const search = z.string().max(80).optional().parse(req.query.search);
      return res.json({ success: true, data: await searchPeople({ associationId, search }) });
    } catch (error) {
      return fail(res, error, 'Could not search the members.');
    }
  },

  async collectorCandidates(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      return res.json({ success: true, data: await listCollectorCandidates(associationId) });
    } catch (error) {
      return fail(res, error, 'Could not load the collectors.');
    }
  },

  /** Names only, for officers who cannot manage members but still need to know whose row they are looking at. */
  async groupPeople(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      return res.json({ success: true, data: await listGroupPeople({ associationId, groupId: id.parse(req.params.id) }) });
    } catch (error) {
      return fail(res, error, 'Could not load the people.');
    }
  },

  async installments(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      const m = await prisma.ajoMembership.findFirst({ where: { id: membershipId, associationId }, select: { member: { select: { userId: true } } } });
      if (!m) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
      if (m.member.userId !== userId && !(await canManage(req))) {
        // A collector may see the schedule of someone currently assigned to them, and nobody else's.
        const today = new Date();
        const assigned = await prisma.ajoCollectorAssignment.findFirst({ where: { membershipId, collectorUserId: userId, startsOn: { lte: today }, OR: [{ endsOn: null }, { endsOn: { gte: today } }] }, select: { id: true } });
        if (!assigned) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
      }
      return res.json({ success: true, data: await listMembershipInstallments({ associationId, membershipId }) });
    } catch (error) {
      return fail(res, error, 'Could not load the schedule.');
    }
  },

  // ---- rules and consent
  async rules(req: Request, res: Response) {
    try {
      const v = await viewer(req);
      const group = await assertGroupVisible({ ...v, groupId: id.parse(req.params.id) });
      const [versions, stats] = await Promise.all([listRuleVersions(prisma, group.id), v.isManager ? acceptanceStats(prisma, group.id) : Promise.resolve(null)]);
      return res.json({ success: true, data: jsonSafe({ versions, ...(stats ? { acceptance: stats } : {}) }) });
    } catch (error) {
      return fail(res, error, 'Could not load the rules.');
    }
  },

  async publishRules(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ effectiveFrom: z.string().datetime().optional(), rules: rulesSchema }).parse(req.body);
      const result = await publishRuleVersion({ associationId, groupId: id.parse(req.params.id), actorUserId: userId, rules: body.rules, effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined });
      return res.status(201).json({ success: true, message: 'New rules published. Members have been told.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not publish the rules.');
    }
  },

  async rulesToAccept(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      await assertSelfOrManager(req, membershipId);
      return res.json({ success: true, data: await rulesToAccept(prisma, { associationId, membershipId }) });
    } catch (error) {
      return fail(res, error, 'Could not load the rules to accept.');
    }
  },

  async acceptRules(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const membershipId = id.parse(req.params.id);
      await assertSelfOrManager(req, membershipId);
      const body = z.object({ ruleVersionId: id.optional(), note: z.string().max(300).optional(), device: z.string().max(80).optional() }).parse(req.body ?? {});
      const result = await acceptRules({ associationId, membershipId, actorUserId: userId, actorIsOfficer: await canManage(req), ...body });
      return res.json({ success: true, message: result.activation.activated ? 'Rules accepted. They are in.' : 'Rules accepted.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not record the acceptance.');
    }
  },

  async guarantorWording(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const name = z.string().max(120).default('').parse(req.query.name ?? '');
      return res.json({ success: true, data: { wording: await previewGuarantorWording({ associationId, membershipId: id.parse(req.params.id), guarantorName: name }) } });
    } catch (error) {
      return fail(res, error, 'Could not load the guarantor wording.');
    }
  },

  async recordGuarantor(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ name: z.string(), phone: z.string(), relationship: z.string(), note: z.string() }).parse(req.body);
      const result = await recordGuarantorConsent({ associationId, membershipId: id.parse(req.params.id), actorUserId: userId, ...body });
      return res.status(201).json({ success: true, message: 'The guarantor’s consent is recorded.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not record the guarantor.');
    }
  },

  // ---- payout order (rotating pot)
  /** An officer creates a one-time link for a guarantor. The link is shown once. */
  async guarantorLink(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ name: z.string(), phone: z.string(), relationship: z.string() }).parse(req.body);
      const made = await createGuarantorLink({ associationId, membershipId: id.parse(req.params.id), actorUserId: userId, ...body });
      const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(201).json({ success: true, message: 'The link is ready. Send it to the guarantor; it works once and expires in 7 days.', data: { link: `${base}/guarantor/${made.token}`, expiresAt: made.expiresAt, wording: made.wording } });
    } catch (error) {
      return fail(res, error, 'Could not create the link.');
    }
  },

  async draw(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const result = await runDraw({ associationId, groupId: id.parse(req.params.id), actorUserId: userId });
      return res.status(201).json({ success: true, message: 'The order has been drawn. Everyone can see the result and the seed.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not run the draw.');
    }
  },

  async order(req: Request, res: Response) {
    try {
      const v = await viewer(req);
      const group = await assertGroupVisible({ ...v, groupId: id.parse(req.params.id) });
      return res.json({ success: true, data: jsonSafe(await getOrder(prisma, group.id, v.userId)) });
    } catch (error) {
      return fail(res, error, 'Could not load the payout order.');
    }
  },

  async requestSwap(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ slotAId: id, slotBId: id, reason: z.string().max(300).optional() }).parse(req.body);
      const result = await requestSwap({ associationId, groupId: id.parse(req.params.id), actorUserId: userId, actorIsOfficer: await canManage(req), ...body });
      return res.status(201).json({ success: true, message: 'Swap requested. The admin decides.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not request the swap.');
    }
  },

  async swaps(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      const groupId = id.parse(req.params.id);
      await groupModelOf(associationId, groupId);
      const status = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional().parse(req.query.status);
      return res.json({ success: true, data: await listSwapRequests(prisma, groupId, status) });
    } catch (error) {
      return fail(res, error, 'Could not load the swap requests.');
    }
  },

  async decideSwap(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), note: z.string().max(300).optional() }).parse(req.body);
      const result = await decideSwap({ associationId, requestId: id.parse(req.params.id), actorUserId: userId, ...body });
      return res.json({ success: true, message: result.applied ? 'Swap approved and applied.' : 'Swap rejected.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not decide the swap.');
    }
  },

  async exception(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ slotId: id, newPosition: id, reason: z.string() }).parse(req.body);
      const result = await emergencyException({ associationId, groupId: id.parse(req.params.id), actorUserId: userId, ...body });
      return res.status(201).json({ success: true, message: 'The exception is recorded and the group has been told.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not record the exception.');
    }
  },

  // ---- collectors
  async assignCollector(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      const body = z.object({ collectorUserId: id, dailyTargetKobo: koboNullable.optional(), startsOn: z.string().optional() }).parse(req.body);
      const result = await assignCollector({ associationId, membershipId: id.parse(req.params.id), actorUserId: userId, collectorUserId: body.collectorUserId, dailyTargetKobo: body.dailyTargetKobo, startsOn: body.startsOn ? new Date(`${body.startsOn}T00:00:00.000Z`) : undefined });
      return res.json({ success: true, message: result.replayed ? 'Nothing changed.' : 'Collector assigned.', data: result });
    } catch (error) {
      return fail(res, error, 'Could not assign the collector.');
    }
  },

  async unassignCollector(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      return res.json({ success: true, data: await unassignCollector({ associationId, membershipId: id.parse(req.params.id), actorUserId: userId }) });
    } catch (error) {
      return fail(res, error, 'Could not remove the collector.');
    }
  },

  async groupCollectors(req: Request, res: Response) {
    try {
      const { associationId } = actor(req);
      return res.json({ success: true, data: await listGroupAssignments({ associationId, groupId: id.parse(req.params.id) }) });
    } catch (error) {
      return fail(res, error, 'Could not load the assignments.');
    }
  },

  /** The signed-in collector's own contributors, and no one else's. */
  async myContributors(req: Request, res: Response) {
    try {
      const { userId, associationId } = actor(req);
      return res.json({ success: true, data: await listAssignedContributors({ associationId, collectorUserId: userId }) });
    } catch (error) {
      return fail(res, error, 'Could not load your contributors.');
    }
  },
};
