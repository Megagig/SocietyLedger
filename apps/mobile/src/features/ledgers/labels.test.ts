import type { LedgerStatementDTO } from '@/types/api/ledgerManage';
import { balanceLabel, statementPresets, statementShareText } from './labels';

describe('balanceLabel', () => {
  it('positive is owed, negative is credit, zero is settled', () => {
    expect(balanceLabel(5000)).toBe('owes');
    expect(balanceLabel(-200)).toBe('credit');
    expect(balanceLabel(0)).toBe('settled');
    expect(balanceLabel(0.001)).toBe('settled');
  });
});

describe('statementShareText', () => {
  const statement: LedgerStatementDTO = {
    member: { id: 7, memberId: 'M-007', firstName: 'Ada', lastName: 'Obi', email: null },
    period: { startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-10-24T00:00:00.000Z' },
    openingBalance: '0',
    entries: [
      { id: 1, date: '2026-02-01T00:00:00.000Z', description: 'Annual dues', category: 'DUES', debit: '5000', credit: '0', balance: '5000', reference: null },
      { id: 2, date: '2026-02-10T00:00:00.000Z', description: 'Payment for Annual dues', category: 'DUES', debit: '0', credit: '2000', balance: '3000', reference: 'R1' },
    ],
    totals: { totalDebits: '5000', totalCredits: '2000' },
    closingBalance: '3000',
  };

  it('lists the member, the period, each entry and the totals', () => {
    const text = statementShareText(statement, 'Unity Union');
    expect(text).toContain('Unity Union — Statement of account');
    expect(text).toContain('Ada Obi (M-007)');
    expect(text).toContain('Annual dues · charged ₦5,000.00');
    expect(text).toContain('Payment for Annual dues · paid ₦2,000.00');
    expect(text).toContain('Closing balance: ₦3,000.00');
  });
});

describe('statementPresets', () => {
  it('offers this year, the last three months and everything', () => {
    const presets = statementPresets(new Date('2026-10-24T10:00:00.000Z'));
    expect(presets.map((p) => p.label)).toEqual(['This year', 'Last 3 months', 'Everything']);
    expect(presets[0]).toMatchObject({ startDate: '2026-01-01', endDate: '2026-10-24' });
    expect(presets[1]!.startDate).toBe('2026-07-24');
  });
});
