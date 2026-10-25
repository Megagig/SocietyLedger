import type { Request, Response } from 'express';
import { z } from 'zod';
import { confirmPassword, reauthFailure } from '../../lib/reauth';
import { respondWithError } from '../accounting/accounting-http';
import { parseLedgerDate } from '../accounting/accounting-ledger';
import { approveSchema, ExpenseRuleError, rejectSchema, voidSchema, voucherInputSchema, type ExpenseStatus } from './expense-rules';
import { expensesService } from './expenses.service';

const STATUSES: ExpenseStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'VOIDED'];

/** A request the rules refused answers with its own status and plain words; a badly shaped one answers 400 with the first problem. */
function fail(res: Response, error: unknown) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, code: 'INVALID_EXPENSE', message: error.issues[0]?.message ?? 'Check the details and try again.' });
  }
  return respondWithError(res, error);
}

function who(req: Request): { associationId: number; userId: number } {
  const associationId = req.user?.associationId;
  const userId = req.user?.id;
  if (!associationId || !userId) throw new ExpenseRuleError('Authentication required.', 403, 'AUTH_REQUIRED');
  return { associationId, userId };
}

function idOf(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ExpenseRuleError('That is not a valid expense.', 400, 'INVALID_ID');
  return id;
}

export const expensesController = {
  async options(req: Request, res: Response) {
    try {
      const { associationId } = who(req);
      return res.json({ success: true, data: await expensesService.getOptions(associationId) });
    } catch (error) {
      return fail(res, error);
    }
  },

  async budgetCheck(req: Request, res: Response) {
    try {
      const { associationId } = who(req);
      const category = Number(req.query.categoryAccountId);
      if (!Number.isInteger(category) || category <= 0) throw new ExpenseRuleError('Choose a category.', 400, 'INVALID_CATEGORY');
      return res.json({ success: true, data: await expensesService.checkBudget(associationId, category, req.query.amount, req.query.date) });
    } catch (error) {
      return fail(res, error);
    }
  },

  async list(req: Request, res: Response) {
    try {
      const { associationId, userId } = who(req);
      const q = req.query;
      const status = typeof q.status === 'string' && STATUSES.includes(q.status as ExpenseStatus) ? (q.status as ExpenseStatus) : undefined;
      const category = Number(q.categoryAccountId);
      const data = await expensesService.list(associationId, {
        status,
        search: typeof q.search === 'string' && q.search.trim() ? q.search.trim().slice(0, 100) : undefined,
        from: parseLedgerDate(q.from, 'The start date', false),
        to: parseLedgerDate(q.to, 'The end date', true),
        categoryAccountId: Number.isInteger(category) && category > 0 ? category : undefined,
        createdBy: q.mine === 'true' ? userId : undefined,
        page: Number(q.page) || 1,
        limit: Number(q.limit) || 20,
      });
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error);
    }
  },

  async get(req: Request, res: Response) {
    try {
      const { associationId } = who(req);
      return res.json({ success: true, data: await expensesService.get(associationId, idOf(req)) });
    } catch (error) {
      return fail(res, error);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { associationId, userId } = who(req);
      const input = voucherInputSchema.parse(req.body ?? {});
      return res.status(201).json({ success: true, data: await expensesService.create(associationId, userId, input) });
    } catch (error) {
      return fail(res, error);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { associationId, userId } = who(req);
      const input = voucherInputSchema.parse(req.body ?? {});
      return res.json({ success: true, data: await expensesService.update(associationId, userId, idOf(req), input) });
    } catch (error) {
      return fail(res, error);
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const { associationId, userId } = who(req);
      return res.json({ success: true, data: await expensesService.remove(associationId, userId, idOf(req)) });
    } catch (error) {
      return fail(res, error);
    }
  },

  async attachReceipt(req: Request, res: Response) {
    try {
      const { associationId, userId } = who(req);
      const file = req.file;
      if (!file) throw new ExpenseRuleError('Choose the receipt to attach.', 400, 'RECEIPT_REQUIRED');
      return res.json({ success: true, data: await expensesService.attachReceipt(associationId, userId, idOf(req), { buffer: file.buffer, size: file.size }) });
    } catch (error) {
      return fail(res, error);
    }
  },

  async removeReceipt(req: Request, res: Response) {
    try {
      const { associationId, userId } = who(req);
      return res.json({ success: true, data: await expensesService.removeReceipt(associationId, userId, idOf(req)) });
    } catch (error) {
      return fail(res, error);
    }
  },

  async receiptUrl(req: Request, res: Response) {
    try {
      const { associationId } = who(req);
      return res.json({ success: true, data: await expensesService.receiptUrl(associationId, idOf(req), req.hostname) });
    } catch (error) {
      return fail(res, error);
    }
  },

  async submit(req: Request, res: Response) {
    try {
      const { associationId, userId } = who(req);
      return res.json({ success: true, data: await expensesService.submit(associationId, userId, idOf(req)) });
    } catch (error) {
      return fail(res, error);
    }
  },

  async withdraw(req: Request, res: Response) {
    try {
      const { associationId, userId } = who(req);
      return res.json({ success: true, data: await expensesService.withdraw(associationId, userId, idOf(req)) });
    } catch (error) {
      return fail(res, error);
    }
  },

  /** Approving moves money in the books, so the approver confirms with their password first (403 REAUTH_FAILED; 429 REAUTH_LOCKED after five wrong). */
  async approve(req: Request, res: Response) {
    try {
      const { associationId, userId } = who(req);
      const parsed = approveSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ success: false, code: 'REAUTH_REQUIRED', message: 'Enter your password to approve this expense.' });
      const confirmed = await confirmPassword(userId, parsed.data.password);
      if (!confirmed.ok) {
        const { status, body } = reauthFailure(confirmed);
        return res.status(status).json(body);
      }
      return res.json({ success: true, data: await expensesService.approve(associationId, userId, idOf(req)) });
    } catch (error) {
      return fail(res, error);
    }
  },

  async reject(req: Request, res: Response) {
    try {
      const { associationId, userId } = who(req);
      const { reason } = rejectSchema.parse(req.body ?? {});
      return res.json({ success: true, data: await expensesService.reject(associationId, userId, idOf(req), reason) });
    } catch (error) {
      return fail(res, error);
    }
  },

  async voidVoucher(req: Request, res: Response) {
    try {
      const { associationId, userId } = who(req);
      const parsed = voidSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ success: false, code: 'INVALID_EXPENSE', message: parsed.error.issues[0]?.message ?? 'Give a reason and your password.' });
      const confirmed = await confirmPassword(userId, parsed.data.password);
      if (!confirmed.ok) {
        const { status, body } = reauthFailure(confirmed);
        return res.status(status).json(body);
      }
      return res.json({ success: true, data: await expensesService.voidVoucher(associationId, userId, idOf(req), parsed.data.reason) });
    } catch (error) {
      return fail(res, error);
    }
  },
};
