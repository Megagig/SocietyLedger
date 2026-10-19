import { Router } from 'express';
import { AdminAuthController } from './admin-auth.controller';
import { AdminTotpController } from './admin-totp.controller';
import { authRateLimit } from '../../middleware/rate-limit.middleware';

const router: Router = Router();
const ctrl = new AdminAuthController();
const totp = new AdminTotpController();

// Platform login — separate from tenant login; no tenant middleware
router.post('/login', authRateLimit, (req, res) => ctrl.login(req, res));
router.get('/me', (req, res) => ctrl.me(req, res));

// Platform admin invite accept flow (A2.12) — public, no session required
router.get('/invite/:token', (req, res) => ctrl.getInvite(req, res));
router.post('/invite/accept', authRateLimit, (req, res) => ctrl.acceptInvite(req, res));

// TOTP 2FA management (all require a valid platform token)
router.post('/2fa/setup', (req, res) => totp.setup(req, res));
router.post('/2fa/confirm', (req, res) => totp.confirm(req, res));
router.post('/2fa/verify', authRateLimit, (req, res) => totp.verify(req, res));
router.post('/2fa/recovery', authRateLimit, (req, res) => totp.recovery(req, res));
router.post('/2fa/regenerate-recovery', (req, res) => totp.regenerateRecovery(req, res));

export default router;
