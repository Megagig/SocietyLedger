/**
 * Members hold only cooperatives.view_own / apply_own / guarantor_own (never the officer-level ledger.* keys),
 * and the cooperatives list endpoints must then return ONLY their own records, whatever `memberId` they pass;
 * the single-record endpoints must 404 someone else's record. Officers (members.view_all / a manage key) keep
 * the full view. Service and RBAC are mocked.
 */
jest.mock('../../src/lib/prisma', () => ({ prisma: { auditLog: { create: jest.fn() } } }));
jest.mock('../../src/services/rbac.service', () => ({ RBACService: { hasAnyPermission: jest.fn() } }));
jest.mock('../../src/modules/cooperatives/cooperatives.service', () => ({
  cooperativesService: {
    getSavingsAccount: jest.fn(),
    getSavingsTransactions: jest.fn(),
    getLoanApplications: jest.fn(),
    getLoanApplication: jest.fn(),
    getLoans: jest.fn(),
    getLoan: jest.fn(),
    getLoanRepayments: jest.fn(),
    searchGuarantorCandidates: jest.fn(),
    listLoanRepaymentRequests: jest.fn(),
    getLoanRepaymentRequestRow: jest.fn(),
  },
}));

import type { Request, Response } from 'express';
import { RBACService } from '../../src/services/rbac.service';
import { cooperativesService } from '../../src/modules/cooperatives/cooperatives.service';
import { cooperativesController } from '../../src/modules/cooperatives/cooperatives.controller';
import { ROLE_PERMISSION_MAPPING } from '../../src/lib/role-permission-mapping';
import { PERMISSIONS } from '../../src/lib/permissions';

const hasAny = RBACService.hasAnyPermission as jest.Mock;
const svc = cooperativesService as unknown as Record<string, jest.Mock>;

function makeReq(
  opts: { query?: Record<string, string>; params?: Record<string, string>; memberId?: number | null } = {}
): Request {
  const memberId = opts.memberId === undefined ? 70 : (opts.memberId ?? undefined);
  return {
    user: { id: 7, associationId: 15, memberId },
    query: opts.query ?? {},
    params: opts.params ?? {},
  } as unknown as Request;
}

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() } as unknown as Response & { status: jest.Mock; json: jest.Mock };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  svc.getSavingsTransactions.mockResolvedValue({ transactions: [], pagination: {} });
  svc.getLoanApplications.mockResolvedValue({ applications: [], pagination: {} });
  svc.getLoans.mockResolvedValue({ loans: [], pagination: {} });
  svc.getLoanRepayments.mockResolvedValue({ repayments: [], pagination: {} });
});

describe.each([
  ['getLoans', 'getLoans', 'loans'],
  ['getLoanApplications', 'getLoanApplications', 'applications'],
] as const)('GET list: %s', (handler, serviceFn, listKey) => {
  const call = (req: Request, res = makeRes()) =>
    (cooperativesController as unknown as Record<string, (r: Request, s: Response) => Promise<unknown>>)[handler](req, res);

  it("forces a member's own id, ignoring a ?memberId for someone else", async () => {
    hasAny.mockResolvedValue(false);

    await call(makeReq({ query: { memberId: '71' } }));

    expect(svc[serviceFn]).toHaveBeenCalledWith(15, expect.objectContaining({ memberId: 70 }));
  });

  it('lets an officer filter by any member, or none', async () => {
    hasAny.mockResolvedValue(true);

    await call(makeReq({ query: { memberId: '71' } }));
    await call(makeReq());

    expect(svc[serviceFn]).toHaveBeenNthCalledWith(1, 15, expect.objectContaining({ memberId: 71 }));
    expect(svc[serviceFn]).toHaveBeenNthCalledWith(2, 15, expect.objectContaining({ memberId: undefined }));
  });

  it('returns an empty page for a non-officer account with no member record', async () => {
    hasAny.mockResolvedValue(false);
    const res = makeRes();

    await call(makeReq({ memberId: null }), res);

    expect(svc[serviceFn]).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data[listKey]).toEqual([]);
  });
});

describe('GET /cooperatives/savings-transactions', () => {
  it("scopes a member to their own accounts' transactions", async () => {
    hasAny.mockResolvedValue(false);

    await cooperativesController.getSavingsTransactions(makeReq({ query: { savingsAccountId: '9' } }), makeRes());

    expect(svc.getSavingsTransactions).toHaveBeenCalledWith(
      15,
      expect.objectContaining({ memberId: 70, savingsAccountId: 9 })
    );
  });

  it('does not scope an officer', async () => {
    hasAny.mockResolvedValue(true);

    await cooperativesController.getSavingsTransactions(makeReq(), makeRes());

    expect(svc.getSavingsTransactions).toHaveBeenCalledWith(15, expect.objectContaining({ memberId: undefined }));
  });

  it('returns an empty page when the account has no member record', async () => {
    hasAny.mockResolvedValue(false);
    const res = makeRes();

    await cooperativesController.getSavingsTransactions(makeReq({ memberId: null }), res);

    expect(svc.getSavingsTransactions).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.transactions).toEqual([]);
  });
});

