import { Decimal } from '@prisma/client/runtime/library';
import type { AccountBalance, BalanceSheetReport, CashFlowReport, IncomeStatementReport } from './accounting.types';

/**
 * A financial statement laid out as plain sections, ready to print. Built from the same reports the screens show, so a PDF can
 * never disagree with the screen it came from. Amounts are written in full (the PDF font has no naira sign, so it reads "NGN").
 */
export type StatementSection = { title: string; rows: { label: string; amount: string }[]; totalLabel: string; total: string };
export type StatementDocument = { title: string; subtitle: string; sections: StatementSection[]; notes: string[] };

/** "NGN 12,500.00", with a leading minus for a negative amount. */
export function naira(value: Decimal.Value): string {
  const amount = new Decimal(value);
  const [whole, kobo] = amount.abs().toFixed(2).split('.');
  return `${amount.isNegative() && !amount.isZero() ? '-' : ''}NGN ${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${kobo}`;
}

const rowsOf = (accounts: Pick<AccountBalance, 'accountName' | 'balance'>[]) => accounts.map((a) => ({ label: a.accountName, amount: naira(a.balance) }));

export function incomeStatementDocument(report: IncomeStatementReport): StatementDocument {
  const loss = new Decimal(report.netIncome).isNegative();
  return {
    title: 'Income statement',
    subtitle: report.period.label,
    sections: [
      { title: 'Income', rows: rowsOf(report.revenue.accounts), totalLabel: 'Total income', total: naira(report.revenue.total) },
      { title: 'Expenses', rows: rowsOf(report.expenses.accounts), totalLabel: 'Total expenses', total: naira(report.expenses.total) },
      { title: loss ? 'Net loss' : 'Net surplus', rows: [], totalLabel: loss ? 'Net loss' : 'Net surplus', total: naira(report.netIncome) },
    ],
    notes: ['Only entries that have been posted are counted.'],
  };
}

export function balanceSheetDocument(report: BalanceSheetReport, asAtLabel: string): StatementDocument {
  const a = report.assets;
  const l = report.liabilities;
  const sections: StatementSection[] = [
    { title: 'Current assets', rows: rowsOf(a.current), totalLabel: 'Total current assets', total: naira(a.totalCurrent) },
    { title: 'Fixed assets', rows: rowsOf(a.fixed), totalLabel: 'Total fixed assets', total: naira(a.totalFixed) },
    ...(a.other.length > 0 ? [{ title: 'Other assets', rows: rowsOf(a.other), totalLabel: 'Total other assets', total: naira(a.totalOther) }] : []),
    { title: 'Total assets', rows: [], totalLabel: 'Total assets', total: naira(a.total) },
    { title: 'Current liabilities', rows: rowsOf(l.current), totalLabel: 'Total current liabilities', total: naira(l.totalCurrent) },
    { title: 'Long-term liabilities', rows: rowsOf(l.longTerm), totalLabel: 'Total long-term liabilities', total: naira(l.totalLongTerm) },
    ...(l.other.length > 0 ? [{ title: 'Other liabilities', rows: rowsOf(l.other), totalLabel: 'Total other liabilities', total: naira(l.totalOther) }] : []),
    { title: 'Total liabilities', rows: [], totalLabel: 'Total liabilities', total: naira(l.total) },
    {
      title: 'Equity',
      rows: [...rowsOf(report.equity.accounts), { label: 'Earnings so far', amount: naira(report.equity.retainedEarnings) }],
      totalLabel: 'Total equity',
      total: naira(report.equity.total),
    },
    { title: 'Liabilities and equity', rows: [], totalLabel: 'Liabilities and equity', total: naira(report.totalLiabilitiesAndEquity) },
  ];
  return {
    title: 'Balance sheet',
    subtitle: `As at ${asAtLabel}`,
    sections,
    notes: report.isBalanced ? ['The sheet balances: assets equal liabilities and equity.'] : ['WARNING: this sheet does not balance. Assets differ from liabilities and equity.'],
  };
}

/** Each thing that came in or went out for one kind of cash movement, with the net. Empty kinds are left out. */
function activitySection(title: string, group: CashFlowReport['operating']): StatementSection[] {
  if (group.inflows.length === 0 && group.outflows.length === 0) return [];
  return [
    {
      title,
      rows: [...group.inflows.map((i) => ({ label: `In: ${i.description}`, amount: naira(i.amount) })), ...group.outflows.map((o) => ({ label: `Out: ${o.description}`, amount: naira(o.amount) }))],
      totalLabel: 'Net cash',
      total: naira(group.netCash),
    },
  ];
}

export function cashFlowDocument(report: CashFlowReport): StatementDocument {
  return {
    title: 'Cash flow',
    subtitle: report.period.label,
    sections: [
      { title: 'Cash at the start', rows: [], totalLabel: 'Cash at the start', total: naira(report.beginningCash) },
      {
        title: 'Where cash moved',
        rows: [
          { label: 'From running the association', amount: naira(report.operating.netCash) },
          { label: 'From buying or selling assets', amount: naira(report.investing.netCash) },
          { label: 'From loans and equity', amount: naira(report.financing.netCash) },
        ],
        totalLabel: 'Change in cash',
        total: naira(report.netCashChange),
      },
      ...activitySection('Running the association', report.operating),
      ...activitySection('Buying or selling assets', report.investing),
      ...activitySection('Loans and equity', report.financing),
      { title: 'Cash at the end', rows: [], totalLabel: 'Cash at the end', total: naira(report.endingCash) },
    ],
    notes: report.reconciles ? ['Bank and cash accounts only. The start plus the change equals the end.'] : ['WARNING: the movements do not add up to the change in cash.'],
  };
}
