import { Prisma } from '@prisma/client';
import type { CooperativeAccountClass } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';

/**
 * Account types and loan categories are data the association's officers create, not a fixed list. Each account type picks one behaviour
 * CLASS, and the class (not the name) drives what the type can do: share capital is never withdrawable; the other classes are.
 */

export const DEFAULT_ACCOUNT_TYPE_NAME = 'Ordinary Savings';
export const DEFAULT_LOAN_CATEGORY_NAME = 'Normal Loans';

export interface AccountTypeInput {
  name?: string;
  description?: string | null;
  accountClass?: CooperativeAccountClass;
  defaultMonthlyAmount?: number | null;
  monthlyWithdrawalLimit?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}

/** What the class forces. Share capital can't be withdrawn, so it can't carry a withdrawal limit either. */
export function resolveClassRules(accountClass: CooperativeAccountClass, limit: number | null | undefined) {
  if (accountClass === 'SHARES') return { isWithdrawable: false, monthlyWithdrawalLimit: null as Decimal | null };
  return { isWithdrawable: true, monthlyWithdrawalLimit: limit ? new Decimal(limit) : null };
}

function duplicateName(error: unknown, what: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new RuleError(`You already have ${what} with that name.`, 409, 'DUPLICATE_NAME');
  }
  throw error;
}

export const cooperativeTypesService = {
  // ----- Account types -----

  async listAccountTypes(associationId: number, options: { includeInactive?: boolean } = {}) {
    const rows = await prisma.cooperativeAccountType.findMany({
      where: { associationId, ...(options.includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { accounts: true } } },
    });
    return rows.map(({ _count, ...type }) => ({ ...type, accountCount: _count.accounts }));
  },

  /** The association's first account type, so a new cooperative can take its first payment without setting anything up. */
  async ensureDefaultAccountType(associationId: number) {
    const existing = await prisma.cooperativeAccountType.count({ where: { associationId } });
    if (existing > 0) return;
    await prisma.cooperativeAccountType.createMany({
      data: [{ associationId, name: DEFAULT_ACCOUNT_TYPE_NAME, accountClass: 'CONTRIBUTION', sortOrder: 0 }],
      skipDuplicates: true,
    });
  },

  async createAccountType(associationId: number, input: AccountTypeInput & { name: string }) {
    const accountClass = input.accountClass ?? 'CONTRIBUTION';
    const rules = resolveClassRules(accountClass, input.monthlyWithdrawalLimit);
    try {
      return await prisma.cooperativeAccountType.create({
        data: {
          associationId,
          name: input.name.trim(),
          description: input.description || null,
          accountClass,
          defaultMonthlyAmount: input.defaultMonthlyAmount ? new Decimal(input.defaultMonthlyAmount) : null,
          sortOrder: input.sortOrder ?? 0,
          ...rules,
        },
      });
    } catch (error) {
      return duplicateName(error, 'an account type');
    }
  },

  async updateAccountType(associationId: number, id: number, input: AccountTypeInput) {
    const current = await prisma.cooperativeAccountType.findFirst({
      where: { id, associationId },
      include: { _count: { select: { accounts: true } } },
    });
    if (!current) throw new RuleError('Account type not found.', 404, 'NOT_FOUND');

    const accountClass = input.accountClass ?? current.accountClass;
    // Changing what a type DOES after members hold money in it would change the rules under their feet.
    if (accountClass !== current.accountClass && current._count.accounts > 0) {
      throw new RuleError(
        'Members already hold accounts of this type, so its behaviour class can no longer change. Create a new type instead.',
        409,
        'CLASS_LOCKED',
      );
    }

    const limit =
      input.monthlyWithdrawalLimit === undefined ? (current.monthlyWithdrawalLimit?.toNumber() ?? null) : input.monthlyWithdrawalLimit;
    const rules = resolveClassRules(accountClass, limit);

    try {
      return await prisma.cooperativeAccountType.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description || null } : {}),
          ...(input.defaultMonthlyAmount !== undefined
            ? { defaultMonthlyAmount: input.defaultMonthlyAmount ? new Decimal(input.defaultMonthlyAmount) : null }
            : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          accountClass,
          ...rules,
        },
      });
    } catch (error) {
      return duplicateName(error, 'an account type');
    }
  },

  // ----- Loan categories -----

  async listLoanCategories(associationId: number, options: { includeInactive?: boolean } = {}) {
    const rows = await prisma.loanCategory.findMany({
      where: { associationId, ...(options.includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return rows.map(({ _count, ...category }) => ({ ...category, productCount: _count.products }));
  },

  async ensureDefaultLoanCategory(associationId: number) {
    const existing = await prisma.loanCategory.count({ where: { associationId } });
    if (existing > 0) return;
    await prisma.loanCategory.createMany({
      data: [{ associationId, name: DEFAULT_LOAN_CATEGORY_NAME, isGoods: false, sortOrder: 0 }],
      skipDuplicates: true,
    });
  },

  async createLoanCategory(
    associationId: number,
    input: { name: string; description?: string | null; isGoods?: boolean; sortOrder?: number },
  ) {
    try {
      return await prisma.loanCategory.create({
        data: {
          associationId,
          name: input.name.trim(),
          description: input.description || null,
          isGoods: input.isGoods ?? false,
          sortOrder: input.sortOrder ?? 0,
        },
      });
    } catch (error) {
      return duplicateName(error, 'a loan category');
    }
  },

  async updateLoanCategory(
    associationId: number,
    id: number,
    input: { name?: string; description?: string | null; isGoods?: boolean; sortOrder?: number; isActive?: boolean },
  ) {
    const current = await prisma.loanCategory.findFirst({ where: { id, associationId }, include: { _count: { select: { products: true } } } });
    if (!current) throw new RuleError('Loan category not found.', 404, 'NOT_FOUND');
    if (input.isGoods !== undefined && input.isGoods !== current.isGoods && current._count.products > 0) {
      throw new RuleError(
        'Loan products already use this category, so it can no longer switch between cash and goods. Create a new category instead.',
        409,
        'GOODS_LOCKED',
      );
    }
    try {
      return await prisma.loanCategory.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description || null } : {}),
          ...(input.isGoods !== undefined ? { isGoods: input.isGoods } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    } catch (error) {
      return duplicateName(error, 'a loan category');
    }
  },
};
