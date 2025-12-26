import { Router } from 'express';
import { AdminController } from './admin.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { PlatformRole } from '@prisma/client';

const router = Router();
const ctrl = new AdminController();

// All routes require SUPER_ADMIN
router.use(authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN]));

// Association management
router.get('/associations', (req, res) => ctrl.listAssociations(req as any, res));
router.get('/stats', (req, res) => ctrl.stats(req as any, res));
router.post('/impersonate/:associationId', (req, res) => ctrl.impersonate(req as any, res));

// User approval management
router.get('/approvals', (req, res) => ctrl.listPendingApprovals(req as any, res));
router.patch('/approvals/:userId', (req, res) => ctrl.updateApproval(req as any, res));
router.post('/approvals/bulk', (req, res) => ctrl.bulkUpdateApprovals(req as any, res));

export default router;
