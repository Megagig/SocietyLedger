import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const MEMBER_LOGIN_STATUSES = ['no_login', 'invited', 'active'] as const;
export const MEMBER_SORT_FIELDS = ['createdAt', 'firstName', 'lastName', 'memberId', 'joinDate', 'status', 'category'] as const;

const MAX_PAGE_SIZE = 100;

export const memberQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('10'),
  search: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  loginStatus: z.enum(MEMBER_LOGIN_STATUSES).optional(),
  sortBy: z.enum(MEMBER_SORT_FIELDS).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type MemberQuery = z.infer<typeof memberQuerySchema>;

/** Page and page size, clamped so a client can't ask for page 0 or the whole table in one response. */
export function resolvePaging(query: Pick<MemberQuery, 'page' | 'limit'>): { page: number; limit: number; skip: number } {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit };
}

/** The `where` for GET /members: scoped to the association, then narrowed by search and the status/category/login filters. */
export function buildMemberWhere(associationId: number, query: MemberQuery): Prisma.MemberWhereInput {
  const where: Prisma.MemberWhereInput = { associationId };

  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
      { memberId: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.category) where.category = query.category;
  if (query.loginStatus) where.loginStatus = query.loginStatus;

  return where;
}

/** Start of the current calendar month in Africa/Lagos (UTC+1, no DST) — "new this month" on the members stats. */
export function startOfMonthLagos(now: Date = new Date()): Date {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1) - 60 * 60 * 1000);
}
