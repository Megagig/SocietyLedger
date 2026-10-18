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
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  priority: z.enum(['info', 'warning', 'urgent']).optional().default('info'),
  sendEmail: z.boolean().optional().default(false),
  sendSMS: z.boolean().optional().default(false),
});

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
   * Create a system announcement (admin only)
   */
  async createAnnouncement(req: AuthRequest, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const adminId = req.user?.id;

      if (!associationId || !adminId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { title, message, priority, sendEmail: shouldSendEmail, sendSMS: shouldSendSMS } = announcementSchema.parse(req.body);

      const association = await prisma.association.findUnique({
        where: { id: associationId },
        select: { name: true },
      });

      // R3.6/G14/G42: real preference gating per recipient (was: in-memory
      // Map nothing read). Also now correctly typed 'announcement' rather
      // than 'system' — matches the dedicated announcementEmail/SMS/InApp
      // preference fields that already existed for exactly this category.
      const result = await broadcastNotification(associationId, {
        title: `📢 ${title}`,
        message,
        kind: 'announcement',
        sendEmail: shouldSendEmail,
        sendSMS: shouldSendSMS,
        emailSubject: `📢 ${title} - ${association?.name || 'Association'}`,
        emailTemplate: 'announcement',
        emailData: {
          title,
          message,
          priority,
          associationName: association?.name || 'Your Association',
        },
      });

      // Log the announcement
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: adminId,
          action: 'ANNOUNCEMENT_CREATED',
          tableName: 'notifications',
          newValues: { title, message, priority, recipientCount: result.recipientCount },
        },
      });

      return res.status(201).json({
        success: true,
        message: `Announcement sent to ${result.recipientCount} users`,
        data: {
          count: result.recipientCount,
          emailsSent: result.emailsSent,
          smsSent: result.smsSent,
        },
      });
    } catch (error) {
      console.error('Create announcement error:', error);
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
