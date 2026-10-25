import { Router } from 'express';
import { NotificationsController } from './notifications.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAssociationRole, requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();
const controller = new NotificationsController();

// All routes require authentication
router.use(authMiddleware);

// User routes
router.get('/', (req, res) => controller.list(req, res));
router.get('/unread-count', (req, res) => controller.getUnreadCount(req, res));
router.get('/preferences', (req, res) => controller.getPreferences(req, res));
router.put('/preferences', (req, res) => controller.updatePreferences(req, res));
router.put('/:id/read', (req, res) => controller.markAsRead(req, res));
router.put('/read-all', (req, res) => controller.markAllAsRead(req, res));
router.delete('/:id', (req, res) => controller.delete(req, res));

// Admin routes
router.post('/', requireAssociationRole(['admin']), (req, res) => controller.create(req, res));
// Announcements: anyone who holds `notifications.send` (not only the admin role)
router.post('/announcement', requirePermission(PERMISSIONS.NOTIFICATION_SEND), (req, res) => controller.createAnnouncement(req, res));
router.post('/announcement/preview', requirePermission(PERMISSIONS.NOTIFICATION_SEND), (req, res) => controller.previewAnnouncement(req, res));
router.get('/announcements', requirePermission(PERMISSIONS.NOTIFICATION_SEND), (req, res) => controller.listAnnouncements(req, res));
router.get('/announcements/:id', requirePermission(PERMISSIONS.NOTIFICATION_SEND), (req, res) => controller.getAnnouncement(req, res));

export default router;
