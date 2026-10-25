import { useTenantStore } from '@/stores/tenant';

/** code-standards.md §6 — "Every query key starts with the tenant subdomain via a `<domain>Keys`
 * factory." First real use: H1 (F2.5) is the first feature whose query keys need tenant
 * scoping — F2.1–F2.4's queries were all either pre-tenant (association lookup) or singleton
 * per-user (`/auth/me`, no tenant-scoped list/cache collision risk). */
export function useTenantKey(): string {
  return useTenantStore((state) => state.current?.subdomain ?? 'no-tenant');
}
