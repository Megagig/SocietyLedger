import { Request } from 'express';
import { Prisma, SecurityEventActorType, SecurityEventSeverity } from '@prisma/client';
import prisma from './prisma';

export interface LogSecurityEventInput {
  eventType: string;
  severity?: SecurityEventSeverity;
  actorType: SecurityEventActorType;
  actorId?: number | null;
  actorEmail?: string | null;
  targetType?: string | null;
  targetId?: string | number | null;
  targetName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
  associationId?: number | null;
}

/**
 * Writes one row to security_event_logs. Never throws — a logging failure
 * must not break the request it's logging. Call this without `await` from
 * request handlers that don't need the write to finish before responding.
 */
export async function logSecurityEvent(input: LogSecurityEventInput): Promise<void> {
  try {
    await prisma.securityEventLog.create({
      data: {
        eventType: input.eventType,
        severity: input.severity ?? SecurityEventSeverity.INFO,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId !== undefined && input.targetId !== null ? String(input.targetId) : null,
        targetName: input.targetName ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        details: (input.details as Prisma.InputJsonValue) ?? undefined,
        associationId: input.associationId ?? null,
      },
    });
  } catch (error) {
    console.error('[SecurityAuditLog] Failed to write event:', error);
  }
}

/** Pulls ip/userAgent off an Express Request for a logSecurityEvent() call. */
export function requestContext(req: Request): { ipAddress: string; userAgent: string | null } {
  return {
    ipAddress: req.ip ?? req.socket?.remoteAddress ?? 'unknown',
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
  };
}
