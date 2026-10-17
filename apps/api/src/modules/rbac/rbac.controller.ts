import { Request, Response } from 'express';
import { RBACService as RBACServiceCore } from '../../services/rbac.service';
import { PrismaClient, PlatformRole } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';

const prisma = new PrismaClient();

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
      
      // Get association-specific roles and platform roles
      const roles = await prisma.role.findMany({
        where: {
          OR: [
            { associationId },
            { associationId: null } // Platform roles
          ],
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
          OR: [
            { associationId },
            { associationId: null }
          ]
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
   * Create a new custom role
   */
  static async createRole(req: Request, res: Response) {
    try {
      const { name, displayName, description, permissions } = req.body;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association context required'
        });
      }

      // Check if role name already exists
      const existing = await prisma.role.findUnique({
        where: {
          associationId_name: { associationId, name }
        }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'A role with this name already exists'
        });
      }

      // Create role with permissions
      const role = await prisma.role.create({
        data: {
          associationId,
          name: name.toLowerCase().replace(/\s+/g, '_'),
          displayName,
          description,
          isSystemRole: false,
          permissions: {
            create: permissions?.map((permKey: string) => ({
              permission: {
                connect: { key: permKey }
              }
            })) || []
          }
        },
        include: {
          permissions: {
            include: { permission: true }
          }
        }
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'ROLE_CREATED',
          tableName: 'roles',
          recordId: role.id,
          newValues: { name, displayName, permissions }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: role
      });
    } catch (error) {
      console.error('Error creating role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create role'
      });
    }
  }

  /**
   * Update a role's permissions
   */
  static async updateRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { displayName, description, permissions } = req.body;
      const associationId = req.user?.associationId;

      const role = await prisma.role.findFirst({
        where: {
          id: parseInt(id),
          associationId
        }
      });

      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      // System roles can only have permissions updated, not name/description
      if (role.isSystemRole && (displayName || description)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify system role name or description'
        });
      }

      // Update role
      const updatedRole = await prisma.$transaction(async (tx) => {
        // Update basic info if not system role
        if (!role.isSystemRole) {
          await tx.role.update({
            where: { id: role.id },
            data: {
              displayName: displayName || role.displayName,
              description: description !== undefined ? description : role.description
            }
          });
        }

        // Update permissions if provided
        if (permissions) {
          // Remove existing permissions
          await tx.rolePermission.deleteMany({
            where: { roleId: role.id }
          });

          // Add new permissions
          const permissionRecords = await tx.permission.findMany({
            where: { key: { in: permissions } }
          });

          await tx.rolePermission.createMany({
            data: permissionRecords.map(p => ({
              roleId: role.id,
              permissionId: p.id
            }))
          });
        }

        return tx.role.findUnique({
          where: { id: role.id },
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        });
      });

      // Clear permission cache for affected users
      const affectedUsers = await prisma.userRole.findMany({
        where: { roleId: role.id },
        select: { userId: true }
      });
      
      affectedUsers.forEach(ur => {
        RBACServiceCore.clearUserCache(ur.userId, associationId!);
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'ROLE_UPDATED',
          tableName: 'roles',
          recordId: role.id,
          oldValues: { displayName: role.displayName, description: role.description },
          newValues: { displayName, description, permissions }
        }
      });

      res.json({
        success: true,
        message: 'Role updated successfully',
        data: updatedRole
      });
    } catch (error) {
      console.error('Error updating role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update role'
      });
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
   * Assign role to user
   */
  static async assignRole(req: Request, res: Response) {
    try {
      const { userId, roleId } = req.body;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association context required'
        });
      }

      // Verify user belongs to association
      const user = await prisma.user.findFirst({
        where: { id: userId, associationId }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found in this association'
        });
      }

      // Verify role exists
      const role = await prisma.role.findFirst({
        where: {
          id: roleId,
          OR: [{ associationId }, { associationId: null }]
        }
      });

      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      // R4.6/G53: Members & Access Settings' allowMultipleRoles was saved
      // but never read — assignRole always stacked roles regardless. When
      // off (the default), assigning a new role retires any other active
      // one for this user instead of leaving both active.
      const allowMultipleRoles = await SettingsService.getSetting(associationId, 'members_access', 'allowMultipleRoles');
      if (!allowMultipleRoles) {
        await prisma.userRole.updateMany({
          where: { userId, associationId, roleId: { not: roleId }, isActive: true },
          data: { isActive: false },
        });
      }

      // Create or update user role
      const userRole = await prisma.userRole.upsert({
        where: {
          userId_roleId_associationId: {
            userId,
            roleId,
            associationId
          }
        },
        update: {
          isActive: true,
          assignedBy: req.user!.id,
          assignedAt: new Date()
        },
        create: {
          userId,
          roleId,
          associationId,
          assignedBy: req.user!.id,
          isActive: true
        }
      });

      // Also update the legacy role field for backward compatibility
      await prisma.user.update({
        where: { id: userId },
        data: { role: role.name }
      });

      // Clear permission cache
      RBACServiceCore.clearUserCache(userId, associationId);

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'ROLE_ASSIGNED',
          tableName: 'user_roles',
          recordId: userRole.id,
          newValues: { userId, roleId, roleName: role.name }
        }
      });

      res.json({
        success: true,
        message: 'Role assigned successfully',
        data: userRole
      });
    } catch (error) {
      console.error('Error assigning role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign role'
      });
    }
  }

  /**
   * Remove role from user
   */
  static async removeRole(req: Request, res: Response) {
    try {
      const { userId, roleId } = req.body;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association context required'
        });
      }

      const userRole = await prisma.userRole.findUnique({
        where: {
          userId_roleId_associationId: {
            userId,
            roleId,
            associationId
          }
        }
      });

      if (!userRole) {
        return res.status(404).json({
          success: false,
          message: 'User role assignment not found'
        });
      }

      // Deactivate instead of delete for audit trail
      await prisma.userRole.update({
        where: { id: userRole.id },
        data: { isActive: false }
      });

      // Clear permission cache
      RBACServiceCore.clearUserCache(userId, associationId);

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'ROLE_REMOVED',
          tableName: 'user_roles',
          recordId: userRole.id,
          oldValues: { userId, roleId }
        }
      });

      res.json({
        success: true,
        message: 'Role removed successfully'
      });
    } catch (error) {
      console.error('Error removing role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove role'
      });
    }
  }

  /**
   * Get users with their roles
   */
  static async getUsersWithRoles(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const { page = 1, limit = 20, search } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

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
          take: Number(limit),
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
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
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