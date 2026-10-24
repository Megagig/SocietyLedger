import { COUNTED_CHARGE, periodRange } from '../reports/report-rules';
import { generateAgingAnalysis } from '../reports/reports-core.service';
import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
// Phase 12: Cache invalidation
import { cacheInvalidationService } from '../../services/cache-invalidation.service';
import { categoryDeactivateError, categoryTypeChangeError } from './category-rules';
// Accounting integration
import { accountingIntegrationService } from '../../services/accounting-integration.service';
import { sendEmail } from '../../lib/email';
import { SettingsService } from '../settings/settings.service';
import { dispatchNotification } from '../../services/notification-preferences.service';
import { memberLedgerService } from '../member-finance/member-ledger.service';
import { cashBackedMessage, findCashBackingReceipts } from './cash-guard';
import { verifyPassword } from '../../lib/auth';
import { reminderText, splitByCooldown } from './reminder-rules';
import { isOverdue, overdueWhere } from './overdue-rules';
import { syncLedgerDebit } from './ledger-sync';
import { restoreChargeExtras } from './restore-rules';

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

// Edit transaction schema (for unpaid/pending transactions only)
const editTransactionSchema = z.object({
  memberId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  editReason: z.string().min(5, 'Please provide a reason for editing (min 5 characters)'),
});

// Void and replace schema (for paid transactions)
const voidAndReplaceSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm'),
  voidReason: z.string().min(10, 'Please provide a detailed reason for voiding (min 10 characters)'),
  newTransaction: z.object({
    memberId: z.number().int().positive(),
    categoryId: z.number().int().positive(),
    amount: z.number().positive('Amount must be positive'),
    dueDate: z.string().datetime().optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
});

