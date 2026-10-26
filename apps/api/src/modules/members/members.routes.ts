import { requireFeature } from '../../middleware/module-feature.middleware';
import { memberLimitMiddleware } from '../../middleware/subscription.middleware';
import { Router } from 'express';
import { memberController } from './members.controller';
import { memberPhotoController, photoUpload } from './member-photo.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Get current user's member profile (must come before /:id route)
router.get('/me',
  memberController.getMe
);

// Update current user's member profile (must come before /:id route)
router.patch('/me',
  memberController.updateMe
);

// Profile photo. A member manages their own; admins with the member-edit permission manage anyone's in their association.
router.put('/me/photo', photoUpload, memberPhotoController.setMine);
router.delete('/me/photo', memberPhotoController.removeMine);

// Get member statistics (dashboard)
router.get('/stats',
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.getStats
);

// Bulk import members
router.post('/bulk',
  requireFeature('members.bulk_import'),
  requirePermission(PERMISSIONS.MEMBER_CREATE),
  memberLimitMiddleware((req) => (Array.isArray(req.body?.members) ? req.body.members.length : 0)),
  memberController.bulkImport
);

// List all members with pagination and filters
router.get('/',
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.list
);

// R7.3 (G65): tenant-scoped self-registration approval queue
router.get('/approvals',
  requirePermission(PERMISSIONS.MEMBER_EDIT_ALL),
  memberController.listPendingApprovals
);

router.patch('/approvals/:userId',
  requirePermission(PERMISSIONS.MEMBER_EDIT_ALL),
  memberController.updateApprovalStatus
);

// Get single member by ID
router.get('/:id',
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.getById
);

// Create new member
router.post('/',
  requirePermission(PERMISSIONS.MEMBER_CREATE),
  memberLimitMiddleware(),
  memberController.create
);

// Update member
router.patch('/:id',
  requirePermission(PERMISSIONS.MEMBER_EDIT),
  memberController.update
);

router.put('/:id/photo',
  requirePermission(PERMISSIONS.MEMBER_EDIT),
  photoUpload,
  memberPhotoController.setFor
);

router.delete('/:id/photo',
  requirePermission(PERMISSIONS.MEMBER_EDIT),
  memberPhotoController.removeFor
);

// Delete member (soft delete)
router.delete('/:id',
  requirePermission(PERMISSIONS.MEMBER_DELETE),
  memberController.delete
);

export default router;
