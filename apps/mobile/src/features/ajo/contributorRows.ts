/**
 * The people typed into thrift onboarding's "Contributors" step, one at a time. Bulk CSV upload stays on the web (owner decision for
 * the phone), so there is no file reading here: just the row, the Nigerian phone rule and the plain-words problem for a row.
 */

export type ContributorRow = { firstName: string; lastName: string; phone: string; address: string; email: string; shares: string };

export const blankRow = (): ContributorRow => ({ firstName: '', lastName: '', phone: '', address: '', email: '', shares: '' });
export const isBlankRow = (r: ContributorRow) => Object.values(r).every((v) => v.trim() === '');

/** The same phone rule the server applies: a Nigerian number, 0803…, 803… or +234803…. Returns it as 234 and ten digits, or null. */
export function normalizeNigerianPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) digits = `234${digits.slice(1)}`;
  else if (digits.length === 10 && !digits.startsWith('234')) digits = `234${digits}`;
  return /^234\d{10}$/.test(digits) ? digits : null;
}

/** A row's problem in plain words (the server checks again), or null when it is fine. */
export function contributorRowProblem(r: ContributorRow, maxShares: number | null): string | null {
  if (!r.firstName.trim()) return 'Enter a first name.';
  if (!r.lastName.trim()) return 'Enter a last name.';
  if (!normalizeNigerianPhone(r.phone)) return 'Enter a Nigerian phone number, for example 08031234567.';
  if (r.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) return 'That email does not look right.';
  if (maxShares !== null && r.shares.trim() !== '') {
    const n = Number(r.shares);
    if (!Number.isInteger(n) || n < 1 || n > maxShares) return `Shares must be a whole number from 1 to ${maxShares}.`;
  }
  return null;
}

/** For each filled row: the name of an earlier row that uses the same phone number, or null. A repeated number would be added once, so say so. */
export function duplicatePhones(rows: ContributorRow[]): (string | null)[] {
  const seen = new Map<string, number>();
  return rows.map((r, i) => {
    const key = normalizeNigerianPhone(r.phone);
    if (!key) return null;
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, i);
      return null;
    }
    return `${rows[first]!.firstName} ${rows[first]!.lastName}`.trim() || `row ${first + 1}`;
  });
}