describe('GET /cooperatives/loan-repayments', () => {
  it("scopes a member to repayments on their own loans", async () => {
    hasAny.mockResolvedValue(false);

    await cooperativesController.getLoanRepayments(makeReq({ query: { loanId: '3' } }), makeRes());

    expect(svc.getLoanRepayments).toHaveBeenCalledWith(15, expect.objectContaining({ memberId: 70, loanId: 3 }));
  });

  it('does not scope an officer', async () => {
    hasAny.mockResolvedValue(true);

    await cooperativesController.getLoanRepayments(makeReq(), makeRes());

    expect(svc.getLoanRepayments).toHaveBeenCalledWith(15, expect.objectContaining({ memberId: undefined }));
  });
});

describe.each([
  ['getSavingsAccount', 'getSavingsAccount'],
  ['getLoan', 'getLoan'],
  ['getLoanApplication', 'getLoanApplication'],
] as const)('GET single record: %s', (handler, serviceFn) => {
  const call = (res: ReturnType<typeof makeRes>) =>
    (cooperativesController as unknown as Record<string, (r: Request, s: Response) => Promise<unknown>>)[handler](
      makeReq({ params: { id: '5' } }),
      res
    );

  it("404s a member asking for someone else's record", async () => {
    hasAny.mockResolvedValue(false);
    svc[serviceFn].mockResolvedValue({ id: 5, memberId: 71 });
    const res = makeRes();

    await call(res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns a member their own record', async () => {
    hasAny.mockResolvedValue(false);
    svc[serviceFn].mockResolvedValue({ id: 5, memberId: 70 });
    const res = makeRes();

    await call(res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns an officer anyone's record", async () => {
    hasAny.mockResolvedValue(true);
    svc[serviceFn].mockResolvedValue({ id: 5, memberId: 71 });
    const res = makeRes();

    await call(res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('GET /cooperatives/guarantor-candidates', () => {
  it('searches on behalf of the borrower, so the service can leave them out', async () => {
    svc.searchGuarantorCandidates.mockResolvedValue([{ id: 71, firstName: 'Ada', lastName: 'Obi', memberId: 'M-071' }]);
    const res = makeRes();

    await cooperativesController.getGuarantorCandidates(makeReq({ query: { search: 'ada' } }), res);

    expect(svc.searchGuarantorCandidates).toHaveBeenCalledWith(15, 70, 'ada');
    expect(res.json.mock.calls[0][0].data.members).toHaveLength(1);
  });

  it('returns nothing for an account with no member record', async () => {
    const res = makeRes();

    await cooperativesController.getGuarantorCandidates(makeReq({ memberId: null }), res);

    expect(svc.searchGuarantorCandidates).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.members).toEqual([]);
  });
});

describe('GET /cooperatives/loan-repayment-requests', () => {
  beforeEach(() => svc.listLoanRepaymentRequests.mockResolvedValue({ repaymentRequests: [], pagination: {} }));

  it("forces a member's own id, ignoring a ?memberId for someone else", async () => {
    hasAny.mockResolvedValue(false);

    await cooperativesController.getLoanRepaymentRequests(makeReq({ query: { memberId: '71' } }), makeRes());

    expect(svc.listLoanRepaymentRequests).toHaveBeenCalledWith(15, expect.objectContaining({ memberId: 70 }));
  });

  it('lets an officer see everyone, or filter', async () => {
    hasAny.mockResolvedValue(true);

    await cooperativesController.getLoanRepaymentRequests(makeReq(), makeRes());
    await cooperativesController.getLoanRepaymentRequests(makeReq({ query: { memberId: '71' } }), makeRes());

    expect(svc.listLoanRepaymentRequests).toHaveBeenNthCalledWith(1, 15, expect.objectContaining({ memberId: undefined }));
    expect(svc.listLoanRepaymentRequests).toHaveBeenNthCalledWith(2, 15, expect.objectContaining({ memberId: 71 }));
  });
});

describe('GET /cooperatives/loan-repayment-requests/:id/receipt', () => {
  it("404s a member asking for someone else's receipt, without touching storage", async () => {
    hasAny.mockResolvedValue(false);
    svc.getLoanRepaymentRequestRow.mockResolvedValue({ id: 8, memberId: 71, filepath: 'k', filename: 'r.png' });
    const res = makeRes();

    await cooperativesController.getLoanRepaymentRequestReceipt(makeReq({ params: { id: '8' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('member role defaults', () => {
  it('grants the cooperatives own-scoped keys and none of the officer-level ledger keys', () => {
    const member = ROLE_PERMISSION_MAPPING.member as string[];

    for (const key of [
      PERMISSIONS.COOPERATIVE_VIEW_OWN,
      PERMISSIONS.COOPERATIVE_APPLY_OWN,
      PERMISSIONS.COOPERATIVE_GUARANTOR_OWN,
      PERMISSIONS.COOPERATIVE_SAVINGS_DEPOSIT_OWN,
    ]) {
      expect(member).toContain(key);
    }
    expect(member).not.toContain('ledger.view');
    expect(member).not.toContain('ledger.create');
  });
});
