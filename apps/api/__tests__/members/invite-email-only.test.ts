/**
 * Invites go out by email only. A phone number alone would get nothing, so a member without an email can't be invited
 * and doesn't show in the invitable list. Prisma is mocked.
 */
const mockPrisma = {
  member: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  memberInvite: { updateMany: jest.fn(), create: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: mockPrisma, prisma: mockPrisma }));
jest.mock('../../src/modules/settings/settings.service', () => ({ SettingsService: { getSetting: jest.fn().mockResolvedValue(72) } }));
jest.mock('../../src/modules/auth/auth.service', () => ({ hashToken: (t: string) => `hashed-${t}` }));
jest.mock('../../src/lib/email', () => ({ sendEmail: jest.fn() }));
jest.mock('../../src/lib/auth', () => ({ hashPassword: jest.fn() }));

import { createMemberInvite, getInvitableMembers } from '../../src/modules/member-invites/member-invites.service';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.member.findMany.mockResolvedValue([]);
  mockPrisma.member.count.mockResolvedValue(0);
});

describe('createMemberInvite', () => {
  it('refuses a member who only has a phone number', async () => {
    mockPrisma.member.findFirst.mockResolvedValue({ id: 4, userId: null, email: null, phone: '08031234567' });

    await expect(createMemberInvite({ memberId: 4, associationId: 1, invitedById: 2 })).rejects.toThrow(/no email address/i);
    expect(mockPrisma.memberInvite.create).not.toHaveBeenCalled();
  });

  it('creates the invite when an email is on file', async () => {
    mockPrisma.member.findFirst.mockResolvedValue({ id: 4, userId: null, email: 'ada@example.com', phone: null });
    mockPrisma.memberInvite.create.mockResolvedValue({ id: 8, email: 'ada@example.com' });
    mockPrisma.member.update.mockResolvedValue({});

    const { invite } = await createMemberInvite({ memberId: 4, associationId: 1, invitedById: 2 });

    expect(invite.email).toBe('ada@example.com');
    expect(mockPrisma.memberInvite.create).toHaveBeenCalledTimes(1);
  });
});

describe('getInvitableMembers', () => {
  it('lists only members with an email, no login yet, and not terminated', async () => {
    await getInvitableMembers(1);

    const where = mockPrisma.member.findMany.mock.calls[0]?.[0].where;
    expect(where).toMatchObject({ associationId: 1, userId: null, email: { not: null } });
    expect(where.status).toEqual({ in: ['active', 'inactive'] });
    expect(where.OR).toBeUndefined();
  });
});
