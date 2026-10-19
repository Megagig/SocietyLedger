/**
 * F0.3 unit tests — services/refresh-token.service.ts, with Prisma mocked
 * (no real DB). Covers rotation, reuse detection, a deactivated user, and a
 * suspended association — the scenarios build-plan.md's F0.3 DoD names.
 */
const mockTx = {
  refreshToken: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn((cb: any) => cb(mockTx)),
  },
}));

import { prisma } from '../../src/lib/prisma';
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeFamily,
  revokeAllForUser,
  listActiveSessions,
  revokeOtherSessions,
} from '../../src/services/refresh-token.service';

const refreshTokenCreate = prisma.refreshToken.create as jest.Mock;
const refreshTokenFindUnique = prisma.refreshToken.findUnique as jest.Mock;
const refreshTokenUpdateMany = prisma.refreshToken.updateMany as jest.Mock;
const refreshTokenFindMany = prisma.refreshToken.findMany as jest.Mock;
const userFindUnique = prisma.user.findUnique as jest.Mock;

const activeUser = {
  id: 10,
  isActive: true,
  platformRole: null,
  userApproval: { approvalStatus: 'approved' },
  association: { status: 'ACTIVE' },
};

beforeEach(() => jest.clearAllMocks());

describe('issueRefreshToken', () => {
  it('creates a row and returns the plaintext token (never persisted) plus its hash-derived row', async () => {
    refreshTokenCreate.mockResolvedValue({ id: 1 });
    const issued = await issueRefreshToken({ userId: 10, associationId: 2 });

    expect(issued.token).toMatch(/^[0-9a-f]{64}$/);
    expect(refreshTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 10, associationId: 2, familyId: issued.familyId }),
      })
    );
    // the stored tokenHash must never equal the plaintext token
    const createdData = refreshTokenCreate.mock.calls[0][0].data;
    expect(createdData.tokenHash).not.toBe(issued.token);
  });

  it('generates a fresh familyId when none is given, but reuses one when passed (rotation)', async () => {
    refreshTokenCreate.mockResolvedValue({ id: 1 });
    const fresh = await issueRefreshToken({ userId: 10, associationId: 2 });
    const rotated = await issueRefreshToken({ userId: 10, associationId: 2, familyId: fresh.familyId });
    expect(rotated.familyId).toBe(fresh.familyId);
  });
});

describe('rotateRefreshToken', () => {
  it('rejects a token that does not exist', async () => {
    refreshTokenFindUnique.mockResolvedValue(null);
    const result = await rotateRefreshToken('nonexistent');
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('[reuse detection] revokes the whole family when an already-revoked token is presented again', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 1, userId: 10, familyId: 'family-a', revokedAt: new Date(), expiresAt: new Date(Date.now() + 100000),
    });
    refreshTokenUpdateMany.mockResolvedValue({ count: 2 });

    const result = await rotateRefreshToken('stolen-but-already-rotated');

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-a', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects an expired token', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 1, userId: 10, familyId: 'family-a', revokedAt: null, expiresAt: new Date(Date.now() - 1000),
    });
    const result = await rotateRefreshToken('expired-token');
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('[revoked user] rejects when the user is no longer active', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 1, userId: 10, familyId: 'family-a', revokedAt: null, expiresAt: new Date(Date.now() + 100000),
    });
    userFindUnique.mockResolvedValue({ ...activeUser, isActive: false });

    const result = await rotateRefreshToken('valid-token-inactive-user');
    expect(result).toEqual({ ok: false, reason: 'user_inactive' });
  });

  it('[suspended association] rejects when the association is suspended', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 1, userId: 10, associationId: 2, familyId: 'family-a', revokedAt: null, expiresAt: new Date(Date.now() + 100000),
    });
    userFindUnique.mockResolvedValue({ ...activeUser, association: { status: 'SUSPENDED' } });

    const result = await rotateRefreshToken('valid-token-suspended-assoc');
    expect(result).toEqual({ ok: false, reason: 'association_inactive' });
  });

  it('rotates successfully: revokes the old row, creates a new one in the same family', async () => {
    const existing = {
      id: 1, userId: 10, associationId: 2, familyId: 'family-a', revokedAt: null,
      expiresAt: new Date(Date.now() + 100000), deviceName: 'Pixel', platform: 'android',
    };
    refreshTokenFindUnique.mockResolvedValue(existing);
    userFindUnique.mockResolvedValue(activeUser);
    mockTx.refreshToken.create.mockResolvedValue({ id: 2 });

    const result = await rotateRefreshToken('valid-token');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe(10);
      expect(result.associationId).toBe(2);
      expect(result.refreshToken.familyId).toBe('family-a');
      expect(result.refreshToken.token).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(mockTx.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ familyId: 'family-a', deviceName: 'Pixel', platform: 'android' }) })
    );
    expect(mockTx.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { revokedAt: expect.any(Date), replacedById: 2 },
    });
  });
});

describe('revokeRefreshToken / revokeFamily / revokeAllForUser', () => {
  it('revokeRefreshToken only touches the matching, not-yet-revoked row', async () => {
    refreshTokenUpdateMany.mockResolvedValue({ count: 1 });
    await revokeRefreshToken('some-token');
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokeAllForUser revokes every active token for that user', async () => {
    refreshTokenUpdateMany.mockResolvedValue({ count: 3 });
    await revokeAllForUser(10);
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 10, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('listActiveSessions', () => {
  it('returns one entry per family, keeping only the most recently used row', async () => {
    refreshTokenFindMany.mockResolvedValue([
      { familyId: 'a', deviceName: 'Phone A', platform: 'ios', lastUsedAt: new Date(2), createdAt: new Date(1) },
      { familyId: 'a', deviceName: 'Phone A (stale dup)', platform: 'ios', lastUsedAt: new Date(1), createdAt: new Date(1) },
      { familyId: 'b', deviceName: 'Phone B', platform: 'android', lastUsedAt: new Date(3), createdAt: new Date(1) },
    ]);

    const sessions = await listActiveSessions(10);

    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.familyId)).toEqual(['a', 'b']);
  });
});

describe('revokeOtherSessions', () => {
  it('revokes every family except the one the kept token belongs to', async () => {
    refreshTokenFindUnique.mockResolvedValue({ familyId: 'keep-me' });
    refreshTokenUpdateMany.mockResolvedValue({ count: 4 });

    const count = await revokeOtherSessions(10, 'my-current-token');

    expect(count).toBe(4);
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 10, revokedAt: null, familyId: { not: 'keep-me' } },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('falls back to revoking everything if the kept token itself cannot be found', async () => {
    refreshTokenFindUnique.mockResolvedValue(null);
    refreshTokenUpdateMany.mockResolvedValue({ count: 5 });

    await revokeOtherSessions(10, 'unknown-token');

    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 10, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
