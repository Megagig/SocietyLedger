// ============================================
// SUPPORT — PLATFORM ROUTES (Tier 2), mounted at /api/admin/support
// Open to SocietyLedger's SUPER_ADMIN and SUPPORT_AGENT staff. Mounted ahead of the SUPER_ADMIN-only /api/admin
// router, so support agents can reach it without being super admins.
// ============================================

import { Router } from 'express';
import { PlatformRole } from '@prisma/client';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { platformSupportController } from './support-platform.controller';
import { attachFiles } from './support-upload';

const router: Router = Router();

router.use(authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT]));

router.get('/stats', platformSupportController.getStats);
router.get('/staff', platformSupportController.listStaff);
router.get('/tickets', platformSupportController.listTickets);
router.get('/tickets/:id', platformSupportController.getTicket);
router.post('/tickets/:id/respond', attachFiles, platformSupportController.respond);
router.patch('/tickets/:id', platformSupportController.updateTicket);
router.get('/attachments/:id', platformSupportController.getAttachment);

export default router;
