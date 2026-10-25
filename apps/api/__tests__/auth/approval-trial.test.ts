/**
 * Approving the founding admin is what starts the free trial. Approving anyone else, or rejecting, must not touch it, and the email that goes
 * out afterwards points at the association's own address.
 */
const userFindUnique = jest.fn();
const prismaTx = jest.fn(async (ops: unknown[]) => ops);
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a), update: jest.fn((a: unknown) => a) },
    userApproval: { update: jest.fn((a: unknown) => a) },
    $transaction: (ops: unknown[]) => prismaTx(ops),
  },
}));
jest.mock('../../src/lib/email', () => ({ sendEmail: jest.fn() }));
jest.mock('../../src/lib/auth', () => ({ hashPassword: jest.fn() }));
jest.mock('../../src/services/refresh-token.service', () => ({ revokeAllForUser: jest.fn() }));
jest.mock('../../src/services/approval-notifications', () => ({ notifyApprovalPending: jest.fn() }));

const startTrial = jest.fn();
jest.mock('../../src/services/subscription-access.service', () => ({ startTrialIfPending: (...a: unknown[]) => startTrial(...a) }));

import { sendEmail } from '../../src/lib/email';
import { sendApprovalNotificationEmail, updateUserApproval } from '../../src/modules/auth/auth.service';

const userRow = (role: string) => ({
  id: 5,
  role,
  associationId: 42,
  userApproval: { approvalStatus: 'pending' },
  association: { name: 'Oko Youth Forum', subdomain: 'oko' },
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FRONTEND_URL = 'https://societyledger.com.ng';
});

describe('updateUserApproval and the free trial', () => {
  it('starts the trial when the founding admin is approved, and reports it', async () => {
    const endsAt = new Date('2026-11-17T10:00:00.000Z');
    userFindUnique.mockResolvedValue(userRow('admin'));
    startTrial.mockResolvedValue({ trialEndsAt: endsAt, days: 14 });

    const result = await updateUserApproval(5, 'approved', 1);

    expect(startTrial).toHaveBeenCalledWith(42);
    expect(result).toMatchObject({ success: true, trial: { days: 14, endsAt } });
  });

  it('reports no trial when it had already started (a second admin approved later)', async () => {
    userFindUnique.mockResolvedValue(userRow('admin'));
    startTrial.mockResolvedValue(null);
    expect((await updateUserApproval(6, 'approved', 1)).trial).toBeNull();
  });

  it('leaves the trial alone when an ordinary member is approved, or anyone is rejected', async () => {
    userFindUnique.mockResolvedValue(userRow('member'));
    await updateUserApproval(7, 'approved', 1);
    userFindUnique.mockResolvedValue(userRow('admin'));
    await updateUserApproval(8, 'rejected', 1, 'not a real association');
    expect(startTrial).not.toHaveBeenCalled();
  });

  it('does nothing for a user that does not exist', async () => {
    userFindUnique.mockResolvedValue(null);
    expect(await updateUserApproval(99, 'approved', 1)).toEqual({ success: false, message: 'User not found' });
    expect(startTrial).not.toHaveBeenCalled();
  });
});

describe('the approval email', () => {
  it('links to the association\'s own address on the live domain, and says when the trial runs until', async () => {
    await sendApprovalNotificationEmail('ada@example.com', 'approved', 'Oko Youth Forum', undefined, 'oko', {
      days: 14,
      endsAt: new Date('2026-11-17T10:00:00.000Z'),
    });
    const call = (sendEmail as jest.Mock).mock.calls[0]?.[0];
    expect(call.template).toBe('account-approved');
    expect(call.data.loginUrl).toBe('https://oko.societyledger.com.ng/auth/login');
    expect(call.data.trialDays).toBe(14);
    expect(call.data.trialEndsOn).toMatch(/2026/);
  });

  it('says nothing about a trial for a rejection or an ordinary member', async () => {
    await sendApprovalNotificationEmail('ada@example.com', 'approved', 'Oko', undefined, 'oko', null);
    const call = (sendEmail as jest.Mock).mock.calls[0]?.[0];
    expect(call.data.trialDays).toBeUndefined();
    expect(call.data.trialEndsOn).toBeUndefined();
  });
});
