import { Router } from 'express';
import { AdminAuthController } from './admin-auth.controller';
import { authRateLimit } from '../../middleware/rate-limit.middleware';

const router: Router = Router();
const ctrl = new AdminAuthController();

// Platform login — separate from tenant login; no tenant middleware
router.post('/login', authRateLimit, (req, res) => ctrl.login(req, res));
router.get('/me', (req, res) => ctrl.me(req, res));

export default router;
