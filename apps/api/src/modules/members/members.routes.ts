import { Router } from 'express';
import { memberController } from './members.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Get member statistics (dashboard)
router.get('/stats',
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.getStats
);

// List all members with pagination and filters
router.get('/',
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.list
);

// Get single member by ID
router.get('/:id',
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.getById
);

// Create new member
router.post('/',
  requirePermission(PERMISSIONS.MEMBER_CREATE),
  memberController.create
);

// Update member
router.patch('/:id',
  requirePermission(PERMISSIONS.MEMBER_EDIT),
  memberController.update
);

// Delete member (soft delete)
router.delete('/:id',
  requirePermission(PERMISSIONS.MEMBER_DELETE),
  memberController.delete
);

export default router;
