import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
// Phase 12: Cache invalidation
import { cacheInvalidationService } from '../../services/cache-invalidation.service';
import { SettingsService } from '../settings/settings.service';
import { updateUserApproval, sendApprovalNotificationEmail } from '../auth/auth.service';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { buildMemberWhere, memberQuerySchema, resolvePaging, startOfMonthLagos } from './members.query';

// Validation schemas
const createMemberSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.preprocess(
    (val) => (val === '' || val === null ? null : val),
    z.string().email('Invalid email address').nullable().optional()
  ),
  phone: z.string().optional().nullable(),
  dateOfBirth: z.preprocess(
    (val) => (val === '' || val === null ? null : val),
    z.string().datetime().nullable().optional()
  ),
  gender: z.enum(['male', 'female', 'other']).default('male'),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  category: z.enum(['regular', 'executive', 'honorary', 'student']).default('regular'),
  status: z.enum(['active', 'inactive', 'suspended', 'terminated']).default('active'),
  joinDate: z.string().datetime('Join date is required'),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  emergencyContactRelationship: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // G80: only read when memberIdAutoGenerate is off — see create()
  memberId: z.string().min(1).optional().nullable(),
});

const updateMemberSchema = createMemberSchema.partial();

const bulkMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  category: z.string().default('regular'),
});

const bulkImportSchema = z.object({
  members: z.array(bulkMemberSchema).min(1, 'At least one member is required'),
});

