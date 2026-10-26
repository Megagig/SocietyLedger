import { requireFeature } from '../../middleware/module-feature.middleware';
import { Router } from 'express';
import { RBACController } from './rbac.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);
// A request without an association must never fall through to every association's roles
router.use((req, res, next) => {
  if (!req.user?.associationId) {
    res.status(400).json({ success: false, message: 'Association context required' });
    return;
  }
  next();
});

/**
 * Permission Routes
 */

// GET /api/rbac/permissions - Get all permissions (grouped by module)
router.get(
  '/permissions',
  requireAnyPermission([PERMISSIONS.ROLES_VIEW, PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.USER_VIEW]),
  RBACController.getPermissions
);

/**
 * Role Routes
 */

// GET /api/rbac/roles - Get all roles for the association
router.get(
  '/roles',
  requireAnyPermission([PERMISSIONS.ROLES_VIEW, PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.USER_VIEW]),
  RBACController.getRoles
);

// GET /api/rbac/roles/:id - Get a single role with details
router.get(
  '/roles/:id',
  requireAnyPermission([PERMISSIONS.ROLES_VIEW, PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.USER_VIEW]),
  RBACController.getRole
);

// POST /api/rbac/roles - Create a new custom role
router.post(
  '/roles',
  requireFeature('members.custom_roles'),
  requirePermission(PERMISSIONS.ROLES_CREATE),
  RBACController.createRole
);

// PUT /api/rbac/roles/:id - Update a role
router.put(
  '/roles/:id',
  requireFeature('members.custom_roles'),
  requirePermission(PERMISSIONS.ROLES_EDIT),
  RBACController.updateRole
);

// DELETE /api/rbac/roles/:id - Delete a custom role
router.delete(
  '/roles/:id',
  requireFeature('members.custom_roles'),
  requirePermission(PERMISSIONS.ROLES_EDIT),
  RBACController.deleteRole
);

/**
 * User Role Assignment Routes
 */

// GET /api/rbac/users - Get users with their roles
router.get(
  '/users',
  requireAnyPermission([PERMISSIONS.ROLES_VIEW, PERMISSIONS.USER_VIEW, PERMISSIONS.SETTINGS_VIEW]),
  RBACController.getUsersWithRoles
);

// POST /api/rbac/assign - Assign role to user
router.post(
  '/assign',
  requirePermission(PERMISSIONS.ROLES_ASSIGN),
  RBACController.assignRole
);

// POST /api/rbac/remove - Remove role from user
router.post(
  '/remove',
  requirePermission(PERMISSIONS.ROLES_ASSIGN),
  RBACController.removeRole
);

export default router;