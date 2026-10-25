/**
 * The figures the AI explains. They are the same ones Reports and Accounting show (never a separate calculation), worked out by the
 * server, written as plain text with members as stand-ins ("Member 3"). The model only explains these; it never sees a name, a phone
 * number or an email, and the officer gets the real names back from `restore`.
 *
 * Alongside the text it returns small tables with the real names, built from the same figures, which the screens show as cards.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { accountingService } from '../accounting/accounting.service';
import { generateFinancialSummary, generateMemberBalances } from '../reports/reports-core.service';
import { Pseudonymizer } from './ai-privacy';

export type AiTable = { id: 'owing' | 'income' | 'spending' | 'asked'; title: string; columns: string[]; rows: string[][] };

export type AiFigures = {
  /** What the model is given: figures only, members as stand-ins. */
  prompt: string;
  /** What the screen shows next to the answer: the same figures with real names. */
  tables: AiTable[];
  pseudo: Pseudonymizer;
  periodLabel: string;
  confidence: 'high' | 'medium' | 'low';
  dataUsed: { type: string; summary: string }[];
};

export const naira = (value: Decimal.Value): string => `₦${new Decimal(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const fullName = (m: { firstName: string | null; lastName: string | null }) => `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim();

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : 'never');

/** Which tables a question is really asking for, from its words. A question that names none gets what came in. */
export function tablesWanted(question: string): Array<AiTable['id']> {
  const q = question.toLowerCase();
  const wanted: Array<AiTable['id']> = [];
  if (/\b(owe|owes|owing|debt|debtor|debtors|overdue|outstanding|arrears|defaulter|defaulters|unpaid|balance)\b/.test(q)) wanted.push('owing');
  if (/\b(spend|spent|spending|expense|expenses|cost|costs|paid out|expenditure)\b/.test(q)) wanted.push('spending');
  if (/\b(income|collect|collected|collection|collections|received|revenue|dues|levy|levies|donation|donations|raised)\b/.test(q)) wanted.push('income');
  return wanted.length > 0 ? wanted : ['income'];
}

/** The members whose names the AI may be asked about, for matching names in a question. Capped, and never the ones who left. */
export async function loadMemberNames(associationId: number): Promise<Array<{ id: number; firstName: string; lastName: string }>> {
  return prisma.member.findMany({ where: { associationId, status: { not: 'terminated' } }, select: { id: true, firstName: true, lastName: true }, take: 5000 });
}

