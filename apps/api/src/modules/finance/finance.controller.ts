import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
// Phase 12: Cache invalidation
import { cacheInvalidationService } from '../../services/cache-invalidation.service';

// ============================================
// VALIDATION SCHEMAS
// ============================================

// Financial Category Types
const categoryTypes = ['due', 'levy', 'donation', 'penalty'] as const;
const frequencyTypes = ['monthly', 'quarterly', 'annual', 'one-time'] as const;

const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  type: z.enum(categoryTypes),
  amount: z.number().positive('Amount must be positive').optional().nullable(),
  frequency: z.enum(frequencyTypes).optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  // Due-specific fields
  gracePeriodDays: z.number().int().min(0).optional(),
  lateFeeType: z.enum(['fixed', 'percentage']).optional(),
  lateFeeAmount: z.number().min(0).optional(),
  // Levy-specific fields
  targetAmount: z.number().positive().optional(),
  deadline: z.string().datetime().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

const categoryQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  type: z.string().optional(),
  isActive: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Transaction Schemas
const transactionStatusTypes = ['pending', 'paid', 'overdue', 'waived', 'partial'] as const;
const paymentMethodTypes = ['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque', 'other'] as const;

const createTransactionSchema = z.object({
  memberId: z.number().int().positive('Member ID is required'),
  categoryId: z.number().int().positive('Category ID is required'),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateTransactionSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  dueDate: z.string().datetime().optional().nullable(),
  status: z.enum(transactionStatusTypes).optional(),
  notes: z.string().optional().nullable(),
});

