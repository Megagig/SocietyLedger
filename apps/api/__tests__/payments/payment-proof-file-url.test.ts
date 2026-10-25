/**
 * The proof file link is reachable by members (payments.view_own), so "own" has to be enforced in the handler: an officer gets any
 * proof in the association, a member only the ones they submitted — otherwise any member could read anyone's receipt by counting
 * proof ids. Prisma, RBAC and storage are mocked.
 */
const mockPrisma = { paymentProof: { findFirst: jest.fn() } };
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
const mockHasAny = jest.fn();
jest.mock('../../src/services/rbac.service', () => ({ RBACService: { hasAnyPermission: (...args: unknown[]) => mockHasAny(...args) } }));
jest.mock('../../src/lib/storage', () => ({
  uploadFile: jest.fn(),
  getPresignedUrl: jest.fn().mockResolvedValue('https://files.example.com/receipt.png?sig=abc'),
}));
jest.mock('../../src/services/payment-proof-notifications', () => ({ notifyProofSubmitted: jest.fn(), notifyProofDecided: jest.fn() }));

import type { Request, Response } from 'express';
import { nigerianPaymentsController } from '../../src/modules/nigerian-payments/nigerian-payments.controller';

const proof = { id: 9, associationId: 1, memberId: 40, filepath: 'payment-proofs/1/receipt.png', filename: 'receipt.png', mimeType: 'image/png' };

function call(user: Record<string, unknown>) {
  const json = jest.fn();
  const res = { status: jest.fn().mockReturnThis(), json } as unknown as Response;
  const req = { user: { id: 3, associationId: 1, ...user }, params: { id: '9' } } as unknown as Request;
  return nigerianPaymentsController.getPaymentProofFileUrl(req, res).then(() => ({ res, json }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.paymentProof.findFirst.mockResolvedValue(proof);
});

describe('GET /proofs/:id/file-url', () => {
  it('gives an officer the link to any proof in the association, without exposing the storage key', async () => {
    mockHasAny.mockResolvedValue(true);
    const { res, json } = await call({ memberId: 99 });

    expect(res.status).toHaveBeenCalledWith(200);
    const body = json.mock.calls[0]?.[0];
    expect(body.data).toMatchObject({ url: 'https://files.example.com/receipt.png?sig=abc', filename: 'receipt.png', mimeType: 'image/png' });
    expect(JSON.stringify(body)).not.toContain('payment-proofs/1/receipt.png');
  });

  it('gives a member the link to their own proof', async () => {
    mockHasAny.mockResolvedValue(false);
    const { res } = await call({ memberId: 40 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("refuses a member another member's proof — as a 404, so ids can't be probed", async () => {
    mockHasAny.mockResolvedValue(false);
    const { res } = await call({ memberId: 41 });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('refuses a caller with no member record who is not an officer', async () => {
    mockHasAny.mockResolvedValue(false);
    const { res } = await call({});
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('404s a proof with no file attached', async () => {
    mockHasAny.mockResolvedValue(true);
    mockPrisma.paymentProof.findFirst.mockResolvedValue({ ...proof, filepath: null });
    const { res } = await call({});
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
