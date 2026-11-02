import prisma from './prisma';

/**
 * Demo tenants (created by prisma/seeds/demo/, flagged `associations.is_demo`) are for testers. They must never cause a real-world
 * side effect: no email, SMS or push, no gateway charge, no billing, and no appearance in platform analytics. Every guard asks here.
 */

/** Addresses on this domain belong to demo accounts only. Mail to them is dropped. Override with DEMO_EMAIL_DOMAIN. */
export const DEMO_EMAIL_DOMAIN = (process.env.DEMO_EMAIL_DOMAIN || 'demo.societyledger.com.ng').toLowerCase();

export function isDemoEmail(address: string | string[] | null | undefined): boolean {
  const list = Array.isArray(address) ? address : [address];
  const real = list.filter((a): a is string => typeof a === 'string' && a.length > 0);
  return real.length > 0 && real.every((a) => a.toLowerCase().trim().endsWith(`@${DEMO_EMAIL_DOMAIN}`));
}

/** The uploads a demo tester may send are capped well below the normal limit. */
export const DEMO_MAX_UPLOAD_BYTES = 1024 * 1024;

const TTL_MS = 60_000;
let cache: { ids: Set<number>; at: number } | null = null;

async function demoIds(now = Date.now()): Promise<Set<number>> {
  if (cache && now - cache.at < TTL_MS) return cache.ids;
  const rows = await prisma.association.findMany({ where: { isDemo: true }, select: { id: true } });
  cache = { ids: new Set(rows.map((r) => r.id)), at: now };
  return cache.ids;
}

export function resetDemoCache(): void {
  cache = null;
}

export async function isDemoAssociation(associationId: number | null | undefined): Promise<boolean> {
  if (!associationId) return false;
  return (await demoIds()).has(associationId);
}

/** Of these users, those who are not demo accounts (the only ones a push may go to). */
export async function withoutDemoUsers(userIds: number[]): Promise<number[]> {
  if (userIds.length === 0) return userIds;
  const demo = await prisma.user.findMany({ where: { id: { in: userIds }, isDemo: true }, select: { id: true } });
  if (demo.length === 0) return userIds;
  const skip = new Set(demo.map((u) => u.id));
  return userIds.filter((id) => !skip.has(id));
}

/** Prisma `where` fragment for platform analytics: leaves demo tenants out. */
export const EXCLUDE_DEMO = { isDemo: false } as const;
