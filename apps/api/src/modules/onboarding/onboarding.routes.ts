import { Router } from 'express';
import { OnboardingController } from './onboarding.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAssociationRole } from '../../middleware/rbac';

const router: Router = Router();
const controller = new OnboardingController();

// All routes require authentication
router.use(authMiddleware);

// Get onboarding status
router.get('/status', (req, res) => controller.getStatus(req, res));

// Complete a step (admin only)
router.patch('/complete-step', requireAssociationRole(['admin']), (req, res) => controller.completeStep(req, res));

// Skip onboarding (admin only)
router.post('/skip', requireAssociationRole(['admin']), (req, res) => controller.skip(req, res));

// Reset onboarding (admin only)
router.post('/reset', requireAssociationRole(['admin']), (req, res) => controller.reset(req, res));

export default router;
