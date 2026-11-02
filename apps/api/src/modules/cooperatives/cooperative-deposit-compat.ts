import { Request, Response } from 'express';
import path from 'path';
import { z } from 'zod';
import { PlatformRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { uploadFile } from '../../lib/storage';
import { PERMISSIONS } from '../../lib/permissions';
import { RBACService } from '../../services/rbac.service';
import { RuleError } from '../finance/rule-error';
import { cooperativePaymentsService, formatPaymentRequest } from './cooperative-payments.service';
import { cooperativeTypesService } from './cooperative-types.service';
import { createSavingsDepositSchema, savingsDepositQuerySchema, rejectSavingsDepositSchema } from './cooperatives.validation';
import { cooperativeEnhancementsController } from './cooperative-enhancements.controller';

/**
 * The original "savings deposit" endpoints (one account, one amount, one receipt), kept for phones that are still running an older build.
 * They no longer have a table of their own: a deposit is now a payment request with a single line, so a deposit made on an old phone lands
 * in the same officer queue as everything else, and approving it goes through the same all-or-nothing posting. The response keeps the old
 * shape so those builds keep working untouched.
 */

type PaymentRequestView = ReturnType<typeof formatPaymentRequest>;

/** The old response shape, from a payment request. A request with several lines (made on the web) reports its total and first account. */
export type AccountLookup = Map<string, { id: number; accountNumber: string }>;
const lookupKey = (memberId: number, typeId: number) => `${memberId}:${typeId}`;

/**
 * A request still waiting has no account on its lines, only a type. For those, report the member's existing account of that type so an
 * older phone still files the deposit under the right account; if the member has none yet, it is 0 (the account opens on approval).
 */
export function toLegacyDeposit(request: PaymentRequestView, accounts?: AccountLookup) {
  const first = request.lines[0];
  const guessed = first && !first.savingsAccountId ? accounts?.get(lookupKey(request.memberId, first.accountTypeId)) : undefined;
  return {
    id: request.id,
    savingsAccountId: first?.savingsAccountId ?? guessed?.id ?? 0,
    accountNumber: first?.accountNumber ?? guessed?.accountNumber ?? '',
    memberId: request.memberId,
    memberName: request.memberName,
    memberNumber: request.memberNumber,
    amount: request.totalAmount,
    paymentDate: request.paymentDate,
    bankAccountId: request.bankAccountId,
    reference: request.reference,
    memberNote: request.memberNote,
    filename: request.filename,
    hasReceipt: request.hasReceipt,
    status: request.status,
    reviewedAt: request.reviewedAt,
    rejectionReason: request.rejectionReason,
    createdAt: request.createdAt,
  };
}

async function accountsFor(associationId: number, requests: PaymentRequestView[]): Promise<AccountLookup> {
  const wanted = requests.filter((r) => r.lines[0] && !r.lines[0].savingsAccountId);
  const map: AccountLookup = new Map();
  if (wanted.length === 0) return map;
  const rows = await prisma.savingsAccount.findMany({
    where: { associationId, status: 'ACTIVE', memberId: { in: [...new Set(wanted.map((r) => r.memberId))] }, accountTypeId: { in: [...new Set(wanted.map((r) => r.lines[0].accountTypeId))] } },
    select: { id: true, memberId: true, accountTypeId: true, accountNumber: true },
    orderBy: { openedAt: 'asc' },
  });
  for (const row of rows) {
    const key = lookupKey(row.memberId, row.accountTypeId as number);
    if (!map.has(key)) map.set(key, { id: row.id, accountNumber: row.accountNumber });
  }
  return map;
}

function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof RuleError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

async function seesAll(req: Request): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.platformRole === PlatformRole.SUPER_ADMIN) return true;
  return RBACService.hasAnyPermission(
    { userId: req.user.id, associationId: req.user.associationId ?? null, platformRole: req.user.platformRole ?? null },
    [PERMISSIONS.MEMBER_VIEW_ALL, PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE, PERMISSIONS.COOPERATIVE_LOANS_MANAGE],
  );
}

