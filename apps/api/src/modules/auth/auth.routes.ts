import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router: Router = Router();
const authController = new AuthController();

// Public routes
router.post('/login', (req, res) => authController.login(req, res));
router.post('/register', (req, res) => authController.register(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));

// Email verification routes
router.post('/verify-email', (req, res) => authController.verifyEmail(req, res));
router.post('/resend-verification', (req, res) => authController.resendVerificationCode(req, res));

// Password reset routes
router.post('/forgot-password', (req, res) => authController.forgotPassword(req, res));
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));

// F0.3 — refresh is public (the refresh token itself is the credential, rate-limited separately in server.ts)
router.post('/refresh', (req, res) => authController.refresh(req, res));

// Protected routes
router.get('/me', authMiddleware, (req, res) => authController.me(req, res));
router.post('/change-password', authMiddleware, (req, res) => authController.changePassword(req, res));
router.get('/sessions', authMiddleware, (req, res) => authController.getSessions(req, res));
router.delete('/sessions/:familyId', authMiddleware, (req, res) => authController.revokeSessionHandler(req, res));
router.post('/sessions/revoke-others', authMiddleware, (req, res) => authController.revokeOtherSessionsHandler(req, res));

// Impersonation handoff exchange (B4) — tenant-optional
router.post('/impersonation/exchange', (req, res) => authController.exchangeImpersonationCode(req, res));

export default router;
