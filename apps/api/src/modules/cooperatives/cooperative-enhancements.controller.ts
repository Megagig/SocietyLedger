import { Request, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import { PlatformRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { uploadFile, getPresignedUrl } from '../../lib/storage';
import { PERMISSIONS } from '../../lib/permissions';
import { RBACService } from '../../services/rbac.service';
import { RuleError } from '../finance/rule-error';
import { cooperativeTypesService } from './cooperative-types.service';
import { cooperativePaymentsService } from './cooperative-payments.service';
import { cooperativeWithdrawalsService } from './cooperative-withdrawals.service';
import { cooperativeMemberService } from './cooperative-member.service';
import { getTwoStageWithdrawal, setTwoStageWithdrawal } from './cooperative-settings';
import {
  approveWithdrawalSchema,
  bankAccountsQuerySchema,
  cooperativeSettingsSchema,
  createAccountTypeSchema,
  createLoanCategorySchema,
  createPaymentRequestSchema,
  createWithdrawalSchema,
  dashboardQuerySchema,
  myPendingPaymentsQuerySchema,
  paymentRequestQuerySchema,
  rangeQuerySchema,
  rejectRequestSchema,
  reviewWithdrawalSchema,
  updateAccountTypeSchema,
  updateLoanCategorySchema,
  withdrawalQuerySchema,
} from './cooperative-enhancements.validation';

/** A rule that was broken answers with its own status and a stable code; a bad body is a 400 with the field errors; anything else is a 500. */
function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof RuleError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, message: error.errors[0]?.message ?? 'Validation error', errors: error.errors });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

/** Holders of any of these keys see everyone's; a member holding only an `_own` key only ever sees their own. */
async function seesAll(req: Request, keys: string[]): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.platformRole === PlatformRole.SUPER_ADMIN) return true;
  return RBACService.hasAnyPermission(
    { userId: req.user.id, associationId: req.user.associationId ?? null, platformRole: req.user.platformRole ?? null },
    keys,
  );
}

const OFFICER_KEYS = [PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE, PERMISSIONS.COOPERATIVE_LOANS_MANAGE];
const WITHDRAWAL_OFFICER_KEYS = [PERMISSIONS.COOPERATIVE_WITHDRAWAL_REVIEW, PERMISSIONS.COOPERATIVE_WITHDRAWAL_APPROVE, ...OFFICER_KEYS];

function ctx(req: Request) {
  const associationId = req.user?.associationId;
  const userId = req.user?.id;
  if (!associationId || !userId) throw new RuleError('Authentication required', 403, 'AUTH_REQUIRED');
  return { associationId, userId, memberId: req.user?.memberId ?? null };
}

function memberCtx(req: Request) {
  const base = ctx(req);
  if (!base.memberId) throw new RuleError('Member profile not found', 400, 'NO_MEMBER');
  return { ...base, memberId: base.memberId };
}