type Range = { startDate?: Date; endDate?: Date; period?: 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' };

/**
 * Works out the figures for a period (this month unless told otherwise) and writes them for the model. `asked` are the members the
 * question named: their own balance is included, under their stand-in.
 */
export async function buildFigures(associationId: number, options: { range?: Range; question?: string; asked?: number[]; pseudo?: Pseudonymizer } = {}): Promise<AiFigures> {
  // The caller may already have given members stand-ins (in the question); the numbering carries on from there
  const pseudo = options.pseudo ?? new Pseudonymizer();
  const range: Range = options.range ?? { period: 'this_month' };

  const [summary, owing] = await Promise.all([
    generateFinancialSummary(associationId, range),
    generateMemberBalances(associationId, { status: 'with_balance', sortBy: 'balance', sortOrder: 'desc', limit: 10 }),
  ]);

  // What was spent comes from the books: only entries that have been posted, the same figures as the income statement
  let books: Awaited<ReturnType<typeof accountingService.generateIncomeStatement>> | null = null;
  try {
    books = await accountingService.generateIncomeStatement(associationId, { startDate: summary.period.startDate, endDate: summary.period.endDate }, false);
  } catch {
    books = null;
  }
  const spent = books ? new Decimal(books.expenses.total) : new Decimal(0);

  const asked: Array<{ alias: string; real: string; owed: Decimal; overdue: number; lastPaid: Date | null }> = [];
  if (options.asked && options.asked.length > 0) {
    const people = await prisma.member.findMany({ where: { associationId, id: { in: options.asked.slice(0, 3) } }, select: { id: true, memberId: true, firstName: true, lastName: true } });
    for (const p of people) {
      const one = await generateMemberBalances(associationId, { search: p.memberId, limit: 5 });
      const row = one.members.find((m) => m.memberId === p.id);
      if (row) asked.push({ alias: pseudo.alias(p.id, fullName(p)), real: fullName(p), owed: new Decimal(row.balance), overdue: row.overdueTransactions, lastPaid: row.lastPaymentDate });
    }
  }

  const owingRows = owing.members.map((m) => ({
    alias: pseudo.alias(m.memberId, fullName(m)),
    real: fullName(m),
    owed: new Decimal(m.balance),
    overdue: m.overdueTransactions,
    lastPaid: m.lastPaymentDate,
  }));

  const income = summary.income.byCategory.slice(0, 8);
  const lines: string[] = [
    `PERIOD: ${summary.period.label} (${day(summary.period.startDate)} to ${day(summary.period.endDate)})`,
    '',
    'MONEY IN THIS PERIOD:',
    `- Money received (payments dated in the period): ${naira(summary.income.total)}${summary.received ? ` from ${summary.received.paymentCount} payments` : ''}`,
    `- Charges raised in the period: ${naira(summary.collections.expected)}`,
    `- Collection rate for those charges: ${summary.collections.collectionRate.toFixed(1)}%`,
    '',
    'MONEY RECEIVED BY CATEGORY:',
    ...(income.length > 0 ? income.map((c) => `- ${c.categoryName}: ${naira(c.amount)}`) : ['- Nothing received in this period']),
    '',
    'SPENDING (from the books, posted entries only):',
    `- Total spent: ${naira(spent)}`,
    ...(books && books.expenses.accounts.length > 0 ? books.expenses.accounts.slice(0, 8).map((a) => `- ${a.accountName}: ${naira(a.balance)}`) : ['- No spending posted in this period']),
    ...(books ? [`- Result in the books (income less spending): ${naira(books.netIncome)}`] : []),
    '',
    'WHAT MEMBERS STILL OWE (all charges not yet paid, not only this period):',
    `- Total still owed: ${naira(owing.totals.balance)} across ${owing.members.length === 10 ? 'at least 10' : owing.members.length} members`,
    `- Overdue charges: ${owing.totals.overdueCharges}`,
    ...(owingRows.length > 0 ? ['', 'MEMBERS WHO OWE THE MOST:', ...owingRows.map((m) => `- ${m.alias}: ${naira(m.owed)} owed, ${m.overdue} overdue ${m.overdue === 1 ? 'charge' : 'charges'}, last paid ${day(m.lastPaid)}`)] : []),
    ...(asked.length > 0 ? ['', 'MEMBERS THE USER ASKED ABOUT:', ...asked.map((m) => `- ${m.alias}: ${naira(m.owed)} owed, ${m.overdue} overdue ${m.overdue === 1 ? 'charge' : 'charges'}, last paid ${day(m.lastPaid)}`)] : []),
    '',
    `ACTIVE MEMBERS: ${owing.totals.memberCount}`,
  ];

  const tables: AiTable[] = [];
  const wanted = new Set(options.question ? tablesWanted(options.question) : []);
  if (asked.length > 0) {
    tables.push({ id: 'asked', title: 'The members you asked about', columns: ['Member', 'Owes', 'Overdue', 'Last paid'], rows: asked.map((m) => [m.real, naira(m.owed), String(m.overdue), day(m.lastPaid)]) });
  }
  if (wanted.has('owing') && owingRows.length > 0) {
    tables.push({ id: 'owing', title: 'Who owes the most', columns: ['Member', 'Owes', 'Overdue'], rows: owingRows.map((m) => [m.real, naira(m.owed), String(m.overdue)]) });
  }
  if (wanted.has('spending') && books && books.expenses.accounts.length > 0) {
    tables.push({ id: 'spending', title: `Spending, ${summary.period.label}`, columns: ['Category', 'Spent'], rows: books.expenses.accounts.slice(0, 10).map((a) => [a.accountName, naira(a.balance)]) });
  }
  if (wanted.has('income') && income.length > 0) {
    tables.push({ id: 'income', title: `Money received, ${summary.period.label}`, columns: ['Category', 'Received'], rows: income.map((c) => [c.categoryName, naira(c.amount)]) });
  }

  const payments = summary.received?.paymentCount ?? 0;
  const confidence = payments >= 20 && owing.totals.memberCount >= 10 ? 'high' : payments >= 5 && owing.totals.memberCount >= 5 ? 'medium' : 'low';

  return {
    prompt: lines.join('\n'),
    tables,
    pseudo,
    periodLabel: summary.period.label,
    confidence,
    dataUsed: [
      { type: 'financial_summary', summary: `Received ${naira(summary.income.total)}, spent ${naira(spent)}` },
      { type: 'member_count', summary: `${owing.totals.memberCount} active members` },
      { type: 'collection_rate', summary: `${summary.collections.collectionRate.toFixed(1)}% collection rate` },
    ],
  };
}
