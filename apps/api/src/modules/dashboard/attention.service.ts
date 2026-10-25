import { prisma } from '../../lib/prisma';
import { PERMISSIONS } from '../../lib/permissions';
import { RBACService, type RBACContext } from '../../services/rbac.service';
import { ModuleFeatureService } from '../../services/module-feature.service';
import { overdueWhere } from '../finance/overdue-rules';

/**
 * "Needs your attention": how many things are waiting on the signed-in officer, one count per kind of queue. Each kind is
 * only counted when the officer may open that queue and its module is on for the association, so a count is never shown
 * to someone who could not act on it. Kinds with nothing waiting are left out.
 */
export type AttentionKey =
  | 'paymentProofs'
  | 'bankTransfers'
  | 'memberApprovals'
  | 'cashLodgments'
  | 'overdueCharges'
  | 'supportTickets'
  | 'loanApplications'
  | 'loanRepayments'
  | 'savingsDeposits'
  | 'welfarePayouts'
  | 'welfareContributions'
  | 'electionNominations'
  | 'electionsToClose'
  | 'electionResults'
  | 'journalEntries'
  | 'expenses';

export interface AttentionItem {
  key: AttentionKey;
  count: number;
}

type CountArgs = { associationId: number; userId: number };

interface AttentionSource {
  key: AttentionKey;
  /** The officer needs at least one of these. */
  permissions: string[];
  /** The module that must be on for the association. */
  module?: string;
  count: (args: CountArgs) => Promise<number>;
}

