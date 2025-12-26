import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { generateToken, TokenPayload } from '../../lib/auth';
import { AuthRequest } from '../../middleware/auth.middleware';
import { updateUserApproval, sendApprovalNotificationEmail } from '../auth/auth.service';

const approvalSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional(),
});

export class AdminController {
  /**
   * Impersonate an association admin (super admin only).
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

      await prisma.auditLog.create({
        data: {
          associationId: targetAssociationId,
          userId: superAdmin.id,
          action: 'IMPERSONATE',
          tableName: 'associations',
          recordId: targetAssociationId,
          newValues: { impersonatedBy: superAdmin.email },
        },
      });

      const payload: TokenPayload = {
        id: superAdmin.id,
        email: superAdmin.email,
        role: 'admin',
        associationId: targetAssociationId,
        platformRole: superAdmin.platformRole,
      };

      const token = generateToken(payload);

      return res.json({
        success: true,
        data: {
          token,
          association: { id: association.id, name: association.name, subdomain: association.subdomain },
        },
        message: 'Impersonation token generated.',
      });
    } catch (error) {
      console.error('Impersonate error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * List all associations (super admin dashboard)
   */
  async listAssociations(req: AuthRequest, res: Response) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const [associations, total] = await Promise.all([
        prisma.association.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            subscriptions: { take: 1, orderBy: { createdAt: 'desc' }, include: { plan: true } },
            _count: { select: { users: true, members: true } },
          },
        }),
        prisma.association.count(),
      ]);

      return res.json({ success: true, data: { associations, total, page, limit } });
    } catch (error) {
      console.error('List associations error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Platform-wide stats
   */
  async stats(req: AuthRequest, res: Response) {
    try {
      const [totalAssociations, activeAssociations, totalUsers, totalMembers, pendingApprovals] = await Promise.all([
        prisma.association.count(),
        prisma.association.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count(),
        prisma.member.count(),
        prisma.userApproval.count({ where: { approvalStatus: 'pending' } }),
      ]);

      return res.json({
        success: true,
        data: { totalAssociations, activeAssociations, totalUsers, totalMembers, pendingApprovals },
      });
    } catch (error) {
      console.error('Stats error:', error);
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
}
