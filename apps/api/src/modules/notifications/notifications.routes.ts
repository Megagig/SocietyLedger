import { Router } from 'express';
import { NotificationsController } from './notifications.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAssociationRole } from '../../middleware/rbac';

const router = Router();
const controller = new NotificationsController();

// All routes require authentication
router.use(authMiddleware);

// User routes
router.get('/', (req, res) => controller.list(req, res));
router.get('/unread-count', (req, res) => controller.getUnreadCount(req, res));
router.put('/:id/read', (req, res) => controller.markAsRead(req, res));
router.put('/read-all', (req, res) => controller.markAllAsRead(req, res));
router.delete('/:id', (req, res) => controller.delete(req, res));

// Admin routes
router.post('/', requireAssociationRole(['admin']), (req, res) => controller.create(req, res));
router.post('/announcement', requireAssociationRole(['admin']), (req, res) => controller.createAnnouncement(req, res));

export default router;
