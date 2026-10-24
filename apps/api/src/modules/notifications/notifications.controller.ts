import { announcementsService } from './announcements.service';
import { RuleError } from '../finance/rule-error';
import { Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { AuthRequest } from '../../middleware/auth.middleware';
import {
  getPreferences as getRealPreferences,
  upsertPreferences,
  dispatchNotification,
  broadcastNotification,
} from '../../services/notification-preferences.service';

const createNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z.enum(['payment_due', 'payment_received', 'system', 'approval', 'announcement']),
  userId: z.number().optional(), // If not provided, broadcast to all users
  sendEmail: z.boolean().optional().default(false),
  sendSMS: z.boolean().optional().default(false),
});

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
  priority: z.enum(['info', 'warning', 'urgent']).optional().default('info'),
  audience: z.enum(['ALL', 'CATEGORY', 'SELECTED']).optional().default('ALL'),
  categories: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
  memberIds: z.array(z.number().int().positive()).max(5000).optional(),
  sendEmail: z.boolean().optional().default(false),
  sendSms: z.boolean().optional().default(false),
  smsText: z.string().trim().max(1000).optional(),
});

/** A rule the officer broke (not enough credits, SMS switched off…) keeps its status and code; a missing record is a 404. */
function announcementFailure(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, message: error.errors[0]?.message ?? 'Validation error', errors: error.errors });
  }
  if (error instanceof RuleError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  const message = error instanceof Error ? error.message : fallback;
  if (/not found$/i.test(message)) return res.status(404).json({ success: false, message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message });
}

export class NotificationsController {
  /**
   * List notifications for the current user
   */
  async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!userId || !associationId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const unreadOnly = req.query.unread === 'true';

      const whereClause: any = {
        userId,
        associationId,
      };

      if (unreadOnly) {
        whereClause.isRead = false;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.notification.count({ where: whereClause }),
        prisma.notification.count({
          where: { userId, associationId, isRead: false },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          notifications,
          total,
          unreadCount,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('List notifications error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!userId || !associationId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const count = await prisma.notification.count({
        where: { userId, associationId, isRead: false },
      });

      return res.json({
        success: true,
        data: { unreadCount: count },
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Create a notification (admin only)
   */
  async create(req: AuthRequest, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const adminId = req.user?.id;

      if (!associationId || !adminId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { title, message, type, userId, sendEmail: shouldSendEmail, sendSMS: shouldSendSMS } = createNotificationSchema.parse(req.body);

      // R3.6/G14/G42: both branches now go through dispatchNotification(),
      // which checks the recipient's real preferences (not an in-memory
      // Map nothing ever read) before creating the in-app row, emailing, or
      // texting — each channel independently gated per notification type.
      if (userId) {
        const result = await dispatchNotification({
          associationId,
          userId,
          title,
          message,
          kind: type,
          sendEmail: shouldSendEmail,
          sendSMS: shouldSendSMS,
          emailSubject: title,
          emailTemplate: 'notification',
          emailData: { title, message, type },
        });

        return res.status(201).json({
          success: true,
          message: 'Notification created',
          data: result,
        });
      } else {
        const result = await broadcastNotification(associationId, {
          title,
          message,
          kind: type,
          sendEmail: shouldSendEmail,
          sendSMS: shouldSendSMS,
          emailSubject: title,
          emailTemplate: 'notification',
          emailData: { title, message, type },
        });

        return res.status(201).json({
          success: true,
          message: `Notification sent to ${result.recipientCount} users`,
          data: result,
        });
      }
    } catch (error) {
      console.error('Create notification error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const notificationId = Number(req.params.id);

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId },
      });

      if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });

      return res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      console.error('Mark as read error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!userId || !associationId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const result = await prisma.notification.updateMany({
        where: { userId, associationId, isRead: false },
        data: { isRead: true },
      });

      return res.json({
        success: true,
        message: `${result.count} notifications marked as read`,
      });
    } catch (error) {
      console.error('Mark all as read error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Delete a notification
   */
  async delete(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const notificationId = Number(req.params.id);

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId },
      });

      if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }

      await prisma.notification.delete({
        where: { id: notificationId },
      });

      return res.json({
        success: true,
        message: 'Notification deleted',
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Send an announcement: to everyone, a kind of member, or hand-picked members; in the app and as a push, and optionally by email and
   * SMS. Needs the `notifications.send` permission (it used to need the admin role, so a treasurer or a custom role couldn't).
   */
  async createAnnouncement(req: AuthRequest, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const input = announcementSchema.parse(req.body);
      const result = await announcementsService.create(associationId, userId, input);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'ANNOUNCEMENT_CREATED',
          tableName: 'announcements',
          recordId: result.announcement.id,
          newValues: { title: input.title, audience: input.audience, sendEmail: input.sendEmail, sendSms: input.sendSms, members: result.reach.members },
        },
      });

      return res.status(201).json({
        success: true,
        message: `Announcement sent to ${result.reach.members} members`,
        data: {
          id: result.announcement.id,
          count: result.reach.members,
          inApp: result.announcement.inAppCount,
          noLogin: result.announcement.noLoginCount,
          emailsSent: result.announcement.emailCount,
          smsSent: result.smsSent,
          smsFailed: result.smsFailed,
          smsInProgress: result.inProgress,
          reach: result.reach,
        },
      });
    } catch (error) {
      return announcementFailure(res, error, 'Failed to create announcement');
    }
  }

  /** What sending this would do: who it reaches and misses, and what the SMS would cost against the balance. */
  async previewAnnouncement(req: AuthRequest, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const data = await announcementsService.preview(associationId, announcementSchema.parse(req.body));
      return res.json({ success: true, data });
    } catch (error) {
      return announcementFailure(res, error, 'Failed to preview the announcement');
    }
  }

  /** The announcements the association has sent, newest first. */
  async listAnnouncements(req: AuthRequest, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      return res.json({ success: true, data: await announcementsService.list(associationId, page, limit) });
    } catch (error) {
      return announcementFailure(res, error, 'Failed to list announcements');
    }
  }

  async getAnnouncement(req: AuthRequest, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      return res.json({ success: true, data: await announcementsService.get(associationId, parseInt(req.params.id)) });
    } catch (error) {
      return announcementFailure(res, error, 'Failed to get the announcement');
    }
  }
  /**
   * Get notification preferences for the current user
   */
  async getPreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!userId || !associationId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // R3.6/G14/G42: real DB-backed preferences, not an in-memory Map
      // that lost every value on restart and that nothing ever read.
      const preferences = await getRealPreferences(associationId, userId);

      return res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      console.error('Get preferences error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Update notification preferences for the current user
   */
  async updatePreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!userId || !associationId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const preferences = await upsertPreferences(associationId, userId, req.body);

      return res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: preferences,
      });
    } catch (error) {
      console.error('Update preferences error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
