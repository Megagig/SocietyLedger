/**
 * The pure rules behind the Ajo screens: money in full, naira typed into a form, dates and places in the order, the cadence in words, the
 * CSV a person uploads, the phone and row rules (which must agree with the server's), and the menu entries each kind of account keeps.
 */
import { cadenceWords, formatDay, formatKobo, frequencyText, koboPositive, nairaToKobo, ordinal } from '@/lib/ajo/format';
import { CSV_TEMPLATE, MAX_CSV_ROWS, contributorRowProblem, normalizeNigerianPhone, readContributorCsv, splitCsv } from '@/lib/ajo/contributorCsv';
import { THRIFT_ONLY_ADMIN_LABELS, THRIFT_ONLY_MEMBER_LABELS } from '@/lib/ajo/useAjoNav';
import { rulesFormToInput, DEFAULT_RULES } from '@/components/ajo/RulesFields';
import { validateProof } from '@/components/ajo/proof';

describe('money is shown in full', () => {
  it('formats kobo as naira with two decimals and separators, never abbreviated', () => {
    expect(formatKobo('1000000')).toBe('₦10,000.00');
    expect(formatKobo('50')).toBe('₦0.50');
    expect(formatKobo('123456789012')).toBe('₦1,234,567,890.12');
    expect(formatKobo('-250075')).toBe('-₦2,500.75');
    expect(formatKobo(null)).toBe('₦0.00');
    expect(formatKobo('not a number')).toBe('₦0.00');
    expect(formatKobo('1000000')).not.toMatch(/\bk\b|\dk/i);
  });

  it('reads naira typed in a form, and refuses anything that is not an amount', () => {
    expect(nairaToKobo('10,000')).toBe(BigInt(1000000));
    expect(nairaToKobo('5000.5')).toBe(BigInt(500050));
    expect(nairaToKobo('₦ 1,250.75')).toBe(BigInt(125075));
    for (const bad of ['10k', '12.345', '', 'abc', '-5']) expect(nairaToKobo(bad)).toBeNull();
  });

  it('tells a positive amount from zero, empty and missing', () => {
    expect(koboPositive('1')).toBe(true);
    for (const v of ['0', '', null, undefined, 'x']) expect(koboPositive(v as never)).toBe(false);
  });
});

describe('dates and places', () => {
  it('shows a calendar day as the same day wherever the reader is', () => {
    expect(formatDay('2027-03-01T00:00:00.000Z')).toBe('1 Mar 2027');
    expect(formatDay(null)).toBe('');
    expect(formatDay('not a date')).toBe('');
  });
  it('writes a place in the order', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
  });
});

describe('how often, in words', () => {
  it('names each frequency, and a custom step in the words the server uses', () => {
    expect(cadenceWords('DAILY', 1, 'DAYS')).toBe('every day');
    expect(cadenceWords('QUARTERLY', 1, 'DAYS')).toBe('every 3 months');
    expect(cadenceWords('ANNUALLY', 1, 'DAYS')).toBe('every year');
    expect(cadenceWords('CUSTOM', 2, 'WEEKS')).toBe('every 2 weeks');
    expect(cadenceWords('CUSTOM', 1, 'MONTHS')).toBe('every month');
    expect(cadenceWords('CUSTOM', 10, 'DAYS')).toBe('every 10 days');
  });
  it('labels a group by its frequency, using the server’s words for a custom one', () => {
    expect(frequencyText({ frequency: 'WEEKLY' })).toBe('Weekly');
    expect(frequencyText({ frequency: 'QUARTERLY', cadence: 'every 3 months' })).toBe('Quarterly');
    expect(frequencyText({ frequency: 'CUSTOM', cadence: 'every 2 weeks' })).toBe('Every 2 weeks');
    expect(frequencyText({ frequency: 'CUSTOM', cadence: null })).toBe('Custom');
  });
});

