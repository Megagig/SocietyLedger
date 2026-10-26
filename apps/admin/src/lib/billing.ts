import { bff } from '@/lib/bff';

/** Types and helpers for the Plan Builder and subscription screens. Prices are whole kobo everywhere; naira is only for typing and display. */

export type VersionStatus = 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';

export interface BuilderVersion {
  id: number;
  version: number;
  status: VersionStatus;
  priceMonthlyKobo: number;
  priceAnnualKobo: number;
  limits: Record<string, number | null> | null;
  changeNote: string | null;
  publishedAt: string | null;
  moduleCodes: string[];
  featureCodes: string[];
  subscribers?: number;
  holders?: number;
}

export interface BuilderPlan {
  id: number;
  code: string;
  name: string;
  description: string | null;
  highlights: string[] | null;
  badgeLabel: string | null;
  isActive: boolean;
  isPublic: boolean;
  isRecommended: boolean;
  isArchived: boolean;
  sortOrder: number;
  isOnboardingPlan: boolean;
  versions: BuilderVersion[];
}

export interface BuilderAddon {
  id: number;
  code: string;
  name: string;
  description: string | null;
  highlights: string[] | null;
  isActive: boolean;
  isPublic: boolean;
  isArchived: boolean;
  sortOrder: number;
  eligiblePlans: { plan: { id: number; code: string; name: string } }[];
  versions: BuilderVersion[];
}

export interface CatalogInfo {
  modules: { code: string; name: string; description: string | null; isCore: boolean }[];
  features: { code: string; name: string; description: string | null; moduleCode: string; isCore: boolean }[];
  limits: readonly { key: string; label: string; unit: string }[];
}

export interface PublishPreview {
  planId: number;
  planName: string;
  hasPublished: boolean;
  fromVersion: number | null;
  toVersion: number;
  price: { monthly: { from: number | null; to: number }; annual: { from: number | null; to: number } };
  modulesAdded: string[];
  modulesRemoved: string[];
  featuresAdded: string[];
  featuresRemoved: string[];
  limits: { from: Record<string, number | null>; to: Record<string, number | null> };
  subscribersOnCurrentVersion: number;
  isOnboardingPlan: boolean;
  warnings: string[];
  blockers: string[];
}

export const billingKeys = {
  plans: ['billing', 'plans'] as const,
  addons: ['billing', 'addons'] as const,
  catalog: ['billing', 'catalog'] as const,
  preview: ['billing', 'preview'] as const,
  migrations: ['billing', 'migrations'] as const,
  subscriptions: (params: string) => ['billing', 'subscriptions', params] as const,
  subscription: (id: number) => ['billing', 'subscription', id] as const,
  payments: (filter: string) => ['billing', 'payments', filter] as const,
};

/** POST/PATCH/DELETE helper: sends JSON and returns the unwrapped data. */
export function send<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  return bff<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Whole kobo as "₦10,000.00" (always in full). */
export function formatKobo(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return '-';
  const sign = kobo < 0 ? '-' : '';
  const abs = Math.abs(Math.round(kobo));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}₦${whole}.${(abs % 100).toString().padStart(2, '0')}`;
}

/** What the owner types (naira, up to two decimals) to whole kobo. Returns null for anything that is not a valid amount. */
export function nairaToKobo(input: string | number): number | null {
  const text = String(input).replace(/[₦,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

/** Kobo as a plain number of naira for an input box (no symbol, no separators). */
export function koboToNairaInput(kobo: number): string {
  return (kobo / 100).toFixed(2);
}

export function versionLabel(v: Pick<BuilderVersion, 'version' | 'status'>): string {
  return `v${v.version}${v.status === 'DRAFT' ? ' (draft)' : v.status === 'SUPERSEDED' ? ' (replaced)' : ''}`;
}

export function currentVersion(plan: { versions: BuilderVersion[] }): BuilderVersion | undefined {
  return plan.versions.find((v) => v.status === 'PUBLISHED');
}

export function draftVersion(plan: { versions: BuilderVersion[] }): BuilderVersion | undefined {
  return plan.versions.find((v) => v.status === 'DRAFT');
}
