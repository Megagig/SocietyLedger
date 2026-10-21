import { mapLoginUserToSessionUser } from './mappers';
import type { LoginUserDTO } from '@/types/api/auth';

const baseUser: LoginUserDTO = {
  id: 1,
  email: 'ada@example.com',
  role: 'member',
  member: { id: 1, firstName: 'Ada', lastName: 'Eze', memberId: 'MEM0001' },
  association: { id: 1, name: 'Opuogun State', subdomain: 'opuogunstate' },
  platformRole: null,
  requiresOnboarding: false,
  permissions: ['ledger.view_own'],
  roles: ['member'],
  isPlatformLogin: false,
};

describe('mapLoginUserToSessionUser', () => {
  it('maps a member login into a SessionUser', () => {
    expect(mapLoginUserToSessionUser(baseUser)).toEqual({
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

  it('maps member: null to member: null', () => {
    expect(mapLoginUserToSessionUser({ ...baseUser, member: null }).member).toBeNull();
  });
});
