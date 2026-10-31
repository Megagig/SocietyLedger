/**
 * Money is always shown in full with two decimals (₦10,000.00): never 10k, never ₦5,000 without the .00, on tiles, tables and chart axes.
 * The first group checks the shared formatters; the second scans the source for the hand-built patterns that used to drop the decimals.
 */
import fs from 'node:fs';
import path from 'node:path';
import { formatAxisNaira, formatCurrency, formatNairaFull } from '@/utils/format';

describe('shared naira formatters', () => {
  it('shows the full figure with two decimals', () => {
    expect(formatCurrency(5000)).toBe('₦5,000.00');
    expect(formatNairaFull(12345678.9)).toBe('₦12,345,678.90');
    expect(formatNairaFull('3150000')).toBe('₦3,150,000.00');
    expect(formatNairaFull(0)).toBe('₦0.00');
  });

  it('labels a chart axis in full, never as 300k', () => {
    expect(formatAxisNaira(300000)).toBe('₦300,000.00');
    expect(formatAxisNaira(75000)).toBe('₦75,000.00');
    expect(formatAxisNaira(0)).toBe('₦0.00');
  });
});

describe('source does not build naira text that drops the decimals', () => {
  const root = path.join(__dirname, '..', '..', 'src');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  walk(root);

  const offenders = (pattern: RegExp) =>
    files.flatMap((file) =>
      fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap((line, i) => (pattern.test(line) ? [`${path.relative(root, file)}:${i + 1}  ${line.trim().slice(0, 90)}`] : [])),
    );

  it('never prints ₦ followed by toLocaleString() (it drops trailing zeros)', () => {
    expect(offenders(/₦\$?\{[^}]*\.toLocaleString\(\)/)).toEqual([]);
  });

  it('never abbreviates an amount to 300k / 1.2M', () => {
    expect(offenders(/₦\$\{[^}]*\/ ?1_?000(_?000)?\)?\.toFixed/)).toEqual([]);
  });

  it('never formats naira with zero decimals', () => {
    expect(offenders(/currency: 'NGN'[^\n]*minimumFractionDigits: 0/)).toEqual([]);
  });
});
