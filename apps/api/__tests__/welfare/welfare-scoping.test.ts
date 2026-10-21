/**
 * Members hold only welfare.view_own / welfare.request_own (never the officer-level ledger.* keys), and the
 * welfare list endpoints must then return ONLY their own records, whatever `memberId` they pass.
 * Officers (members.view_all / payments.approve) keep the full view. Service and RBAC are mocked.
 */
jest.mock('../../src/lib/prisma', () => ({ prisma: { auditLog: { create: jest.fn() } } }));
jest.mock('../../src/services/rbac.service', () => ({ RBACService: { hasAnyPermission: jest.fn() } }));
jest.mock('../../src/modules/welfare/welfare.service', () => ({
  welfareService: { listContributions: jest.fn(), listPayoutRequests: jest.fn() },
}));

import type { Request, Response } from 'express';
import { RBACService } from '../../src/services/rbac.service';
import { welfareService } from '../../src/modules/welfare/welfare.service';
import { welfareController } from '../../src/modules/welfare/welfare.controller';
import { ROLE_PERMISSION_MAPPING } from '../../src/lib/role-permission-mapping';
import { PERMISSIONS } from '../../src/lib/permissions';

const hasAny = RBACService.hasAnyPermission as jest.Mock;
const svc = welfareService as unknown as Record<string, jest.Mock>;

function makeReq(query: Record<string, string> = {}, opts: { memberId?: number | null } = {}): Request {
  const memberId = opts.memberId === undefined ? 70 : (opts.memberId ?? undefined);
  return { user: { id: 7, associationId: 15, memberId }, query, params: {} } as unknown as Request;
}

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() } as unknown as Response & { status: jest.Mock; json: jest.Mock };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  svc.listContributions.mockResolvedValue({ contributions: [], pagination: {} });
  svc.listPayoutRequests.mockResolvedValue({ requests: [], pagination: {} });
});

describe('GET /welfare/contributions', () => {
  it('forces a member\'s own id, ignoring a ?memberId for someone else', async () => {
    hasAny.mockResolvedValue(false);

    await welfareController.listContributions(makeReq({ memberId: '71' }), makeRes());

    expect(svc.listContributions).toHaveBeenCalledWith(15, expect.objectContaining({ memberId: 70 }));
  });

  it('lets an officer filter by any member, or none', async () => {
    hasAny.mockResolvedValue(true);

    await welfareController.listContributions(makeReq({ memberId: '71' }), makeRes());
    await welfareController.listContributions(makeReq(), makeRes());

    expect(svc.listContributions).toHaveBeenNthCalledWith(1, 15, expect.objectContaining({ memberId: 71 }));
    expect(svc.listContributions).toHaveBeenNthCalledWith(2, 15, expect.objectContaining({ memberId: undefined }));
  });

  it('returns an empty page for a non-officer account with no member record', async () => {
    hasAny.mockResolvedValue(false);
    const res = makeRes();

    await welfareController.listContributions(makeReq({}, { memberId: null }), res);

    expect(svc.listContributions).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.contributions).toEqual([]);
  });
});

describe('GET /welfare/payouts', () => {
  it('forces a member\'s own id, ignoring a ?memberId for someone else', async () => {
    hasAny.mockResolvedValue(false);

    await welfareController.listPayoutRequests(makeReq({ memberId: '71' }), makeRes());

    expect(svc.listPayoutRequests).toHaveBeenCalledWith(15, expect.objectContaining({ memberId: 70 }));
  });

  it('lets an officer filter by any member', async () => {
    hasAny.mockResolvedValue(true);

    await welfareController.listPayoutRequests(makeReq({ memberId: '71' }), makeRes());

    expect(svc.listPayoutRequests).toHaveBeenCalledWith(15, expect.objectContaining({ memberId: 71 }));
  });
});

describe('default member role', () => {
  it('has the own-scoped welfare permissions and none of the officer ledger keys welfare used to require', () => {
    const member: readonly string[] = ROLE_PERMISSION_MAPPING.member;

    expect(member).toEqual(expect.arrayContaining([PERMISSIONS.WELFARE_VIEW_OWN, PERMISSIONS.WELFARE_REQUEST_OWN]));
    expect(member).not.toContain('ledger.view');
    expect(member).not.toContain('ledger.create');
  });
});