const bulkTransactionSchema = z.object({
  categoryId: z.number().int().positive('Category ID is required'),
  memberIds: z.array(z.number().int().positive()).min(1, 'At least one member is required'),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const transactionQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  memberId: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Payment Schemas
const recordPaymentSchema = z.object({
  transactionId: z.number().int().positive('Transaction ID is required'),
  amountPaid: z.number().positive('Amount must be positive'),
  paymentDate: z.string().datetime().optional(),
  paymentMethod: z.enum(paymentMethodTypes).optional(),
  notes: z.string().optional().nullable(),
});

const bulkPaymentSchema = z.object({
  transactionIds: z.array(z.number().int().positive()).min(1, 'At least one transaction is required'),
  paymentDate: z.string().datetime().optional(),
  paymentMethod: z.enum(paymentMethodTypes).optional(),
  notes: z.string().optional().nullable(),
});

// ============================================
// FINANCIAL CATEGORY CONTROLLER
// ============================================

export const financeController = {
  // ==========================================
  // CATEGORY ENDPOINTS
  // ==========================================

  // List all financial categories
  async listCategories(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = categoryQuerySchema.parse(req.query);
      const page = parseInt(queryParams.page);
      const limit = parseInt(queryParams.limit);
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = { associationId };

      if (queryParams.type) {
        where.type = queryParams.type;
      }

      if (queryParams.isActive !== undefined) {
        where.isActive = queryParams.isActive === 'true';
      }

      if (queryParams.search) {
        where.OR = [
          { name: { contains: queryParams.search, mode: 'insensitive' } },
          { description: { contains: queryParams.search, mode: 'insensitive' } },
        ];
      }

      const [categories, totalCount] = await Promise.all([
        prisma.financialCategory.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [queryParams.sortBy]: queryParams.sortOrder },
        }),
        prisma.financialCategory.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          categories,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: skip + categories.length < totalCount,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
  },

  // Get single category by ID
  async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const category = await prisma.financialCategory.findFirst({
        where: { id: parseInt(id), associationId },
        include: {
          _count: { select: { transactions: true } },
        },
      });

      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }

      // Get transaction stats for this category
      const stats = await prisma.transaction.aggregate({
        where: { categoryId: parseInt(id), associationId },
        _sum: { amount: true },
        _count: { id: true },
      });

      const paidStats = await prisma.transaction.aggregate({
        where: { categoryId: parseInt(id), associationId, status: 'paid' },
        _sum: { amount: true },
        _count: { id: true },
      });

      return res.status(200).json({
        success: true,
        data: {
          ...category,
          stats: {
            totalTransactions: stats._count.id,
            totalAmount: stats._sum.amount || 0,
            paidTransactions: paidStats._count.id,
            paidAmount: paidStats._sum.amount || 0,
            pendingAmount: (stats._sum.amount || new Decimal(0)).minus(paidStats._sum.amount || 0),
          },
        },
      });
    } catch (error) {
      console.error('Error fetching category:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch category' });
    }
  },

  // Create new category
  async createCategory(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = createCategorySchema.parse(req.body);

      // Check for duplicate name within same type
      const existing = await prisma.financialCategory.findFirst({
        where: {
          associationId,
          name: { equals: validatedData.name, mode: 'insensitive' },
          type: validatedData.type,
        },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: `A ${validatedData.type} category with this name already exists`,
        });
      }

      const category = await prisma.financialCategory.create({
        data: {
          associationId,
          name: validatedData.name,
          type: validatedData.type,
          amount: validatedData.amount,
          frequency: validatedData.frequency,
          description: validatedData.description,
          isActive: validatedData.isActive,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'CREATE',
          tableName: 'financial_categories',
          recordId: category.id,
          newValues: category,
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onCategoryChange(associationId);

      return res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: category,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating category:', error);
      return res.status(500).json({ success: false, message: 'Failed to create category' });
    }
  },

  // Update category
  async updateCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = updateCategorySchema.parse(req.body);

      const existing = await prisma.financialCategory.findFirst({
        where: { id: parseInt(id), associationId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }

      // Check name uniqueness if changing
      if (validatedData.name && validatedData.name !== existing.name) {
        const duplicate = await prisma.financialCategory.findFirst({
          where: {
            associationId,
            name: { equals: validatedData.name, mode: 'insensitive' },
            type: validatedData.type || existing.type,
            id: { not: parseInt(id) },
          },
        });

        if (duplicate) {
          return res.status(400).json({
            success: false,
            message: 'A category with this name already exists',
          });
        }
      }

      const updated = await prisma.financialCategory.update({
        where: { id: parseInt(id) },
        data: {
          name: validatedData.name,
          type: validatedData.type,
          amount: validatedData.amount,
          frequency: validatedData.frequency,
          description: validatedData.description,
          isActive: validatedData.isActive,
        },
      });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'UPDATE',
          tableName: 'financial_categories',
          recordId: updated.id,
          oldValues: existing,
          newValues: updated,
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onCategoryChange(associationId);

      return res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        data: updated,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating category:', error);
      return res.status(500).json({ success: false, message: 'Failed to update category' });
    }
  },

  // Delete category (soft delete by deactivating)
  async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const category = await prisma.financialCategory.findFirst({
        where: { id: parseInt(id), associationId },
      });

      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }

      // Check for pending transactions
      const pendingCount = await prisma.transaction.count({
        where: {
          categoryId: parseInt(id),
          associationId,
          status: { in: ['pending', 'overdue'] },
        },
      });

      if (pendingCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete category with ${pendingCount} pending transaction(s)`,
        });
      }

      // Soft delete
      await prisma.financialCategory.update({
        where: { id: parseInt(id) },
        data: { isActive: false },
      });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'DELETE',
          tableName: 'financial_categories',
          recordId: parseInt(id),
          oldValues: category,
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onCategoryChange(associationId);

      return res.status(200).json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
  },

  // Get category statistics
  async getCategoryStats(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const [byType, totalActive, totalInactive] = await Promise.all([
        prisma.financialCategory.groupBy({
          by: ['type'],
          where: { associationId },
          _count: { id: true },
        }),
        prisma.financialCategory.count({ where: { associationId, isActive: true } }),
        prisma.financialCategory.count({ where: { associationId, isActive: false } }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          totalActive,
          totalInactive,
          byType: byType.reduce((acc, item) => {
            acc[item.type] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
        },
      });
    } catch (error) {
      console.error('Error fetching category stats:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
    }
  },


  // ==========================================
  // TRANSACTION ENDPOINTS
  // ==========================================

  // List all transactions
  async listTransactions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = transactionQuerySchema.parse(req.query);
      const page = parseInt(queryParams.page);
      const limit = parseInt(queryParams.limit);
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = { associationId };

      if (queryParams.memberId) {
        where.memberId = parseInt(queryParams.memberId);
      }

      if (queryParams.categoryId) {
        where.categoryId = parseInt(queryParams.categoryId);
      }

      if (queryParams.status) {
        where.status = queryParams.status;
      }

      if (queryParams.type) {
        where.category = { type: queryParams.type };
      }

      if (queryParams.startDate || queryParams.endDate) {
        where.createdAt = {};
        if (queryParams.startDate) {
          where.createdAt.gte = new Date(queryParams.startDate);
        }
        if (queryParams.endDate) {
          where.createdAt.lte = new Date(queryParams.endDate);
        }
      }

      if (queryParams.search) {
        where.OR = [
          { referenceNumber: { contains: queryParams.search, mode: 'insensitive' } },
          { notes: { contains: queryParams.search, mode: 'insensitive' } },
          { member: { firstName: { contains: queryParams.search, mode: 'insensitive' } } },
          { member: { lastName: { contains: queryParams.search, mode: 'insensitive' } } },
        ];
      }

      const [transactions, totalCount] = await Promise.all([
        prisma.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [queryParams.sortBy]: queryParams.sortOrder },
          include: {
            member: {
              select: { id: true, memberId: true, firstName: true, lastName: true, email: true },
            },
            category: {
              select: { id: true, name: true, type: true },
            },
            payments: {
              select: { id: true, amountPaid: true, paymentDate: true, paymentMethod: true },
            },
          },
        }),
        prisma.transaction.count({ where }),
      ]);

      // Calculate paid amount for each transaction
      const transactionsWithBalance = transactions.map(txn => {
        const totalPaid = txn.payments.reduce(
          (sum, p) => sum.plus(p.amountPaid),
          new Decimal(0)
        );
        return {
          ...txn,
          totalPaid,
          balance: new Decimal(txn.amount).minus(totalPaid),
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          transactions: transactionsWithBalance,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: skip + transactions.length < totalCount,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
    }
  },

  // Get single transaction by ID
  async getTransactionById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const transaction = await prisma.transaction.findFirst({
        where: { id: parseInt(id), associationId },
        include: {
          member: {
            select: { id: true, memberId: true, firstName: true, lastName: true, email: true, phone: true },
          },
          category: true,
          payments: {
            orderBy: { paymentDate: 'desc' },
            include: {
              confirmer: { select: { id: true, email: true } },
            },
          },
          creator: { select: { id: true, email: true } },
        },
      });

      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      const totalPaid = transaction.payments.reduce(
        (sum, p) => sum.plus(p.amountPaid),
        new Decimal(0)
      );

      return res.status(200).json({
        success: true,
        data: {
          ...transaction,
          totalPaid,
          balance: new Decimal(transaction.amount).minus(totalPaid),
        },
      });
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch transaction' });
    }
  },

  // Create new transaction
  async createTransaction(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = createTransactionSchema.parse(req.body);

      // Verify member exists
      const member = await prisma.member.findFirst({
        where: { id: validatedData.memberId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }

      // Verify category exists and is active
      const category = await prisma.financialCategory.findFirst({
        where: { id: validatedData.categoryId, associationId, isActive: true },
      });

      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found or inactive' });
      }

      // Generate reference number
      const txnCount = await prisma.transaction.count({ where: { associationId } });
      const referenceNumber = `TXN${String(txnCount + 1).padStart(6, '0')}`;

      const transaction = await prisma.transaction.create({
        data: {
          associationId,
          memberId: validatedData.memberId,
          categoryId: validatedData.categoryId,
          amount: validatedData.amount,
          dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
          referenceNumber,
          status: 'pending',
          notes: validatedData.notes,
          createdBy: req.user!.id,
        },
        include: {
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
          category: { select: { id: true, name: true, type: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'CREATE',
          tableName: 'transactions',
          recordId: transaction.id,
          newValues: transaction,
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onTransactionChange(associationId);

      return res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        data: transaction,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating transaction:', error);
      return res.status(500).json({ success: false, message: 'Failed to create transaction' });
    }
  },

  // Bulk create transactions (assign dues/levies to multiple members)
  async bulkCreateTransactions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = bulkTransactionSchema.parse(req.body);

      // Verify category exists
      const category = await prisma.financialCategory.findFirst({
        where: { id: validatedData.categoryId, associationId, isActive: true },
      });

      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found or inactive' });
      }

      // Verify all members exist
      const members = await prisma.member.findMany({
        where: { id: { in: validatedData.memberIds }, associationId },
      });

      if (members.length !== validatedData.memberIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some members not found',
          found: members.length,
          requested: validatedData.memberIds.length,
        });
      }

      // Get current transaction count for reference numbers
      const txnCount = await prisma.transaction.count({ where: { associationId } });

      // Create transactions in bulk
      const transactions = await prisma.$transaction(
        validatedData.memberIds.map((memberId, index) =>
          prisma.transaction.create({
            data: {
              associationId,
              memberId,
              categoryId: validatedData.categoryId,
              amount: validatedData.amount,
              dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
              referenceNumber: `TXN${String(txnCount + index + 1).padStart(6, '0')}`,
              status: 'pending',
              notes: validatedData.notes,
              createdBy: req.user!.id,
            },
          })
        )
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'BULK_CREATE',
          tableName: 'transactions',
          newValues: { count: transactions.length, categoryId: validatedData.categoryId },
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onTransactionChange(associationId);

      return res.status(201).json({
        success: true,
        message: `${transactions.length} transactions created successfully`,
        data: { count: transactions.length, transactions },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating bulk transactions:', error);
      return res.status(500).json({ success: false, message: 'Failed to create transactions' });
    }
  },

  // Update transaction
  async updateTransaction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = updateTransactionSchema.parse(req.body);

      const existing = await prisma.transaction.findFirst({
        where: { id: parseInt(id), associationId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      // Don't allow editing paid transactions
      if (existing.status === 'paid' && validatedData.status !== 'paid') {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify a fully paid transaction',
        });
      }

      const updated = await prisma.transaction.update({
        where: { id: parseInt(id) },
        data: {
          amount: validatedData.amount,
          dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
          status: validatedData.status,
          notes: validatedData.notes,
        },
        include: {
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
          category: { select: { id: true, name: true, type: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'UPDATE',
          tableName: 'transactions',
          recordId: updated.id,
          oldValues: existing,
          newValues: updated,
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onTransactionChange(associationId);

      return res.status(200).json({
        success: true,
        message: 'Transaction updated successfully',
        data: updated,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating transaction:', error);
      return res.status(500).json({ success: false, message: 'Failed to update transaction' });
    }
  },

  // Delete transaction
  async deleteTransaction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const transaction = await prisma.transaction.findFirst({
        where: { id: parseInt(id), associationId },
        include: { payments: true },
      });

      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      // Don't allow deleting transactions with payments
      if (transaction.payments.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete transaction with recorded payments',
        });
      }

      await prisma.transaction.delete({ where: { id: parseInt(id) } });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'DELETE',
          tableName: 'transactions',
          recordId: parseInt(id),
          oldValues: transaction,
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onTransactionChange(associationId);

      return res.status(200).json({
        success: true,
        message: 'Transaction deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete transaction' });
    }
  },

  // Get transaction statistics
  async getTransactionStats(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const [byStatus, byType, totals] = await Promise.all([
        prisma.transaction.groupBy({
          by: ['status'],
          where: { associationId },
          _count: { id: true },
          _sum: { amount: true },
        }),
        prisma.$queryRaw`
          SELECT fc.type, COUNT(t.id)::int as count, COALESCE(SUM(t.amount), 0) as total
          FROM transactions t
          JOIN financial_categories fc ON t.category_id = fc.id
          WHERE t.association_id = ${associationId}
          GROUP BY fc.type
        ` as Promise<Array<{ type: string; count: number; total: Decimal }>>,
        prisma.transaction.aggregate({
          where: { associationId },
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

      // Get total payments
      const totalPayments = await prisma.payment.aggregate({
        where: { associationId },
        _sum: { amountPaid: true },
      });

      return res.status(200).json({
        success: true,
        data: {
          totalTransactions: totals._count.id,
          totalAmount: totals._sum.amount || 0,
          totalPaid: totalPayments._sum.amountPaid || 0,
          totalOutstanding: (totals._sum.amount || new Decimal(0)).minus(totalPayments._sum.amountPaid || 0),
          byStatus: byStatus.reduce((acc, item) => {
            acc[item.status] = { count: item._count.id, amount: item._sum.amount || 0 };
            return acc;
          }, {} as Record<string, { count: number; amount: Decimal | number }>),
          byType: byType.reduce((acc, item) => {
            acc[item.type] = { count: item.count, amount: item.total };
            return acc;
          }, {} as Record<string, { count: number; amount: Decimal }>),
        },
      });
    } catch (error) {
      console.error('Error fetching transaction stats:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
    }
  },


  // ==========================================
  // PAYMENT ENDPOINTS
  // ==========================================

  // Record a payment for a transaction
  async recordPayment(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = recordPaymentSchema.parse(req.body);

      // Get transaction with payments
      const transaction = await prisma.transaction.findFirst({
        where: { id: validatedData.transactionId, associationId },
        include: { payments: true },
      });

      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      // Calculate current paid amount
      const currentPaid = transaction.payments.reduce(
        (sum, p) => sum.plus(p.amountPaid),
        new Decimal(0)
      );
      const balance = new Decimal(transaction.amount).minus(currentPaid);

      if (balance.lessThanOrEqualTo(0)) {
        return res.status(400).json({
          success: false,
          message: 'Transaction is already fully paid',
        });
      }

      if (new Decimal(validatedData.amountPaid).greaterThan(balance)) {
        return res.status(400).json({
          success: false,
          message: `Payment amount exceeds balance. Maximum: ${balance}`,
        });
      }

      // Generate unique receipt number with timestamp to avoid collisions
      const timestamp = Date.now().toString().slice(-6);
      const paymentCount = await prisma.payment.count({ where: { associationId } });
      const receiptNumber = `RCP${String(paymentCount + 1).padStart(6, '0')}-${timestamp}`;

      // Create payment and update transaction status
      const newPaidTotal = currentPaid.plus(validatedData.amountPaid);
      const newStatus = newPaidTotal.greaterThanOrEqualTo(transaction.amount) ? 'paid' : 'partial';

      const [payment] = await prisma.$transaction([
        prisma.payment.create({
          data: {
            associationId,
            transactionId: validatedData.transactionId,
            amountPaid: validatedData.amountPaid,
            paymentDate: validatedData.paymentDate ? new Date(validatedData.paymentDate) : new Date(),
            paymentMethod: validatedData.paymentMethod,
            receiptNumber,
            confirmedBy: req.user!.id,
            confirmedAt: new Date(),
          },
        }),
        prisma.transaction.update({
          where: { id: validatedData.transactionId },
          data: {
            status: newStatus,
            paymentDate: newStatus === 'paid' ? new Date() : undefined,
            paymentMethod: validatedData.paymentMethod,
          },
        }),
      ]);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'CREATE',
          tableName: 'payments',
          recordId: payment.id,
          newValues: payment,
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onPaymentChange(associationId);

      return res.status(201).json({
        success: true,
        message: 'Payment recorded successfully',
        data: {
          payment,
          transactionStatus: newStatus,
          remainingBalance: new Decimal(transaction.amount).minus(newPaidTotal),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error recording payment:', error);
      return res.status(500).json({ success: false, message: 'Failed to record payment' });
    }
  },

  // Bulk mark transactions as paid
  async bulkMarkPaid(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = bulkPaymentSchema.parse(req.body);

      // Get all transactions
      const transactions = await prisma.transaction.findMany({
        where: { id: { in: validatedData.transactionIds }, associationId },
        include: { payments: true },
      });

      if (transactions.length !== validatedData.transactionIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some transactions not found',
        });
      }

      // Get payment count for receipt numbers
      const paymentCount = await prisma.payment.count({ where: { associationId } });

      // Process each transaction
      const results = await prisma.$transaction(
        transactions.flatMap((txn, index) => {
          const currentPaid = txn.payments.reduce(
            (sum, p) => sum.plus(p.amountPaid),
            new Decimal(0)
          );
          const balance = new Decimal(txn.amount).minus(currentPaid);

          if (balance.lessThanOrEqualTo(0)) return [];

          return [
            prisma.payment.create({
              data: {
                associationId,
                transactionId: txn.id,
                amountPaid: balance,
                paymentDate: validatedData.paymentDate ? new Date(validatedData.paymentDate) : new Date(),
                paymentMethod: validatedData.paymentMethod,
                receiptNumber: `RCP${String(paymentCount + index + 1).padStart(6, '0')}`,
                confirmedBy: req.user!.id,
                confirmedAt: new Date(),
              },
            }),
            prisma.transaction.update({
              where: { id: txn.id },
              data: { status: 'paid', paymentDate: new Date() },
            }),
          ];
        })
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'BULK_PAYMENT',
          tableName: 'payments',
          newValues: { transactionIds: validatedData.transactionIds, count: results.length / 2 },
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onPaymentChange(associationId);

      return res.status(200).json({
        success: true,
        message: `${results.length / 2} transactions marked as paid`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error bulk marking paid:', error);
      return res.status(500).json({ success: false, message: 'Failed to process bulk payment' });
    }
  },

  // Get payment history
  async listPayments(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const where: any = { associationId };

      if (req.query.transactionId) {
        where.transactionId = parseInt(req.query.transactionId as string);
      }

      if (req.query.startDate || req.query.endDate) {
        where.paymentDate = {};
        if (req.query.startDate) where.paymentDate.gte = new Date(req.query.startDate as string);
        if (req.query.endDate) where.paymentDate.lte = new Date(req.query.endDate as string);
      }

      const [payments, totalCount] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { paymentDate: 'desc' },
          include: {
            transaction: {
              include: {
                member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
                category: { select: { id: true, name: true, type: true } },
              },
            },
            confirmer: { select: { id: true, email: true } },
          },
        }),
        prisma.payment.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          payments,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: skip + payments.length < totalCount,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching payments:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
  },

  // ==========================================
  // MEMBER FINANCIAL SUMMARY
  // ==========================================

  // Get member's financial summary
  async getMemberFinancialSummary(req: Request, res: Response) {
    try {
      const { memberId } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const member = await prisma.member.findFirst({
        where: { id: parseInt(memberId), associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }

      // Get all transactions for member
      const transactions = await prisma.transaction.findMany({
        where: { memberId: parseInt(memberId), associationId },
        include: {
          category: { select: { id: true, name: true, type: true } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Calculate totals
      let totalDues = new Decimal(0);
      let totalPaid = new Decimal(0);
      const byCategory: Record<string, { total: Decimal; paid: Decimal; pending: Decimal }> = {};

      transactions.forEach(txn => {
        const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
        totalDues = totalDues.plus(txn.amount);
        totalPaid = totalPaid.plus(paid);

        const catName = txn.category.name;
        if (!byCategory[catName]) {
          byCategory[catName] = { total: new Decimal(0), paid: new Decimal(0), pending: new Decimal(0) };
        }
        byCategory[catName].total = byCategory[catName].total.plus(txn.amount);
        byCategory[catName].paid = byCategory[catName].paid.plus(paid);
        byCategory[catName].pending = byCategory[catName].pending.plus(new Decimal(txn.amount).minus(paid));
      });

      const pendingTransactions = transactions.filter(t => t.status !== 'paid' && t.status !== 'waived');
      const overdueTransactions = transactions.filter(t => t.status === 'overdue');

      return res.status(200).json({
        success: true,
        data: {
          member: { id: member.id, memberId: member.memberId, name: `${member.firstName} ${member.lastName}` },
          summary: {
            totalDues,
            totalPaid,
            balance: totalDues.minus(totalPaid),
            pendingCount: pendingTransactions.length,
            overdueCount: overdueTransactions.length,
          },
          byCategory,
          recentTransactions: transactions.slice(0, 10).map(txn => ({
            ...txn,
            totalPaid: txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0)),
          })),
        },
      });
    } catch (error) {
      console.error('Error fetching member financial summary:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch financial summary' });
    }
  },

  // ==========================================
  // DASHBOARD & OVERVIEW
  // ==========================================

  // Get financial dashboard overview
  async getDashboard(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      // Get date range (default: current month)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const [
        totalMembers,
        activeCategories,
        monthlyTransactions,
        monthlyPayments,
        overdueTransactions,
        recentPayments,
      ] = await Promise.all([
        prisma.member.count({ where: { associationId, status: 'active' } }),
        prisma.financialCategory.count({ where: { associationId, isActive: true } }),
        prisma.transaction.aggregate({
          where: { associationId, createdAt: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.payment.aggregate({
          where: { associationId, paymentDate: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amountPaid: true },
          _count: { id: true },
        }),
        prisma.transaction.count({
          where: { associationId, status: 'overdue' },
        }),
        prisma.payment.findMany({
          where: { associationId },
          take: 5,
          orderBy: { paymentDate: 'desc' },
          include: {
            transaction: {
              include: {
                member: { select: { firstName: true, lastName: true } },
                category: { select: { name: true, type: true } },
              },
            },
          },
        }),
      ]);

      // Get total outstanding
      const allTransactions = await prisma.transaction.aggregate({
        where: { associationId, status: { in: ['pending', 'overdue', 'partial'] } },
        _sum: { amount: true },
      });

      const allPayments = await prisma.payment.aggregate({
        where: { associationId },
        _sum: { amountPaid: true },
      });

      return res.status(200).json({
        success: true,
        data: {
          overview: {
            totalMembers,
            activeCategories,
            overdueTransactions,
          },
          thisMonth: {
            transactionsCreated: monthlyTransactions._count.id,
            transactionsAmount: monthlyTransactions._sum.amount || 0,
            paymentsReceived: monthlyPayments._count.id,
            paymentsAmount: monthlyPayments._sum.amountPaid || 0,
          },
          totals: {
            totalOutstanding: (allTransactions._sum.amount || new Decimal(0)).minus(allPayments._sum.amountPaid || 0),
            totalCollected: allPayments._sum.amountPaid || 0,
          },
          recentPayments,
        },
      });
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
    }
  },

  // ==========================================
  // PAYMENT REMINDERS
  // ==========================================

  // Send payment reminders to members with pending/overdue transactions
  async sendPaymentReminders(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { transactionIds, message } = req.body;

      if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Transaction IDs are required' });
      }

      // Get transactions with member details
      const transactions = await prisma.transaction.findMany({
        where: {
          id: { in: transactionIds },
          associationId,
          status: { in: ['pending', 'overdue', 'partial'] },
        },
        include: {
          member: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          category: { select: { name: true, type: true } },
          payments: { select: { amountPaid: true } },
        },
      });

      if (transactions.length === 0) {
        return res.status(404).json({ success: false, message: 'No valid transactions found' });
      }

      // Get association details
      const association = await prisma.association.findUnique({
        where: { id: associationId },
        select: { name: true },
      });

      // Group transactions by member for consolidated reminders
      const memberTransactions: Record<number, typeof transactions> = {};
      transactions.forEach(txn => {
        if (!memberTransactions[txn.member.id]) {
          memberTransactions[txn.member.id] = [];
        }
        memberTransactions[txn.member.id].push(txn);
      });

      const results = {
        sent: 0,
        failed: 0,
        noEmail: 0,
        details: [] as { memberId: number; memberName: string; status: string; error?: string }[],
      };

      // Send reminders (in production, this would use the email service)
      for (const [memberId, memberTxns] of Object.entries(memberTransactions)) {
        const member = memberTxns[0].member;
        
        if (!member.email) {
          results.noEmail++;
          results.details.push({
            memberId: member.id,
            memberName: `${member.firstName} ${member.lastName}`,
            status: 'no_email',
          });
          continue;
        }

        try {
          // Calculate total outstanding for this member
          const totalOutstanding = memberTxns.reduce((sum, txn) => {
            const paid = txn.payments.reduce((p, pay) => p.plus(pay.amountPaid), new Decimal(0));
            return sum.plus(new Decimal(txn.amount).minus(paid));
          }, new Decimal(0));

          // In production, send actual email here
          // For now, we'll log and record the reminder
          console.log(`📧 [REMINDER] Sending payment reminder to ${member.email}`);
          console.log(`   Association: ${association?.name}`);
          console.log(`   Outstanding: ₦${totalOutstanding.toNumber().toLocaleString()}`);
          console.log(`   Transactions: ${memberTxns.length}`);
          if (message) console.log(`   Custom message: ${message}`);

          // Record reminder in audit log
          await prisma.auditLog.create({
            data: {
              associationId,
              userId: req.user!.id,
              action: 'SEND_REMINDER',
              tableName: 'transactions',
              newValues: {
                memberId: member.id,
                memberEmail: member.email,
                transactionCount: memberTxns.length,
                totalOutstanding: totalOutstanding.toNumber(),
                customMessage: message || null,
              },
            },
          });

          results.sent++;
          results.details.push({
            memberId: member.id,
            memberName: `${member.firstName} ${member.lastName}`,
            status: 'sent',
          });
        } catch (err: any) {
          results.failed++;
          results.details.push({
            memberId: member.id,
            memberName: `${member.firstName} ${member.lastName}`,
            status: 'failed',
            error: err.message,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Reminders sent: ${results.sent}, Failed: ${results.failed}, No email: ${results.noEmail}`,
        data: results,
      });
    } catch (error) {
      console.error('Error sending reminders:', error);
      return res.status(500).json({ success: false, message: 'Failed to send reminders' });
    }
  },

  // Get members with pending payments for reminder selection
  async getMembersForReminders(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const status = (req.query.status as string) || 'all'; // 'pending', 'overdue', 'all'

      // Build status filter
      const statusCondition = status === 'all' 
        ? { in: ['pending', 'overdue', 'partial'] }
        : status;

      // Get all pending/overdue transactions grouped by member
      const transactions = await prisma.transaction.findMany({
        where: {
          associationId,
          status: statusCondition,
        },
        include: {
          member: { select: { id: true, memberId: true, firstName: true, lastName: true, email: true, phone: true } },
          category: { select: { id: true, name: true, type: true } },
          payments: { select: { amountPaid: true } },
        },
        orderBy: [{ member: { lastName: 'asc' } }, { dueDate: 'asc' }],
      });

      // Define member map type
      interface MemberData {
        member: {
          id: number;
          memberId: string;
          firstName: string;
          lastName: string;
          email: string | null;
          phone: string | null;
        };
        transactions: Array<{
          id: number;
          referenceNumber: string;
          category: string;
          amount: number;
          balance: number;
          dueDate: Date | null;
          status: string;
        }>;
        totalOutstanding: number;
        overdueCount: number;
      }

      // Group by member and calculate totals
      const memberMap: Record<number, MemberData> = {};

      transactions.forEach(txn => {
        const paid = txn.payments.reduce((sum: Decimal, p: { amountPaid: Decimal }) => sum.plus(p.amountPaid), new Decimal(0));
        const balance = new Decimal(txn.amount).minus(paid).toNumber();

        if (!memberMap[txn.member.id]) {
          memberMap[txn.member.id] = {
            member: txn.member,
            transactions: [],
            totalOutstanding: 0,
            overdueCount: 0,
          };
        }

        memberMap[txn.member.id].transactions.push({
          id: txn.id,
          referenceNumber: txn.referenceNumber || '',
          category: txn.category.name,
          amount: Number(txn.amount),
          balance,
          dueDate: txn.dueDate,
          status: txn.status,
        });

        memberMap[txn.member.id].totalOutstanding += balance;
        if (txn.status === 'overdue') {
          memberMap[txn.member.id].overdueCount++;
        }
      });

      const members = Object.values(memberMap).sort((a, b) => b.totalOutstanding - a.totalOutstanding);

      return res.status(200).json({
        success: true,
        data: {
          members,
          summary: {
            totalMembers: members.length,
            totalOutstanding: members.reduce((sum, m) => sum + m.totalOutstanding, 0),
            totalTransactions: transactions.length,
            overdueTransactions: transactions.filter(t => t.status === 'overdue').length,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching members for reminders:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch members' });
    }
  },

  // Update overdue status for transactions past due date
  async updateOverdueStatus(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const now = new Date();

      // Find pending transactions with past due dates
      const result = await prisma.transaction.updateMany({
        where: {
          associationId,
          status: 'pending',
          dueDate: { lt: now },
        },
        data: {
          status: 'overdue',
        },
      });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'UPDATE_OVERDUE',
          tableName: 'transactions',
          newValues: { updatedCount: result.count },
        },
      });

      return res.status(200).json({
        success: true,
        message: `${result.count} transaction(s) marked as overdue`,
        data: { updatedCount: result.count },
      });
    } catch (error) {
      console.error('Error updating overdue status:', error);
      return res.status(500).json({ success: false, message: 'Failed to update overdue status' });
    }
  },
};
