import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth.middleware';
import { PlatformRole } from '@prisma/client';

export function requirePlatformRole(roles: PlatformRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const platformRole = req.user?.platformRole;
    if (!platformRole || !roles.includes(platformRole)) {
      return res.status(403).json({ success: false, message: 'Platform access denied' });
    }
    next();
  };
}

export function requireAssociationRole(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Super admins bypass association role checks
    if (req.user?.platformRole === PlatformRole.SUPER_ADMIN) {
      return next();
    }
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ success: false, message: 'Association access denied' });
    }
    next();
  };
}