export const cooperativeDepositCompat = {
  /** POST /api/cooperatives/savings-deposits  (multipart: file + savingsAccountId, amount, paymentDate, …) */
  async create(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = req.user?.memberId;
      if (!associationId || !req.user) return res.status(400).json({ success: false, message: 'Authentication required' });
      if (!memberId) return res.status(400).json({ success: false, message: 'Member profile not found' });

      const data = createSavingsDepositSchema.parse(req.body);
      const file = req.file;
      if (!file?.buffer) return res.status(400).json({ success: false, message: 'Attach your bank receipt (a photo or PDF)' });

      // Checked before the upload so a bad request never leaves an orphaned file in storage.
      const account = await prisma.savingsAccount.findFirst({ where: { id: data.savingsAccountId, associationId, memberId, status: 'ACTIVE' } });
      if (!account) return res.status(400).json({ success: false, message: 'Savings account not found or inactive' });

      let accountTypeId = account.accountTypeId;
      if (!accountTypeId) {
        await cooperativeTypesService.ensureDefaultAccountType(associationId);
        const fallback = await prisma.cooperativeAccountType.findFirst({ where: { associationId, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
        accountTypeId = fallback?.id ?? null;
      }
      if (!accountTypeId) return res.status(400).json({ success: false, message: 'This account has no account type yet. Ask an officer to set one up.' });

      const paidOn = new Date(data.paymentDate);
      const input = {
        paymentDate: paidOn,
        bankAccountId: data.bankAccountId,
        reference: data.reference,
        memberNote: data.memberNote,
        lines: [
          { accountTypeId, savingsAccountId: account.id, amount: Number(data.amount), periodMonth: paidOn.getUTCMonth() + 1, periodYear: paidOn.getUTCFullYear() },
        ],
      };
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
          userId: req.user.id,
          action: 'UPLOAD',
          tableName: 'cooperative_payment_requests',
          recordId: created.id,
          newValues: { savingsAccountId: data.savingsAccountId, amount: data.amount, filename: file.originalname },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Deposit submitted. It will show in your savings once an officer confirms the payment.',
        data: toLegacyDeposit(created),
      });
    } catch (error) {
      return fail(res, error, 'Failed to submit the deposit');
    }
  },

  /** GET /api/cooperatives/savings-deposits — a member gets only their own; officers get everyone's. */
  async list(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const query = savingsDepositQuerySchema.parse(req.query);
      const page = parseInt(query.page);
      const limit = parseInt(query.limit);

      const all = await seesAll(req);
      if (!all && !req.user?.memberId) {
        return res.json({ success: true, data: { deposits: [], pagination: { page, limit, totalCount: 0, totalPages: 0, hasMore: false } } });
      }
      const result = await cooperativePaymentsService.listRequests(associationId, {
        page,
        limit,
        status: query.status,
        memberId: all ? (query.memberId ? parseInt(query.memberId) : undefined) : req.user?.memberId,
        savingsAccountId: query.savingsAccountId ? parseInt(query.savingsAccountId) : undefined,
      });
      const lookup = await accountsFor(associationId, result.requests);
      return res.json({ success: true, data: { deposits: result.requests.map((r) => toLegacyDeposit(r, lookup)), pagination: result.pagination } });
    } catch (error) {
      return fail(res, error, 'Failed to get savings deposits');
    }
  },

  /** The receipt: the same row and the same ownership rule as a payment request's. */
  receipt: cooperativeEnhancementsController.getPaymentReceipt,

  async approve(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) return res.status(400).json({ success: false, message: 'Authentication required' });
      const approved = await cooperativePaymentsService.approve(associationId, parseInt(req.params.id), userId);
      return res.json({ success: true, message: 'Deposit approved and added to savings', data: toLegacyDeposit(approved) });
    } catch (error) {
      return fail(res, error, 'Failed to approve the deposit');
    }
  },

  async reject(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) return res.status(400).json({ success: false, message: 'Authentication required' });
      const { reason } = rejectSavingsDepositSchema.parse(req.body);
      const rejected = await cooperativePaymentsService.reject(associationId, parseInt(req.params.id), userId, reason);
      return res.json({ success: true, message: 'Deposit rejected', data: toLegacyDeposit(rejected) });
    } catch (error) {
      return fail(res, error, 'Failed to reject the deposit');
    }
  },
};
