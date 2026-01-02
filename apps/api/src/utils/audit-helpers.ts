/**
 * Audit Helpers for Hybrid Super Admin Architecture
 * 
 * Phase 22: Provides utilities for creating audit logs with execution context,
 * especially for tracking impersonation actions.
 */

import { AuthRequest } from '../middleware/auth.middleware';
import { ContextAwareRequest } from '../middleware/context.middleware';
import { ContextService } from '../services/context.service';
import { AuditContext, ContextMode } from '../types/context.types';
import prisma from '../lib/prisma';

/**
 * Get audit context from request
 * 
 * Extracts all relevant context information for audit logging,
 * including impersonation state.
 */
export function getAuditContext(req: AuthRequest): AuditContext {
  const user = req.user;
  
  if (!user) {
    return {
      isImpersonating: false,
      performedByUserId: 0,
      contextMode: ContextMode.TENANT,
      timestamp: new Date(),
    };
  }
  
  const isImpersonating = !!user.isImpersonating;
  
  return {
    isImpersonating,
    performedByUserId: user.id,
    originalAssociationId: isImpersonating ? user.originalAssociationId : user.associationId ?? undefined,
    impersonatedAssociationId: isImpersonating ? user.associationId ?? undefined : undefined,
    contextMode: isImpersonating 
      ? ContextMode.IMPERSONATION 
      : (user.platformRole === 'SUPER_ADMIN' && req.path.startsWith('/api/admin') 
          ? ContextMode.SYSTEM 
          : ContextMode.TENANT),
    timestamp: new Date(),
  };
}

/**
 * Create an audit log entry with execution context
 * 
 * This is a helper that wraps the standard audit log creation
 * with additional context information for impersonation tracking.
 * 
 * @param req - The authenticated request
 * @param data - The audit log data
 */
export async function createAuditLogWithContext(
  req: AuthRequest,
  data: {
    associationId: number | null;
    action: string;
    tableName: string;
    recordId: number | null;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  }
): Promise<void> {
  const context = getAuditContext(req);
  
  try {
    await prisma.auditLog.create({
      data: {
        associationId: data.associationId,
        userId: req.user?.id || 0,
        action: data.action,
        tableName: data.tableName,
        recordId: data.recordId,
        oldValues: data.oldValues ? JSON.parse(JSON.stringify(data.oldValues)) : undefined,
        newValues: {
          ...(data.newValues || {}),
          // Attach audit context for impersonation tracking
          _auditContext: {
            isImpersonating: context.isImpersonating,
            performedByUserId: context.performedByUserId,
            originalAssociationId: context.originalAssociationId,
            impersonatedAssociationId: context.impersonatedAssociationId,
            contextMode: context.contextMode,
            timestamp: context.timestamp.toISOString(),
          },
        },
      },
    });
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('[Audit] Failed to create audit log with context:', error);
  }
}

/**
 * Create an impersonation audit log entry
 * 
 * Specifically for logging impersonation start/end events.
 * 
 * @param req - The authenticated request
 * @param action - 'IMPERSONATE' or 'END_IMPERSONATION'
 * @param targetAssociationId - The association being impersonated
 * @param additionalData - Any additional data to log
 */
export async function logImpersonationAction(
  req: AuthRequest,
  action: 'IMPERSONATE' | 'END_IMPERSONATION',
  targetAssociationId: number,
  additionalData?: Record<string, unknown>
): Promise<void> {
  const user = req.user;
  
  if (!user) {
    console.error('[Audit] Cannot log impersonation action without user');
    return;
  }
  
  try {
    await prisma.auditLog.create({
      data: {
        associationId: targetAssociationId,
        userId: user.id,
        action,
        tableName: 'associations',
        recordId: targetAssociationId,
        newValues: {
          performedBy: user.email,
          performedByUserId: user.id,
          originalAssociationId: user.originalAssociationId || user.associationId,
          targetAssociationId,
          timestamp: new Date().toISOString(),
          ...(additionalData || {}),
        },
      },
    });
  } catch (error) {
    console.error('[Audit] Failed to log impersonation action:', error);
  }
}

/**
 * Get impersonation duration in milliseconds
 * 
 * @param impersonationTimestamp - Unix timestamp when impersonation started
 * @returns Duration in milliseconds, or 0 if not impersonating
 */
export function getImpersonationDuration(impersonationTimestamp?: number): number {
  if (!impersonationTimestamp) return 0;
  return Date.now() - impersonationTimestamp;
}

/**
 * Format impersonation duration for display
 * 
 * @param durationMs - Duration in milliseconds
 * @returns Human-readable duration string
 */
export function formatImpersonationDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
