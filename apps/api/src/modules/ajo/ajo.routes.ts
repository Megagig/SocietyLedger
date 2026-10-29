/**
 * /api/ajo: the Thrift (Ajo) add-on. Every route sits behind sign-in, the tenant and `requireAjoAccess()`, so a tenant without the add-on
 * gets MODULE_DISABLED and one whose add-on expired can read and export but not write (ADDON_EXPIRED). Later phases add their routes here.
 */
import { Request, Response, Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { AJO_MODULE, requireAjoAccess, type AjoRequest } from './ajo-access';
import { contributorCapacity, tenantKind } from './ajo-capacity';
import { ajoContributionsController as contributions, uploadProof } from './ajo-contributions.controller';
import { ajoGroupsController as groups } from './ajo-groups.controller';
import { ajoPayoutsController as payouts } from './ajo-payouts.controller';
import { ajoRiskController as risk } from './ajo-risk.controller';
import { ajoMembersController as members } from './ajo-members.controller';

const router: Router = Router();

router.use(authMiddleware);
router.use(requireAjoAccess());

/**
 * GET /api/ajo/status: what the signed-in tenant can do with Ajo right now, and how much of its contributor quota is used.
 * The apps read this to decide whether to show the write buttons, the "expired" banner and the "upgrade" prompt.
 */
router.get(
  '/status',
  requireAnyPermission([PERMISSIONS.AJO_VIEW_OWN, PERMISSIONS.AJO_MANAGE, PERMISSIONS.AJO_COLLECT]),
  async (req: Request, res: Response) => {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const capacity = await contributorCapacity(associationId);
      const kind = await tenantKind(associationId);
      const access = (req as AjoRequest).ajoAccess ?? 'FULL';
      return res.json({
        success: true,
        data: {
          module: AJO_MODULE,
          access,
          readOnly: access === 'READ_ONLY',
          tenantKind: kind,
          contributors: { limit: capacity.limit, count: capacity.count, remaining: capacity.limit === null ? null : Math.max(0, capacity.limit - capacity.count) },
        },
      });
    } catch (error) {
      console.error('Ajo status error:', error);
      return res.status(500).json({ success: false, message: 'Could not load your Ajo status.' });
    }
  },
);

// ---- approval and phone confirmation (T2.1)
router.post('/memberships/:id/approve', requirePermission(PERMISSIONS.AJO_MANAGE), members.approve);
router.post('/memberships/:id/phone-code', requirePermission(PERMISSIONS.AJO_VIEW_OWN), members.sendPhoneCode);
router.post('/memberships/:id/phone-code/confirm', requirePermission(PERMISSIONS.AJO_VIEW_OWN), members.confirmCode);

// ---- payout account and SocietyLedger verification (T2.2, T2.3). `:memberId` is a member id, or `me` for the signed-in person's own.
// A person acts on their own record; an officer with ajo.manage acts on anyone's in the association (checked in the controller).
router.get('/members/:memberId/payout-account', requirePermission(PERMISSIONS.AJO_VIEW_OWN), members.getAccount);
router.put('/members/:memberId/payout-account', requirePermission(PERMISSIONS.AJO_VIEW_OWN), members.setAccount);
router.post('/members/:memberId/payout-account/reveal', requirePermission(PERMISSIONS.AJO_VIEW_OWN), members.reveal);
router.get('/members/:memberId/verification', requirePermission(PERMISSIONS.AJO_VIEW_OWN), members.verificationStatus);
router.post('/members/:memberId/verification/resubmit', requirePermission(PERMISSIONS.AJO_MANAGE), members.resubmit);

// ---- groups, rules, schedules, order and collectors (T3). Reading is open to anyone with an Ajo permission (the service narrows it to
// groups they belong to); writing needs ajo.manage, and the admin-only decisions need ajo.approve_payout.
const readers = requireAnyPermission([PERMISSIONS.AJO_VIEW_OWN, PERMISSIONS.AJO_MANAGE, PERMISSIONS.AJO_COLLECT]);
const manage = requirePermission(PERMISSIONS.AJO_MANAGE);
const approve = requirePermission(PERMISSIONS.AJO_APPROVE_PAYOUT);

