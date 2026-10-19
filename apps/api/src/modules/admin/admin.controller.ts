import { Response } from 'express';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma';
import { generateToken, TokenPayload } from '../../lib/auth';
import { AuthRequest } from '../../middleware/auth.middleware';
import { updateUserApproval, sendApprovalNotificationEmail } from '../auth/auth.service';
import { logImpersonationAction, getImpersonationDuration, formatImpersonationDuration } from '../../utils/audit-helpers';
import { logSecurityEvent, requestContext } from '../../lib/security-audit-log';
import { SecurityEventActorType, SecurityEventSeverity } from '@prisma/client';

const BASE_DOMAIN = process.env.BASE_DOMAIN || 'societyledger.com.ng';

const approvalSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional(),
});

const impersonateSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  durationMinutes: z.number().int().min(1).max(240).default(240),
});

const associationActionSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

const searchSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
  tier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
  sortBy: z.enum(['createdAt', 'name', 'memberCount', 'userCount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export class AdminController {
  /**
   * Impersonate an association admin (super admin only).
   * 
   * Phase 22: Enhanced with impersonation tracking fields in token.
   */
  async impersonate(req: AuthRequest, res: Response) {
    try {
      const targetAssociationId = Number(req.params.associationId);
      const superAdmin = req.user;

      if (!superAdmin) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const association = await prisma.association.findUnique({ where: { id: targetAssociationId } });
      if (!association) {
        return res.status(404).json({ success: false, message: 'Association not found' });
      }

      // B4: Handoff code path
      const { reason, durationMinutes } = impersonateSchema.parse(req.body);

      const handoffCode = randomBytes(32).toString('hex');
      const codeHash = createHash('sha256').update(handoffCode).digest('hex');
      const expiresAt = new Date(Date.now() + 60_000); // 60 seconds

      await prisma.impersonationHandoff.create({
        data: {
          codeHash,
          adminUserId: superAdmin.id,
          associationId: targetAssociationId,
          reason,
          durationMinutes,
          expiresAt,
        },
      });

      await logImpersonationAction(req, 'IMPERSONATE', targetAssociationId, {
        targetAssociationName: association.name,
        targetSubdomain: association.subdomain,
        reason,
        durationMinutes,
      });

      void logSecurityEvent({
        eventType: 'IMPERSONATION_STARTED',
        severity: SecurityEventSeverity.CRITICAL,
        actorType: SecurityEventActorType.ADMIN,
        actorId: superAdmin.id,
        actorEmail: superAdmin.email,
        targetType: 'association',
        targetId: targetAssociationId,
        targetName: association.name,
        associationId: targetAssociationId,
        details: { reason, durationMinutes },
        ...requestContext(req),
      });

      return res.json({
        success: true,
        data: {
          handoffCode,
          subdomain: association.subdomain,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
      }
      console.error('Impersonate error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * End impersonation and return to home association.
   * 
   * Phase 22: New endpoint for explicitly ending impersonation.
   */
  async endImpersonation(req: AuthRequest, res: Response) {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      if (!user.isImpersonating) {
        return res.status(400).json({ 
          success: false, 
          message: 'Not currently impersonating any association',
        });
      }

      // Calculate impersonation duration
      const duration = getImpersonationDuration(user.impersonationTimestamp);
      const durationFormatted = formatImpersonationDuration(duration);

      // Log end of impersonation
      await logImpersonationAction(req, 'END_IMPERSONATION', user.associationId!, {
        duration,
        durationFormatted,
        originalAssociationId: user.originalAssociationId,
      });

      void logSecurityEvent({
        eventType: 'IMPERSONATION_ENDED',
        severity: SecurityEventSeverity.WARNING,
        actorType: SecurityEventActorType.ADMIN,
        actorId: user.id,
        actorEmail: user.email,
        targetType: 'association',
        targetId: user.associationId ?? undefined,
        associationId: user.associationId ?? undefined,
        details: { duration, durationFormatted },
        ...requestContext(req),
      });

      // Generate new token for home association (no impersonation flags)
      const payload: TokenPayload = {
        id: user.id,
        email: user.email,
        role: 'admin',
        associationId: user.originalAssociationId,
        platformRole: user.platformRole,
        // No impersonation flags - back to normal
      };

      const token = generateToken(payload);

      // Get home association details
      const homeAssociation = user.originalAssociationId 
        ? await prisma.association.findUnique({
            where: { id: user.originalAssociationId },
            select: { id: true, name: true, subdomain: true },
          })
        : null;

      return res.json({
        success: true,
        data: {
          token,
          association: homeAssociation,
          impersonationEnded: {
            previousAssociationId: user.associationId,
            duration,
            durationFormatted,
          },
        },
        message: `Impersonation ended. Session lasted ${durationFormatted}. Returned to home association.`,
      });
    } catch (error) {
      console.error('End impersonation error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * List all associations (super admin dashboard) with search and filters
   */
  async listAssociations(req: AuthRequest, res: Response) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      // Parse search and filter params
      const { search, status, tier, sortBy, sortOrder } = searchSchema.parse(req.query);

      // Build where clause
      const whereClause: any = {};
      
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { subdomain: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ];
      }
      
      if (status) {
        whereClause.status = status;
      }
      
      if (tier) {
        whereClause.tier = tier;
      }

      // Build order by
      let orderBy: any = { createdAt: 'desc' };
      if (sortBy) {
        if (sortBy === 'memberCount') {
          orderBy = { members: { _count: sortOrder || 'desc' } };
        } else if (sortBy === 'userCount') {
          orderBy = { users: { _count: sortOrder || 'desc' } };
        } else {
          orderBy = { [sortBy]: sortOrder || 'desc' };
        }
      }

      const [associations, total] = await Promise.all([
        prisma.association.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy,
          include: {
            subscriptions: { 
              take: 1, 
              orderBy: { createdAt: 'desc' }, 
              include: { plan: true } 
            },
            _count: { select: { users: true, members: true, transactions: true } },
          },
        }),
        prisma.association.count({ where: whereClause }),
      ]);

      return res.json({ 
        success: true, 
        data: { 
          associations, 
          total, 
          page, 
          limit,
          totalPages: Math.ceil(total / limit),
        } 
      });
    } catch (error) {
      console.error('List associations error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get single association details
   */
  async getAssociation(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);

      const association = await prisma.association.findUnique({
        where: { id: associationId },
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              plan: true,
              payments: { orderBy: { createdAt: 'desc' }, take: 5 }
            },
          },
          users: {
            where: { role: 'admin' },
            select: { id: true, email: true, role: true },
            take: 3,
          },
          _count: {
            select: {
              users: true,
              members: true,
              transactions: true,
              payments: true,
              accounting: true,
            }
          },
        },
      });

      if (!association) {
        return res.status(404).json({ success: false, message: 'Association not found' });
      }

      // Get additional stats
      const [
        activeMembers,
        totalRevenue,
        pendingTransactions,
        recentActivity,
      ] = await Promise.all([
        prisma.member.count({ where: { associationId, status: 'active' } }),
        prisma.payment.aggregate({
          where: { associationId },
          _sum: { amountPaid: true },
        }),
        prisma.transaction.count({ where: { associationId, status: 'pending' } }),
        prisma.auditLog.findMany({
          where: { associationId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { email: true } } },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          association,
          stats: {
            activeMembers,
            totalRevenue: totalRevenue._sum.amountPaid || 0,
            pendingTransactions,
          },
          recentActivity,
        },
      });
    } catch (error) {
      console.error('Get association error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Suspend an association
   */
  async suspendAssociation(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const adminId = req.user?.id;
      const { reason } = associationActionSchema.parse(req.body);

      if (!adminId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const association = await prisma.association.findUnique({ where: { id: associationId } });
      if (!association) {
        return res.status(404).json({ success: false, message: 'Association not found' });
      }

      if (association.status === 'SUSPENDED') {
        return res.status(400).json({ success: false, message: 'Association is already suspended' });
      }

      // Update association status
      await prisma.association.update({
        where: { id: associationId },
        data: { status: 'SUSPENDED' },
      });

      // Log the action
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: adminId,
          action: 'ASSOCIATION_SUSPENDED',
          tableName: 'associations',
          recordId: associationId,
          oldValues: { status: association.status },
          newValues: { status: 'SUSPENDED', reason },
        },
      });

      void logSecurityEvent({
        eventType: 'ASSOCIATION_SUSPENDED',
        severity: SecurityEventSeverity.CRITICAL,
        actorType: SecurityEventActorType.ADMIN,
        actorId: adminId,
        actorEmail: req.user?.email,
        targetType: 'association',
        targetId: associationId,
        targetName: association.name,
        associationId,
        details: { reason, previousStatus: association.status },
        ...requestContext(req),
      });

      return res.json({
        success: true,
        message: 'Association suspended successfully',
      });
    } catch (error) {
      console.error('Suspend association error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Reactivate a suspended association
   */
  async reactivateAssociation(req: AuthRequest, res: Response) {
    try {
      const associationId = Number(req.params.associationId);
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const association = await prisma.association.findUnique({ where: { id: associationId } });
      if (!association) {
        return res.status(404).json({ success: false, message: 'Association not found' });
      }

      if (association.status === 'ACTIVE') {
        return res.status(400).json({ success: false, message: 'Association is already active' });
      }

      // Update association status
      await prisma.association.update({
        where: { id: associationId },
        data: { status: 'ACTIVE' },
      });

      // Log the action
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: adminId,
          action: 'ASSOCIATION_REACTIVATED',
          tableName: 'associations',
          recordId: associationId,
          oldValues: { status: association.status },
          newValues: { status: 'ACTIVE' },
        },
      });

      void logSecurityEvent({
        eventType: 'ASSOCIATION_REACTIVATED',
        severity: SecurityEventSeverity.WARNING,
        actorType: SecurityEventActorType.ADMIN,
        actorId: adminId,
        actorEmail: req.user?.email,
        targetType: 'association',
        targetId: associationId,
        targetName: association.name,
        associationId,
        details: { previousStatus: association.status },
        ...requestContext(req),
      });

      return res.json({
        success: true,
        message: 'Association reactivated successfully',
      });
    } catch (error) {
      console.error('Reactivate association error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Platform-wide stats with more details
   */
  async stats(req: AuthRequest, res: Response) {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalAssociations,
        activeAssociations,
        suspendedAssociations,
        totalUsers,
        totalMembers,
        pendingApprovals,
        newAssociationsThisMonth,
        newAssociationsThisWeek,
        subscriptionsByStatus,
        subscriptionsByTier,
        totalRevenue,
        revenueThisMonth,
      ] = await Promise.all([
        prisma.association.count(),
        prisma.association.count({ where: { status: 'ACTIVE' } }),
        prisma.association.count({ where: { status: 'SUSPENDED' } }),
        prisma.user.count(),
        prisma.member.count(),
        prisma.userApproval.count({ where: { approvalStatus: 'pending' } }),
        prisma.association.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.association.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.subscription.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        prisma.association.groupBy({
          by: ['tier'],
          _count: { tier: true },
        }),
        prisma.paymentHistory.aggregate({
          where: { status: 'SUCCESS' },
          _sum: { amount: true },
        }),
        prisma.paymentHistory.aggregate({
          where: { 
            status: 'SUCCESS',
            paidAt: { gte: thirtyDaysAgo },
          },
          _sum: { amount: true },
        }),
      ]);

      // Format subscription stats
      const subscriptionStats = subscriptionsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {} as Record<string, number>);

      // Format tier stats
      const tierStats = subscriptionsByTier.reduce((acc, item) => {
        acc[item.tier] = item._count.tier;
        return acc;
      }, {} as Record<string, number>);

      return res.json({
        success: true,
        data: {
          overview: {
            totalAssociations,
            activeAssociations,
            suspendedAssociations,
            totalUsers,
            totalMembers,
            pendingApprovals,
          },
          growth: {
            newAssociationsThisMonth,
            newAssociationsThisWeek,
          },
          subscriptions: subscriptionStats,
          tiers: tierStats,
          revenue: {
            total: totalRevenue._sum.amount || 0,
            thisMonth: revenueThisMonth._sum.amount || 0,
          },
        },
      });
    } catch (error) {
      console.error('Stats error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get platform analytics (charts data)
   */
  async analytics(req: AuthRequest, res: Response) {
    try {
      const days = Number(req.query.days) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get daily signups
      const dailySignups = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM associations
        WHERE created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      // Get daily revenue
      const dailyRevenue = await prisma.$queryRaw<{ date: Date; total: number }[]>`
        SELECT DATE(paid_at) as date, SUM(amount) as total
        FROM payment_history
        WHERE paid_at >= ${startDate} AND status = 'SUCCESS'
        GROUP BY DATE(paid_at)
        ORDER BY date ASC
      `;

      // Get subscription status distribution
      const subscriptionDistribution = await prisma.subscription.groupBy({
        by: ['status'],
        _count: { status: true },
      });

      // Get tier distribution
      const tierDistribution = await prisma.association.groupBy({
        by: ['tier'],
        _count: { tier: true },
      });

      return res.json({
        success: true,
        data: {
          dailySignups: dailySignups.map(d => ({ 
            date: d.date, 
            count: Number(d.count) 
          })),
          dailyRevenue: dailyRevenue.map(d => ({ 
            date: d.date, 
            total: Number(d.total) 
          })),
          subscriptionDistribution: subscriptionDistribution.map(s => ({
            status: s.status,
            count: s._count.status,
          })),
          tierDistribution: tierDistribution.map(t => ({
            tier: t.tier,
            count: t._count.tier,
          })),
        },
      });
    } catch (error) {
      console.error('Analytics error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get security event audit logs (platform-wide or per association).
   * Distinct from the generic record-change "audit_log" table — this reads
   * security_event_logs (logins, 2FA, impersonation, password resets,
   * suspensions, approvals, etc), written via lib/security-audit-log.ts.
   */
  async auditLogs(req: AuthRequest, res: Response) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 25;
      const skip = (page - 1) * limit;
      const associationId = req.query.associationId ? Number(req.query.associationId) : undefined;
      const search = req.query.search as string | undefined;
      const severity = req.query.severity as string | undefined;
      const eventType = req.query.eventType as string | undefined;
      const actorType = req.query.actorType as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const whereClause: any = {};
      if (associationId) whereClause.associationId = associationId;
      if (severity) whereClause.severity = severity;
      if (actorType) whereClause.actorType = actorType;
      if (eventType) whereClause.eventType = { contains: eventType, mode: 'insensitive' };
      if (search) {
        whereClause.OR = [
          { eventType: { contains: search, mode: 'insensitive' } },
          { actorEmail: { contains: search, mode: 'insensitive' } },
          { targetName: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (startDate || endDate) {
        whereClause.occurredAt = {};
        if (startDate) whereClause.occurredAt.gte = new Date(startDate);
        if (endDate) whereClause.occurredAt.lte = new Date(endDate);
      }

      const [logs, total] = await Promise.all([
        prisma.securityEventLog.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { occurredAt: 'desc' },
          include: {
            association: { select: { id: true, name: true, subdomain: true } },
          },
        }),
        prisma.securityEventLog.count({ where: whereClause }),
      ]);

      return res.json({
        success: true,
        data: {
          logs,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Audit logs error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * List pending user approvals (super admin)
   */
  async listPendingApprovals(req: AuthRequest, res: Response) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const status = (req.query.status as string) || 'pending';
      const associationId = req.query.associationId ? Number(req.query.associationId) : undefined;

      const whereClause: any = {
        approvalStatus: status,
      };

      if (associationId) {
        whereClause.user = { associationId };
      }

      const [approvals, total] = await Promise.all([
        prisma.userApproval.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                emailVerified: true,
                createdAt: true,
                association: {
                  select: {
                    id: true,
                    name: true,
                    subdomain: true,
                  },
                },
              },
            },
            approvedBy: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        }),
        prisma.userApproval.count({ where: whereClause }),
      ]);

      return res.json({
        success: true,
        data: {
          approvals,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('List pending approvals error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Approve or reject a user (super admin)
   */
  async updateApproval(req: AuthRequest, res: Response) {
    try {
      const userId = Number(req.params.userId);
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { status, rejectionReason } = approvalSchema.parse(req.body);

      // Get user details for email notification
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          association: { select: { name: true, subdomain: true } },
          userApproval: true,
        },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (!user.userApproval) {
        return res.status(400).json({ success: false, message: 'User approval record not found' });
      }

      // Update approval status
      const result = await updateUserApproval(userId, status, adminId, rejectionReason);

      if (!result.success) {
        return res.status(400).json({ success: false, message: result.message });
      }

      // Log the action
      await prisma.auditLog.create({
        data: {
          associationId: user.associationId || 0,
          userId: adminId,
          action: status === 'approved' ? 'USER_APPROVED' : 'USER_REJECTED',
          tableName: 'user_approvals',
          recordId: userId,
          newValues: { status, rejectionReason },
        },
      });

      void logSecurityEvent({
        eventType: status === 'approved' ? 'USER_APPROVED' : 'USER_REJECTED',
        severity: SecurityEventSeverity.INFO,
        actorType: SecurityEventActorType.ADMIN,
        actorId: adminId,
        actorEmail: req.user?.email,
        targetType: 'user',
        targetId: userId,
        targetName: user.email,
        associationId: user.associationId ?? undefined,
        details: { status, rejectionReason },
        ...requestContext(req),
      });

      // Send notification email
      try {
        await sendApprovalNotificationEmail(
          user.email,
          status,
          user.association?.name,
          rejectionReason,
          user.association?.subdomain
        );
      } catch (emailError) {
        console.error('Failed to send approval notification email:', emailError);
      }

      return res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Update approval error:', error);
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
   * Bulk approve/reject users
   */
  async bulkUpdateApprovals(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const schema = z.object({
        userIds: z.array(z.number()).min(1),
        status: z.enum(['approved', 'rejected']),
        rejectionReason: z.string().optional(),
      });

      const { userIds, status, rejectionReason } = schema.parse(req.body);

      const results = await Promise.allSettled(
        userIds.map(async (userId) => {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { association: { select: { name: true, subdomain: true } } },
          });

          if (!user) return { userId, success: false, message: 'User not found' };

          const result = await updateUserApproval(userId, status, adminId, rejectionReason);

          if (result.success) {
            try {
              await sendApprovalNotificationEmail(
                user.email,
                status,
                user.association?.name,
                rejectionReason,
                user.association?.subdomain
              );
            } catch (e) {
              console.error(`Failed to send email to ${user.email}:`, e);
            }
          }

          return { userId, ...result };
        })
      );

      const successful = results.filter(
        (r) => r.status === 'fulfilled' && (r.value as any).success
      ).length;

      return res.json({
        success: true,
        message: `${successful} of ${userIds.length} users ${status}`,
        data: { results },
      });
    } catch (error) {
      console.error('Bulk update approvals error:', error);
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

  async listImpersonationSessions(req: AuthRequest, res: Response) {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;

      const [items, total] = await Promise.all([
        prisma.impersonationHandoff.findMany({
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reason: true,
            durationMinutes: true,
            expiresAt: true,
            usedAt: true,
            createdAt: true,
            adminUser: { select: { id: true, email: true } },
            association: { select: { id: true, name: true, subdomain: true } },
          },
        }),
        prisma.impersonationHandoff.count(),
      ]);

      return res.json({
        success: true,
        data: { items, pagination: { total, limit, offset } },
      });
    } catch (error) {
      console.error('List impersonation sessions error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Webhook event logs ────────────────────────────────────────────────────

  async getWebhookStats(req: AuthRequest, res: Response) {
    try {
      const allLogs = await prisma.webhookEventLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: { id: true, source: true, status: true, createdAt: true },
      });

      function channelStats(logs: typeof allLogs) {
        const total = logs.length;
        const successful = logs.filter((l) => l.status === 'SUCCESS').length;
        const failed = logs.filter((l) => l.status === 'FAILED').length;
        const last = logs[0]?.createdAt ?? null;
        return {
          totalEvents: total,
          successfulEvents: successful,
          failedEvents: failed,
          successRate: total > 0 ? (successful / total) * 100 : 0,
          failureRate: total > 0 ? (failed / total) * 100 : 0,
          lastEventTime: last ? last.toISOString() : null,
        };
      }

      const recentFull = await prisma.webhookEventLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          eventType: true,
          source: true,
          status: true,
          statusCode: true,
          duration: true,
          errorMessage: true,
          payload: true,
          createdAt: true,
        },
      });

      return res.json({
        success: true,
        data: {
          paystack: channelStats(allLogs.filter((l) => l.source === 'paystack')),
          custom: channelStats(allLogs.filter((l) => l.source !== 'paystack')),
          overall: channelStats(allLogs),
          recentEvents: recentFull.map((e) => ({
            id: e.id,
            eventType: e.eventType,
            source: e.source,
            status: e.status.toLowerCase(),
            statusCode: e.statusCode,
            duration: e.duration,
            errorMessage: e.errorMessage,
            payload: e.payload,
            timestamp: e.createdAt.toISOString(),
          })),
        },
      });
    } catch (error) {
      console.error('getWebhookStats error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async listWebhookEvents(req: AuthRequest, res: Response) {
    try {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = 20;
      const skip = (page - 1) * limit;
      const { search, eventType, status } = req.query as Record<string, string | undefined>;

      const where: Record<string, unknown> = {};
      if (eventType) where.eventType = eventType;
      if (status) where.status = status.toUpperCase();
      if (search) {
        where.OR = [
          { eventType: { contains: search, mode: 'insensitive' } },
          { errorMessage: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.webhookEventLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip,
          select: {
            id: true,
            eventType: true,
            source: true,
            status: true,
            statusCode: true,
            duration: true,
            errorMessage: true,
            payload: true,
            createdAt: true,
          },
        }),
        prisma.webhookEventLog.count({ where }),
      ]);

      return res.json({
        success: true,
        data: {
          events: items.map((e) => ({
            id: e.id,
            eventType: e.eventType,
            source: e.source,
            status: e.status.toLowerCase(),
            statusCode: e.statusCode,
            duration: e.duration,
            errorMessage: e.errorMessage,
            payload: e.payload,
            timestamp: e.createdAt.toISOString(),
          })),
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('listWebhookEvents error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async retryFailedWebhooks(req: AuthRequest, res: Response) {
    try {
      const { count } = await prisma.webhookEventLog.updateMany({
        where: { status: 'FAILED' },
        data: { status: 'RETRYING' },
      });
      return res.json({ success: true, data: { queued: count } });
    } catch (error) {
      console.error('retryFailedWebhooks error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async retryWebhookEvent(req: AuthRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const event = await prisma.webhookEventLog.findUnique({ where: { id } });
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
      await prisma.webhookEventLog.update({ where: { id }, data: { status: 'RETRYING', retryCount: event.retryCount + 1 } });
      return res.json({ success: true, message: 'Event queued for retry' });
    } catch (error) {
      console.error('retryWebhookEvent error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── Admin account ─────────────────────────────────────────────────────────

  async getMe(req: AuthRequest, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: (req as any).user.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          platformRole: true,
          createdAt: true,
          lastLoginAt: true,
          totpSecretEnc: true,
        },
      });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          platformRole: user.platformRole,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          twoFactorEnabled: !!user.totpSecretEnc,
        },
      });
    } catch (error) {
      console.error('getMe error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async updateMe(req: AuthRequest, res: Response) {
    const schema = z.object({
      firstName: z.string().max(100).optional(),
      lastName: z.string().max(100).optional(),
    });
    try {
      const { firstName, lastName } = schema.parse(req.body);
      const user = await prisma.user.update({
        where: { id: (req as any).user.id },
        data: { firstName, lastName },
        select: { id: true, email: true, firstName: true, lastName: true, platformRole: true, createdAt: true, lastLoginAt: true, totpSecretEnc: true },
      });
      return res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          platformRole: user.platformRole,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          twoFactorEnabled: !!user.totpSecretEnc,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      console.error('updateMe error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async changePassword(req: AuthRequest, res: Response) {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    });
    try {
      const { currentPassword, newPassword } = schema.parse(req.body);
      const user = await prisma.user.findUnique({
        where: { id: (req as any).user.id },
        select: { id: true, passwordHash: true },
      });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash ?? '');
      if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      const newHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
      return res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      console.error('changePassword error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
