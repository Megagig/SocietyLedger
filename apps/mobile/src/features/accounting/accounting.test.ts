import type { BalanceSheetDTO, CashFlowDTO, IncomeStatementDTO } from '@/types/api/accounting';
import {
  ACCOUNT_SUBTYPE_OPTIONS,
  asAtMoment,
  balanceSheetText,
  cashFlowText,
  changeText,
  changeTone,
  dayOf,
  endOfLagosDay,
  entryDateIso,
  incomeStatementText,
  isAutomatic,
  isEditable,
  parentChange,
  SYNC_KINDS,
  sourceLabel,
  totalsOf,
  usedPercent,
} from './labels';
import { accountFormSchema, budgetFormSchema, budgetTotal, journalFormSchema, periodFormSchema, toAccountPayload, toBudgetPayload, toJournalPayload, toPeriodPayload } from './schemas';

describe('totalsOf', () => {
  it('adds debits and credits exactly and says whether they balance', () => {
    const totals = totalsOf([{ debit: '1,000.10', credit: '' }, { debit: '0.20', credit: '' }, { debit: '', credit: '1000.30' }]);
    expect(totals.debit.toFixed(2)).toBe('1000.30');
    expect(totals.credit.toFixed(2)).toBe('1000.30');
    expect(totals.balanced).toBe(true);
  });

  it('shows the difference when a kobo is missing, and does not call an empty entry balanced', () => {
    const out = totalsOf([{ debit: '100', credit: '' }, { debit: '', credit: '99.99' }]);
    expect(out.balanced).toBe(false);
    expect(out.difference.toFixed(2)).toBe('0.01');
    expect(totalsOf([{ debit: '', credit: '' }, { debit: '', credit: '' }]).balanced).toBe(false);
  });
});

describe('dates', () => {
  it('takes the calendar day from a plain day or a moment', () => {
    expect(dayOf('2026-10-24')).toBe('2026-10-24');
    const local = new Date(2026, 9, 24, 0, 30).toISOString(); // 00:30 on the 24th on this device
    expect(dayOf(local)).toBe('2026-10-24');
  });

  it('saves a day at midday UTC so it cannot slip to another Lagos day', () => {
    expect(entryDateIso('2026-10-24')).toBe('2026-10-24T12:00:00.000Z');
  });

  it('ends a Lagos day a millisecond before midnight there', () => {
    expect(endOfLagosDay('2026-10-31')).toBe('2026-10-31T22:59:59.999Z');
  });

  it('draws a balance sheet to the end of last month, last quarter or last year', () => {
    const now = new Date('2026-11-15T10:00:00.000Z');
    expect(asAtMoment('today', now)).toBe(now.toISOString());
    expect(asAtMoment('last_month', now)).toBe('2026-10-31T22:59:59.999Z');
    expect(asAtMoment('last_quarter', now)).toBe('2026-09-30T22:59:59.999Z');
    expect(asAtMoment('last_year', now)).toBe('2025-12-31T22:59:59.999Z');
  });
});

describe('entries', () => {
  it('knows an automatic entry from a written one, and says where it came from', () => {
    expect(isAutomatic({ sourceType: 'manual' })).toBe(false);
    expect(isAutomatic({ sourceType: null })).toBe(false);
    expect(isAutomatic({ sourceType: 'auto_sync:Payment' })).toBe(true);
    expect(sourceLabel({ sourceType: 'manual' })).toBe('Written by an officer');
    expect(sourceLabel({ sourceType: 'auto_sync:Payment' })).toBe('Made by the app for a payment');
    expect(sourceLabel({ sourceType: 'auto_sync:CashReversal' })).toBe('Made by the app for a cancelled cash receipt');
  });

  it('lets only a draft or a rejected entry be changed', () => {
    expect(isEditable('DRAFT')).toBe(true);
    expect(isEditable('REJECTED')).toBe(true);
    expect(isEditable('PENDING_APPROVAL')).toBe(false);
    expect(isEditable('APPROVED')).toBe(false);
    expect(isEditable('POSTED')).toBe(false);
  });
});

