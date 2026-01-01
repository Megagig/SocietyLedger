/**
 * Context Types for Hybrid Super Admin Architecture
 * 
 * Phase 22: Defines the three context modes and execution context structure.
 * 
 * Context Modes:
 * - TENANT: Normal tenant operations within user's own association
 * - SYSTEM: Platform admin operations (accessing /api/admin/*)
 * - IMPERSONATION: Acting as another tenant (Super Admin impersonating)
 */

import { PlatformRole } from '@prisma/client';

/**
 * Execution context modes
 */
export enum ContextMode {
  /** Normal tenant operations - user operating within their own association */
  TENANT = 'TENANT',
  
  /** System/Platform operations - Super Admin accessing platform-level features */
  SYSTEM = 'SYSTEM',
  
  /** Impersonation mode - Super Admin acting as another association */
  IMPERSONATION = 'IMPERSONATION',
}

/**
 * Full execution context for a request
 */
export interface ExecutionContext {
  /** Current context mode */
  mode: ContextMode;
  
  /** User ID making the request */
  userId: number;
  
  /** User's home association ID (their actual association) */
  homeAssociationId: number | null;
  
  /** Current operating association ID (may differ during impersonation) */
  currentAssociationId: number | null;
  
  /** Whether user is currently impersonating another association */
  isImpersonating: boolean;
  
  /** The association being impersonated (if impersonating) */
  impersonatedAssociationId?: number;
  
  /** When impersonation started (if impersonating) */
  impersonationStartedAt?: Date;
  
  /** User's platform role (if any) */
  platformRole: PlatformRole | null;
  
  /** Whether this is a system context (platform admin operations) */
  isSystemContext: boolean;
  
  /** Whether user is a platform admin (Super Admin) */
  isPlatformAdmin: boolean;
}

/**
 * Enhanced token payload with impersonation tracking
 * 
 * This extends the base TokenPayload with additional fields for
 * tracking impersonation state. All new fields are optional for
 * backward compatibility.
 */
export interface EnhancedTokenPayload {
  /** User ID */
  id: number;
  
  /** User email */
  email: string;
  
  /** User's role within the association */
  role: string;
  
  /** Member ID (if user is linked to a member) */
  memberId?: number;
  
  /** 
   * Association ID - Now always set for Super Admins (Platform Association)
   * For regular users, this is their association
   * During impersonation, this is the impersonated association
   */
  associationId?: number;
  
  /** Platform role (SUPER_ADMIN, SUPPORT_AGENT, etc.) */
  platformRole?: PlatformRole;
  
  // ============================================
  // NEW: Impersonation tracking fields
  // ============================================
  
  /** Whether this token represents an impersonation session */
  isImpersonating?: boolean;
  
  /** 
   * Original association ID (home association) during impersonation
   * This is the Super Admin's actual association (Platform Association)
   */
  originalAssociationId?: number;
  
  /** Unix timestamp when impersonation started */
  impersonationTimestamp?: number;
}

/**
 * Audit context for logging actions with impersonation awareness
 */
export interface AuditContext {
  /** Whether the action was performed during impersonation */
  isImpersonating: boolean;
  
  /** User ID who performed the action */
  performedByUserId: number;
  
  /** User's home association (original, not impersonated) */
  originalAssociationId?: number;
  
  /** Association being impersonated (if impersonating) */
  impersonatedAssociationId?: number;
  
  /** Context mode when action was performed */
  contextMode: ContextMode;
  
  /** Timestamp of the action */
  timestamp: Date;
}

/**
 * Type guard to check if a token payload has impersonation fields
 */
export function isImpersonationToken(payload: EnhancedTokenPayload): boolean {
  return payload.isImpersonating === true && 
         payload.originalAssociationId !== undefined;
}

/**
 * Type guard to check if user is a platform admin
 */
export function isPlatformAdmin(platformRole: PlatformRole | null | undefined): boolean {
  return platformRole === 'SUPER_ADMIN';
}
