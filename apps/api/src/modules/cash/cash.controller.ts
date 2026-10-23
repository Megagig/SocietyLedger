import { Request, Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../lib/permissions';
import { RBACService } from '../../services/rbac.service';
import { CASH_RULE_STATUS, CashRuleError } from './cash-rules';
import { cashCollectionsService } from './cash-collections.service';
import { cashLodgmentsService } from './cash-lodgments.service';
import { voidCashReceipt } from './cash-void';

const itemSchema = z.object({
  kind: z.enum(['DUES', 'LEVY', 'SAVINGS', 'WELFARE', 'DONATION', 'LOAN_REPAYMENT']),
  targetId: z.number().int().positive(),
  amount: z.number().positive().multipleOf(0.01),
  allocationId: z.number().int().positive().optional(),
});

const createCollectionSchema = z.object({
  title: z.string().trim().min(2).max(120),
  meetingId: z.number().int().positive().nullish(),
  notes: z.string().trim().max(500).nullish(),
});

const receiptSchema = z.object({
  memberId: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(100),
  items: z.array(itemSchema).min(1).max(20),
});

const lodgmentFieldsSchema = z.object({
  bankAccountId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  depositDate: z.coerce.date(),
  bankReference: z.string().trim().max(100).optional(),
  shortfallReason: z.string().trim().max(500).optional(),
  collectionIds: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0) : undefined)),
});

const decisionSchema = z.object({ status: z.enum(['VERIFIED', 'REJECTED']), reason: z.string().trim().max(500).optional() });

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Whether the caller may see every officer's cash, not just their own. */
async function canViewAll(req: Request): Promise<boolean> {
  const context = { userId: req.user!.id, associationId: req.user?.associationId ?? null, platformRole: req.user?.platformRole ?? null };
  return (
    (await RBACService.hasPermission(context, PERMISSIONS.CASH_VIEW)) || (await RBACService.hasPermission(context, PERMISSIONS.CASH_VERIFY))
  );
}

function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof CashRuleError) {
    return res.status(CASH_RULE_STATUS[error.code]).json({ success: false, message: error.message, code: error.code, details: error.details });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, message: 'Please check the details and try again.', errors: error.errors });
  }
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: fallback });
}

const idParam = (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new CashRuleError('NOT_FOUND', 'That record was not found.');
  return id;
};

export const cashController = {
  async overview(req: Request, res: Response) {
    try {
      const data = await cashLodgmentsService.getOverview(req.user!.associationId!, { userId: req.user!.id, viewAll: await canViewAll(req) });
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to load cash overview');
    }
  },

  async createCollection(req: Request, res: Response) {
    try {
      const body = createCollectionSchema.parse(req.body);
      const data = await cashCollectionsService.createCollection(req.user!.associationId!, req.user!.id, body);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to open the collection');
    }
  },

  async listCollections(req: Request, res: Response) {
    try {
      const { page, limit } = pageSchema.parse(req.query);
      const status = req.query.status === 'OPEN' || req.query.status === 'CLOSED' ? req.query.status : undefined;
      const meetingId = req.query.meetingId ? Number(req.query.meetingId) : undefined;
      const data = await cashCollectionsService.listCollections(req.user!.associationId!, {
        userId: req.user!.id,
        viewAll: await canViewAll(req),
        status,
        meetingId: Number.isInteger(meetingId) ? meetingId : undefined,
        page,
        limit,
      });
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to load collections');
    }
  },

  async getCollection(req: Request, res: Response) {
    try {
      const data = await cashCollectionsService.getCollection(req.user!.associationId!, idParam(req), { userId: req.user!.id, viewAll: await canViewAll(req) });
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to load the collection');
    }
  },

  async closeCollection(req: Request, res: Response) {
    try {
      const data = await cashCollectionsService.closeCollection(req.user!.associationId!, req.user!.id, idParam(req));
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to close the collection');
    }
  },

  async payables(req: Request, res: Response) {
    try {
      const memberId = Number(req.query.memberId);
      if (!Number.isInteger(memberId) || memberId <= 0) throw new CashRuleError('INVALID_LINK', 'Choose a member first.');
      const data = await cashCollectionsService.getPayables(req.user!.associationId!, memberId);
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to load what the member can pay');
    }
  },

  async recordReceipt(req: Request, res: Response) {
    try {
      const body = receiptSchema.parse(req.body);
      const { receipt, replayed } = await cashCollectionsService.recordReceipt(req.user!.associationId!, req.user!.id, {
        collectionId: idParam(req),
        ...body,
      });
      return res.status(replayed ? 200 : 201).json({ success: true, replayed, data: receipt });
    } catch (error) {
      return fail(res, error, 'Failed to record the receipt');
    }
  },

  async voidReceipt(req: Request, res: Response) {
    try {
      const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
      const id = idParam(req);
      await voidCashReceipt(req.user!.associationId!, req.user!.id, id, reason);
      return res.json({ success: true, message: 'Receipt voided' });
    } catch (error) {
      return fail(res, error, 'Failed to void the receipt');
    }
  },

  async lodgable(req: Request, res: Response) {
    try {
      const data = await cashLodgmentsService.getLodgable(req.user!.associationId!, req.user!.id);
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to load the cash you can lodge');
    }
  },

  async recordLodgment(req: Request, res: Response) {
    try {
      const file = req.file;
      if (!file) throw new CashRuleError('INVALID_ITEM', 'Attach a photo of the deposit slip.');
      const body = lodgmentFieldsSchema.parse(req.body);
      const data = await cashLodgmentsService.recordLodgment(req.user!.associationId!, req.user!.id, body, {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      });
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to record the lodgment');
    }
  },

  async listLodgments(req: Request, res: Response) {
    try {
      const { page, limit } = pageSchema.parse(req.query);
      const status = ['PENDING', 'VERIFIED', 'REJECTED'].includes(String(req.query.status)) ? (req.query.status as 'PENDING' | 'VERIFIED' | 'REJECTED') : undefined;
      const data = await cashLodgmentsService.listLodgments(req.user!.associationId!, { userId: req.user!.id, viewAll: await canViewAll(req), status, page, limit });
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to load lodgments');
    }
  },

  async getLodgment(req: Request, res: Response) {
    try {
      const data = await cashLodgmentsService.getLodgment(req.user!.associationId!, idParam(req), { userId: req.user!.id, viewAll: await canViewAll(req) });
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to load the lodgment');
    }
  },

  async slipUrl(req: Request, res: Response) {
    try {
      const data = await cashLodgmentsService.getSlipUrl(req.user!.associationId!, idParam(req), { userId: req.user!.id, viewAll: await canViewAll(req) }, req.hostname);
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to load the deposit slip');
    }
  },

  async decideLodgment(req: Request, res: Response) {
    try {
      const body = decisionSchema.parse(req.body);
      const data = await cashLodgmentsService.decideLodgment(req.user!.associationId!, req.user!.id, idParam(req), body);
      return res.json({ success: true, data });
    } catch (error) {
      return fail(res, error, 'Failed to record the decision');
    }
  },
};