// Bulk edit schema
const bulkEditSchema = z.object({
  transactionIds: z.array(z.number().int().positive()).min(1, 'At least one transaction is required'),
  updates: z.object({
    categoryId: z.number().int().positive().optional(),
    dueDate: z.string().datetime().optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
  editReason: z.string().min(5, 'Please provide a reason for bulk editing (min 5 characters)'),
});

const bulkTransactionSchema = z.object({
  categoryId: z.number().int().positive('Category ID is required'),
  memberIds: z.array(z.number().int().positive()).min(1, 'At least one member is required'),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const bulkDeleteSchema = z.object({
  transactionIds: z.array(z.number().int().positive()).min(1, 'At least one transaction is required'),
  forceDelete: z.boolean().optional().default(false), // When true, cascade deletes payments and donation records
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
          include: { _count: { select: { transactions: true, levyCampaigns: true } } },
        }),
        prisma.financialCategory.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          // usageCount: how many charges and levy campaigns use the category (its type is locked once that is above 0)
          categories: categories.map(({ _count, ...category }) => ({
            ...category,
            usageCount: _count.transactions + _count.levyCampaigns,
          })),
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
          _count: { select: { transactions: true, levyCampaigns: true } },
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
          usageCount: category._count.transactions + category._count.levyCampaigns,
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

      // The type decides how a category's charges behave, so it is locked once anything uses the category.
      if (validatedData.type !== undefined && validatedData.type !== existing.type) {
        const [charges, campaigns] = await Promise.all([
          prisma.transaction.count({ where: { categoryId: existing.id, associationId } }),
          prisma.levyCampaign.count({ where: { categoryId: existing.id, associationId } }),
        ]);
        const typeError = categoryTypeChangeError(existing.type, validatedData.type, { charges, campaigns });
        if (typeError) return res.status(409).json({ success: false, code: 'CATEGORY_IN_USE', message: typeError });
      }

      // Switching a category off is the same as deleting it, so the same open-charges rule applies.
      if (validatedData.isActive === false && existing.isActive) {
        const openCharges = await prisma.transaction.count({
          where: { categoryId: existing.id, associationId, isVoided: false, status: { in: ['pending', 'overdue', 'partial'] } },
        });
        const deactivateError = categoryDeactivateError(openCharges);
        if (deactivateError) return res.status(400).json({ success: false, code: 'CATEGORY_HAS_OPEN_CHARGES', message: deactivateError });
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
          isVoided: false,
          status: { in: ['pending', 'overdue', 'partial'] },
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

      if (queryParams.status === 'overdue') {
        Object.assign(where, overdueWhere());
      } else if (queryParams.status) {
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

      // Accounting integration: Sync transaction to accounting module
      try {
        await accountingIntegrationService.onTransactionCreated(transaction, req.user!.id);
      } catch (syncError) {
        console.error('Accounting sync failed (non-critical):', syncError);
        // Don't throw - transaction creation succeeded
      }

      // Ledger sync: create DEBIT entry so the member ledger reflects this obligation
      try {
        await memberLedgerService.createFromTransaction(transaction.id, req.user!.id);
      } catch (ledgerError) {
        console.error('Ledger sync failed (non-critical):', ledgerError);
      }

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

      // Accounting integration: Sync all transactions to accounting module
      for (const transaction of transactions) {
        await syncLedgerDebit(transaction.id, req.user!.id);

        try {
          // Fetch full transaction with relations for accounting sync
          const fullTransaction = await prisma.transaction.findUnique({
            where: { id: transaction.id },
            include: {
              member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
              category: { select: { id: true, name: true, type: true } },
            },
          });
          if (fullTransaction) {
            await accountingIntegrationService.onTransactionCreated(fullTransaction, req.user!.id);
          }
        } catch (syncError) {
          console.error(`Accounting sync failed for transaction ${transaction.id} (non-critical):`, syncError);
          // Continue with other transactions
        }
      }

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
      const forceDelete = req.query.forceDelete === 'true';

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const transaction = await prisma.transaction.findFirst({
        where: { id: parseInt(id), associationId },
        include: { payments: true, donationRecord: true },
      });

      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      const cashReceipts = await findCashBackingReceipts(associationId, [transaction.id]);
      if (cashReceipts.length > 0) {
        return res.status(409).json({ success: false, code: 'CASH_BACKED', message: cashBackedMessage(cashReceipts) });
      }

      // Don't allow deleting transactions with payments unless forceDelete is true
      if (transaction.payments.length > 0 && !forceDelete) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete transaction with recorded payments. Use forceDelete=true to cascade delete.',
        });
      }

      // Use a transaction for cascade deletion
      await prisma.$transaction(async (tx) => {
        // First delete donation record if any
        if (transaction.donationRecord) {
          await tx.donationRecord.delete({
            where: { id: transaction.donationRecord.id },
          });
        }

        // Then delete payments if any
        if (transaction.payments.length > 0) {
          await tx.payment.deleteMany({
            where: { transactionId: parseInt(id) },
          });
        }

        // Finally delete the transaction
        await tx.transaction.delete({ where: { id: parseInt(id) } });
      });

      const auditLog = await prisma.auditLog.create({
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
        data: { auditLogId: auditLog.id },
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete transaction' });
    }
  },

  // Bulk delete transactions
  async bulkDeleteTransactions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = bulkDeleteSchema.parse(req.body);

      // Fetch all transactions
      const transactions = await prisma.transaction.findMany({
        where: {
          id: { in: validatedData.transactionIds },
          associationId,
        },
        include: { payments: true, donationRecord: true },
      });

      if (transactions.length !== validatedData.transactionIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some transactions not found',
          found: transactions.length,
          requested: validatedData.transactionIds.length,
        });
      }

      const cashReceipts = await findCashBackingReceipts(associationId, validatedData.transactionIds);
      if (cashReceipts.length > 0) {
        return res.status(409).json({ success: false, code: 'CASH_BACKED', message: cashBackedMessage(cashReceipts) });
      }

      // Check for transactions with payments
      const transactionsWithPayments = transactions.filter(t => t.payments.length > 0);
      if (transactionsWithPayments.length > 0 && !validatedData.forceDelete) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete ${transactionsWithPayments.length} transaction(s) with recorded payments. Use forceDelete option to cascade delete.`,
          data: {
            cannotDelete: transactionsWithPayments.map(t => ({
              id: t.id,
              referenceNumber: t.referenceNumber,
              paymentsCount: t.payments.length,
            })),
          },
        });
      }

      // Use a transaction for cascade deletion
      await prisma.$transaction(async (tx) => {
        // First delete donation records if any
        await tx.donationRecord.deleteMany({
          where: { transactionId: { in: validatedData.transactionIds } },
        });

        // Then delete payments if any
        await tx.payment.deleteMany({
          where: { transactionId: { in: validatedData.transactionIds } },
        });

        // Finally delete the transactions
        await tx.transaction.deleteMany({
          where: { id: { in: validatedData.transactionIds } },
        });
      });

      // Create audit log
      const auditLog = await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'BULK_DELETE',
          tableName: 'transactions',
          oldValues: { count: transactions.length, transactions },
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onTransactionChange(associationId);

      return res.status(200).json({
        success: true,
        message: `${transactions.length} transaction(s) deleted successfully`,
        data: {
          deletedCount: transactions.length,
          auditLogId: auditLog.id,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error bulk deleting transactions:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete transactions' });
    }
  },

  // Edit unpaid transaction (Hybrid approach - only for unpaid/pending transactions)
  async editTransaction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const validatedData = editTransactionSchema.parse(req.body);

      // Fetch the transaction with payments
      const transaction = await prisma.transaction.findFirst({
        where: { id: parseInt(id), associationId },
        include: { payments: true, member: true, category: true },
      });

      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      // Block editing if transaction is paid or partially paid
      const totalPaid = transaction.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
      if (totalPaid > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot edit paid or partially paid transactions. Use void-and-replace instead.',
          data: { totalPaid, status: transaction.status },
        });
      }

      // Block editing voided transactions
      if (transaction.isVoided) {
        return res.status(400).json({
          success: false,
          message: 'Cannot edit voided transactions',
        });
      }

      // If member is changing, need to recalculate ledgers
      const oldMemberId = transaction.memberId;
      const newMemberId = validatedData.memberId || transaction.memberId;
      const memberChanged = oldMemberId !== newMemberId;

      // Store old values for edit history
      const oldValues = {
        memberId: transaction.memberId,
        categoryId: transaction.categoryId,
        amount: Number(transaction.amount),
        dueDate: transaction.dueDate,
        notes: transaction.notes,
      };

      // Update transaction
      const updatedTransaction = await prisma.transaction.update({
        where: { id: parseInt(id) },
        data: {
          memberId: validatedData.memberId,
          categoryId: validatedData.categoryId,
          amount: validatedData.amount,
          dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
          notes: validatedData.notes,
          lastEditedBy: userId,
          lastEditedAt: new Date(),
          editHistory: {
            ...(transaction.editHistory as any || {}),
            edits: [
              ...((transaction.editHistory as any)?.edits || []),
              {
                editedAt: new Date().toISOString(),
                editedBy: userId,
                reason: validatedData.editReason,
                oldValues,
                newValues: validatedData,
              },
            ],
          },
        },
        include: { member: true, category: true },
      });

      // Recalculate ledgers if member changed
      if (memberChanged) {
        const { memberLedgerService } = await import('../member-finance/member-ledger.service');
        // Re-sync both old and new member ledgers
        await memberLedgerService.syncExistingTransactions(associationId, oldMemberId, userId, true);
        await memberLedgerService.syncExistingTransactions(associationId, newMemberId, userId, true);
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'EDIT_TRANSACTION',
          tableName: 'transactions',
          recordId: parseInt(id),
          oldValues,
          newValues: validatedData,
        },
      });

      // Invalidate cache
      await cacheInvalidationService.onTransactionChange(associationId);

      return res.status(200).json({
        success: true,
        message: 'Transaction updated successfully',
        data: updatedTransaction,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error editing transaction:', error);
      return res.status(500).json({ success: false, message: 'Failed to edit transaction' });
    }
  },

  // Void and replace transaction (for paid transactions)
  async voidAndReplaceTransaction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const validatedData = voidAndReplaceSchema.parse(req.body);

      // Re-authentication: voiding rewrites what a member owes, so the officer proves it is them at the keyboard.
      const actor = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
      if (!actor?.passwordHash || !(await verifyPassword(validatedData.password, actor.passwordHash))) {
        return res.status(403).json({ success: false, code: 'REAUTH_FAILED', message: 'That password is not correct.' });
      }

      // Fetch the original transaction
      const originalTransaction = await prisma.transaction.findFirst({
        where: { id: parseInt(id), associationId },
        include: { payments: true, member: true, category: true },
      });

      if (!originalTransaction) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      // Block if already voided
      if (originalTransaction.isVoided) {
        return res.status(400).json({
          success: false,
          message: 'Transaction is already voided',
        });
      }

      // Generate unique reference for new transaction
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newReferenceNumber = `TXN${timestamp}${random}`;

      // Use transaction to void old and create new
      const result = await prisma.$transaction(async (tx) => {
        // Mark original as voided
        const voidedTransaction = await tx.transaction.update({
          where: { id: parseInt(id) },
          data: {
            isVoided: true,
            voidReason: validatedData.voidReason,
            voidedAt: new Date(),
            voidedBy: userId,
          },
        });

        // Create new corrected transaction
        const newTransaction = await tx.transaction.create({
          data: {
            associationId,
            memberId: validatedData.newTransaction.memberId,
            categoryId: validatedData.newTransaction.categoryId,
            amount: validatedData.newTransaction.amount,
            dueDate: validatedData.newTransaction.dueDate ? new Date(validatedData.newTransaction.dueDate) : null,
            notes: validatedData.newTransaction.notes || `Replacement for voided transaction ${originalTransaction.referenceNumber || originalTransaction.id}`,
            referenceNumber: newReferenceNumber,
            status: 'pending',
            createdBy: userId,
            replaces: parseInt(id),
          },
          include: { member: true, category: true },
        });

        // Link back to original
        await tx.transaction.update({
          where: { id: parseInt(id) },
          data: { replacedBy: newTransaction.id },
        });

        return { voidedTransaction, newTransaction };
      });

      // Recalculate ledgers for affected members
      const { memberLedgerService } = await import('../member-finance/member-ledger.service');
      const affectedMemberIds = new Set([
        originalTransaction.memberId,
        validatedData.newTransaction.memberId,
      ]);
      
      for (const memberId of affectedMemberIds) {
        await memberLedgerService.syncExistingTransactions(associationId, memberId, userId, true);
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'VOID_AND_REPLACE_TRANSACTION',
          tableName: 'transactions',
          recordId: parseInt(id),
          oldValues: originalTransaction,
          newValues: { voidReason: validatedData.voidReason, newTransaction: result.newTransaction },
        },
      });

      // Invalidate cache
      await cacheInvalidationService.onTransactionChange(associationId);

      return res.status(200).json({
        success: true,
        message: 'Transaction voided and replaced successfully',
        data: {
          voidedTransaction: result.voidedTransaction,
          newTransaction: result.newTransaction,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error voiding and replacing transaction:', error);
      return res.status(500).json({ success: false, message: 'Failed to void and replace transaction' });
    }
  },

  // Bulk edit transactions (only unpaid/pending transactions)
  async bulkEditTransactions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const validatedData = bulkEditSchema.parse(req.body);

      // Fetch all transactions
      const transactions = await prisma.transaction.findMany({
        where: {
          id: { in: validatedData.transactionIds },
          associationId,
        },
        include: { payments: true },
      });

      if (transactions.length !== validatedData.transactionIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some transactions not found',
          found: transactions.length,
          requested: validatedData.transactionIds.length,
        });
      }

      // Check for paid transactions
      const paidTransactions = transactions.filter(t => {
        const totalPaid = t.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
        return totalPaid > 0;
      });

      if (paidTransactions.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot bulk edit ${paidTransactions.length} paid/partially paid transaction(s)`,
          data: {
            cannotEdit: paidTransactions.map(t => ({
              id: t.id,
              referenceNumber: t.referenceNumber,
              status: t.status,
            })),
          },
        });
      }

      // Check for voided transactions
      const voidedTransactions = transactions.filter(t => t.isVoided);
      if (voidedTransactions.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot bulk edit ${voidedTransactions.length} voided transaction(s)`,
        });
      }

      // Perform bulk update
      const editEntry = {
        editedAt: new Date().toISOString(),
        editedBy: userId,
        reason: validatedData.editReason,
        updates: validatedData.updates,
      };

      const updated = await prisma.$transaction(
        transactions.map(t =>
          prisma.transaction.update({
            where: { id: t.id },
            data: {
              categoryId: validatedData.updates.categoryId,
              dueDate: validatedData.updates.dueDate ? new Date(validatedData.updates.dueDate) : undefined,
              notes: validatedData.updates.notes,
              lastEditedBy: userId,
              lastEditedAt: new Date(),
              editHistory: {
                ...(t.editHistory as any || {}),
                edits: [
                  ...((t.editHistory as any)?.edits || []),
                  editEntry,
                ],
              },
            },
          })
        )
      );

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'BULK_EDIT_TRANSACTIONS',
          tableName: 'transactions',
          newValues: {
            count: updated.length,
            updates: validatedData.updates,
            reason: validatedData.editReason,
            transactionIds: validatedData.transactionIds,
          },
        },
      });

      // Invalidate cache
      await cacheInvalidationService.onTransactionChange(associationId);

      return res.status(200).json({
        success: true,
        message: `${updated.length} transaction(s) updated successfully`,
        data: { updatedCount: updated.length },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error bulk editing transactions:', error);
      return res.status(500).json({ success: false, message: 'Failed to bulk edit transactions' });
    }
  },

  // Undo delete transaction (restore from audit log)
  async undoDeleteTransaction(req: Request, res: Response) {
    try {
      const { auditLogId } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      // Fetch the audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          id: parseInt(auditLogId),
          associationId,
          action: { in: ['DELETE', 'BULK_DELETE'] },
          tableName: 'transactions',
        },
      });

      if (!auditLog) {
        return res.status(404).json({ success: false, message: 'Audit log not found or not a delete action' });
      }

      const oldValues = auditLog.oldValues as any;

      if (auditLog.action === 'DELETE') {
        // Single transaction restore
        const txnData = oldValues;
        
        // Check if transaction was already restored
        const existing = await prisma.transaction.findFirst({
          where: { referenceNumber: txnData.referenceNumber, associationId },
        });

        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'Transaction already exists (may have been restored previously)',
          });
        }

        // Restore the transaction
        const restored = await prisma.transaction.create({
          data: {
            associationId: txnData.associationId,
            memberId: txnData.memberId,
            categoryId: txnData.categoryId,
            amount: txnData.amount,
            dueDate: txnData.dueDate ? new Date(txnData.dueDate) : null,
            referenceNumber: txnData.referenceNumber,
            status: txnData.status,
            notes: txnData.notes,
            createdBy: req.user!.id,
          },
        });

        // Bring back its payments and donation record too, so a charge that was paid is not restored as paid with nothing behind it.
        await restoreChargeExtras(associationId, restored.id, txnData, req.user!.id);

        await prisma.auditLog.create({
          data: {
            associationId,
            userId: req.user!.id,
            action: 'RESTORE',
            tableName: 'transactions',
            recordId: restored.id,
            newValues: { restoredFrom: auditLogId },
          },
        });

        // Phase 12: Invalidate cache
        await cacheInvalidationService.onTransactionChange(associationId);

        return res.status(200).json({
          success: true,
          message: 'Transaction restored successfully',
          data: restored,
        });
      } else {
        // Bulk restore
        const txnsData = oldValues.transactions;
        
        if (!txnsData || !Array.isArray(txnsData)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid audit log data for bulk restore',
          });
        }

        // Check for existing transactions
        const referenceNumbers = txnsData.map((t: any) => t.referenceNumber);
        const existing = await prisma.transaction.findMany({
          where: { referenceNumber: { in: referenceNumbers }, associationId },
        });

        if (existing.length > 0) {
          return res.status(400).json({
            success: false,
            message: `${existing.length} transaction(s) already exist (may have been restored previously)`,
          });
        }

        // Restore all transactions
        const restored = await prisma.$transaction(
          txnsData.map((txnData: any) =>
            prisma.transaction.create({
              data: {
                associationId: txnData.associationId,
                memberId: txnData.memberId,
                categoryId: txnData.categoryId,
                amount: txnData.amount,
                dueDate: txnData.dueDate ? new Date(txnData.dueDate) : null,
                referenceNumber: txnData.referenceNumber,
                status: txnData.status,
                notes: txnData.notes,
                createdBy: req.user!.id,
              },
            })
          )
        );

        for (const [index, charge] of restored.entries()) {
          await restoreChargeExtras(associationId, charge.id, txnsData[index], req.user!.id);
        }

        await prisma.auditLog.create({
          data: {
            associationId,
            userId: req.user!.id,
            action: 'BULK_RESTORE',
            tableName: 'transactions',
            newValues: { count: restored.length, restoredFrom: auditLogId },
          },
        });

        // Phase 12: Invalidate cache
        await cacheInvalidationService.onTransactionChange(associationId);

        return res.status(200).json({
          success: true,
          message: `${restored.length} transaction(s) restored successfully`,
          data: { restoredCount: restored.length },
        });
      }
    } catch (error) {
      console.error('Error restoring transaction:', error);
      return res.status(500).json({ success: false, message: 'Failed to restore transaction' });
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
          where: { associationId, isVoided: false },
          _count: { id: true },
          _sum: { amount: true },
        }),
        prisma.$queryRaw`
          SELECT fc.type, COUNT(t.id)::int as count, COALESCE(SUM(t.amount), 0) as total
          FROM transactions t
          JOIN financial_categories fc ON t.category_id = fc.id
          WHERE t.association_id = ${associationId} AND t.is_voided = false AND t.status <> 'waived'
          GROUP BY fc.type
        ` as Promise<Array<{ type: string; count: number; total: Decimal }>>,
        // What is billed leaves out forgiven (waived) charges, the same as the reports do
        prisma.transaction.aggregate({
          where: { associationId, isVoided: false, status: { not: 'waived' } },
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

      // Get total payments
      const totalPayments = await prisma.payment.aggregate({
        where: { associationId, transaction: { isVoided: false, status: { not: 'waived' } } },
        _sum: { amountPaid: true },
      });

      // Overdue by due date (the stored status lags until the overdue job runs).
      const overdueNow = await prisma.transaction.aggregate({ where: { associationId, ...overdueWhere() }, _count: { id: true }, _sum: { amount: true } });

      return res.status(200).json({
        success: true,
        data: {
          totalTransactions: totals._count.id,
          totalAmount: totals._sum.amount || 0,
          totalPaid: totalPayments._sum.amountPaid || 0,
          totalOutstanding: (totals._sum.amount || new Decimal(0)).minus(totalPayments._sum.amountPaid || 0),
          overdue: { count: overdueNow._count.id, amount: overdueNow._sum.amount || 0 },
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

      if (transaction.isVoided) {
        return res.status(400).json({ success: false, message: 'This charge was voided, so it can no longer be paid. Pay its replacement instead.' });
      }

      // R4.6/G53: Payment Settings' enabledChannels was saved but never
      // read — reject a method the association hasn't enabled.
      if (validatedData.paymentMethod) {
        const paymentSettings = await SettingsService.getSettings(associationId, 'payments');
        const enabledChannels: string[] = paymentSettings.enabledChannels || [];
        if (enabledChannels.length > 0 && !enabledChannels.includes(validatedData.paymentMethod)) {
          return res.status(400).json({
            success: false,
            message: `Payment method "${validatedData.paymentMethod}" is not enabled for this association`,
          });
        }
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

      // R4.6/G53: Financial Settings' enablePartialPayments was saved but
      // never read — reject an amount that doesn't fully settle the
      // balance when the association has disabled partial payments.
      // G87: Payment Settings has an identically-named, independently-toggleable
      // enablePartialPayments field that was never checked at all — either one
      // being off blocks a partial payment.
      if (new Decimal(validatedData.amountPaid).lessThan(balance)) {
        const [financialSettings, paymentSettings] = await Promise.all([
          SettingsService.getSettings(associationId, 'financial'),
          SettingsService.getSettings(associationId, 'payments'),
        ]);
        if (financialSettings.enablePartialPayments === false || paymentSettings.enablePartialPayments === false) {
          return res.status(400).json({
            success: false,
            message: 'Partial payments are not enabled for this association. The full balance must be paid.',
          });
        }
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

      // Ledger sync: create CREDIT entry for this payment
      try {
        await memberLedgerService.createFromPayment(payment.id, req.user!.id);
      } catch (ledgerError) {
        console.error('Ledger sync failed (non-critical):', ledgerError);
      }

      // Fetch full payment with transaction relations for accounting sync + receipt email
      const fullPayment = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: {
          transaction: {
            include: {
              member: { select: { id: true, memberId: true, firstName: true, lastName: true, userId: true } },
              category: { select: { id: true, name: true, type: true } },
            },
          },
        },
      });

      // Accounting integration: Sync payment to accounting module
      try {
        if (fullPayment) {
          await accountingIntegrationService.onPaymentRecorded(fullPayment, req.user!.id);
        }
      } catch (syncError) {
        console.error('Accounting sync failed (non-critical):', syncError);
        // Don't throw - payment recording succeeded
      }

      // R4.6/G53: Payment Settings' receiptAutoGenerate was saved but never
      // read by anything — gate the (previously orphaned) 'payment-receipt'
      // email template on it instead of leaving it unsent unconditionally.
      try {
        const receiptAutoGenerate = await SettingsService.getSetting(associationId, 'payments', 'receiptAutoGenerate');
        const memberUserId = fullPayment?.transaction.member?.userId;
        if (receiptAutoGenerate !== false && memberUserId) {
          const association = await prisma.association.findUnique({
            where: { id: associationId },
            select: { name: true },
          });

          await dispatchNotification({
            associationId,
            userId: memberUserId,
            title: 'Payment Received',
            message: `Your payment of ₦${validatedData.amountPaid.toLocaleString()} has been received and confirmed.`,
            kind: 'payment_received',
            sendEmail: true,
            emailSubject: 'Payment Receipt',
            emailTemplate: 'payment-receipt',
            emailData: {
              memberName: `${fullPayment!.transaction.member!.firstName} ${fullPayment!.transaction.member!.lastName}`,
              receiptNumber,
              amount: validatedData.amountPaid,
              categoryName: fullPayment!.transaction.category?.name || 'Payment',
              paymentMethod: validatedData.paymentMethod || 'N/A',
              paymentDate: new Date().toLocaleDateString(),
              associationName: association?.name || 'Your Association',
            },
          });
        }
      } catch (receiptError) {
        console.error('Receipt email failed (non-critical):', receiptError);
      }

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

      // Filter out already fully paid transactions
      const unpaidTransactions = transactions.filter(txn => {
        if (txn.isVoided) return false;
        const currentPaid = txn.payments.reduce(
          (sum, p) => sum.plus(p.amountPaid),
          new Decimal(0)
        );
        return new Decimal(txn.amount).minus(currentPaid).greaterThan(0);
      });

      if (unpaidTransactions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'All selected transactions are already fully paid',
        });
      }

      // Generate batch reference number (unique for this bulk payment)
      const batchReference = `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Helper function to generate unique receipt number
      const generateUniqueReceiptNumber = (index: number) => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `RCP${timestamp}${random}${index}`;
      };

      const paymentDate = validatedData.paymentDate ? new Date(validatedData.paymentDate) : new Date();

      // Process all transactions in a single database transaction
      const result = await prisma.$transaction(async (tx) => {
        const createdPayments = [];
        
        for (let i = 0; i < unpaidTransactions.length; i++) {
          const txn = unpaidTransactions[i];
          const currentPaid = txn.payments.reduce(
            (sum, p) => sum.plus(p.amountPaid),
            new Decimal(0)
          );
          const balance = new Decimal(txn.amount).minus(currentPaid);

          // Create payment record
          const payment = await tx.payment.create({
            data: {
              associationId,
              transactionId: txn.id,
              amountPaid: balance,
              paymentDate,
              paymentMethod: validatedData.paymentMethod,
              receiptNumber: generateUniqueReceiptNumber(i),
              confirmedBy: req.user!.id,
              confirmedAt: new Date(),
            },
          });

          // Update transaction status (notes are stored in transaction)
          await tx.transaction.update({
            where: { id: txn.id },
            data: { 
              status: 'paid', 
              paymentDate,
              paymentMethod: validatedData.paymentMethod,
              notes: validatedData.notes 
                ? `${txn.notes ? txn.notes + ' | ' : ''}Paid via batch: ${batchReference}. ${validatedData.notes}`
                : txn.notes,
            },
          });

          createdPayments.push(payment);
        }

        return createdPayments;
      }, {
        maxWait: 30000,
        timeout: 30000,
      });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'BULK_PAYMENT',
          tableName: 'payments',
          newValues: { 
            batchReference,
            transactionIds: unpaidTransactions.map(t => t.id), 
            count: result.length,
            paymentMethod: validatedData.paymentMethod,
            notes: validatedData.notes,
          },
        },
      });

      // Phase 12: Invalidate cache
      await cacheInvalidationService.onPaymentChange(associationId);

      // Ledger + accounting sync for all bulk payments
      for (const payment of result) {
        try {
          await memberLedgerService.createFromPayment(payment.id, req.user!.id);
        } catch (ledgerError) {
          console.error(`Ledger sync failed for payment ${payment.id} (non-critical):`, ledgerError);
        }
        try {
          // Fetch full payment with transaction relations for accounting sync
          const fullPayment = await prisma.payment.findUnique({
            where: { id: payment.id },
            include: {
              transaction: {
                include: {
                  member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
                  category: { select: { id: true, name: true, type: true } },
                },
              },
            },
          });
          if (fullPayment) {
            await accountingIntegrationService.onPaymentRecorded(fullPayment, req.user!.id);
          }
        } catch (syncError) {
          console.error(`Accounting sync failed for payment ${payment.id} (non-critical):`, syncError);
        }
      }

      return res.status(200).json({
        success: true,
        message: `${result.length} transaction(s) marked as paid`,
        data: {
          batchReference,
          paymentsCreated: result.length,
          totalAmount: unpaidTransactions.reduce(
            (sum, t) => sum.plus(new Decimal(t.amount).minus(
              t.payments.reduce((s, p) => s.plus(p.amountPaid), new Decimal(0))
            )),
            new Decimal(0)
          ).toNumber(),
        },
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
      // This month in Lagos, and charges that are not voided or forgiven: the same rules as the reports and their lists
      const { startDate: startOfMonth, endDate: endOfMonth } = periodRange('this_month');

      const [
        totalMembers,
        activeCategories,
        monthlyTransactions,
        monthlyPayments,
        owing,
        recentPayments,
      ] = await Promise.all([
        prisma.member.count({ where: { associationId, status: 'active' } }),
        prisma.financialCategory.count({ where: { associationId, isActive: true } }),
        prisma.transaction.aggregate({
          where: { associationId, ...COUNTED_CHARGE, createdAt: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.payment.aggregate({
          where: { associationId, paymentDate: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amountPaid: true },
          _count: { id: true },
        }),
        generateAgingAnalysis(associationId, new Date(), false),
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

      // What is still owed, and how many charges are overdue, come from the aging report's own code, so the lists behind them add up
      const { current, days31to60, days61to90, over90 } = owing.buckets;
      const overdueTransactions = current.count + days31to60.count + days61to90.count + over90.count;
      const allPayments = await prisma.payment.aggregate({ where: { associationId }, _sum: { amountPaid: true } });

      return res.status(200).json({
        success: true,
        data: {
          overview: {
            totalMembers,
            activeCategories,
            overdueTransactions,
          },
          thisMonth: {
            startDate: startOfMonth,
            endDate: endOfMonth,
            transactionsCreated: monthlyTransactions._count.id,
            transactionsAmount: monthlyTransactions._sum.amount || 0,
            paymentsReceived: monthlyPayments._count.id,
            paymentsAmount: monthlyPayments._sum.amountPaid || 0,
          },
          totals: {
            totalOutstanding: owing.summary.totalOutstanding,
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
          isVoided: false,
          status: { in: ['pending', 'overdue', 'partial'] },
        },
        include: {
          member: { select: { id: true, userId: true, firstName: true, lastName: true, email: true, phone: true } },
          category: { select: { name: true, type: true } },
          payments: { select: { amountPaid: true } },
        },
      });

      if (transactions.length === 0) {
        return res.status(404).json({ success: false, message: 'No valid transactions found' });
      }

      // A charge reminded in the last day is skipped (the daily job and other officers update the same marker).
      const { fresh: transactionsToRemind, recent: recentlyReminded } = splitByCooldown(transactions);
      if (transactionsToRemind.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'These members were all reminded in the last 24 hours, so nothing was sent.',
          data: { sent: 0, failed: 0, noEmail: 0, noContact: 0, inApp: 0, skippedRecently: recentlyReminded.length, details: [] },
        });
      }

      // Get association details
      const association = await prisma.association.findUnique({
        where: { id: associationId },
        select: { name: true },
      });

      // R4.6/G53: Notification Settings' senderName was saved but never read
      const notificationSettings = await SettingsService.getSettings(associationId, 'notifications');
      const senderName: string | undefined = notificationSettings.senderName;

      // Group transactions by member for consolidated reminders
      const memberTransactions: Record<number, typeof transactions> = {};
      transactionsToRemind.forEach(txn => {
        if (!memberTransactions[txn.member.id]) {
          memberTransactions[txn.member.id] = [];
        }
        memberTransactions[txn.member.id].push(txn);
      });

      const results = {
        sent: 0,
        failed: 0,
        noEmail: 0,
        noContact: 0,
        inApp: 0,
        skippedRecently: recentlyReminded.length,
        details: [] as { memberId: number; memberName: string; status: string; error?: string }[],
      };

      // Send reminders (in production, this would use the email service)
      for (const [memberId, memberTxns] of Object.entries(memberTransactions)) {
        const member = memberTxns[0].member;
        
        // Reach the member wherever they can be reached: in the app if they have a login, by email if they have one.
        if (!member.email && !member.userId) {
          results.noEmail++;
          results.noContact++;
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

          const anyOverdue = memberTxns.some((t) => t.dueDate && t.dueDate.getTime() < Date.now());
          if (member.userId) {
            try {
              const text = reminderText({ count: memberTxns.length, total: totalOutstanding.toNumber(), overdue: anyOverdue, custom: message });
              const outcome = await dispatchNotification({
                associationId,
                userId: member.userId,
                kind: 'payment_due',
                pushType: 'dues.reminder',
                title: text.title,
                message: text.message,
              });
              if (outcome.inAppCreated) results.inApp++;
            } catch (notifyError) {
              console.error('In-app reminder failed (non-critical):', notifyError);
            }
          }

          // G43: real email per transaction — each has its own category/due
          // date, so one reminder per transaction matches the existing
          // payment-reminder/payment-overdue templates' fields correctly
          // rather than forcing several transactions into one summary email.
          for (const txn of member.email ? memberTxns : []) {
            const paid = txn.payments.reduce((p, pay) => p.plus(pay.amountPaid), new Decimal(0));
            const txnOutstanding = new Decimal(txn.amount).minus(paid);
            const daysUntilDue = txn.dueDate
              ? Math.ceil((txn.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : 0;

            await sendEmail({
              to: member.email!,
              subject: daysUntilDue < 0
                ? `Overdue: ${txn.category.name} payment for ${association?.name}`
                : `Payment Reminder: ${txn.category.name} for ${association?.name}`,
              template: daysUntilDue < 0 ? 'payment-overdue' : 'payment-reminder',
              fromName: senderName,
              data: {
                memberName: `${member.firstName} ${member.lastName}`,
                associationName: association?.name,
                categoryName: txn.category.name,
                amount: txnOutstanding.toNumber(),
                dueDate: txn.dueDate ? txn.dueDate.toLocaleDateString('en-NG') : 'N/A',
                daysUntilDue,
                daysOverdue: daysUntilDue < 0 ? Math.abs(daysUntilDue) : undefined,
                ...(message && { customMessage: message }),
              },
            });
          }

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

          await prisma.transaction.updateMany({ where: { id: { in: memberTxns.map((t) => t.id) } }, data: { lastReminderSentAt: new Date() } });

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
        message: `Reminders sent: ${results.sent}, Failed: ${results.failed}, No way to reach: ${results.noContact}${results.skippedRecently > 0 ? `, Skipped (reminded in the last 24 hours): ${results.skippedRecently}` : ''}`,
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

      // Get all pending/overdue transactions grouped by member. "Overdue" is decided by the due date, not the stored status.
      const transactions = await prisma.transaction.findMany({
        where: status === 'overdue' ? { associationId, ...overdueWhere() } : { associationId, isVoided: false, status: statusCondition },
        include: {
          member: { select: { id: true, memberId: true, firstName: true, lastName: true, email: true, phone: true, userId: true } },
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
          /** Whether the member has a login, so an in-app reminder can reach them even without an email. */
          hasAccount: boolean;
        };
        transactions: Array<{
          id: number;
          referenceNumber: string;
          category: string;
          amount: number;
          balance: number;
          dueDate: Date | null;
          status: string;
          lastReminderSentAt: Date | null;
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
            member: {
              id: txn.member.id,
              memberId: txn.member.memberId,
              firstName: txn.member.firstName,
              lastName: txn.member.lastName,
              email: txn.member.email,
              phone: txn.member.phone,
              hasAccount: !!txn.member.userId,
            },
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
          lastReminderSentAt: txn.lastReminderSentAt,
        });

        memberMap[txn.member.id].totalOutstanding += balance;
        if (isOverdue(txn)) {
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
            overdueTransactions: transactions.filter(t => isOverdue(t)).length,
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
