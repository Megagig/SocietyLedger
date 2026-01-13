import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { PlatformRole } from '@prisma/client';
import webhooksManagementRouter from './webhooks-management.controller';

const router = Router();

// Apply authentication middleware and require Super Admin platform role for all routes
router.use(authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN]));

// Mount webhooks management routes
router.use('/', webhooksManagementRouter);

export default router;