export const cooperativeEnhancementsController = {
  // ----- Account types -----

  async listAccountTypes(req: Request, res: Response) {
    try {
      const { associationId } = ctx(req);
      const manager = await seesAll(req, [PERMISSIONS.COOPERATIVE_MANAGE_TYPES]);
      if (manager) await cooperativeTypesService.ensureDefaultAccountType(associationId);
      const data = await cooperativeTypesService.listAccountTypes(associationId, { includeInactive: manager && req.query.includeInactive === 'true' });
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to get account types');
    }
  },

  async createAccountType(req: Request, res: Response) {
    try {
      const { associationId } = ctx(req);
      const data = await cooperativeTypesService.createAccountType(associationId, createAccountTypeSchema.parse(req.body));
      return res.status(201).json({ success: true, message: 'Account type created', data });
    } catch (error) {
      return fail(res, error, 'Failed to create account type');
    }
  },

  async updateAccountType(req: Request, res: Response) {
    try {
      const { associationId } = ctx(req);
      const data = await cooperativeTypesService.updateAccountType(associationId, parseInt(req.params.id), updateAccountTypeSchema.parse(req.body));
      return res.json({ success: true, message: 'Account type updated', data });
    } catch (error) {
      return fail(res, error, 'Failed to update account type');
    }
  },

  // ----- Loan categories -----

  async listLoanCategories(req: Request, res: Response) {
    try {
      const { associationId } = ctx(req);
      const manager = await seesAll(req, [PERMISSIONS.COOPERATIVE_MANAGE_TYPES]);
      if (manager) await cooperativeTypesService.ensureDefaultLoanCategory(associationId);
      const data = await cooperativeTypesService.listLoanCategories(associationId, { includeInactive: manager && req.query.includeInactive === 'true' });
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to get loan categories');
    }
  },

  async createLoanCategory(req: Request, res: Response) {
    try {
      const { associationId } = ctx(req);
      const data = await cooperativeTypesService.createLoanCategory(associationId, createLoanCategorySchema.parse(req.body));
      return res.status(201).json({ success: true, message: 'Loan category created', data });
    } catch (error) {
      return fail(res, error, 'Failed to create loan category');
    }
  },

  async updateLoanCategory(req: Request, res: Response) {
    try {
      const { associationId } = ctx(req);
      const data = await cooperativeTypesService.updateLoanCategory(associationId, parseInt(req.params.id), updateLoanCategorySchema.parse(req.body));
      return res.json({ success: true, message: 'Loan category updated', data });
    } catch (error) {
      return fail(res, error, 'Failed to update loan category');
    }
  },

  // ----- Payment requests -----

  /** POST /api/cooperatives/payment-requests  (multipart: `file` + fields, `lines` as a JSON string) */
  async createPaymentRequest(req: Request, res: Response) {
    try {
      const { associationId, userId, memberId } = memberCtx(req);
      const input = createPaymentRequestSchema.parse(req.body);

      const file = req.file;
      if (!file?.buffer) {
        throw new RuleError('Attach your bank receipt (a photo or PDF).', 400, 'PROOF_REQUIRED');
      }

      // Checked before the upload so a bad request never leaves an orphaned file behind.
      await cooperativePaymentsService.validateNewRequest(associationId, input);

      const ext = path.extname(file.originalname) || '';
      const storageKey = `cooperative-payments/${associationId}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      await uploadFile(storageKey, file.buffer, file.mimetype);

      const created = await cooperativePaymentsService.createRequest(associationId, memberId, input, {
        filename: file.originalname,
        filepath: storageKey,
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPLOAD',
          tableName: 'cooperative_payment_requests',
          recordId: created.id,
          newValues: { total: created.totalAmount.toString(), lines: input.lines.length, filename: file.originalname },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Payment submitted. It will show in your savings once an officer confirms it.',
        data: created,
      });
    } catch (error) {
      return fail(res, error, 'Failed to submit the payment');
    }
  },

  async listPaymentRequests(req: Request, res: Response) {
    try {
      const { associationId, memberId } = ctx(req);
      const query = paymentRequestQuerySchema.parse(req.query);
      const all = await seesAll(req, OFFICER_KEYS);
      const page = parseInt(query.page);
      const limit = parseInt(query.limit);
      if (!all && !memberId) {
        return res.json({ success: true, data: { requests: [], pagination: { page, limit, totalCount: 0, totalPages: 0, hasMore: false } } });
      }
      const data = await cooperativePaymentsService.listRequests(associationId, {
        page,
        limit,
        status: query.status,
        memberId: all ? (query.memberId ? parseInt(query.memberId) : undefined) : (memberId as number),
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      });
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to get payment requests');
    }
  },

  /** The proof. Its owner or an officer only. `?format=json` returns { url } for clients that can't follow a redirect with their auth. */
  async getPaymentReceipt(req: Request, res: Response) {
    try {
      const { associationId, memberId } = ctx(req);
      const row = await cooperativePaymentsService.getRow(associationId, parseInt(req.params.id));
      if (!row || (!(await seesAll(req, OFFICER_KEYS)) && row.memberId !== memberId)) {
        return res.status(404).json({ success: false, message: 'Payment request not found' });
      }
      const url = await getPresignedUrl(row.filepath, undefined, req.hostname);
      if (req.query.format === 'json') {
        return res.json({ success: true, data: { url, filename: row.filename, mimeType: row.mimeType } });
      }
      return res.redirect(url);
    } catch (error) {
      return fail(res, error, 'Failed to get the receipt');
    }
  },

  async approvePaymentRequest(req: Request, res: Response) {
    try {
      const { associationId, userId } = ctx(req);
      const data = await cooperativePaymentsService.approve(associationId, parseInt(req.params.id), userId);
      return res.json({ success: true, message: 'Payment approved and added to savings', data });
    } catch (error) {
      return fail(res, error, 'Failed to approve the payment');
    }
  },

  async rejectPaymentRequest(req: Request, res: Response) {
    try {
      const { associationId, userId } = ctx(req);
      const { reason } = rejectRequestSchema.parse(req.body);
      const data = await cooperativePaymentsService.reject(associationId, parseInt(req.params.id), userId, reason);
      return res.json({ success: true, message: 'Payment rejected', data });
    } catch (error) {
      return fail(res, error, 'Failed to reject the payment');
    }
  },

  // ----- Withdrawals -----

  async withdrawalSummary(req: Request, res: Response) {
    try {
      const { associationId, memberId } = memberCtx(req);
      const data = await cooperativeWithdrawalsService.memberSummary(associationId, memberId);
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to get your withdrawal summary');
    }
  },

  async createWithdrawal(req: Request, res: Response) {
    try {
      const { associationId, memberId } = memberCtx(req);
      const data = await cooperativeWithdrawalsService.create(associationId, memberId, createWithdrawalSchema.parse(req.body));
      return res.status(201).json({ success: true, message: 'Withdrawal requested. You will be told when it is decided.', data });
    } catch (error) {
      return fail(res, error, 'Failed to request the withdrawal');
    }
  },

  async listWithdrawals(req: Request, res: Response) {
    try {
      const { associationId, memberId } = ctx(req);
      const query = withdrawalQuerySchema.parse(req.query);
      const all = await seesAll(req, WITHDRAWAL_OFFICER_KEYS);
      const page = parseInt(query.page);
      const limit = parseInt(query.limit);
      if (!all && !memberId) {
        return res.json({ success: true, data: { requests: [], pagination: { page, limit, totalCount: 0, totalPages: 0, hasMore: false } } });
      }
      const data = await cooperativeWithdrawalsService.list(associationId, {
        page,
        limit,
        status: query.status,
        memberId: all ? (query.memberId ? parseInt(query.memberId) : undefined) : (memberId as number),
      });
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to get withdrawals');
    }
  },

  async reviewWithdrawal(req: Request, res: Response) {
    try {
      const { associationId, userId } = ctx(req);
      const data = await cooperativeWithdrawalsService.review(associationId, parseInt(req.params.id), userId, reviewWithdrawalSchema.parse(req.body));
      return res.json({ success: true, message: data.status === 'REJECTED' ? 'Withdrawal rejected' : 'Passed on for approval', data });
    } catch (error) {
      return fail(res, error, 'Failed to review the withdrawal');
    }
  },

  async approveWithdrawal(req: Request, res: Response) {
    try {
      const { associationId, userId } = ctx(req);
      const data = await cooperativeWithdrawalsService.approve(associationId, parseInt(req.params.id), userId, approveWithdrawalSchema.parse(req.body));
      return res.json({ success: true, message: 'Withdrawal approved and recorded', data });
    } catch (error) {
      return fail(res, error, 'Failed to approve the withdrawal');
    }
  },

  async rejectWithdrawal(req: Request, res: Response) {
    try {
      const { associationId, userId } = ctx(req);
      const { reason } = rejectRequestSchema.parse(req.body);
      const data = await cooperativeWithdrawalsService.reject(associationId, parseInt(req.params.id), userId, reason);
      return res.json({ success: true, message: 'Withdrawal rejected', data });
    } catch (error) {
      return fail(res, error, 'Failed to reject the withdrawal');
    }
  },

  async cancelWithdrawal(req: Request, res: Response) {
    try {
      const { associationId, memberId } = memberCtx(req);
      const data = await cooperativeWithdrawalsService.cancel(associationId, parseInt(req.params.id), memberId);
      return res.json({ success: true, message: 'Withdrawal cancelled', data });
    } catch (error) {
      return fail(res, error, 'Failed to cancel the withdrawal');
    }
  },

  // ----- Member read models (a member's own pages; officers see a member's by id) -----

  async myDashboard(req: Request, res: Response) {
    try {
      const { associationId, memberId } = memberCtx(req);
      const { year } = dashboardQuerySchema.parse(req.query);
      const now = new Date();
      return res.json({ success: true, data: await cooperativeMemberService.dashboard(associationId, memberId, year ?? now.getUTCFullYear(), now) });
    } catch (error) {
      return fail(res, error, 'Failed to get your cooperative dashboard');
    }
  },

  async myTransactions(req: Request, res: Response) {
    try {
      const { associationId, memberId } = memberCtx(req);
      return res.json({ success: true, data: await cooperativeMemberService.transactions(associationId, memberId, rangeQuerySchema.parse(req.query)) });
    } catch (error) {
      return fail(res, error, 'Failed to get your transactions');
    }
  },

  async myCashbook(req: Request, res: Response) {
    try {
      const { associationId, memberId } = memberCtx(req);
      return res.json({ success: true, data: await cooperativeMemberService.cashbook(associationId, memberId, rangeQuerySchema.parse(req.query)) });
    } catch (error) {
      return fail(res, error, 'Failed to get your cashbook');
    }
  },

  async myPendingPayments(req: Request, res: Response) {
    try {
      const { associationId, memberId } = memberCtx(req);
      const q = myPendingPaymentsQuerySchema.parse(req.query);
      const data = await cooperativeMemberService.pendingPayments(associationId, memberId, {
        from: q.from,
        to: q.to,
        type: q.type,
        status: q.status,
        newestFirst: q.sort === 'newest',
      });
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to get your pending payments');
    }
  },

  async bankAccounts(req: Request, res: Response) {
    try {
      const { associationId } = ctx(req);
      const { search } = bankAccountsQuerySchema.parse(req.query);
      return res.json({ success: true, data: { bankAccounts: await cooperativeMemberService.bankAccounts(associationId, search) } });
    } catch (error) {
      return fail(res, error, 'Failed to get the cooperative bank accounts');
    }
  },

  /** An officer opening one member's cooperative dashboard. */
  async memberDashboard(req: Request, res: Response) {
    try {
      const { associationId } = ctx(req);
      const { year } = dashboardQuerySchema.parse(req.query);
      const now = new Date();
      return res.json({ success: true, data: await cooperativeMemberService.dashboard(associationId, parseInt(req.params.id), year ?? now.getUTCFullYear(), now) });
    } catch (error) {
      return fail(res, error, 'Failed to get the member dashboard');
    }
  },

  /** An officer opening one member's cashbook. */
  async memberCashbook(req: Request, res: Response) {
    try {
      const { associationId } = ctx(req);
      return res.json({ success: true, data: await cooperativeMemberService.cashbook(associationId, parseInt(req.params.id), rangeQuerySchema.parse(req.query)) });
    } catch (error) {
      return fail(res, error, 'Failed to get the member cashbook');
    }
  },

  // ----- Settings -----

  async getSettings(req: Request, res: Response) {
    try {
      const { associationId } = ctx(req);
      return res.json({ success: true, data: { requireTwoStageWithdrawal: await getTwoStageWithdrawal(associationId) } });
    } catch (error) {
      return fail(res, error, 'Failed to get cooperative settings');
    }
  },

  async updateSettings(req: Request, res: Response) {
    try {
      const { associationId, userId } = ctx(req);
      const { requireTwoStageWithdrawal } = cooperativeSettingsSchema.parse(req.body);
      await setTwoStageWithdrawal(associationId, userId, requireTwoStageWithdrawal);
      return res.json({ success: true, message: 'Settings saved', data: { requireTwoStageWithdrawal } });
    } catch (error) {
      return fail(res, error, 'Failed to save cooperative settings');
    }
  },
};