describe('reading a CSV of contributors', () => {
  it('reads the template it gives out', () => {
    const r = readContributorCsv(CSV_TEMPLATE);
    expect(r.ok && r.rows).toEqual([
      { firstName: 'Ngozi', lastName: 'Eze', phone: '08031234567', address: '12 Market Road Aba', email: 'ngozi@example.com', shares: '1' },
      { firstName: 'Chidi', lastName: 'Okafor', phone: '08051234567', address: '', email: '', shares: '' },
    ]);
  });
  it('copes with a spreadsheet’s export: byte-order mark, semicolons, quotes, other header spellings, a single name column', () => {
    const a = readContributorCsv('﻿First Name;Surname;Mobile Number\r\nAda;Obi;"0803 123 4567"\r\n');
    expect(a.ok && a.rows[0]).toMatchObject({ firstName: 'Ada', lastName: 'Obi', phone: '0803 123 4567' });
    const b = readContributorCsv('name,phone,address\n"Obi, Ada Jr",0803,"12 ""Main"" St, Aba"\nMono,0805,\n');
    expect(b.ok && b.rows[0].address).toBe('12 "Main" St, Aba');
    expect(b.ok && [b.rows[1].firstName, b.rows[1].lastName]).toEqual(['Mono', '']);
    expect(splitCsv('a\tb\n1\t2\n\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('refuses a file it cannot use, in words, and never more than the limit', () => {
    expect(readContributorCsv('')).toMatchObject({ ok: false, message: expect.stringMatching(/empty/) });
    expect(readContributorCsv('first_name,last_name\nA,B')).toMatchObject({ ok: false, message: expect.stringMatching(/phone/) });
    expect(readContributorCsv('phone\n0803')).toMatchObject({ ok: false, message: expect.stringMatching(/first_name/) });
    expect(readContributorCsv('first_name,last_name,phone\n')).toMatchObject({ ok: false, message: expect.stringMatching(/no people/) });
    const rows = (n: number) => 'first_name,last_name,phone\n' + Array.from({ length: n }, (_, i) => `A${i},B,0803${i}`).join('\n');
    expect(readContributorCsv(rows(MAX_CSV_ROWS)).ok).toBe(true);
    expect(readContributorCsv(rows(MAX_CSV_ROWS + 1))).toMatchObject({ ok: false, message: expect.stringContaining(`${MAX_CSV_ROWS + 1} people`) });
  });
});

describe('phone numbers and rows agree with the server', () => {
  it('accepts the Nigerian forms the server accepts, refuses the rest', () => {
    for (const p of ['08031234567', '8031234567', '+2348031234567', '234 803 123 4567', '0803-123-4567']) expect(normalizeNigerianPhone(p)).toBe('2348031234567');
    for (const p of ['', '12345', '080312345', '0803123456789', 'abc']) expect(normalizeNigerianPhone(p)).toBeNull();
  });
  it('says what is wrong with a row, and ignores shares outside a rotating pot', () => {
    const good = { firstName: 'A', lastName: 'B', phone: '08031234567', address: '', email: '', shares: '' };
    expect(contributorRowProblem(good, null)).toBeNull();
    expect(contributorRowProblem({ ...good, firstName: ' ' }, null)).toMatch(/first name/);
    expect(contributorRowProblem({ ...good, phone: '1' }, null)).toMatch(/phone/);
    expect(contributorRowProblem({ ...good, email: 'x' }, null)).toMatch(/email/);
    expect(contributorRowProblem({ ...good, shares: '4' }, 3)).toMatch(/1 to 3/);
    expect(contributorRowProblem({ ...good, shares: '9' }, null)).toBeNull();
  });
});

describe('rules typed in a form become what the server takes', () => {
  it('turns naira and percent into kobo and basis points', () => {
    expect(rulesFormToInput({ ...DEFAULT_RULES, lateFeeType: 'FIXED', lateFeeValue: '500', lateFeeCap: '2,000' })).toMatchObject({ input: { lateFeeType: 'FIXED', lateFeeValue: '50000', lateFeeCapKobo: '200000' } });
    expect(rulesFormToInput({ ...DEFAULT_RULES, lateFeeType: 'PERCENT', lateFeeValue: '10' })).toMatchObject({ input: { lateFeeValue: '1000', lateFeeCapKobo: null } });
    expect(rulesFormToInput(DEFAULT_RULES)).toMatchObject({ input: { lateFeeType: 'NONE', lateFeeValue: '0' } });
  });
  it('refuses a late fee that is not an amount, or a grace period out of range', () => {
    expect(rulesFormToInput({ ...DEFAULT_RULES, lateFeeType: 'FIXED', lateFeeValue: 'abc' })).toHaveProperty('error');
    expect(rulesFormToInput({ ...DEFAULT_RULES, lateFeeType: 'PERCENT', lateFeeValue: '150' })).toHaveProperty('error');
    expect(rulesFormToInput({ ...DEFAULT_RULES, graceDays: 31 })).toHaveProperty('error');
  });
});

describe('proof files and the menu a thrift group keeps', () => {
  it('checks a slip before it is uploaded, with the same limits as the server', () => {
    const file = (type: string, size: number) => ({ type, size }) as File;
    expect(validateProof(file('image/png', 1000))).toBeNull();
    expect(validateProof(file('application/pdf', 5 * 1024 * 1024))).toBeNull();
    expect(validateProof(file('text/plain', 10))).toMatch(/JPG, PNG/);
    expect(validateProof(file('image/png', 5 * 1024 * 1024 + 1))).toMatch(/5 MB/);
  });
  it('keeps only Ajo, and what is needed to run and pay, in a standalone group’s menu', () => {
    expect(THRIFT_ONLY_ADMIN_LABELS).toEqual(expect.arrayContaining(['Thrift Circles', 'Collect', 'Subscription', 'Settings']));
    for (const gone of ['Finance', 'Accounting', 'Welfare', 'Cooperatives', 'Governance', 'Reports']) expect(THRIFT_ONLY_ADMIN_LABELS).not.toContain(gone);
    expect(THRIFT_ONLY_MEMBER_LABELS).toEqual(['My Thrift', 'My Profile']);
  });
});
