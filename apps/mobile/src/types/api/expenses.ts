import type { Pagination } from './accounting';
import type { IsoDateString, MoneyValue } from './common';

/** Expense vouchers (spending recorded after it is paid). Mirrors `apps/api/src/modules/expenses`. Money arrives as strings. */

export type ExpenseStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'VOIDED';

export type ExpenseAccountRef = { id: number; code: string; name: string };

/** Where a category stands against its budget line if this voucher is counted. `overBy` is zero unless it takes the line past its plan. */
export type BudgetPositionDTO = {
  budgetId: number;
  budgetName: string;
  planned: MoneyValue;
  spent: MoneyValue;
  thisVoucher: MoneyValue;
  left: MoneyValue;
  overBy: MoneyValue;
};

export type ExpenseDTO = {
  id: number;
  voucherNumber: string;
  expenseDate: IsoDateString;
  payee: string;
  description: string;
  amount: MoneyValue;
  category: ExpenseAccountRef;
  paidFrom: ExpenseAccountRef;
  reference: string | null;
  noReceiptReason: string | null;
  hasReceipt: boolean;
  receiptType: string | null;
  status: ExpenseStatus;
  createdBy: number;
  createdByEmail: string | null;
  submittedAt: IsoDateString | null;
  approvedBy: number | null;
  approvedByEmail: string | null;
  approvedAt: IsoDateString | null;
  /** Set when it was approved: it took its category past its budget line. */
  overBudget: boolean;
  rejectedByEmail: string | null;
  rejectedAt: IsoDateString | null;
  rejectionReason: string | null;
  voidedByEmail: string | null;
  voidedAt: IsoDateString | null;
  voidReason: string | null;
  journalEntryId: number | null;
  reversalEntryId: number | null;
  createdAt: IsoDateString;
};

/** One voucher in full: the budget note is there while it is not yet in the books. */
export type ExpenseDetailDTO = ExpenseDTO & {
  budget: BudgetPositionDTO | null;
  /** While it waits: how many officers other than the one who recorded it can approve it. Zero means nobody can decide it yet. Null once it is no longer waiting. */
  otherApprovers: number | null;
};

export type ExpenseListDTO = {
  vouchers: ExpenseDTO[];
  totals: { approvedAmount: MoneyValue; approvedCount: number; waitingForApproval: number };
  pagination: Pagination;
};

export type ExpenseOptionsDTO = {
  categories: { id: number; code: string; name: string; parentId: number | null }[];
  paidFrom: ExpenseAccountRef[];
  receiptRequiredAbove: MoneyValue;
};

export type ExpenseParams = { status?: ExpenseStatus; search?: string; mine?: 'true'; page: number; limit: number };

export type ExpensePayload = {
  payee: string;
  description: string;
  amount: number;
  expenseDate: string;
  categoryAccountId: number;
  paidFromAccountId: number;
  reference?: string | null;
  noReceiptReason?: string | null;
};

export type ReceiptLinkDTO = { url: string; type: string | null };
