/**
 * Reading a list of contributors from a CSV the admin uploads (thrift onboarding, step 3). Pure, so it is easy to check.
 * It is forgiving about the file (a spreadsheet's byte-order mark, commas or semicolons or tabs, quoted cells, a few header spellings)
 * and strict about the result: every row comes back with its own problem in words, never a silent skip.
 */

export const MAX_CSV_ROWS = 200;

export type ContributorRow = { firstName: string; lastName: string; phone: string; address: string; email: string; shares: string };

export const CSV_TEMPLATE = 'first_name,last_name,phone,address,email,shares\nNgozi,Eze,08031234567,12 Market Road Aba,ngozi@example.com,1\nChidi,Okafor,08051234567,,,\n';

const HEADERS: Record<keyof ContributorRow | 'name', string[]> = {
  firstName: ['firstname', 'first', 'givenname', 'forename'],
  lastName: ['lastname', 'last', 'surname', 'familyname'],
  name: ['name', 'fullname'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'tel', 'telephone', 'gsm'],
  address: ['address', 'homeaddress', 'residentialaddress'],
  email: ['email', 'emailaddress'],
  shares: ['shares', 'share', 'numberofshares'],
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/** Splits CSV text into cells, honouring quotes ("a, b", and "" for a quote inside a cell). */
export function splitCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const firstLine = src.split('\n', 1)[0] ?? '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch as keyof typeof counts] += 1;
  }
  const delimiter = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [','])[0] as string;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export type CsvReadResult = { ok: true; rows: ContributorRow[] } | { ok: false; message: string };

/** The people in a CSV, or a plain-words reason the file cannot be used. */
export function readContributorCsv(text: string): CsvReadResult {
  const table = splitCsv(text);
  if (table.length === 0) return { ok: false, message: 'The file is empty.' };
  const header = table[0].map(squash);
  const find = (key: keyof typeof HEADERS) => header.findIndex((h) => HEADERS[key].includes(h));
  const col = { firstName: find('firstName'), lastName: find('lastName'), name: find('name'), phone: find('phone'), address: find('address'), email: find('email'), shares: find('shares') };

  if (col.phone < 0) return { ok: false, message: 'The first row must name the columns, and one must be "phone". Download the template to see the layout.' };
  if (col.firstName < 0 && col.name < 0) return { ok: false, message: 'The first row must have "first_name" and "last_name" columns (or a single "name"). Download the template to see the layout.' };

  const body = table.slice(1);
  if (body.length === 0) return { ok: false, message: 'The file has the column names but no people under them.' };
  if (body.length > MAX_CSV_ROWS) return { ok: false, message: `The file has ${body.length} people. Upload up to ${MAX_CSV_ROWS} at a time.` };

  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
  const rows = body.map((r) => {
    let firstName = cell(r, col.firstName);
    let lastName = cell(r, col.lastName);
    if (col.firstName < 0 || (!firstName && !lastName && col.name >= 0)) {
      const full = cell(r, col.name);
      const at = full.indexOf(' ');
      firstName = at < 0 ? full : full.slice(0, at);
      lastName = at < 0 ? '' : full.slice(at + 1).trim();
    }
    return { firstName, lastName, phone: cell(r, col.phone), address: cell(r, col.address), email: cell(r, col.email), shares: cell(r, col.shares) };
  });
  return { ok: true, rows };
}

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
