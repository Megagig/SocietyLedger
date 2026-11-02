/**
 * What the demo seed creates: tenants, which modules are filled in, and one login per role/situation. Edit here to change the demo;
 * `--dry-run` prints the plan derived from this file.
 */
import { AssociationKind, AssociationTier } from '@prisma/client';
import { DEMO_EMAIL_DOMAIN } from '../../../src/lib/demo';

export const SEED_KEY = 'demo';
export const SEED_VERSION = 1;

export type RoleName = 'admin' | 'treasurer' | 'financial_secretary' | 'election_committee' | 'ajo_officer' | 'ajo_collector' | 'member';

/** How a member's record and sign-in are set up, so every screen state can be reached with a login. */
export type Situation =
  | 'normal'      // active, pays on time, a little owing now and then
  | 'paid'        // fully paid up
  | 'arrears'     // several months overdue
  | 'new'         // joined this month: nothing owed yet
  | 'inactive'    // member status "inactive" (can sign in)
  | 'suspended'   // member suspended and the sign-in switched off (cannot sign in: shows the blocked state)
  | 'pending';    // registered but not yet approved by an admin (cannot sign in: "pending approval")

export interface PersonaDef {
  key: string;            // part of the email: <key>.<short>@demo...
  role: RoleName;
  situation?: Situation;
  /** What a tester should do with this login. Goes into the credentials sheet. */
  test: string;
  /** Same email local part and person in more than one tenant (the "switch context" persona). */
  sharedIdentity?: string;
  /** Name for the persona, when it matters (otherwise drawn from the fixed-seed generator). */
  name?: [string, string];
}

export interface ModuleFlags {
  dues: boolean; levy: boolean; donations: boolean; expenses: boolean; welfare: boolean; cooperative: boolean;
  meetings: boolean; elections: boolean; polls: boolean; announcements: boolean;
}
const NONE: ModuleFlags = { dues: false, levy: false, donations: false, expenses: false, welfare: false, cooperative: false, meetings: false, elections: false, polls: false, announcements: false };

export interface PotDef { name: string; members: number; contributionKobo: number; state: 'in_progress' | 'completed' | 'not_started'; bank: string }
export interface ThriftDef { name: string; savers: number; dailyKobo: number; days: number; cycleLength: number; bank: string }

export interface TenantDef {
  short: string;
  name: string;
  kind: AssociationKind;
  associationType: string;       // Settings > Association type (the app's own list)
  planCode: 'starter' | 'professional' | 'enterprise' | 'thrift-group';
  tier: AssociationTier;
  members: number;               // size of the member roll (associations)
  modules: ModuleFlags;
  pots?: PotDef[];
  thrift?: ThriftDef[];
  personas: PersonaDef[];
  blurb: string;
}

export const subdomainOf = (t: Pick<TenantDef, 'short'>) => `demo-${t.short}`;
export const emailFor = (key: string, short: string) => `${key}.${short}@${DEMO_EMAIL_DOMAIN}`;

const ALL_ASSOC_PERSONAS = (opts: { ajo: boolean; voting: boolean }): PersonaDef[] => [
  { key: 'admin', role: 'admin', test: 'Everything: members, finance, settings, roles, audit log, SMS, polls, billing page.' },
  { key: 'treasurer', role: 'treasurer', test: 'Finance only: ledger, payments, approvals, cash, reports. No settings, roles or audit.' },
  { key: 'secretary', role: 'financial_secretary', test: 'Records payments and cash but cannot approve them; no settings.' },
  ...(opts.voting ? [{ key: 'elections', role: 'election_committee' as const, test: 'Runs elections and publishes results; otherwise an ordinary member.' }] : []),
  ...(opts.ajo ? [
    { key: 'ajo-officer', role: 'ajo_officer' as const, test: 'Runs Ajo circles day to day; cannot approve payouts.' },
    { key: 'ajo-collector', role: 'ajo_collector' as const, test: 'Collects cash from the savers assigned to them.' },
  ] : []),
  { key: 'member', role: 'member', situation: 'normal', test: 'Ordinary member: own profile, ledger, payments, welfare, polls and votes.' },
  { key: 'member-paid', role: 'member', situation: 'paid', test: 'Fully paid up: nothing owing, clean statement.' },
  { key: 'member-arrears', role: 'member', situation: 'arrears', test: 'Overdue dues and a partial payment: arrears banners and reminders.' },
  { key: 'member-new', role: 'member', situation: 'new', test: 'Joined this month: first-time empty states.' },
  { key: 'member-inactive', role: 'member', situation: 'inactive', test: 'Inactive member who can still sign in.' },
  { key: 'member-suspended', role: 'member', situation: 'suspended', test: 'Suspended: sign-in is blocked (the "account not active" state).' },
  { key: 'member-pending', role: 'member', situation: 'pending', test: 'Awaiting admin approval: sign-in is blocked ("pending approval"). Approve from the admin login.' },
];

