import { Request, Response } from 'express';
import { RBACService as RBACServiceCore } from '../../services/rbac.service';
import { PrismaClient, PlatformRole } from '@prisma/client';
import { RuleError } from '../finance/rule-error';
import * as rbacRoles from './rbac-roles.service';

const prisma = new PrismaClient();

/** Who is asking, or null when the request has no association behind it. */
function actorOf(req: Request): rbacRoles.Actor | null {
  const user = req.user;
  if (!user?.associationId) return null;
  return { id: user.id, associationId: user.associationId, platformRole: user.platformRole ?? null };
}

/** A rule the request broke answers with its own status and plain message; anything else is a 500. */
function respondWithError(res: Response, error: unknown, doing: string) {
  if (error instanceof RuleError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  console.error(`Error trying to ${doing}:`, error);
  return res.status(500).json({ success: false, message: `Could not ${doing}` });
}

/**
 * RBAC Controller - Handles role and permission management API endpoints
 */
export class RBACController {
  /**
   * Get all permissions (grouped by module)
   */
  static async getPermissions(req: Request, res: Response) {
    try {
      const permissions = await prisma.permission.findMany({
        where: { isActive: true },
        orderBy: [{ module: 'asc' }, { key: 'asc' }]
      });

      // Group by module
      const grouped = permissions.reduce((acc, perm) => {
        if (!acc[perm.module]) {
          acc[perm.module] = [];
        }
        acc[perm.module].push(perm);
        return acc;
      }, {} as Record<string, typeof permissions>);

      res.json({
        success: true,
        data: {
          permissions,
          grouped,
          total: permissions.length
        }
      });
    } catch (error) {
      console.error('Error fetching permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch permissions'
      });
    }
  }

  /**
   * Get all roles for the current association
   */
  static async getRoles(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      
      // This association's own roles only: platform roles (no association) are SocietyLedger staff's and are never shown here
      const roles = await prisma.role.findMany({
        where: {
          associationId,
          isActive: true
        },
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          _count: {
            select: { userRoles: { where: { isActive: true } } }
          }
        },
        orderBy: [{ isSystemRole: 'desc' }, { name: 'asc' }]
      });

      // Transform to include permission keys
      const transformedRoles = roles.map(role => ({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystemRole: role.isSystemRole,
        isActive: role.isActive,
        associationId: role.associationId,
        userCount: role._count.userRoles,
        permissions: role.permissions.map(rp => rp.permission.key),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      }));

      res.json({
        success: true,
        data: {
          roles: transformedRoles,
          total: roles.length
        }
      });
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch roles'
      });
    }
  }

  /**
   * Get a single role with full details
   */
  static async getRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      const role = await prisma.role.findFirst({
        where: {
          id: parseInt(id),
          associationId
        },
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          userRoles: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  role: true,
                  member: {
                    select: {
                      firstName: true,
                      lastName: true
                    }
                  }
                }
              }
            },
            where: { isActive: true }
          }
        }
      });

      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      res.json({
        success: true,
        data: {
          ...role,
          permissions: role.permissions.map(rp => rp.permission),
          users: role.userRoles.map(ur => ({
            id: ur.user.id,
            email: ur.user.email,
            name: ur.user.member 
              ? `${ur.user.member.firstName} ${ur.user.member.lastName}`
              : ur.user.email,
            assignedAt: ur.assignedAt
          }))
        }
      });
    } catch (error) {
      console.error('Error fetching role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch role'
      });
    }
  }

  /**
   * Create a new custom role (with only permissions the creator holds)
   */
  static async createRole(req: Request, res: Response) {
    try {
      const actor = actorOf(req);
      if (!actor) return res.status(400).json({ success: false, message: 'Association context required' });
      const role = await rbacRoles.createRole(actor, req.body);
      res.status(201).json({ success: true, message: 'Role created successfully', data: role });
    } catch (error) {
      respondWithError(res, error, 'create the role');
    }
  }

  /**
   * Update a role's name or permissions (never the Administrator role's permissions; never adding what you do not hold)
   */
  static async updateRole(req: Request, res: Response) {
    try {
      const actor = actorOf(req);
      if (!actor) return res.status(400).json({ success: false, message: 'Association context required' });
      const role = await rbacRoles.updateRole(actor, Number(req.params.id), req.body);
      res.json({ success: true, message: 'Role updated successfully', data: role });
    } catch (error) {
      respondWithError(res, error, 'update the role');
    }
  }

  /**
   * Delete a custom role
   */
  static async deleteRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      const role = await prisma.role.findFirst({
        where: {
          id: parseInt(id),
          associationId
        },
        include: {
          _count: { select: { userRoles: { where: { isActive: true } } } }
        }
      });

      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      if (role.isSystemRole) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete system roles'
        });
      }

      if (role._count.userRoles > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete role with ${role._count.userRoles} assigned users. Reassign users first.`
        });
      }

      await prisma.role.delete({
        where: { id: role.id }
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'ROLE_DELETED',
          tableName: 'roles',
          recordId: role.id,
          oldValues: { name: role.name, displayName: role.displayName }
        }
      });

      res.json({
        success: true,
        message: 'Role deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete role'
      });
    }
  }

  /**
   * Assign role to user (a role of this association only; nobody changes their own roles or gives more than they hold)
   */
  static async assignRole(req: Request, res: Response) {
    try {
      const actor = actorOf(req);
      if (!actor) return res.status(400).json({ success: false, message: 'Association context required' });
      const userRole = await rbacRoles.assignRole(actor, req.body);
      res.json({ success: true, message: 'Role assigned successfully', data: userRole });
    } catch (error) {
      respondWithError(res, error, 'assign the role');
    }
  }

  /**
   * Remove role from user (never the last Administrator)
   */
  static async removeRole(req: Request, res: Response) {
    try {
      const actor = actorOf(req);
      if (!actor) return res.status(400).json({ success: false, message: 'Association context required' });
      await rbacRoles.removeRole(actor, req.body);
      res.json({ success: true, message: 'Role removed successfully' });
    } catch (error) {
      respondWithError(res, error, 'remove the role');
    }
  }

  /**
   * Get users with their roles
   */
  static async getUsersWithRoles(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const { search } = req.query;
      // A page is at most 100 people; a missing or silly number falls back to the first page of 20.
      const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
      const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit)) || 20));

      const skip = (page - 1) * limit;

      const where: any = {
        associationId,
        isActive: true
      };

      if (search) {
        where.OR = [
          { email: { contains: String(search), mode: 'insensitive' } },
          { member: { firstName: { contains: String(search), mode: 'insensitive' } } },
          { member: { lastName: { contains: String(search), mode: 'insensitive' } } }
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          include: {
            member: {
              select: {
                firstName: true,
                lastName: true,
                memberId: true
              }
            },
            userRoles: {
              where: { isActive: true },
              include: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                    isSystemRole: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count({ where })
      ]);

      const transformedUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        legacyRole: user.role,
        platformRole: user.platformRole,
        name: user.member 
          ? `${user.member.firstName} ${user.member.lastName}`
          : user.email,
        memberId: user.member?.memberId,
        roles: user.userRoles.map(ur => ur.role),
        isActive: user.isActive,
        createdAt: user.createdAt
      }));

      res.json({
        success: true,
        data: {
          users: transformedUsers,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching users with roles:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users'
      });
    }
  }
}