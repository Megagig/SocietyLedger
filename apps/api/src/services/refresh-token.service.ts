/**
 * Mobile refresh-token sessions (F0.3).
 *
 * One row per issued token; `familyId` groups every token descended from
 * one login through rotation. Reusing an already-rotated (revoked) token
 * is treated as theft and revokes the whole family — the standard
 * rotation-with-reuse-detection pattern architecture.md §9.1 specifies.
 */
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { isMemberDisabled } from '../lib/member-access';
import { generateRefreshToken, hashRefreshToken } from '../lib/auth';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface IssuedRefreshToken {
  id: number;
  token: string; // plaintext — returned to the client once, never stored
  familyId: string;
  expiresAt: Date;
}

export async function issueRefreshToken(params: {
  userId: number;
  associationId: number | null;
  familyId?: string; // reused on rotation; a fresh uuid on a new login
  deviceName?: string | null;
  platform?: string | null;
}): Promise<IssuedRefreshToken> {
  const token = generateRefreshToken();
  const tokenHash = hashRefreshToken(token);
  const familyId = params.familyId ?? randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  const row = await prisma.refreshToken.create({
    data: {
      userId: params.userId,
      associationId: params.associationId,
      tokenHash,
      familyId,
      deviceName: params.deviceName ?? undefined,
      platform: params.platform ?? undefined,
      expiresAt,
      lastUsedAt: new Date(),
    },
  });

  return { id: row.id, token, familyId, expiresAt };
}

export type RotateResult =
  | { ok: true; userId: number; associationId: number | null; refreshToken: IssuedRefreshToken }
  | { ok: false; reason: 'invalid' | 'expired' | 'user_inactive' | 'association_inactive' | 'member_disabled' };

/**
 * Verifies a presented refresh token and, if valid, rotates it: the old row
 * is revoked and a new one issued in the same family. Re-checks the user's
 * active/approval status and the association's status on every rotation
 * (not just at login) — a user disabled or an association suspended after
 * the token was issued can no longer use it to stay signed in.
 */
export async function rotateRefreshToken(plainToken: string): Promise<RotateResult> {
  const tokenHash = hashRefreshToken(plainToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing) return { ok: false, reason: 'invalid' };

  if (existing.revokedAt) {
    // Reuse of an already-rotated/revoked token: treat as theft, kill the whole family.
    await revokeFamily(existing.familyId);
    return { ok: false, reason: 'invalid' };
  }

  if (existing.expiresAt < new Date()) {
    return { ok: false, reason: 'expired' };
  }

  const user = await prisma.user.findUnique({
    where: { id: existing.userId },
    include: { userApproval: true, association: { select: { status: true } }, member: { select: { status: true } } },
  });

  if (!user || !user.isActive) {
    return { ok: false, reason: 'user_inactive' };
  }
  if (!user.platformRole && isMemberDisabled(user.member?.status)) {
    return { ok: false, reason: 'member_disabled' };
  }
  if (!user.platformRole && user.userApproval && user.userApproval.approvalStatus !== 'approved') {
    return { ok: false, reason: 'user_inactive' };
  }
  if (user.association && (user.association.status === 'SUSPENDED' || user.association.status === 'CANCELLED')) {
    return { ok: false, reason: 'association_inactive' };
  }

  const issued = await prisma.$transaction(async (tx) => {
    const token = generateRefreshToken();
    const tokenHashNew = hashRefreshToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const newRow = await tx.refreshToken.create({
      data: {
        userId: existing.userId,
        associationId: existing.associationId,
        tokenHash: tokenHashNew,
        familyId: existing.familyId,
        deviceName: existing.deviceName,
        platform: existing.platform,
        expiresAt,
        lastUsedAt: new Date(),
      },
    });

    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: newRow.id },
    });

    return { id: newRow.id, token, familyId: existing.familyId, expiresAt };
  });

  return { ok: true, userId: existing.userId, associationId: existing.associationId, refreshToken: issued };
}

/** Best-effort — used by logout. Swallows a not-found token (already gone/invalid). */
export async function revokeRefreshToken(plainToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(plainToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Used on password change/reset — every refresh token for the user, across every family. */
export async function revokeAllForUser(userId: number): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export interface SessionSummary {
  familyId: string;
  deviceName: string | null;
  platform: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/** One row per active family (its most recent token), for GET /auth/sessions. */
export async function listActiveSessions(userId: number): Promise<SessionSummary[]> {
  const rows = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
  });

  const seen = new Set<string>();
  const sessions: SessionSummary[] = [];
  for (const row of rows) {
    if (seen.has(row.familyId)) continue;
    seen.add(row.familyId);
    sessions.push({
      familyId: row.familyId,
      deviceName: row.deviceName,
      platform: row.platform,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
    });
  }
  return sessions;
}

/** Signs one device out. The user id is part of the query, so nobody can revoke another person's session. Returns how many tokens were revoked (0 = not theirs, or already signed out). */
export async function revokeSessionForUser(userId: number, familyId: string): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/** Revokes every active family for the user except the one `keepPlainToken` belongs to. */
export async function revokeOtherSessions(userId: number, keepPlainToken: string): Promise<number> {
  const keepTokenHash = hashRefreshToken(keepPlainToken);
  const keep = await prisma.refreshToken.findUnique({ where: { tokenHash: keepTokenHash } });

  const result = await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(keep ? { familyId: { not: keep.familyId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
