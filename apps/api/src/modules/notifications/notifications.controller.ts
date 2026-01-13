import { Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { AuthRequest } from '../../middleware/auth.middleware';
import { sendEmail } from '../../lib/email';

// In-memory store for preferences (in production, this should be a database table)
const preferencesStore = new Map<string, any>();

const createNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z.enum(['payment_due', 'payment_received', 'system', 'approval', 'announcement']),
  userId: z.number().optional(), // If not provided, broadcast to all users
  sendEmail: z.boolean().optional().default(false),
});

const announcementSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  priority: z.enum(['info', 'warning', 'urgent']).optional().default('info'),
  sendEmail: z.boolean().optional().default(false),
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

      const { title, message, type, userId, sendEmail: shouldSendEmail } = createNotificationSchema.parse(req.body);

      // If userId is provided, create for specific user; otherwise broadcast to all
      if (userId) {
        const notification = await prisma.notification.create({
          data: {
            associationId,
            userId,
            title,
            message,
            type,
          },
        });

        // Send email if requested
        if (shouldSendEmail) {
          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (user?.email) {
            try {
              await sendEmail({
                to: user.email,
                subject: title,
                template: 'notification',
                data: { title, message, type },
              });
            } catch (emailError) {
              console.error('Failed to send notification email:', emailError);
            }
          }
        }

        return res.status(201).json({
          success: true,
          message: 'Notification created',
          data: notification,
        });
      } else {
        // Broadcast to all users in the association
        const users = await prisma.user.findMany({
          where: { associationId, isActive: true },
          select: { id: true, email: true },
        });

        const notifications = await prisma.notification.createMany({
          data: users.map(user => ({
            associationId,
            userId: user.id,
            title,
            message,
            type,
          })),
        });

        // Send emails if requested
        if (shouldSendEmail) {
          const emails = users.filter(u => u.email).map(u => u.email);
          for (const email of emails) {
            try {
              await sendEmail({
                to: email,
                subject: title,
                template: 'notification',
                data: { title, message, type },
              });
            } catch (emailError) {
              console.error(`Failed to send email to ${email}:`, emailError);
            }
          }
        }

        return res.status(201).json({
          success: true,
          message: `Notification sent to ${users.length} users`,
          data: { count: notifications.count },
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

      const { title, message, priority, sendEmail: shouldSendEmail } = announcementSchema.parse(req.body);

      // Get all active users in the association
      const users = await prisma.user.findMany({
        where: { associationId, isActive: true },
        select: { id: true, email: true },
      });

      // Create notifications for all users
      const notifications = await prisma.notification.createMany({
        data: users.map(user => ({
          associationId,
          userId: user.id,
          title: `📢 ${title}`,
          message,
          type: 'system',
        })),
      });

      // Log the announcement
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: adminId,
          action: 'ANNOUNCEMENT_CREATED',
          tableName: 'notifications',
          newValues: { title, message, priority, recipientCount: users.length },
        },
      });

      // Send emails if requested
      if (shouldSendEmail) {
        const association = await prisma.association.findUnique({
          where: { id: associationId },
          select: { name: true },
        });

        for (const user of users) {
          if (user.email) {
            try {
              await sendEmail({
                to: user.email,
                subject: `📢 ${title} - ${association?.name || 'Association'}`,
                template: 'announcement',
                data: { 
                  title, 
                  message, 
                  priority,
                  associationName: association?.name || 'Your Association',
                },
              });
            } catch (emailError) {
              console.error(`Failed to send announcement email to ${user.email}:`, emailError);
            }
          }
        }
      }

      return res.status(201).json({
        success: true,
        message: `Announcement sent to ${users.length} users`,
        data: { 
          count: notifications.count,
          emailsSent: shouldSendEmail ? users.filter(u => u.email).length : 0,
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

      const userKey = `${associationId}-${userId}`;
      
      // Get preferences from store or return defaults
      const storedPreferences = preferencesStore.get(userKey);
      
      const defaultPreferences = {
        emailEnabled: true,
        smsEnabled: false,
        inAppEnabled: true,
        paymentDueEmail: true,
        paymentDueSMS: false,
        paymentDueInApp: true,
        paymentReceivedEmail: true,
        paymentReceivedSMS: false,
        paymentReceivedInApp: true,
        systemEmail: true,
        systemSMS: false,
        systemInApp: true,
        approvalEmail: true,
        approvalSMS: false,
        approvalInApp: true,
        announcementEmail: true,
        announcementSMS: false,
        announcementInApp: true,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        quietHoursTimezone: 'UTC',
      };

      const preferences = storedPreferences || defaultPreferences;

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

      const userKey = `${associationId}-${userId}`;
      const preferences = req.body;

      // Store preferences in memory
      preferencesStore.set(userKey, preferences);

      console.log(`Updated preferences for user ${userKey}:`, preferences);

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