router.get('/me', readers, groups.mine);
router.get('/people', manage, groups.people);
router.get('/collector-candidates', manage, groups.collectorCandidates);
router.get('/groups', readers, groups.list);
router.post('/groups', manage, groups.create);
router.get('/groups/:id', readers, groups.detail);
router.patch('/groups/:id', manage, groups.update);
router.post('/groups/:id/open', manage, groups.open);
router.post('/groups/:id/start', manage, groups.start);
router.post('/groups/:id/cancel', manage, groups.cancel);
router.get('/groups/:id/bank-account', readers, groups.bankAccount);

router.get('/groups/:id/members', manage, groups.members);
router.post('/groups/:id/members', manage, groups.addMember);
router.post('/groups/:id/members/bulk', manage, groups.bulkAdd);
router.patch('/memberships/:id/shares', manage, groups.setShares);
router.post('/memberships/:id/leave', readers, groups.leave);
router.get('/memberships/:id/installments', readers, groups.installments);

router.get('/groups/:id/rules', readers, groups.rules);
router.post('/groups/:id/rules', manage, groups.publishRules);
router.get('/memberships/:id/rules-to-accept', readers, groups.rulesToAccept);
router.post('/memberships/:id/accept-rules', readers, groups.acceptRules);
router.get('/memberships/:id/guarantor-wording', manage, groups.guarantorWording);
router.post('/memberships/:id/guarantor', manage, groups.recordGuarantor);

router.post('/groups/:id/draw', manage, groups.draw);
router.get('/groups/:id/order', readers, groups.order);
router.post('/groups/:id/swaps', readers, groups.requestSwap);
router.get('/groups/:id/swaps', manage, groups.swaps);
router.post('/swaps/:id/decision', approve, groups.decideSwap);
router.post('/groups/:id/exceptions', approve, groups.exception);

router.post('/memberships/:id/collector', manage, groups.assignCollector);
router.delete('/memberships/:id/collector', manage, groups.unassignCollector);
router.get('/groups/:id/collectors', manage, groups.groupCollectors);
router.get('/collector/contributors', requirePermission(PERMISSIONS.AJO_COLLECT), groups.myContributors);

// ---- contributions and collections (T4). Only confirmed money counts; every record needs an Idempotency-Key header.
const reconcile = requirePermission(PERMISSIONS.AJO_RECONCILE);
const officers = requireAnyPermission([PERMISSIONS.AJO_RECONCILE, PERMISSIONS.AJO_MANAGE]);
const collect = requirePermission(PERMISSIONS.AJO_COLLECT);

router.post('/groups/:id/contributions/cash', collect, contributions.cash);
router.post('/groups/:id/contributions/transfer', requireAnyPermission([PERMISSIONS.AJO_CONTRIBUTE, PERMISSIONS.AJO_MANAGE]), uploadProof, contributions.transfer);
router.get('/groups/:id/contributions', officers, contributions.groupQueue);
router.get('/memberships/:id/contributions', readers, contributions.membershipHistory);
router.post('/contributions/:id/confirm', reconcile, contributions.confirm);
router.post('/contributions/:id/reject', reconcile, contributions.reject);
router.post('/contributions/:id/reverse', reconcile, contributions.reverse);
router.get('/contributions/:id/proof', readers, contributions.proof);
router.get('/contributions/:id/receipts', readers, contributions.receipts);
router.post('/receipts/send-queued', manage, contributions.sendQueuedReceipts);

router.get('/groups/:id/collector-day', requireAnyPermission([PERMISSIONS.AJO_COLLECT, PERMISSIONS.AJO_RECONCILE, PERMISSIONS.AJO_MANAGE]), contributions.day);
router.post('/groups/:id/handovers', collect, contributions.handOver);
router.get('/groups/:id/handovers', officers, contributions.handovers);
router.get('/handovers/:id', officers, contributions.handover);
router.post('/handovers/:id/reconcile', reconcile, contributions.reconcile);

