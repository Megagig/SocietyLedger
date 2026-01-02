import { Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../lib/auth';
import { TenantRequest } from './tenant.middleware';
import { PlatformRole } from '@prisma/client';

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

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
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
      });
      return;
    }

    next();
  };
}
