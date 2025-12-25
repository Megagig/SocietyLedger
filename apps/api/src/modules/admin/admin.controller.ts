import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { generateToken, TokenPayload } from '../../lib/auth';
import { AuthRequest } from '../../middleware/auth.middleware';

export class AdminController {
  /**
   * Impersonate an association admin (super admin only).
   * Returns a short-lived token scoped to the target association.
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

      // Log impersonation action
      await prisma.auditLog.create({
        data: {
          associationId: targetAssociationId,
          userId: superAdmin.userId,
          action: 'IMPERSONATE',
          tableName: 'associations',
          recordId: targetAssociationId,
          newValues: { impersonatedBy: superAdmin.email },
        },
      });

      // Generate a short-lived token for this association
      const payload: TokenPayload = {
        userId: superAdmin.userId,
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
        message: 'Impersonation token generated. Use this token to act as this association.',
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
      const [totalAssociations, activeAssociations, totalUsers, totalMembers] = await Promise.all([
        prisma.association.count(),
        prisma.association.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count(),
        prisma.member.count(),
      ]);

      return res.json({
        success: true,
        data: { totalAssociations, activeAssociations, totalUsers, totalMembers },
      });
    } catch (error) {
      console.error('Stats error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
