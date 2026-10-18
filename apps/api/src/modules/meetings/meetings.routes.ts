import { Router } from 'express';
import { meetingsController } from './meetings.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { requireModule } from '../../middleware/module-feature.middleware';

const router: Router = Router();

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Phase 19: Apply module check to all meetings routes
// In shadow mode, this logs but doesn't block; in enforce mode, it blocks access
router.use(requireModule('meetings'));

// ==================== DASHBOARD & ANALYTICS ====================

// Get meeting statistics
router.get('/stats',
  requirePermission(PERMISSIONS.MEETING_VIEW),
  meetingsController.getStats
);

// Get upcoming meetings
router.get('/upcoming',
  requirePermission(PERMISSIONS.MEETING_VIEW),
  meetingsController.getUpcoming
);

// Get recent meetings
router.get('/recent',
  requirePermission(PERMISSIONS.MEETING_VIEW),
  meetingsController.getRecent
);

// Get member attendance history
router.get('/attendance-history',
  requirePermission(PERMISSIONS.MEETING_VIEW),
  meetingsController.getMemberAttendanceHistory
);

// ==================== MEETING CRUD ====================

// List all meetings with pagination and filters
router.get('/',
  requirePermission(PERMISSIONS.MEETING_VIEW),
  meetingsController.getMeetings
);

// Get single meeting by ID
router.get('/:id',
  requirePermission(PERMISSIONS.MEETING_VIEW),
  meetingsController.getMeetingById
);

// Create new meeting
router.post('/',
  requirePermission(PERMISSIONS.MEETING_CREATE),
  meetingsController.createMeeting
);

// Update meeting
router.patch('/:id',
  requirePermission(PERMISSIONS.MEETING_EDIT),
  meetingsController.updateMeeting
);

// Cancel meeting
router.post('/:id/cancel',
  requirePermission(PERMISSIONS.MEETING_DELETE),
  meetingsController.cancelMeeting
);

// Delete meeting
router.delete('/:id',
  requirePermission(PERMISSIONS.MEETING_DELETE),
  meetingsController.deleteMeeting
);

// ==================== AGENDA ITEMS ====================

// Add agenda item
router.post('/:id/agenda',
  requirePermission(PERMISSIONS.MEETING_EDIT),
  meetingsController.addAgendaItem
);

// Update agenda item
router.patch('/:id/agenda/:agendaId',
  requirePermission(PERMISSIONS.MEETING_EDIT),
  meetingsController.updateAgendaItem
);

// Delete agenda item
router.delete('/:id/agenda/:agendaId',
  requirePermission(PERMISSIONS.MEETING_EDIT),
  meetingsController.deleteAgendaItem
);

// ==================== ATTENDANCE ====================

// Initialize attendance for all members
router.post('/:id/attendance/initialize',
  requirePermission(PERMISSIONS.MEETING_ATTENDANCE),
  meetingsController.initializeAttendance
);

// Get attendance for a meeting
router.get('/:id/attendance',
  requirePermission(PERMISSIONS.MEETING_VIEW),
  meetingsController.getAttendance
);

// Mark single attendance
router.post('/:id/attendance',
  requirePermission(PERMISSIONS.MEETING_ATTENDANCE),
  meetingsController.markAttendance
);

// Bulk mark attendance
router.post('/:id/attendance/bulk',
  requirePermission(PERMISSIONS.MEETING_ATTENDANCE),
  meetingsController.bulkMarkAttendance
);

// ==================== MINUTES ====================

// Get minutes for a meeting
router.get('/:id/minutes',
  requirePermission(PERMISSIONS.MEETING_VIEW),
  meetingsController.getMinutes
);

// Create minutes
router.post('/:id/minutes',
  requirePermission(PERMISSIONS.MEETING_MINUTES),
  meetingsController.createMinutes
);

// Update minutes
router.patch('/:id/minutes',
  requirePermission(PERMISSIONS.MEETING_MINUTES),
  meetingsController.updateMinutes
);

// Approve minutes
router.post('/:id/minutes/approve',
  requirePermission(PERMISSIONS.MEETING_MINUTES),
  meetingsController.approveMinutes
);

export default router;