export const TENANTS: TenantDef[] = [
  {
    short: 'unity', name: 'Unity Estate Residents Association', kind: AssociationKind.ASSOCIATION, associationType: 'hoa',
    planCode: 'enterprise', tier: AssociationTier.ENTERPRISE, members: 60,
    modules: { dues: true, levy: true, donations: true, expenses: true, welfare: true, cooperative: true, meetings: true, elections: true, polls: true, announcements: true },
    pots: [{ name: 'Unity Estate Ajo Circle', members: 6, contributionKobo: 1_000_000, state: 'in_progress', bank: 'GTBank' }],
    blurb: 'Flagship estate association (Enterprise plan). Every module is filled in.',
    personas: [
      ...ALL_ASSOC_PERSONAS({ ajo: true, voting: true }),
      { key: 'dual', role: 'member', situation: 'normal', sharedIdentity: 'amaka.dual', name: ['Amaka', 'Nwachukwu'], test: 'Same person as the dual login in Balogun Market Ajo: sign in to each tenant to test switching contexts.' },
    ],
  },
  {
    short: 'umuahia', name: 'Umuahia Progressive Town Union', kind: AssociationKind.ASSOCIATION, associationType: 'town_union',
    planCode: 'professional', tier: AssociationTier.PROFESSIONAL, members: 40,
    modules: { ...NONE, dues: true, levy: true, donations: true, welfare: true, meetings: true, elections: true, polls: true, announcements: true },
    blurb: 'Town union (Professional plan): dues, levies, meetings, elections, welfare, fundraising. No cooperative or accounting (plan-gated).',
    personas: ALL_ASSOC_PERSONAS({ ajo: false, voting: true }),
  },
  {
    short: 'lagoscoop', name: 'Lagos Traders Cooperative Society', kind: AssociationKind.ASSOCIATION, associationType: 'cooperative',
    planCode: 'enterprise', tier: AssociationTier.ENTERPRISE, members: 35,
    modules: { ...NONE, dues: true, expenses: true, cooperative: true, meetings: true, announcements: true },
    thrift: [{ name: 'Lagos Traders Daily Savers', savers: 8, dailyKobo: 100_000, days: 45, cycleLength: 60, bank: 'Access Bank' }],
    blurb: 'Cooperative (Enterprise plan): savings, loans with schedules, a rejected loan, thrift inside the society. Welfare, elections and polls are left empty on purpose.',
    personas: ALL_ASSOC_PERSONAS({ ajo: true, voting: false }).filter((p) => !['member-suspended', 'member-pending'].includes(p.key)),
  },
  {
    short: 'alumni', name: 'Federal Government College Umuahia Old Boys Association', kind: AssociationKind.ASSOCIATION, associationType: 'alumni',
    planCode: 'starter', tier: AssociationTier.STARTER, members: 14,
    modules: { ...NONE, dues: true, meetings: true },
    blurb: 'Alumni group (Starter plan), lightly populated. Welfare, voting and SMS are plan-gated off.',
    personas: [
      { key: 'admin', role: 'admin', test: 'Starter-plan admin: notice which menus are locked by the plan.' },
      { key: 'member', role: 'member', situation: 'normal', test: 'Member on a Starter plan.' },
      { key: 'member-arrears', role: 'member', situation: 'arrears', test: 'Overdue dues.' },
    ],
  },
  {
    short: 'grace', name: 'Grace Assembly Fellowship Church', kind: AssociationKind.ASSOCIATION, associationType: 'religious',
    planCode: 'starter', tier: AssociationTier.STARTER, members: 14,
    modules: { ...NONE, dues: true, meetings: true },
    blurb: 'Church body (Starter plan), lightly populated.',
    personas: [
      { key: 'admin', role: 'admin', test: 'Starter-plan admin for a religious body.' },
      { key: 'member', role: 'member', situation: 'normal', test: 'Member of a church body.' },
    ],
  },
  {
    short: 'club', name: 'Ikoyi Sunset Social Club', kind: AssociationKind.ASSOCIATION, associationType: 'club',
    planCode: 'starter', tier: AssociationTier.STARTER, members: 14,
    modules: { ...NONE, dues: true, meetings: true },
    blurb: 'Social club (Starter plan), lightly populated.',
    personas: [
      { key: 'admin', role: 'admin', test: 'Starter-plan admin for a club.' },
      { key: 'member', role: 'member', situation: 'normal', test: 'Club member.' },
    ],
  },
  {
    short: 'balogun', name: 'Balogun Market Ajo', kind: AssociationKind.THRIFT_GROUP, associationType: 'other',
    planCode: 'thrift-group', tier: AssociationTier.STARTER, members: 0,
    modules: NONE,
    pots: [
      { name: 'Balogun Market Ajo Circle', members: 10, contributionKobo: 500_000, state: 'in_progress', bank: 'GTBank' },
      { name: 'Balogun Traders Ajo (completed)', members: 4, contributionKobo: 200_000, state: 'completed', bank: 'Zenith Bank' },
      { name: 'Balogun New Year Ajo (not started)', members: 6, contributionKobo: 300_000, state: 'not_started', bank: 'First Bank' },
    ],
    blurb: 'Standalone thrift group with rotating circles in every lifecycle state. Every member of a circle sees the whole circle.',
    personas: [
      { key: 'admin', role: 'admin', test: 'Group administrator: circles, members, payouts (the only role that approves payouts).' },
      { key: 'officer', role: 'ajo_officer', test: 'Officer: confirms payments, prepares payouts, cannot approve them.' },
      { key: 'member', role: 'member', situation: 'normal', test: 'Circle member: sees the whole circle board; paid every round so far.' },
      { key: 'member-late', role: 'member', situation: 'arrears', test: 'Has not paid the round in progress: late-fee and reminder states.' },
      { key: 'dual', role: 'member', situation: 'normal', sharedIdentity: 'amaka.dual', name: ['Amaka', 'Nwachukwu'], test: 'Same person as the dual login in Unity Estate: switching contexts.' },
    ],
  },
  {
    short: 'mamangozi', name: 'Mama Ngozi Daily Contributions', kind: AssociationKind.THRIFT_GROUP, associationType: 'other',
    planCode: 'thrift-group', tier: AssociationTier.STARTER, members: 0,
    modules: NONE,
    thrift: [{ name: 'Mama Ngozi Daily Contributions', savers: 10, dailyKobo: 100_000, days: 80, cycleLength: 30, bank: 'Access Bank' }],
    blurb: 'Standalone collector thrift: a collector, ten savers, about three months of daily cash, a withdrawal with the collector fee, and a saver in arrears. Each saver sees only their own records.',
    personas: [
      { key: 'admin', role: 'admin', test: 'Group administrator.' },
      { key: 'officer', role: 'ajo_officer', test: 'Officer: reconciles the collector handovers and prepares payouts; the admin approves them.' },
      { key: 'collector', role: 'ajo_collector', test: 'Collector: only the savers assigned to them; daily cash and handovers.' },
      { key: 'saver', role: 'member', situation: 'normal', test: 'Saver: sees ONLY their own contributions and balance, never other savers.' },
      { key: 'saver-arrears', role: 'member', situation: 'arrears', test: 'Saver who missed days: arrears state.' },
    ],
  },
];

/** Which short names form the dual-context identity. */
export const DUAL_IDENTITY = 'amaka.dual';
