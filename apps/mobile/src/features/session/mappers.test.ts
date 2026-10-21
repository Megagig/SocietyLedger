import { mapMeUserToSessionUser } from './mappers';
import type { MeResponseDTO } from '@/types/api/auth';

const baseUser: MeResponseDTO['user'] = {
  id: 1,
  email: 'ada@example.com',
  role: 'member',
  isActive: true,
  emailVerified: true,
  associationId: 1,
  platformRole: null,
  member: { id: 1, firstName: 'Ada', lastName: 'Eze', memberId: 'MEM0001', email: 'ada@example.com', phone: '0800' },
  userApproval: { approvalStatus: 'approved' },
  association: { id: 1, name: 'Opuogun State', subdomain: 'opuogunstate' },
  requiresOnboarding: false,
  permissions: ['ledger.view_own'],
  roles: ['member'],
};

describe('mapMeUserToSessionUser', () => {
  it('maps a member user, keeping only the SessionUser fields', () => {
    expect(mapMeUserToSessionUser(baseUser)).toEqual({
      id: 1,
      email: 'ada@example.com',
      role: 'member',
      permissions: ['ledger.view_own'],
      roles: ['member'],
      requiresOnboarding: false,
      platformRole: null,
      member: { id: 1, firstName: 'Ada', lastName: 'Eze', memberId: 'MEM0001' },
    });
  });

  it('maps member: null to member: null (no login-linked member yet)', () => {
    expect(mapMeUserToSessionUser({ ...baseUser, member: null }).member).toBeNull();
  });
});