export const memberController = {
  // Get all members with pagination, search, and filters
  async list(req: Request, res: Response) {
    try {
      let associationId = req.user?.associationId;
      
      // For Super Admins, prefer X-Association-Id header if present
      // This supports impersonation and context switching
      if (req.user?.platformRole === 'SUPER_ADMIN') {
        const headerAssociationId = req.headers['x-association-id'] as string;
        if (headerAssociationId && !isNaN(Number(headerAssociationId))) {
          associationId = Number(headerAssociationId);
        }
      }

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      // Validate and parse query params
      const queryParams = memberQuerySchema.parse(req.query);
      const { page, limit, skip } = resolvePaging(queryParams);
      const where = buildMemberWhere(associationId, queryParams);

      // Get total count
      const totalCount = await prisma.member.count({ where });

      // Get members with pagination
      const members = await prisma.member.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [queryParams.sortBy]: queryParams.sortOrder,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          members,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: skip + members.length < totalCount,
          },
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid filter or sort option', errors: error.issues });
      }
      console.error('Error fetching members:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch members',
      });
    }
  },

  // Get single member by ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      const member = await prisma.member.findFirst({
        where: {
          id: parseInt(id),
          associationId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
          transactions: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              category: true,
            },
          },
        },
      });

      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found',
        });
      }

      // Calculate financial summary
      const financialSummary = await prisma.transaction.aggregate({
        where: {
          memberId: member.id,
          associationId,
        },
        _sum: {
          amount: true,
        },
      });

      const paidAmount = await prisma.payment.aggregate({
        where: {
          transaction: {
            memberId: member.id,
            associationId,
          },
        },
        _sum: {
          amountPaid: true,
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          ...member,
          financialSummary: {
            totalDues: financialSummary._sum.amount || 0,
            totalPaid: paidAmount._sum.amountPaid || 0,
            balance: Number(financialSummary._sum.amount || 0) - Number(paidAmount._sum.amountPaid || 0),
          },
        },
      });
    } catch (error) {
      console.error('Error fetching member:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch member',
      });
    }
  },

  // Create new member
  async create(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      // Validate request body
      const validatedData = createMemberSchema.parse(req.body);

      // Generate member ID — R4.6/G53: Members & Access Settings'
      // memberIdPrefix was saved but never read; 'MEM' stays the fallback.
      // G80: memberIdAutoGenerate now has a real manual-entry fallback instead of
      // silently doing nothing when turned off.
      const memberIdAutoGenerate = await SettingsService.getSetting(associationId, 'members_access', 'memberIdAutoGenerate');
      let memberId: string;
      if (memberIdAutoGenerate === false) {
        if (!validatedData.memberId) {
          return res.status(400).json({
            success: false,
            message: 'Member ID is required (automatic generation is turned off for this association)',
          });
        }
        const existingId = await prisma.member.findFirst({
          where: { associationId, memberId: validatedData.memberId },
        });
        if (existingId) {
          return res.status(400).json({
            success: false,
            message: 'This member ID is already in use',
          });
        }
        memberId = validatedData.memberId;
      } else {
        const memberCount = await prisma.member.count({ where: { associationId } });
        const memberIdPrefix = (await SettingsService.getSetting(associationId, 'members_access', 'memberIdPrefix')) || 'MEM';
        memberId = `${memberIdPrefix}${String(memberCount + 1).padStart(4, '0')}`;
      }

      // Check if email already exists
      if (validatedData.email) {
        const existingMember = await prisma.member.findFirst({
          where: {
            associationId,
            email: validatedData.email,
          },
        });

        if (existingMember) {
          return res.status(400).json({
            success: false,
            message: 'Member with this email already exists',
          });
        }
      }

      // Create member
      const member = await prisma.member.create({
        data: {
          associationId,
          memberId,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          email: validatedData.email,
          phone: validatedData.phone,
          address: validatedData.address,
          city: validatedData.city,
          state: validatedData.state,
          country: validatedData.country,
          gender: validatedData.gender,
          dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : undefined,
          occupation: validatedData.occupation,
          emergencyContactName: validatedData.emergencyContactName,
          emergencyContactPhone: validatedData.emergencyContactPhone,
          emergencyContactRelationship: validatedData.emergencyContactRelationship,
          notes: validatedData.notes,
          joinDate: validatedData.joinDate ? new Date(validatedData.joinDate) : new Date(),
          status: validatedData.status,
          category: validatedData.category,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'CREATE',
          tableName: 'members',
          recordId: member.id,
          newValues: member,
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onMemberChange(associationId);

      return res.status(201).json({
        success: true,
        message: 'Member created successfully',
        data: member,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      console.error('Error creating member:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create member',
      });
    }
  },

  // Update member
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      // Validate request body
      const validatedData = updateMemberSchema.parse(req.body);

      // Check if member exists
      const existingMember = await prisma.member.findFirst({
        where: {
          id: parseInt(id),
          associationId,
        },
      });

      if (!existingMember) {
        return res.status(404).json({
          success: false,
          message: 'Member not found',
        });
      }

      // Check email uniqueness if changing
      if (validatedData.email && validatedData.email !== existingMember.email) {
        const emailExists = await prisma.member.findFirst({
          where: {
            associationId,
            email: validatedData.email,
            id: { not: parseInt(id) },
          },
        });

        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: 'Email already in use by another member',
          });
        }
      }

      // Update member — memberId is create-only (G80), never editable via this endpoint
      const { memberId: _ignoredMemberId, ...updateFields } = validatedData;
      const updatedMember = await prisma.member.update({
        where: { id: parseInt(id) },
        data: {
          ...updateFields,
          joinDate: validatedData.joinDate ? new Date(validatedData.joinDate) : undefined,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'UPDATE',
          tableName: 'members',
          recordId: updatedMember.id,
          oldValues: existingMember,
          newValues: updatedMember,
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onMemberChange(associationId);

      return res.status(200).json({
        success: true,
        message: 'Member updated successfully',
        data: updatedMember,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      console.error('Error updating member:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update member',
      });
    }
  },

  // Delete member (soft delete)
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      // Check if member exists
      const member = await prisma.member.findFirst({
        where: {
          id: parseInt(id),
          associationId,
        },
      });

      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found',
        });
      }

      // Check for pending transactions
      const pendingTransactions = await prisma.transaction.count({
        where: {
          memberId: parseInt(id),
          associationId,
          status: { in: ['pending', 'overdue'] },
        },
      });

      if (pendingTransactions > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete member with ${pendingTransactions} pending transaction(s)`,
          pendingTransactions,
        });
      }

      // Soft delete - update status to terminated
      const deletedMember = await prisma.member.update({
        where: { id: parseInt(id) },
        data: {
          status: 'terminated',
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'DELETE',
          tableName: 'members',
          recordId: deletedMember.id,
          oldValues: member,
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onMemberChange(associationId);

      return res.status(200).json({
        success: true,
        message: 'Member deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting member:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete member',
      });
    }
  },

  // Get member statistics
  async getStats(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      const [
        totalMembers,
        activeMembers,
        inactiveMembers,
        suspendedMembers,
        terminatedMembers,
        newThisMonth,
        withLogin,
        membersByCategory,
      ] = await Promise.all([
        prisma.member.count({ where: { associationId } }),
        prisma.member.count({ where: { associationId, status: 'active' } }),
        prisma.member.count({ where: { associationId, status: 'inactive' } }),
        prisma.member.count({ where: { associationId, status: 'suspended' } }),
        prisma.member.count({ where: { associationId, status: 'terminated' } }),
        prisma.member.count({ where: { associationId, createdAt: { gte: startOfMonthLagos() } } }),
        prisma.member.count({ where: { associationId, loginStatus: 'active' } }),
        prisma.member.groupBy({
          by: ['category'],
          where: { associationId },
          _count: { id: true },
        }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          totalMembers,
          activeMembers,
          inactiveMembers,
          suspendedMembers,
          terminatedMembers,
          newThisMonth,
          withLogin,
          byCategory: membersByCategory.reduce((acc, item) => {
            acc[item.category] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
        },
      });
    } catch (error) {
      console.error('Error fetching member stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch member statistics',
      });
    }
  },

  // Bulk import members
  async bulkImport(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      // Validate request body
      const { members } = bulkImportSchema.parse(req.body);

      // Get current member count for ID generation
      let memberCount = await prisma.member.count({ where: { associationId } });
      const memberIdPrefix = (await SettingsService.getSetting(associationId, 'members_access', 'memberIdPrefix')) || 'MEM';

      const results = {
        created: 0,
        skipped: 0,
        errors: [] as string[],
      };

      // Process each member
      for (const memberData of members) {
        try {
          // Skip if email exists (if email provided)
          if (memberData.email) {
            const existingMember = await prisma.member.findFirst({
              where: {
                associationId,
                email: memberData.email,
              },
            });

            if (existingMember) {
              results.skipped++;
              results.errors.push(`Skipped: ${memberData.firstName} ${memberData.lastName} - email already exists`);
              continue;
            }
          }

          // Generate member ID
          memberCount++;
          const memberId = `${memberIdPrefix}${String(memberCount).padStart(4, '0')}`;

          // Validate category
          const validCategories = ['regular', 'executive', 'honorary', 'student'];
          const category = validCategories.includes(memberData.category?.toLowerCase() || '')
            ? memberData.category?.toLowerCase()
            : 'regular';

          // Create member
          await prisma.member.create({
            data: {
              associationId,
              memberId,
              firstName: memberData.firstName,
              lastName: memberData.lastName,
              email: memberData.email || null,
              phone: memberData.phone || null,
              category: category as string,
              status: 'active',
              joinDate: new Date(),
            },
          });

          results.created++;
        } catch (err) {
          results.errors.push(`Failed: ${memberData.firstName} ${memberData.lastName}`);
        }
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'BULK_IMPORT',
          tableName: 'members',
          newValues: { imported: results.created, skipped: results.skipped },
        },
      });

      // Phase 12: Invalidate cache
      if (results.created > 0) {
        await cacheInvalidationService.onMemberChange(associationId);
      }

      return res.status(201).json({
        success: true,
        message: `Successfully imported ${results.created} members`,
        data: results,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      console.error('Error bulk importing members:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to import members',
      });
    }
  },

  // Get current user's member profile
  async getMe(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
      }

      // G15 (found at R2.7, 2026-10-15): this used to match on
      // Member.email === User.email, but Member.email is frequently null/
      // different from the login email — the real link is Member.userId.
      const member = await prisma.member.findFirst({
        where: {
          associationId,
          userId,
        },
      });

      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member profile not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: member,
      });
    } catch (error) {
      console.error('Error fetching member profile:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch member profile',
      });
    }
  },

  // Update current user's member profile
  async updateMe(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
      }

      // Validate request body
      const validatedData = updateMemberSchema.parse(req.body);

      // G15: see getMe() above — match on Member.userId, not Member.email.
      const existingMember = await prisma.member.findFirst({
        where: {
          associationId,
          userId,
        },
      });

      if (!existingMember) {
        return res.status(404).json({
          success: false,
          message: 'Member profile not found',
        });
      }

      // Check email uniqueness if changing
      if (validatedData.email && validatedData.email !== existingMember.email) {
        const emailExists = await prisma.member.findFirst({
          where: {
            associationId,
            email: validatedData.email,
            id: { not: existingMember.id },
          },
        });

        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: 'Email already in use by another member',
          });
        }
      }

      // Update member — memberId is create-only (G80), never editable via this endpoint
      const { memberId: _ignoredMemberId, ...updateFields } = validatedData;
      const updatedMember = await prisma.member.update({
        where: { id: existingMember.id },
        data: {
          ...updateFields,
          joinDate: validatedData.joinDate ? new Date(validatedData.joinDate) : undefined,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'UPDATE',
          tableName: 'members',
          recordId: updatedMember.id,
          oldValues: existingMember,
          newValues: updatedMember,
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onMemberChange(associationId);

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedMember,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      console.error('Error updating member profile:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update profile',
      });
    }
  },

  // R7.3 (G65): tenant-scoped approval queue — lets association admins approve
  // or reject self-registered members without needing platform Super Admin access.
  async listPendingApprovals(req: AuthRequest, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const page = Number(req.query.page) || 1;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const skip = (page - 1) * limit;
      const validStatuses = ['pending', 'approved', 'rejected'] as const;
      type ApprovalStatus = typeof validStatuses[number];
      const rawStatus = req.query.status as string;
      const status: ApprovalStatus = validStatuses.includes(rawStatus as ApprovalStatus) ? (rawStatus as ApprovalStatus) : 'pending';
      const search = (req.query.search as string | undefined)?.trim() ?? '';

      const whereClause: Prisma.UserApprovalWhereInput = {
        approvalStatus: status,
        user: {
          associationId,
          ...(search ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { member: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                ],
              }},
            ],
          } : {}),
        },
      };

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
                isActive: true,
                createdAt: true,
                member: {
                  select: {
                    id: true,
                    memberId: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                  },
                },
              },
            },
            approvedBy: {
              select: { id: true, email: true },
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
  },

  async updateApprovalStatus(req: AuthRequest, res: Response) {
    const approvalSchema = z.object({
      status: z.enum(['approved', 'rejected']),
      rejectionReason: z.string().optional(),
    });

    try {
      const associationId = req.user?.associationId;
      const adminId = req.user?.id;
      if (!associationId || !adminId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const userId = Number(req.params.userId);
      if (!userId) {
        return res.status(400).json({ success: false, message: 'Invalid userId' });
      }

      const { status, rejectionReason } = approvalSchema.parse(req.body);

      // Scope check: user must belong to this association
      const user = await prisma.user.findFirst({
        where: { id: userId, associationId },
        include: {
          association: { select: { name: true, subdomain: true } },
          userApproval: true,
        },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found in this association' });
      }

      if (!user.userApproval) {
        return res.status(400).json({ success: false, message: 'User approval record not found' });
      }

      const result = await updateUserApproval(userId, status, adminId, rejectionReason);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.message });
      }

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: adminId,
          action: status === 'approved' ? 'USER_APPROVED' : 'USER_REJECTED',
          tableName: 'user_approvals',
          recordId: userId,
          newValues: { status, rejectionReason },
        },
      });

      // The approval itself already committed, so a delivery failure must not fail the request —
      // but it is reported back so the admin can tell the member another way instead of assuming
      // they were notified.
      let emailSent = true;
      let emailError: string | undefined;
      try {
        await sendApprovalNotificationEmail(
          user.email,
          status,
          user.association?.name,
          rejectionReason,
          user.association?.subdomain
        );
      } catch (err) {
        emailSent = false;
        emailError = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Failed to send approval notification email to ${user.email}:`, err);
      }

      return res.json({ success: true, message: result.message, emailSent, emailError });
    } catch (error) {
      console.error('Update approval status error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
};
