import { Router } from 'express';
import { AssociationsController } from './associations.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole, requireAssociationRole } from '../../middleware/rbac';
import { PlatformRole } from '@prisma/client';

const router = Router();
const ctrl = new AssociationsController();

// Public
router.get('/check-subdomain', (req, res) => ctrl.checkSubdomain(req, res));
router.post('/signup', (req, res) => ctrl.signup(req, res));

// Platform-admin managed (super admin only)
router.post('/', authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN]), (req, res) => ctrl.create(req, res));
router.get('/:id', authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN]), (req, res) => ctrl.getById(req, res));
router.patch('/:id', authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN]), (req, res) => ctrl.update(req, res));
router.delete('/:id', authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN]), (req, res) => ctrl.softDelete(req, res));

export default router;
