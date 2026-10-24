/**
 * The welfare queues on "Needs your attention": payouts waiting for a decision, and contributions waiting to be confirmed (not the
 * ones the officer recorded themselves, because they can't confirm those).
 */
const count = () => jest.fn(async () => 0);
const prismaMock: any = {
  userApproval: { count: count() },
  paymentProof: { count: count() },
  bankTransfer: { count: count() },
  cashLodgment: { count: count() },
  transaction: { count: count() },
  supportTicket: { count: count() },
  loanApplication: { count: count() },
  loanRepaymentRequest: { count: count() },
  savingsDepositRequest: { count: count() },
  welfarePayoutRequest: { count: count() },
  welfareContribution: { count: count() },
  candidate: { count: count() },
  election: { count: count() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('../../src/services/rbac.service', () => ({ RBACService: { hasAnyPermission: jest.fn() } }));
jest.mock('../../src/services/module-feature.service', () => ({ ModuleFeatureService: { isModuleEnabled: jest.fn() } }));

import { attentionService } from '../../src/modules/dashboard/attention.service';
import { RBACService } from '../../src/services/rbac.service';
import { ModuleFeatureService } from '../../src/services/module-feature.service';
import { PERMISSIONS } from '../../src/lib/permissions';

const context = { userId: 5, associationId: 9, platformRole: null };

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(prismaMock).forEach((m: any) => m.count.mockResolvedValue(0));
  (ModuleFeatureService.isModuleEnabled as jest.Mock).mockResolvedValue(true);
});

describe('election attention', () => {
  it('counts nominations to decide for the committee, leaving out their own, and only while the voting module is on', async () => {
    (RBACService.hasAnyPermission as jest.Mock).mockImplementation(async (_c: unknown, wanted: string[]) => wanted.includes(PERMISSIONS.ELECTION_CANDIDATES));
    prismaMock.candidate.count.mockResolvedValue(4);
    expect(await attentionService.getAttention(context)).toEqual([{ key: 'electionNominations', count: 4 }]);
    const where = prismaMock.candidate.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: 'PENDING', election: { associationId: 9 }, NOT: { member: { userId: 5 } } });
    expect(where.election.status.in).toEqual(['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED']);

    (ModuleFeatureService.isModuleEnabled as jest.Mock).mockImplementation(async (_a: number, code: string) => code !== 'voting');
    prismaMock.candidate.count.mockClear();
    expect(await attentionService.getAttention(context)).toEqual([]);
    expect(prismaMock.candidate.count).not.toHaveBeenCalled();
  });

  it('shows voting to close and results to publish only to the people who can do those', async () => {
    (RBACService.hasAnyPermission as jest.Mock).mockImplementation(async (_c: unknown, wanted: string[]) => wanted.includes(PERMISSIONS.ELECTION_RUN));
    prismaMock.election.count.mockResolvedValue(1);
    expect((await attentionService.getAttention(context)).map((i) => i.key)).toEqual(['electionsToClose']);
    (RBACService.hasAnyPermission as jest.Mock).mockImplementation(async (_c: unknown, wanted: string[]) => wanted.includes(PERMISSIONS.ELECTION_RESULTS_PUBLISH));
    expect((await attentionService.getAttention(context)).map((i) => i.key)).toEqual(['electionResults']);
  });

  it('a member without those permissions sees none of it', async () => {
    (RBACService.hasAnyPermission as jest.Mock).mockResolvedValue(false);
    prismaMock.candidate.count.mockResolvedValue(4);
    prismaMock.election.count.mockResolvedValue(2);
    expect(await attentionService.getAttention(context)).toEqual([]);
  });
});

describe('welfare attention', () => {
  it('counts contributions to confirm for an officer who may confirm them, leaving out the ones they recorded', async () => {
    (RBACService.hasAnyPermission as jest.Mock).mockImplementation(async (_c: unknown, wanted: string[]) => wanted.includes(PERMISSIONS.WELFARE_CONTRIBUTION_CONFIRM));
    prismaMock.welfareContribution.count.mockResolvedValue(3);
    expect(await attentionService.getAttention(context)).toEqual([{ key: 'welfareContributions', count: 3 }]);
    const where = prismaMock.welfareContribution.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ associationId: 9, status: 'PENDING' });
    expect(where.OR).toEqual([{ recordedBy: null }, { recordedBy: { not: 5 } }]);
  });

  it('an officer who may not confirm contributions never sees the count', async () => {
    (RBACService.hasAnyPermission as jest.Mock).mockResolvedValue(false);
    prismaMock.welfareContribution.count.mockResolvedValue(3);
    expect(await attentionService.getAttention(context)).toEqual([]);
    expect(prismaMock.welfareContribution.count).not.toHaveBeenCalled();
  });

  it('nothing is counted when the welfare module is off', async () => {
    (RBACService.hasAnyPermission as jest.Mock).mockResolvedValue(true);
    (ModuleFeatureService.isModuleEnabled as jest.Mock).mockImplementation(async (_a: number, code: string) => code !== 'welfare');
    prismaMock.welfareContribution.count.mockResolvedValue(3);
    prismaMock.welfarePayoutRequest.count.mockResolvedValue(2);
    const keys = (await attentionService.getAttention(context)).map((i) => i.key);
    expect(keys).not.toContain('welfareContributions');
    expect(keys).not.toContain('welfarePayouts');
  });
});
