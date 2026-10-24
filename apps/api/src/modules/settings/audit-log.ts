import type { Prisma } from '@prisma/client';
import { RuleError } from '../finance/rule-error';

/** Stored change records can hold anything a module wrote. Anything that looks like a secret is hidden before it leaves the server. */
const SECRET_KEY = /pass(word)?|secret|token|hash|otp|pin\b|cvv|card.?number|api.?key|authorization|signature|code$/i;
export const REDACTED = '[hidden]';

export function redactAuditValues(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth > 6) return REDACTED;
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => redactAuditValues(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, v]) => [key, SECRET_KEY.test(key) ? REDACTED : redactAuditValues(v, depth + 1)]),
  );
}

export type AuditQuery = { page?: unknown; limit?: unknown; action?: unknown; tableName?: unknown; search?: unknown; userId?: unknown; from?: unknown; to?: unknown };

const asText = (v: unknown, max = 100): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : undefined);

function asDate(v: unknown, label: string, endOfDay: boolean): Date | undefined {
  const text = asText(v, 40);
  if (!text) return undefined;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+01:00` : text);
  if (Number.isNaN(date.getTime())) throw new RuleError(`${label} is not a date.`, 400, 'INVALID_DATE');
  return date;
}

/** The paging and filters of the audit log, checked. A day is cut in Lagos time (UTC+1), like the reports. */
export function parseAuditQuery(associationId: number, query: AuditQuery) {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit)) || 20));
  const from = asDate(query.from, 'The start date', false);
  const to = asDate(query.to, 'The end date', true);
  if (from && to && to < from) throw new RuleError('The end date is before the start date.', 400, 'INVALID_DATE');

  const where: Prisma.AuditLogWhereInput = { associationId };
  const action = asText(query.action);
  const tableName = asText(query.tableName);
  const search = asText(query.search);
  const userId = Number(query.userId);
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (tableName) where.tableName = tableName;
  if (Number.isInteger(userId) && userId > 0) where.userId = userId;
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (search) {
    where.OR = [
      { action: { contains: search, mode: 'insensitive' } },
      { tableName: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { member: { firstName: { contains: search, mode: 'insensitive' } } } },
      { user: { member: { lastName: { contains: search, mode: 'insensitive' } } } },
    ];
  }
  return { page, limit, skip: (page - 1) * limit, where };
}
