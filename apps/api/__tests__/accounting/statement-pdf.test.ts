/** An accounting statement laid out for print, and written as a real PDF file. */
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: {}, prisma: {} }));

import { Decimal } from '@prisma/client/runtime/library';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { balanceSheetDocument, cashFlowDocument, incomeStatementDocument, naira } from '../../src/modules/accounting/statement-document';
import { pdfService } from '../../src/modules/exports/pdf.service';

const rows = (items: [string, number][]) => items.map(([accountName, balance], i) => ({ accountId: i, accountCode: String(i), accountName, balance: new Decimal(balance) }));
const period = { startDate: new Date('2026-10-01'), endDate: new Date('2026-10-31'), label: 'October 2026' };

describe('naira', () => {
  it('writes the full amount with commas and kobo, and a minus for a negative one', () => {
    expect(naira(12500)).toBe('NGN 12,500.00');
    expect(naira('1234567.5')).toBe('NGN 1,234,567.50');
    expect(naira(-5)).toBe('-NGN 5.00');
    expect(naira(0)).toBe('NGN 0.00');
  });
});

describe('the statement documents', () => {
  it('lays out the income statement with income, expenses and the result', () => {
    const doc = incomeStatementDocument({ period, revenue: { total: new Decimal(12500), accounts: rows([['Dues', 12500]]) }, expenses: { total: new Decimal(2500), accounts: rows([['Hall hire', 2500]]) }, netIncome: new Decimal(10000) });
    expect(doc.subtitle).toBe('October 2026');
    expect(doc.sections.map((s) => s.title)).toEqual(['Income', 'Expenses', 'Net surplus']);
    expect(doc.sections[2]!.total).toBe('NGN 10,000.00');
  });

  it('calls a negative result a loss', () => {
    const doc = incomeStatementDocument({ period, revenue: { total: new Decimal(0), accounts: [] }, expenses: { total: new Decimal(5), accounts: [] }, netIncome: new Decimal(-5) });
    expect(doc.sections[2]!.title).toBe('Net loss');
  });

  it('includes every liability on the balance sheet and warns when it does not balance', () => {
    const sheet = {
      asOfDate: new Date(),
      assets: { current: rows([['Bank', 9000]]), fixed: [], other: [], totalCurrent: new Decimal(9000), totalFixed: new Decimal(0), totalOther: new Decimal(0), total: new Decimal(9000) },
      liabilities: { current: [], longTerm: [], other: rows([['Held funds', 4000]]), totalCurrent: new Decimal(0), totalLongTerm: new Decimal(0), totalOther: new Decimal(4000), total: new Decimal(4000) },
      equity: { accounts: [], retainedEarnings: new Decimal(4000), total: new Decimal(4000) },
      totalLiabilitiesAndEquity: new Decimal(8000),
      isBalanced: false,
    };
    const doc = balanceSheetDocument(sheet, '31 October 2026');
    expect(doc.subtitle).toBe('As at 31 October 2026');
    expect(doc.sections.map((x) => x.title)).toEqual(['Current assets', 'Fixed assets', 'Total assets', 'Current liabilities', 'Long-term liabilities', 'Other liabilities', 'Total liabilities', 'Equity', 'Liabilities and equity']);
    expect(doc.sections.find((x) => x.title === 'Other liabilities')!.rows).toEqual([{ label: 'Held funds', amount: 'NGN 4,000.00' }]);
    expect(doc.sections.find((x) => x.title === 'Current assets')!.rows).toEqual([{ label: 'Bank', amount: 'NGN 9,000.00' }]);
    expect(doc.notes[0]).toContain('WARNING');
  });

  it('lays out the cash flow from start to end', () => {
    const zero = { inflows: [], outflows: [], netCash: new Decimal(0) };
    const doc = cashFlowDocument({ period, operating: { ...zero, netCash: new Decimal(2200) }, investing: zero, financing: zero, netCashChange: new Decimal(2200), beginningCash: new Decimal(1000), endingCash: new Decimal(3200), reconciles: true });
    expect(doc.sections.map((s) => s.total)).toEqual(['NGN 1,000.00', 'NGN 2,200.00', 'NGN 3,200.00']);
    expect(doc.notes[0]).not.toContain('WARNING');
  });

  it('itemises the cash that moved, leaving out kinds where nothing moved', () => {
    const none = { inflows: [], outflows: [], netCash: new Decimal(0) };
    const doc = cashFlowDocument({
      period,
      operating: { inflows: [{ description: 'October dues', amount: new Decimal(3000) }], outflows: [{ description: 'Hall hire', amount: new Decimal(800) }], netCash: new Decimal(2200) },
      investing: none,
      financing: none,
      netCashChange: new Decimal(2200),
      beginningCash: new Decimal(1000),
      endingCash: new Decimal(3200),
      reconciles: true,
    });
    const operating = doc.sections.find((s) => s.title === 'Running the association')!;
    expect(operating.rows).toEqual([{ label: 'In: October dues', amount: 'NGN 3,000.00' }, { label: 'Out: Hall hire', amount: 'NGN 800.00' }]);
    expect(operating.total).toBe('NGN 2,200.00');
    expect(doc.sections.some((s) => s.title === 'Buying or selling assets')).toBe(false);
  });
});

describe('the PDF file', () => {
  it('is written as a real PDF, even for a long statement', async () => {
    const accounts = Array.from({ length: 120 }, (_, i) => ({ label: `Account number ${i + 1}`, amount: naira(i * 1000) }));
    const doc = { title: 'Balance sheet', subtitle: 'As at 31 October 2026', sections: [{ title: 'Assets', rows: accounts, totalLabel: 'Total assets', total: naira(7_140_000) }], notes: ['Only posted entries are counted.'] };
    const file = path.join(os.tmpdir(), `statement-${Date.now()}.pdf`);
    await pdfService.generateStatementPDF(doc, { name: 'Opuogun Union' } as never, file);
    const bytes = fs.readFileSync(file);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(2000);
    // 120 lines cannot fit one page
    expect((bytes.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    fs.unlinkSync(file);
  });
});