// ---- payouts (T5). SocietyLedger never sends money: these routes prepare, approve and RECORD what the group paid from its own account.
const anyPayoutRole = requireAnyPermission([PERMISSIONS.AJO_MANAGE, PERMISSIONS.AJO_RECONCILE, PERMISSIONS.AJO_APPROVE_PAYOUT]);
const admin = requirePermission(PERMISSIONS.AJO_APPROVE_PAYOUT);

router.get('/payouts/mine', readers, payouts.mine);
router.get('/levy', requireAnyPermission([PERMISSIONS.AJO_MANAGE, PERMISSIONS.AJO_APPROVE_PAYOUT]), payouts.levy);
router.get('/groups/:id/payouts/preview', anyPayoutRole, payouts.preview);
router.get('/groups/:id/payouts', anyPayoutRole, payouts.list);
router.post('/groups/:id/payouts', manage, payouts.prepare);
router.post('/groups/:id/payouts/prepare-all', manage, payouts.prepareAll);
router.post('/groups/:id/complete', admin, payouts.complete);
router.get('/payouts/:id', anyPayoutRole, payouts.get);
router.post('/payouts/:id/approve', admin, payouts.approve);
router.post('/payouts/:id/void', requireAnyPermission([PERMISSIONS.AJO_MANAGE, PERMISSIONS.AJO_APPROVE_PAYOUT]), payouts.void);
router.post('/payouts/:id/fail', reconcile, payouts.fail);
router.post('/payouts/:id/record-paid', reconcile, uploadProof, payouts.recordPaid);
router.post('/payouts/:id/reverse', admin, payouts.reverse);

// ---- late fees, disputes, default cases, repayment plans and the trust score (T6)
const anyOfficer = requireAnyPermission([PERMISSIONS.AJO_MANAGE, PERMISSIONS.AJO_RECONCILE]);

router.get('/memberships/:id/late-fees', readers, risk.memberLateFees);
router.get('/groups/:id/late-fees', anyOfficer, risk.groupLateFees);
router.post('/late-fees/:id/waive', manage, risk.waive);
router.post('/late-fees/:id/reverse-waiver', manage, risk.reverseWaiver);
router.post('/late-fees/:id/told', manage, risk.told);

router.post('/memberships/:id/disputes', readers, uploadProof, risk.raiseDispute);
router.get('/memberships/:id/disputes', readers, risk.memberDisputes);
router.get('/groups/:id/disputes', anyOfficer, risk.groupDisputes);
router.post('/disputes/:id/resolve', anyOfficer, risk.resolveDispute);
router.get('/disputes/:id/evidence', readers, risk.evidence);

router.get('/groups/:id/cases', requireAnyPermission([PERMISSIONS.AJO_MANAGE, PERMISSIONS.AJO_APPROVE_PAYOUT]), risk.groupCases);
router.get('/memberships/:id/cases', readers, risk.memberCases);
router.get('/cases/:id', requireAnyPermission([PERMISSIONS.AJO_MANAGE, PERMISSIONS.AJO_APPROVE_PAYOUT]), risk.getCase);
router.post('/memberships/:id/cases', manage, risk.openCase);
router.post('/cases/:id/notes', manage, risk.note);
router.post('/cases/:id/member-response', readers, risk.memberResponse);
router.post('/cases/:id/plan', manage, risk.draftPlan);
router.post('/plans/:id/agree', readers, risk.agree);
router.post('/plans/:id/cancel', manage, risk.cancelPlan);
router.post('/cases/:id/close', admin, risk.close);

router.get('/memberships/:id/trust', readers, risk.memberTrust);
router.get('/groups/:id/trust', anyOfficer, risk.groupTrust);

export default router;