describe('journalFormSchema', () => {
  const line = (accountId: string, debit: string, credit: string) => ({ accountId, debit, credit, description: '' });
  const base = { entryDate: '2026-10-24', description: 'Hall hire', reference: '', lines: [line('1', '5000', ''), line('2', '', '5000')] };

  it('accepts a balanced entry', () => {
    expect(journalFormSchema.safeParse(base).success).toBe(true);
  });

  it('refuses an entry that is out by a kobo, saying by how much', () => {
    const result = journalFormSchema.safeParse({ ...base, lines: [line('1', '5000', ''), line('2', '', '4999.99')] });
    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.issues.map((i) => i.message).join(' ')).toContain('0.01');
  });

  it('refuses a line that is both a debit and a credit, or neither, or has no account', () => {
    expect(journalFormSchema.safeParse({ ...base, lines: [line('1', '5', '5'), line('2', '', '5')] }).success).toBe(false);
    expect(journalFormSchema.safeParse({ ...base, lines: [line('1', '', ''), line('2', '', '5')] }).success).toBe(false);
    expect(journalFormSchema.safeParse({ ...base, lines: [line('', '5', ''), line('2', '', '5')] }).success).toBe(false);
  });

  it('refuses amounts finer than a kobo, fewer than two lines, and no description', () => {
    expect(journalFormSchema.safeParse({ ...base, lines: [line('1', '5.001', ''), line('2', '', '5.001')] }).success).toBe(false);
    expect(journalFormSchema.safeParse({ ...base, lines: [line('1', '5', '')] }).success).toBe(false);
    expect(journalFormSchema.safeParse({ ...base, description: '  ' }).success).toBe(false);
  });

  it('sends each line as a debit or a credit, with commas taken out and the day set at midday', () => {
    const payload = toJournalPayload({ ...base, lines: [line('1', '5,000.50', ''), line('2', '', '5000.5')], reference: ' INV-9 ' });
    expect(payload.entryDate).toBe('2026-10-24T12:00:00.000Z');
    expect(payload.reference).toBe('INV-9');
    expect(payload.lines).toEqual([{ accountId: 1, debitAmount: 5000.5 }, { accountId: 2, creditAmount: 5000.5 }]);
  });
});

describe('the other forms', () => {
  it('checks an account\'s code and name', () => {
    const base = { code: '5140', name: 'Hall hire', type: 'EXPENSE', subType: '', normalBalance: '', description: '', parentId: '', isActive: true };
    expect(accountFormSchema.safeParse(base).success).toBe(true);
    expect(accountFormSchema.safeParse({ ...base, code: 'has space' }).success).toBe(false);
    expect(accountFormSchema.safeParse({ ...base, name: '' }).success).toBe(false);
  });

  it('wants a budget with a year, dates that run forwards, and each account once', () => {
    const base = { name: '2026 budget', fiscalYear: '2026', startDate: '2026-01-01', endDate: '2026-12-31', description: '', items: [{ accountId: '4', amount: '120000', notes: '' }] };
    expect(budgetFormSchema.safeParse(base).success).toBe(true);
    expect(budgetFormSchema.safeParse({ ...base, fiscalYear: '26' }).success).toBe(false);
    expect(budgetFormSchema.safeParse({ ...base, endDate: '2025-12-31' }).success).toBe(false);
    expect(budgetFormSchema.safeParse({ ...base, items: [{ accountId: '4', amount: '1', notes: '' }, { accountId: '4', amount: '2', notes: '' }] }).success).toBe(false);
    expect(budgetFormSchema.safeParse({ ...base, items: [{ accountId: '4', amount: '', notes: '' }] }).success).toBe(false);
    expect(toBudgetPayload(base).items).toEqual([{ accountId: 4, annualAmount: 120000 }]);
    expect(toBudgetPayload({ ...base, items: [{ accountId: '4', amount: '120,000', notes: ' Hall, four events ' }] }).items).toEqual([{ accountId: 4, annualAmount: 120000, notes: 'Hall, four events' }]);
    expect(budgetTotal([{ amount: '1,000' }, { amount: '250.5' }, { amount: '' }]).toFixed(2)).toBe('1250.50');
  });

  it('wants a period to end after it starts', () => {
    const base = { name: 'October 2026', periodType: 'month', startDate: '2026-10-01', endDate: '2026-10-31' };
    expect(periodFormSchema.safeParse(base).success).toBe(true);
    expect(periodFormSchema.safeParse({ ...base, endDate: '2026-10-01' }).success).toBe(false);
    expect(toPeriodPayload(base).startDate).toBe('2026-10-01T12:00:00.000Z');
  });
});

describe('account groups and balances', () => {
  it('offers the same groups as the website, by kind of account', () => {
    expect(ACCOUNT_SUBTYPE_OPTIONS.ASSET.map((o) => o.value)).toEqual(['current_asset', 'fixed_asset', 'other_asset']);
    expect(ACCOUNT_SUBTYPE_OPTIONS.LIABILITY.map((o) => o.value)).toEqual(['current_liability', 'long_term_liability']);
    expect(ACCOUNT_SUBTYPE_OPTIONS.EXPENSE.map((o) => o.value)).toContain('program_expense');
  });

  it('sends the group and a chosen normal balance, and leaves both out when not chosen', () => {
    const base = { code: '1240', name: 'Accumulated depreciation', type: 'ASSET', subType: 'fixed_asset', normalBalance: 'CREDIT', description: '', parentId: '', isActive: true };
    expect(toAccountPayload(base)).toMatchObject({ subType: 'fixed_asset', normalBalance: 'CREDIT', type: 'ASSET' });
    const plain = toAccountPayload({ ...base, subType: '', normalBalance: '' });
    expect(plain).not.toHaveProperty('subType');
    expect(plain).not.toHaveProperty('normalBalance');
  });
});

