/**
 * Member Invites Routes
 * 
 * Routes for member login activation:
 * - Admin routes (protected): invite, revoke, resend, list
 * - Public routes: verify token, accept invite, self-register
 */

import { Router } from 'express';
import { memberInviteController } from './member-invites.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================

// Verify invite token - used by activation page to validate token
router.get('/verify', memberInviteController.verifyToken);

// Accept invite and create account - final step of invite flow
router.post('/accept', memberInviteController.acceptInvite);

// Member self-registration - creates member + user with auto-linking
router.post('/self-register', tenantMiddleware, memberInviteController.selfRegister);

// ============================================
// PROTECTED ROUTES (auth + tenant required)
// ============================================

// Apply auth and tenant middleware to all routes below
router.use(authMiddleware);
router.use(tenantMiddleware);

// Get members eligible for invite (no user account yet)
router.get(
  '/invitable',
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberInviteController.getInvitableMembers
);

// Get all pending invites
router.get(
  '/pending',
  requirePermission(PERMISSIONS.USER_CREATE),
  memberInviteController.getPendingInvites
);

// Get invite history for a specific member
router.get(
  '/member/:memberId/history',
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberInviteController.getMemberInviteHistory
);

// Invite a member to activate login
router.post(
  '/invite',
  requirePermission(PERMISSIONS.USER_CREATE),
  memberInviteController.inviteMember
);

// Bulk invite members
router.post(
  '/bulk-invite',
  requirePermission(PERMISSIONS.USER_CREATE),
  memberInviteController.bulkInvite
);

// Resend invite
router.post(
  '/:id/resend',
  requirePermission(PERMISSIONS.USER_CREATE),
  memberInviteController.resendInvite
);

// Revoke invite
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.USER_CREATE),
  memberInviteController.revokeInvite
);

export default router;
