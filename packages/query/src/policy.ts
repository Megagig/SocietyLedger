/**
 * How long each kind of data is trusted, and whether it may be kept on the device. One table, so web, mobile and admin agree.
 *
 * Choosing a class for a new screen:
 *   static     changes when an admin edits it (settings, roles, categories, plans)
 *   directory  changes now and then (members, meetings, polls, profile)
 *   aggregate  figures computed from many records (dashboard, reports, board); a minute or two behind is fine
 *   money      what someone owes or has paid (balances, payments, dues, contributions, payouts): short, and always refetched when a screen opens
 *   live       must not be reused (a code, a one-time link, a progress bar)
 *
 * An unknown domain gets `directory` and is NOT persisted: new data is opt-in to being kept on a device.
 */
import { domainOf } from './keys';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const FRESHNESS = {
  static: { staleTime: 30 * MINUTE, gcTime: 24 * HOUR },
  directory: { staleTime: 5 * MINUTE, gcTime: 24 * HOUR },
  aggregate: { staleTime: 90 * SECOND, gcTime: 24 * HOUR },
  money: { staleTime: 30 * SECOND, gcTime: 24 * HOUR },
  live: { staleTime: 0, gcTime: 5 * MINUTE },
} as const;

export type Freshness = keyof typeof FRESHNESS;

export interface DomainPolicy {
  freshness: Freshness;
  /** May this domain be written to the device (IndexedDB / MMKV) and shown on the next open? */
  persist: boolean;
}

const p = (freshness: Freshness, persist = false): DomainPolicy => ({ freshness, persist });

export const DOMAINS: Readonly<Record<string, DomainPolicy>> = {
  // static
  settings: p('static', true),
  roles: p('static', true),
  categories: p('static', true),
  plans: p('static', true),
  permissions: p('static', true),
  association: p('static', true),
  modules: p('static', true),

  // directory
  session: p('directory', true),
  profile: p('directory', true),
  members: p('directory', true),
  meetings: p('directory', true),
  voting: p('directory', true),
  polls: p('directory', true),
  elections: p('directory', true),
  notifications: p('directory', true),
  inbox: p('directory'),
  communication: p('directory'),
  support: p('directory'),

  // aggregate
  dashboard: p('aggregate', true),
  reports: p('aggregate'),
  ajoBoard: p('aggregate'),
  ajoReports: p('aggregate'),
  ajoStatus: p('aggregate', true),

  // money: kept as "last known" only where it already was; refetched every time a screen opens
  memberFinance: p('money', true),
  memberLedger: p('money', true),
  cash: p('money'),
  payments: p('money'),
  dues: p('money'),
  balances: p('money'),
  expenses: p('money'),
  contributions: p('money'),
  payouts: p('money'),
  ajo: p('money'),
  ajoSavings: p('money'),
  ajoPayments: p('money'),
  ajoPayouts: p('money'),
};

const DEFAULT_POLICY: DomainPolicy = { freshness: 'directory', persist: false };

export function policyFor(domain: string | undefined): DomainPolicy {
  return (domain && DOMAINS[domain]) || DEFAULT_POLICY;
}

export interface QueryDefaults {
  staleTime: number;
  gcTime: number;
  refetchOnMount?: 'always';
}

/** Spread into a query: `useQuery({ queryKey, queryFn, ...queryDefaults('members') })`. */
export function queryDefaults(domain: string): QueryDefaults {
  const { freshness } = policyFor(domain);
  const base = FRESHNESS[freshness];
  // Money is shown at once from memory, then checked against the server every time a screen opens.
  return freshness === 'money' ? { ...base, refetchOnMount: 'always' } : { ...base };
}

export function freshnessOf(queryKey: readonly unknown[]): Freshness {
  return policyFor(domainOf(queryKey)).freshness;
}