describe('comparison and sync words', () => {
  it('writes a change with its sign and percentage', () => {
    expect(changeText({ amount: '1000', percentage: 50 })).toBe('+₦1,000.00 (50.0%)');
    expect(changeText({ amount: '-500', percentage: -10 })).toBe('-₦500.00 (-10.0%)');
    expect(changeText({ amount: '0', percentage: 0 })).toBe('₦0.00 (0.0%)');
  });

  it('calls income going up good and spending going up bad', () => {
    expect(changeTone({ amount: '1', percentage: 1 }, 'good-when-up')).toBe('success');
    expect(changeTone({ amount: '-1', percentage: -1 }, 'good-when-up')).toBe('danger');
    expect(changeTone({ amount: '-1', percentage: -1 }, 'good-when-down')).toBe('success');
    expect(changeTone({ amount: '1', percentage: 1 }, 'good-when-down')).toBe('danger');
    expect(changeTone({ amount: '0', percentage: 0 }, 'good-when-up')).toBe('secondary');
  });

  it('lists every kind of record the books are caught up with, grouped as the website does', () => {
    expect(SYNC_KINDS.map((k) => k.kind)).toEqual(['transactions', 'payments', 'welfare-contributions', 'welfare-payouts', 'savings-transactions', 'loans', 'loan-repayments']);
    expect([...new Set(SYNC_KINDS.map((k) => k.group))]).toEqual(['Finance', 'Welfare', 'Cooperatives']);
  });

  it('draws a chosen date to the moment it is asked for', () => {
    const now = new Date('2026-11-15T10:00:00.000Z');
    expect(asAtMoment('choose', now)).toBe(now.toISOString());
  });
});

describe('budget bars', () => {
  it('keeps the bar between nothing and full', () => {
    expect(usedPercent(250, 1000)).toBe(25);
    expect(usedPercent(1500, 1000)).toBe(100);
    expect(usedPercent(0, 0)).toBe(0);
    expect(usedPercent(10, 0)).toBe(100);
  });
});

describe('the words for the share sheet', () => {
  const rows = (items: [string, string][]) => items.map(([accountName, balance], i) => ({ accountId: i, accountCode: String(i), accountName, balance }));

  it('writes the income statement in full amounts', () => {
    const report: IncomeStatementDTO = {
      period: { startDate: '', endDate: '', label: 'October 2026' },
      revenue: { total: '12500', accounts: rows([['Dues', '12500']]) },
      expenses: { total: '2500', accounts: rows([['Hall hire', '2500']]) },
      netIncome: '10000',
    };
    const text = incomeStatementText(report, 'Opuogun Union');
    expect(text).toContain('Opuogun Union');
    expect(text).toContain('Dues: ₦12,500.00');
    expect(text).toContain('Net surplus: ₦10,000.00');
  });

  it('calls a negative result a loss', () => {
    const report = { period: { startDate: '', endDate: '', label: 'x' }, revenue: { total: '0', accounts: [] }, expenses: { total: '5', accounts: [] }, netIncome: '-5' } as IncomeStatementDTO;
    expect(incomeStatementText(report, 'A')).toContain('Net loss');
  });

  it('writes the balance sheet and the cash flow', () => {
    const sheet = {
      asOfDate: '',
      assets: { current: rows([['Bank', '9000']]), fixed: [], other: [], totalCurrent: '9000', totalFixed: '0', totalOther: '0', total: '9000' },
      liabilities: { current: [], longTerm: [], other: rows([['Held funds', '4000']]), totalCurrent: '0', totalLongTerm: '0', totalOther: '4000', total: '4000' },
      equity: { accounts: [], retainedEarnings: '5000', total: '5000' },
      totalLiabilitiesAndEquity: '9000',
      isBalanced: true,
    } as BalanceSheetDTO;
    const text = balanceSheetText(sheet, 'Union', '31 October 2026');
    expect(text).toContain('Balance sheet as at 31 October 2026');
    expect(text).toContain('Held funds: ₦4,000.00');
    expect(text).toContain('Total assets: ₦9,000.00');

    const flow = { period: { startDate: '', endDate: '', label: 'October 2026' }, operating: { inflows: [], outflows: [], netCash: '3000' }, investing: { inflows: [], outflows: [], netCash: '0' }, financing: { inflows: [], outflows: [], netCash: '0' }, netCashChange: '3000', beginningCash: '1000', endingCash: '4000' } as CashFlowDTO;
    expect(cashFlowText(flow, 'Union')).toContain('Cash at the end: ₦4,000.00');
  });
});

describe('parentChange', () => {
  it('moves an account under the parent chosen', () => {
    expect(parentChange('12', null)).toBe(12);
    expect(parentChange('12', 5)).toBe(12);
  });

  it('takes an account out from under its parent when None is chosen, and otherwise sends nothing', () => {
    expect(parentChange('', 5)).toBeNull();
    expect(parentChange('', null)).toBeUndefined();
  });
});
