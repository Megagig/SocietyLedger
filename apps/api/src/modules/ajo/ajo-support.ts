/**
 * Small shared helpers for the Ajo services: audit entries that cannot leak a secret, and best-effort notifications.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { dispatchNotification } from '../../services/notification-preferences.service';

type Tx = Prisma.TransactionClient;

/** Keys that must never reach an audit row or a log line, whatever a caller passes. */
const SECRET_KEY = /account.?number|number.?enc|code.?hash|password|secret|token|otp|^code$/i;

/** A copy of `value` with every secret-looking key removed, and any ten-digit run (an account number) masked. Recurses into objects and arrays. */
export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactSecrets) as unknown as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(key)) continue;
      out[key] = redactSecrets(v);
    }
    return out as T;
  }
  if (typeof value === 'string') return value.replace(/\b[0-9]{10}\b/g, (m) => `••••${m.slice(-4)}`) as unknown as T;
  return value;
}

export interface AjoAuditEntry {
  associationId: number;
  /** The signed-in user who did it. */
  userId: number;
  /** For example `AJO_MEMBERSHIP_APPROVED`. */
  action: string;
  /** For example `ajo_memberships`. */
  tableName: string;
  recordId?: number | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

/** Write a tenant audit entry (who, what, when). Runs in the caller's transaction so the change and its record stand or fall together. */
export async function auditAjo(db: Tx, entry: AjoAuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      associationId: entry.associationId,
      userId: entry.userId,
      action: entry.action,
      tableName: entry.tableName,
      recordId: entry.recordId ?? null,
      oldValues: entry.oldValues ? (redactSecrets(entry.oldValues) as Prisma.InputJsonValue) : Prisma.JsonNull,
      newValues: entry.newValues ? (redactSecrets(entry.newValues) as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}

/** Everyone in the association who holds a permission. Used to tell whether someone is the only person who can do a thing. */
export async function permissionHolderIds(db: Tx | typeof prisma, associationId: number, permissionKey: string): Promise<number[]> {
  const rows = await db.userRole.findMany({
    where: { associationId, isActive: true, user: { isActive: true }, role: { isActive: true, permissions: { some: { permission: { key: permissionKey } } } } },
    select: { userId: true },
    distinct: ['userId'],
  });
  return rows.map((r) => r.userId);
}

export interface AjoNotice {
  title: string;
  message: string;
  /** The push `data.type`, for example `ajo.verification_status`. */
  pushType: string;
  entityId?: number;
  kind?: 'system' | 'approval';
}

/** Tell one user. Best-effort: a failed notification never fails the change that caused it. */
export async function notifyUser(associationId: number, userId: number, notice: AjoNotice): Promise<void> {
  try {
    await dispatchNotification({ associationId, userId, kind: notice.kind ?? 'system', entityId: notice.entityId, pushType: notice.pushType, title: notice.title, message: notice.message });
  } catch (error) {
    console.error(`[ajo] notification to user ${userId} failed (non-critical):`, (error as Error).message);
  }
}

/** Tell everyone in the association who holds a permission (for example the people who run groups). Best-effort. */
export async function notifyPermissionHolders(associationId: number, permissionKey: string, notice: AjoNotice, exceptUserId?: number): Promise<void> {
  try {
    const rows = await prisma.userRole.findMany({
      where: { associationId, isActive: true, user: { isActive: true }, role: { isActive: true, permissions: { some: { permission: { key: permissionKey } } } } },
      select: { userId: true },
      distinct: ['userId'],
    });
    for (const { userId } of rows) {
      if (userId !== exceptUserId) await notifyUser(associationId, userId, notice);
    }
  } catch (error) {
    console.error('[ajo] notification to permission holders failed (non-critical):', (error as Error).message);
  }
}