export const ATTENTION_SOURCES: AttentionSource[] = [
  {
    key: 'memberApprovals',
    permissions: [PERMISSIONS.MEMBER_EDIT_ALL],
    count: ({ associationId }) => prisma.userApproval.count({ where: { approvalStatus: 'pending', user: { associationId } } }),
  },
  {
    key: 'paymentProofs',
    permissions: [PERMISSIONS.PAYMENT_VIEW],
    count: ({ associationId }) => prisma.paymentProof.count({ where: { associationId, status: 'PENDING' } }),
  },
  {
    key: 'bankTransfers',
    permissions: [PERMISSIONS.PAYMENT_VIEW],
    count: ({ associationId }) => prisma.bankTransfer.count({ where: { associationId, status: 'PENDING' } }),
  },
  {
    // A lodgment must be checked by someone other than the officer who made it.
    key: 'cashLodgments',
    permissions: [PERMISSIONS.CASH_VERIFY],
    count: ({ associationId, userId }) => prisma.cashLodgment.count({ where: { associationId, status: 'PENDING', lodgedBy: { not: userId } } }),
  },
  {
    key: 'overdueCharges',
    permissions: [PERMISSIONS.LEDGER_VIEW],
    count: ({ associationId }) => prisma.transaction.count({ where: { associationId, ...overdueWhere() } }),
  },
  {
    key: 'supportTickets',
    permissions: [PERMISSIONS.SUPPORT_VIEW_ALL],
    count: ({ associationId }) =>
      prisma.supportTicket.count({ where: { associationId, audience: 'ASSOCIATION', status: { in: ['OPEN', 'WAITING_ON_STAFF'] } } }),
  },
  {
    key: 'loanApplications',
    permissions: [PERMISSIONS.COOPERATIVE_LOANS_MANAGE],
    module: 'cooperatives',
    count: ({ associationId }) =>
      prisma.loanApplication.count({ where: { associationId, status: { in: ['PENDING_REVIEW', 'UNDER_REVIEW', 'PENDING_APPROVAL'] } } }),
  },
  {
    key: 'loanRepayments',
    permissions: [PERMISSIONS.COOPERATIVE_LOANS_MANAGE],
    module: 'cooperatives',
    count: ({ associationId }) => prisma.loanRepaymentRequest.count({ where: { associationId, status: 'PENDING' } }),
  },
  {
    key: 'savingsDeposits',
    permissions: [PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE],
    module: 'cooperatives',
    count: ({ associationId }) => prisma.savingsDepositRequest.count({ where: { associationId, status: 'PENDING' } }),
  },
  {
    key: 'welfarePayouts',
    permissions: [PERMISSIONS.WELFARE_PAYOUT_APPROVE],
    module: 'welfare',
    count: ({ associationId }) => prisma.welfarePayoutRequest.count({ where: { associationId, status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
  },
  {
    // Contributions waiting to be confirmed — not the ones this officer recorded, because they can't confirm those.
    key: 'welfareContributions',
    permissions: [PERMISSIONS.WELFARE_CONTRIBUTION_CONFIRM],
    module: 'welfare',
    count: ({ associationId, userId }) =>
      prisma.welfareContribution.count({
        where: { associationId, status: 'PENDING', OR: [{ recordedBy: null }, { recordedBy: { not: userId } }] },
      }),
  },
  {
    // Nominations waiting for a decision before voting opens — not the officer's own, because they can't decide those.
    key: 'electionNominations',
    permissions: [PERMISSIONS.ELECTION_CANDIDATES],
    module: 'voting',
    count: ({ associationId, userId }) =>
      prisma.candidate.count({
        where: {
          status: 'PENDING',
          election: { associationId, status: { in: ['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED'] } },
          NOT: { member: { userId } },
        },
      }),
  },
  {
    // Voting that has run past its end date and is still open.
    key: 'electionsToClose',
    permissions: [PERMISSIONS.ELECTION_RUN],
    module: 'voting',
    count: ({ associationId }) => prisma.election.count({ where: { associationId, status: 'VOTING_OPEN', votingEndDate: { lt: new Date() } } }),
  },
  {
    // Journal entries to approve (not the officer's own, because they can't approve those) and approved ones still to post.
    key: 'journalEntries',
    permissions: [PERMISSIONS.FINANCE_APPROVE],
    module: 'accounting',
    count: ({ associationId, userId }) =>
      prisma.journalEntry.count({
        where: { associationId, OR: [{ status: 'PENDING_APPROVAL', createdBy: { not: userId } }, { status: 'APPROVED' }] },
      }),
  },
  {
    // Expenses waiting for a second officer to approve (not the officer's own, because they can't approve those).
    key: 'expenses',
    permissions: [PERMISSIONS.FINANCE_APPROVE],
    module: 'accounting',
    count: ({ associationId, userId }) => prisma.expenseVoucher.count({ where: { associationId, status: 'PENDING_APPROVAL', createdBy: { not: userId } } }),
  },
  {
    key: 'electionResults',
    permissions: [PERMISSIONS.ELECTION_RESULTS_PUBLISH],
    module: 'voting',
    count: ({ associationId }) => prisma.election.count({ where: { associationId, status: 'VOTING_CLOSED' } }),
  },
];

export const attentionService = {
  async getAttention(context: RBACContext & { associationId: number }): Promise<AttentionItem[]> {
    const { associationId, userId } = context;
    const moduleOn = new Map<string, Promise<boolean>>();
    const isModuleOn = (code: string) => {
      if (!moduleOn.has(code)) moduleOn.set(code, ModuleFeatureService.isModuleEnabled(associationId, code));
      return moduleOn.get(code)!;
    };

    const counted = await Promise.all(
      ATTENTION_SOURCES.map(async (source): Promise<AttentionItem | null> => {
        try {
          if (!(await RBACService.hasAnyPermission(context, source.permissions))) return null;
          if (source.module && !(await isModuleOn(source.module))) return null;
          const count = await source.count({ associationId, userId });
          return count > 0 ? { key: source.key, count } : null;
        } catch (error) {
          // One failing count must not blank the whole list.
          console.error(`Attention count failed for ${source.key}:`, error);
          return null;
        }
      }),
    );
    return counted.filter((item): item is AttentionItem => item !== null);
  },
};
