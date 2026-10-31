/**
 * Query keys. Every key is built here, so a key can never be missing the association.
 *
 *   [tenant, domain, ...parts]                      data shared by the people of one association
 *   [tenant, domain, 'u', userId, ...parts]         data that belongs to one person (their own savings, contributions, profile)
 *
 * The tenant is first so one prefix ([tenant]) addresses everything an association has cached, and a different tenant can never match it.
 * The domain is second: persistence and invalidation work on it (see policy.ts).
 *
 * "Tenant" is the association: its id on the web, its subdomain on mobile (one-to-one). Either is fine; what matters is that it is always there.
 */

export type TenantId = string | number;
export type UserId = string | number;
export type KeyPart = string | number | boolean | null | undefined | Record<string, unknown> | readonly unknown[];

export class QueryScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryScopeError';
  }
}

function assertTenant(tenant: unknown): asserts tenant is TenantId {
  if (tenant === null || tenant === undefined || tenant === '' || (typeof tenant === 'number' && !Number.isFinite(tenant))) {
    throw new QueryScopeError('A query key needs the association (tenant). Do not build a key before it is known: use `enabled: !!tenant`.');
  }
}

function assertUser(userId: unknown): asserts userId is UserId {
  if (userId === null || userId === undefined || userId === '' || (typeof userId === 'number' && !Number.isFinite(userId))) {
    throw new QueryScopeError('A per-person query key needs the user. Do not build a key before it is known: use `enabled: !!userId`.');
  }
}

/** Data shared by the people of one association. */
export function key(tenant: TenantId | null | undefined, domain: string, ...parts: KeyPart[]): readonly unknown[] {
  assertTenant(tenant);
  return [tenant, domain, ...parts];
}

/** Data that belongs to one person. Two people on the same device or in the same association never share it. */
export function userKey(tenant: TenantId | null | undefined, userId: UserId | null | undefined, domain: string, ...parts: KeyPart[]): readonly unknown[] {
  assertTenant(tenant);
  assertUser(userId);
  return [tenant, domain, 'u', userId, ...parts];
}

/** Prefix that matches every query of an association. */
export function tenantPrefix(tenant: TenantId | null | undefined): readonly unknown[] {
  assertTenant(tenant);
  return [tenant];
}

/** Prefix that matches every query of one domain in one association. */
export function domainPrefix(tenant: TenantId | null | undefined, domain: string): readonly unknown[] {
  assertTenant(tenant);
  return [tenant, domain];
}

export function tenantOf(queryKey: readonly unknown[]): TenantId | undefined {
  const first = queryKey[0];
  return typeof first === 'string' || typeof first === 'number' ? first : undefined;
}

export function domainOf(queryKey: readonly unknown[]): string | undefined {
  const second = queryKey[1];
  return typeof second === 'string' ? second : undefined;
}

/** The person a key belongs to, or undefined for data shared by the association. */
export function userOf(queryKey: readonly unknown[]): UserId | undefined {
  if (queryKey[2] !== 'u') return undefined;
  const id = queryKey[3];
  return typeof id === 'string' || typeof id === 'number' ? id : undefined;
}
