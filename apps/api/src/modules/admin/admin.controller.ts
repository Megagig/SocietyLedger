import { Response } from 'express';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import prisma from '../../lib/prisma';
import { generateToken, TokenPayload } from '../../lib/auth';
import { AuthRequest } from '../../middleware/auth.middleware';
import { updateUserApproval, sendApprovalNotificationEmail } from '../auth/auth.service';
import { logImpersonationAction, getImpersonationDuration, formatImpersonationDuration } from '../../utils/audit-helpers';

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
   * Get audit logs (platform-wide or per association)
   */
  async auditLogs(req: AuthRequest, res: Response) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const skip = (page - 1) * limit;
      const associationId = req.query.associationId ? Number(req.query.associationId) : undefined;
      const action = req.query.action as string | undefined;

      const whereClause: any = {};
      if (associationId) {
        whereClause.associationId = associationId;
      }
      if (action) {
        whereClause.action = { contains: action, mode: 'insensitive' };
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, email: true } },
            association: { select: { id: true, name: true, subdomain: true } },
          },
        }),
        prisma.auditLog.count({ where: whereClause }),
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
}
