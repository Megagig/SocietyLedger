/**
 * Context Service for Hybrid Super Admin Architecture
 * 
 * Phase 22: Service to determine and manage execution context based on request state.
 * 
 * This service is READ-ONLY - it does not modify requests, only analyzes them.
 */

import { PlatformRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { 
  ContextMode, 
  ExecutionContext, 
  AuditContext,
  isPlatformAdmin,
} from '../types/context.types';

export class ContextService {
  /**
   * Determine execution context from request
   * 
   * This is READ-ONLY - does not modify the request
   * 
   * @param req - The authenticated request
   * @returns ExecutionContext with all context information
   */
  static determineContext(req: AuthRequest): ExecutionContext {
    const user = req.user;
    
    if (!user) {
      throw new Error('User not authenticated - cannot determine context');
    }
    
    const isUserPlatformAdmin = isPlatformAdmin(user.platformRole);
    const isImpersonating = !!user.isImpersonating;
    
    // Home association is the original association (before impersonation)
    // If impersonating, use originalAssociationId; otherwise use current associationId
    const homeAssociationId = isImpersonating 
      ? (user.originalAssociationId ?? null)
      : (user.associationId ?? null);
    
    // Current association is where the user is currently operating
    const currentAssociationId = user.associationId ?? null;
    
    // Determine context mode
    let mode: ContextMode;
    
    if (isImpersonating) {
      // User is impersonating another association
      mode = ContextMode.IMPERSONATION;
    } else if (isUserPlatformAdmin && this.isAdminRoute(req.path)) {
      // Platform admin accessing admin routes
      mode = ContextMode.SYSTEM;
    } else {
      // Normal tenant operations
      mode = ContextMode.TENANT;
    }
    
    return {
      mode,
      userId: user.id,
      homeAssociationId,
      currentAssociationId,
      isImpersonating,
      impersonatedAssociationId: isImpersonating ? currentAssociationId ?? undefined : undefined,
      impersonationStartedAt: user.impersonationTimestamp 
        ? new Date(user.impersonationTimestamp) 
        : undefined,
      platformRole: user.platformRole ?? null,
      isSystemContext: mode === ContextMode.SYSTEM,
      isPlatformAdmin: isUserPlatformAdmin,
    };
  }
  
  /**
   * Check if the request path is an admin route
   */
  static isAdminRoute(path: string): boolean {
    return path.startsWith('/api/admin');
  }
  
  /**
   * Check if user is in system context
   * 
   * System context = Platform admin accessing admin routes without impersonation
   */
  static isSystemContext(req: AuthRequest): boolean {
    if (!req.user) return false;
    
    return isPlatformAdmin(req.user.platformRole) && 
           this.isAdminRoute(req.path) &&
           !req.user.isImpersonating;
  }
  
  /**
   * Check if user is currently impersonating
   */
  static isImpersonating(req: AuthRequest): boolean {
    return !!req.user?.isImpersonating;
  }
  
  /**
   * Get home association ID (original, not impersonated)
   * 
   * During impersonation, this returns the Super Admin's actual association
   * (Platform Association), not the association being impersonated.
   */
  static getHomeAssociationId(req: AuthRequest): number | null {
    if (!req.user) return null;
    
    if (req.user.isImpersonating && req.user.originalAssociationId) {
      return req.user.originalAssociationId;
    }
    
    return req.user.associationId ?? null;
  }
  
  /**
   * Get current operating association ID
   * 
   * This is the association the user is currently operating in.
   * During impersonation, this is the impersonated association.
   */
  static getCurrentAssociationId(req: AuthRequest): number | null {
    return req.user?.associationId ?? null;
  }
  
  /**
   * Check if user can access platform admin features
   */
  static canAccessPlatformAdmin(req: AuthRequest): boolean {
    return isPlatformAdmin(req.user?.platformRole);
  }
  
  /**
   * Get audit context for logging
   * 
   * This provides all the context needed for comprehensive audit logging
   * that tracks impersonation state.
   */
  static getAuditContext(req: AuthRequest): AuditContext {
    const context = this.determineContext(req);
    
    return {
      isImpersonating: context.isImpersonating,
      performedByUserId: context.userId,
      originalAssociationId: context.homeAssociationId ?? undefined,
      impersonatedAssociationId: context.impersonatedAssociationId,
      contextMode: context.mode,
      timestamp: new Date(),
    };
  }
  
  /**
   * Get a human-readable description of the current context
   * 
   * Useful for logging and debugging
   */
  static describeContext(req: AuthRequest): string {
    const context = this.determineContext(req);
    
    switch (context.mode) {
      case ContextMode.IMPERSONATION:
        return `IMPERSONATION: User ${context.userId} impersonating association ${context.impersonatedAssociationId} (home: ${context.homeAssociationId})`;
      case ContextMode.SYSTEM:
        return `SYSTEM: Platform admin ${context.userId} in system context`;
      case ContextMode.TENANT:
        return `TENANT: User ${context.userId} in association ${context.currentAssociationId}`;
      default:
        return `UNKNOWN: User ${context.userId}`;
    }
  }
}
