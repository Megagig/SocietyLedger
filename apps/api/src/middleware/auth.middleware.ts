import { Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../lib/auth';
import { TenantRequest } from './tenant.middleware';
import { PlatformRole } from '@prisma/client';
import { getAssociationAccess, invalidateAccessCache, type AccessState } from '../services/subscription-access.service';

export interface AuthRequest extends TenantRequest {
  user?: TokenPayload;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header or cookies
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }

    // Enforce tenant isolation unless platform admin
    if (req.tenantId && decoded.associationId && decoded.platformRole !== PlatformRole.SUPER_ADMIN) {
      if (decoded.associationId !== req.tenantId) {
        res.status(403).json({
          success: false,
          message: 'Access denied for this association',
          code: 'TENANT_MISMATCH', // F0.5
        });
        return;
      }
    }

    // Attach user to request
    req.user = decoded;

    // For Super Admins, allow association context from X-Association-Id header
    // This enables Super Admins to view association data via impersonation or context switching
    if (decoded.platformRole === PlatformRole.SUPER_ADMIN) {
      const headerAssociationId = req.headers['x-association-id'] as string;
      console.log('[Auth] Super Admin detected, X-Association-Id header:', headerAssociationId);
      if (headerAssociationId && !isNaN(Number(headerAssociationId))) {
        // Override the associationId from the header for Super Admins
        req.user = { ...decoded, associationId: Number(headerAssociationId) };
        console.log('[Auth] Injected associationId from header:', Number(headerAssociationId));
      }
    }

    // An association whose trial or subscription has run out is blocked until it pays. Platform staff are never blocked, and a few
    // areas stay open so people can sign in, see why they are blocked, renew and reach support.
    // Someone on the billing pages may be paying right now, so never serve them a stale answer afterwards.
    if (decoded.associationId && (req.originalUrl ?? '').toLowerCase().startsWith('/api/subscriptions')) {
      invalidateAccessCache(decoded.associationId);
    }
    if (!decoded.platformRole && decoded.associationId && !isSubscriptionExempt(req.originalUrl)) {
      let access: AccessState | null = null;
      try {
        access = await getAssociationAccess(decoded.associationId);
      } catch (accessError) {
        // Never lock everyone out because the check itself failed.
        console.error('Subscription access check failed (allowing the request):', accessError);
      }
      if (access && !access.allowed) {
        res.status(403).json({
          success: false,
          message:
            access.reason === 'TRIAL_ENDED'
              ? 'Your free trial has ended. Renew to continue.'
              : 'Your subscription has ended. Renew to continue.',
          code: 'SUBSCRIPTION_INACTIVE',
          reason: access.reason,
          trialEnded: access.reason === 'TRIAL_ENDED',
          requiresRenewal: true,
        });
        return;
      }
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
}

/** Areas that stay open to a blocked association (sign-in/me, renewing, support, push-token cleanup on sign-out). */
const SUBSCRIPTION_EXEMPT_PREFIXES = ['/api/auth', '/api/subscriptions', '/api/support', '/api/help', '/api/devices'];

export function isSubscriptionExempt(originalUrl: string | undefined): boolean {
  const path = (originalUrl ?? '').split('?')[0].toLowerCase();
  return SUBSCRIPTION_EXEMPT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS', // F0.5
      });
      return;
    }

    next();
  };
}
