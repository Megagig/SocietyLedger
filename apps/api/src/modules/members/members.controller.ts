import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { z } from 'zod';
// Phase 12: Cache invalidation
import { cacheInvalidationService } from '../../services/cache-invalidation.service';

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

const memberQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('10'),
  search: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
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
          console.log('[Members] Super Admin using X-Association-Id header:', associationId);
        }
      }
      
      // Debug logging for impersonation
      console.log('[Members] List request - User:', {
        id: req.user?.id,
        email: req.user?.email,
        associationId: req.user?.associationId,
        platformRole: req.user?.platformRole,
        isImpersonating: req.user?.isImpersonating,
        originalAssociationId: req.user?.originalAssociationId,
      });
      console.log('[Members] X-Association-Id header:', req.headers['x-association-id']);
      console.log('[Members] Final associationId for query:', associationId);

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }
      
      console.log('[Members] Querying members for associationId:', associationId);

      // Validate and parse query params
      const queryParams = memberQuerySchema.parse(req.query);
      const page = parseInt(queryParams.page);
      const limit = parseInt(queryParams.limit);
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = { associationId };

      // Search filter
      if (queryParams.search) {
        where.OR = [
          { firstName: { contains: queryParams.search, mode: 'insensitive' } },
          { lastName: { contains: queryParams.search, mode: 'insensitive' } },
          { email: { contains: queryParams.search, mode: 'insensitive' } },
          { phone: { contains: queryParams.search, mode: 'insensitive' } },
          { memberId: { contains: queryParams.search, mode: 'insensitive' } },
        ];
      }

      // Status filter
      if (queryParams.status) {
        where.status = queryParams.status;
      }

      // Category filter
      if (queryParams.category) {
        where.category = queryParams.category;
      }

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

      // Generate member ID
      const memberCount = await prisma.member.count({ where: { associationId } });
      const memberId = `MEM${String(memberCount + 1).padStart(4, '0')}`;

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

      // Update member
      const updatedMember = await prisma.member.update({
        where: { id: parseInt(id) },
        data: {
          ...validatedData,
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
        membersByCategory,
      ] = await Promise.all([
        prisma.member.count({ where: { associationId } }),
        prisma.member.count({ where: { associationId, status: 'active' } }),
        prisma.member.count({ where: { associationId, status: 'inactive' } }),
        prisma.member.count({ where: { associationId, status: 'suspended' } }),
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
          const memberId = `MEM${String(memberCount).padStart(4, '0')}`;

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
      const userEmail = req.user?.email;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      if (!userEmail) {
        return res.status(400).json({
          success: false,
          message: 'User email is required',
        });
      }

      // Find member by email and association
      const member = await prisma.member.findFirst({
        where: {
          associationId,
          email: userEmail,
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
      const userEmail = req.user?.email;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      if (!userEmail) {
        return res.status(400).json({
          success: false,
          message: 'User email is required',
        });
      }

      // Validate request body
      const validatedData = updateMemberSchema.parse(req.body);

      // Find member by email and association
      const existingMember = await prisma.member.findFirst({
        where: {
          associationId,
          email: userEmail,
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

      // Update member
      const updatedMember = await prisma.member.update({
        where: { id: existingMember.id },
        data: {
          ...validatedData,
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
};
