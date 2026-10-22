/**
 * The full §9.6 page-by-page sitemap from `context/project-overview.md`, as
 * typed data. Source of truth for `gen-skeleton.ts` (D1.3) and later the
 * `coverage` / `gen-reference` scripts (D1.7, D6.1). Never edited by a
 * generator — this file mirrors `project-overview.md §9.6` by hand; if the
 * sitemap there changes, update this file first; `gen-skeleton.ts --check`
 * reports the drift.
 *
 * The 197th page — the docs home page (`/docs`, `content/docs/index.mdx`,
 * §9.6.1's first row) — predates this file (created at D1.1) and isn't
 * modelled here; it sits outside every section folder.
 */

export type Audience = 'all' | 'member' | 'officer' | 'admin' | 'founder';
export type Platform = 'web' | 'mobile';
export type PageType = 'overview' | 'task' | 'concept' | 'reference' | 'faq' | 'platform';

export interface PageDef {
  /** Slug relative to the section folder; 'index' renders at the section's own root. */
  slug: string;
  title: string;
  type: PageType;
  audience: Audience[];
  platforms: Platform[];
  permission?: string;
  module?: string;
  covers: string[];
}

export interface SectionDef {
  /** Folder name under `content/docs/`. */
  slug: string;
  title: string;
  icon: string;
  /** Separator label this section sits under in the root sidebar (`architecture.md §14.4`). */
  navGroup: string;
  pages: PageDef[];
}

export const sections: SectionDef[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    icon: 'Rocket',
    navGroup: 'Start',
    pages: [
      { slug: 'index', title: 'Getting started', type: 'overview', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'create-your-association', title: 'Creating your association', type: 'task', audience: ['founder'], platforms: ['web'], covers: ['/signup', 'A13'] },
      { slug: 'onboarding-wizard', title: 'Finishing the setup wizard', type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['/onboarding/*', 'O1', 'O2', 'O3', 'O4', 'O5'] },
      { slug: 'your-first-week', title: 'Your first week: a setup checklist', type: 'task', audience: ['admin'], platforms: ['web'], covers: [] },
      { slug: 'joining-as-a-member', title: 'Joining your association as a member', type: 'task', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/auth/activate', 'A5', 'A9', 'A10'] },
      { slug: 'signing-in', title: 'Signing in for the first time', type: 'task', audience: ['all'], platforms: ['web', 'mobile'], covers: ['/auth/login', 'A3', 'A4', 'A6'] },
      { slug: 'install-the-mobile-app', title: 'Installing the mobile app', type: 'task', audience: ['all'], platforms: ['mobile'], covers: ['A1', 'A2', 'A3'] },
    ],
  },
  {
    slug: 'core-concepts',
    title: 'Core concepts',
    icon: 'BookOpen',
    navGroup: 'Start',
    pages: [
      { slug: 'your-association', title: 'Your association, explained', type: 'concept', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'members-and-user-accounts', title: 'Members and login accounts', type: 'concept', audience: ['admin'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'roles-and-permissions', title: 'Roles & what each person can see', type: 'concept', audience: ['admin'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'plans-and-modules', title: 'Plans & modules', type: 'concept', audience: ['admin'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'money-in-societyledger', title: 'How money is tracked', type: 'concept', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'the-member-ledger', title: 'The member ledger and statements', type: 'concept', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'notifications-and-channels', title: 'Notifications: in-app, email, SMS and push', type: 'concept', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'glossary', title: 'Glossary', type: 'reference', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
    ],
  },
  {
    slug: 'account-security',
    title: 'Account & security',
    icon: 'ShieldCheck',
    navGroup: 'Start',
    pages: [
      { slug: 'signing-in-and-out', title: 'Signing in and out', type: 'task', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'verifying-your-email', title: 'Verifying your email', type: 'task', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'resetting-your-password', title: 'Resetting a forgotten password', type: 'task', audience: ['all'], platforms: ['web', 'mobile'], covers: ['/auth/forgot-password', '/auth/reset-password'] },
      { slug: 'changing-your-password', title: 'Changing your password', type: 'task', audience: ['all'], platforms: ['web', 'mobile'], covers: ['/dashboard/member/settings', 'P3'] },
      { slug: 'account-approval-status', title: 'Pending, rejected or suspended accounts', type: 'concept', audience: ['member'], platforms: ['web', 'mobile'], covers: ['A10', 'A11'] },
      { slug: 'signed-in-devices', title: 'Signed-in devices', type: 'task', audience: ['all'], platforms: ['mobile'], covers: ['P3'] },
      { slug: 'app-lock-and-biometrics', title: 'App lock, Face ID and fingerprint', type: 'task', audience: ['all'], platforms: ['mobile'], covers: ['A14', 'P3'] },
      { slug: 'switching-associations', title: 'Belonging to more than one association', type: 'concept', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
    ],
  },
  {
    slug: 'member-guide',
    title: 'Member guide',
    icon: 'User',
    navGroup: 'For members',
    pages: [
      { slug: 'index', title: 'Member guide', type: 'overview', audience: ['member'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'your-dashboard', title: 'Your dashboard at a glance', type: 'concept', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/member', 'H1'] },
      { slug: 'what-you-owe', title: 'Seeing what you owe', type: 'concept', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/my-finances', 'M1', 'M2'] },
      { slug: 'paying-online', title: 'Paying online with card or bank (Paystack)', type: 'task', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/my-finances/pay', 'M3', 'M5'] },
      { slug: 'paying-by-bank-transfer', title: 'Paying by bank transfer and uploading proof', type: 'task', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/payments/bank-transfers/new', 'M4'] },
      { slug: 'your-statement', title: 'Reading and downloading your statement', type: 'task', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/my-finances/ledger', 'M6', 'M7'] },
      { slug: 'dues-levies-and-penalties', title: 'Your dues, levies and penalties', type: 'concept', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/my-finances/dues', '/dashboard/my-finances/levies', '/dashboard/my-finances/penalties', 'M8', 'M9', 'M10'] },
      { slug: 'making-a-donation', title: 'Making a donation', type: 'task', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/my-finances/donations', 'M11', 'M12'] },
      { slug: 'payment-history-and-receipts', title: 'Payment history and receipts', type: 'task', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/my-finances/payments', 'M13'] },
      { slug: 'your-profile', title: 'Keeping your profile up to date', type: 'task', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/member/my-profile', 'P2'] },
      { slug: 'meetings-and-attendance', title: 'Your meetings and attendance', type: 'concept', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/member/my-meetings', 'C2', 'C3', 'C4'] },
      { slug: 'voting', title: 'Voting in elections and polls', type: 'task', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/member/my-voting', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10'] },
      { slug: 'welfare', title: 'Welfare contributions and support requests', type: 'concept', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/welfare/*', 'C11', 'C12'] },
      { slug: 'savings-and-loans', title: 'Your savings and loans', type: 'concept', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/cooperatives/my-*', 'M15', 'M16', 'M17', 'M18', 'M19', 'M20'] },
      { slug: 'notification-preferences', title: 'Choosing which notifications you get', type: 'task', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/notifications/preferences', 'N2'] },
      { slug: 'getting-help', title: 'Getting help', type: 'task', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/help', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'] },
    ],
  },
  {
    slug: 'members',
    title: 'Members',
    icon: 'Users',
    navGroup: 'Running your association',
    pages: [
      { slug: 'index', title: 'Managing members', type: 'overview', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'your-member-list', title: 'Finding members: search and filters', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/members', 'MG1'] },
      { slug: 'adding-a-member', title: 'Adding a member', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/members/create', 'MG3'] },
      { slug: 'editing-and-disabling', title: 'Editing or disabling a member', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/members/[id]/edit', 'MG2', 'MG3'] },
      { slug: 'categories-and-statuses', title: 'Member categories and statuses', type: 'reference', audience: ['officer'], platforms: ['web'], covers: ['category', 'status', 'loginStatus'] },
      { slug: 'inviting-members-to-log-in', title: 'Inviting members to log in', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/members/invite', 'MG4'] },
      { slug: 'self-registration-and-approvals', title: 'Self-registration and approving accounts', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/settings/members-access', '/dashboard/settings/users', 'MG5'] },
      { slug: 'importing-members', title: 'Importing members from a spreadsheet', type: 'task', audience: ['officer'], platforms: ['web'], covers: ['POST /members/bulk'] },
      { slug: 'the-member-profile', title: 'The member profile: finance, attendance, cooperative', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/members/[id]', 'MG2'] },
      { slug: 'exporting-members', title: 'Exporting your member list', type: 'task', audience: ['officer'], platforms: ['web'], covers: ['/dashboard/exports'] },
    ],
  },
  {
    slug: 'finance',
    title: 'Finance',
    icon: 'Wallet',
    navGroup: 'Running your association',
    pages: [
      { slug: 'index', title: 'Finance', type: 'overview', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'finance-overview', title: 'Understanding the finance overview', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/finance/overview', 'FN1'] },
      { slug: 'financial-categories', title: 'Setting up financial categories', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/finance/categories', 'FN6'] },
      { slug: 'creating-charges', title: 'Charging members: single and bulk', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/finance/transactions/create', 'FN4'] },
      { slug: 'setting-up-dues', title: 'Setting up recurring dues', type: 'task', audience: ['officer'], platforms: ['web'], covers: ['/dashboard/finance/dues'] },
      { slug: 'recording-a-payment', title: 'Recording a payment a member made', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['FN5', '/dashboard/finance/transactions/[id]'] },
      { slug: 'editing-voiding-and-deleting', title: 'Editing, voiding or deleting a transaction (and undo)', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['FN3'] },
      { slug: 'levy-campaigns', title: 'Running a levy campaign', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/finance/levies*', 'FN8', 'FN9'] },
      { slug: 'donations-and-causes', title: 'Donations and causes', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/finance/donations', 'FN10'] },
      { slug: 'penalties-and-late-fees', title: 'Penalties and automatic late fees', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/finance/penalties', 'FN11'] },
      { slug: 'waiving-a-penalty', title: 'Waiving a penalty', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['FN11'] },
      { slug: 'overdue-and-reminders', title: 'Following up overdue members', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/finance/overdue', '/dashboard/finance/reminders', 'FN12'] },
      { slug: 'member-ledgers', title: 'Member ledgers and statements', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/finance/member-ledger*', 'FN13', 'FN14'] },
      { slug: 'transaction-statuses', title: 'Transaction and payment statuses', type: 'reference', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
    ],
  },
  {
    slug: 'payments',
    title: 'Payments & reconciliation',
    icon: 'Banknote',
    navGroup: 'Running your association',
    pages: [
      { slug: 'index', title: 'Payments & reconciliation', type: 'overview', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'how-members-pay', title: 'Ways members can pay', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'online-payments-with-paystack', title: 'Online payments with Paystack', type: 'task', audience: ['officer'], platforms: ['web'], covers: ['/dashboard/settings/payments', '/dashboard/finance/payments/verify'] },
      { slug: 'association-bank-accounts', title: "Adding your association's bank accounts", type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/payments/nigerian/bank-accounts', 'PY7'] },
      { slug: 'verifying-payment-proofs', title: 'Verifying payment proofs', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/payments/nigerian/verification', 'PY2', 'PY3'] },
      { slug: 'recording-bank-transfers', title: 'Recording and verifying bank transfers', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/payments/nigerian/transfers*', 'PY4', 'PY5', 'PY6'] },
      { slug: 'importing-a-bank-statement', title: 'Importing a bank statement', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/payments/nigerian/statements', 'PY8'] },
      { slug: 'matching-and-reconciliation', title: 'Matching payments and reconciling', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/payments/nigerian/reconciliation'] },
      { slug: 'reconciliation-history', title: 'Reconciliation history', type: 'task', audience: ['officer'], platforms: ['web'], covers: ['/dashboard/payments/nigerian/reconciliation-history'] },
    ],
  },
  {
    slug: 'accounting',
    title: 'Accounting',
    icon: 'Calculator',
    navGroup: 'Running your association',
    pages: [
      { slug: 'index', title: 'Accounting', type: 'overview', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'what-happens-automatically', title: 'What happens automatically when money moves', type: 'concept', audience: ['officer'], platforms: ['web'], covers: ['/dashboard/settings/accounting-integration'] },
      { slug: 'accounting-dashboard', title: 'The accounting dashboard', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/accounting', 'AC1'] },
      { slug: 'income-statement-at-a-glance', title: 'Your income statement at a glance', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['AC5'] },
      { slug: 'balance-sheet-at-a-glance', title: 'Your balance sheet at a glance', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['AC5'] },
      { slug: 'budgets', title: 'Budgets in brief', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['AC6'] },
    ],
  },
  {
    slug: 'accounting-guide',
    title: 'Accounting guide',
    icon: 'Bookmark',
    navGroup: 'Running your association',
    pages: [
      { slug: 'chart-of-accounts', title: 'The chart of accounts', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/accounting/chart-of-accounts', 'AC2'] },
      { slug: 'how-transactions-post', title: 'How charges and payments post to accounts', type: 'concept', audience: ['officer'], platforms: ['web'], covers: [] },
      { slug: 'journal-entries', title: 'Journal entries: draft, approve, post', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/accounting/journal-entries', 'AC3', 'AC4'] },
      { slug: 'income-statement', title: 'Income statement in depth', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/accounting/income-statement'] },
      { slug: 'balance-sheet', title: 'Balance sheet in depth', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/accounting/balance-sheet'] },
      { slug: 'cash-flow', title: 'Cash flow statement', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/accounting/cash-flow'] },
      { slug: 'budgets-and-variance', title: 'Budgets, approval and variance', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/accounting/budgets'] },
      { slug: 'accounting-periods', title: 'Accounting periods and closing', type: 'concept', audience: ['officer'], platforms: ['web'], covers: ['AccountingPeriod'] },
      { slug: 'sync-status-and-errors', title: 'Sync status and fixing sync errors', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/accounting/sync/*'] },
    ],
  },
  {
    slug: 'reports',
    title: 'Reports & exports',
    icon: 'ChartColumn',
    navGroup: 'Running your association',
    pages: [
      { slug: 'index', title: 'Reports & exports', type: 'overview', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'finding-the-report-you-need', title: 'Finding the report you need', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'association-dashboard', title: 'The association dashboard', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard', 'H2'] },
      { slug: 'financial-summary', title: 'Financial summary report', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/reports/financial-summary', 'RP2'] },
      { slug: 'member-balances', title: 'Member balances report', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['RP3'] },
      { slug: 'aging-analysis', title: 'Aging analysis: how long money has been owed', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['RP4'] },
      { slug: 'collection-rate', title: 'Collection rate', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['RP5'] },
      { slug: 'income-by-category', title: 'Income by category', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['RP6'] },
      { slug: 'exporting-reports', title: 'Exporting to PDF and Excel', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/exports', 'RP7'] },
      { slug: 'custom-exports', title: 'Building a custom export', type: 'task', audience: ['officer'], platforms: ['web'], covers: ['/dashboard/exports/custom'] },
      { slug: 'export-history', title: 'Export history and downloads', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/exports/history'] },
    ],
  },
  {
    slug: 'meetings',
    title: 'Meetings & attendance',
    icon: 'CalendarDays',
    navGroup: 'Community',
    pages: [
      { slug: 'index', title: 'Meetings', type: 'overview', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'scheduling-a-meeting', title: 'Scheduling a meeting', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/governance/meetings/create', 'GV2'] },
      { slug: 'building-an-agenda', title: 'Building the agenda', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['GV2'] },
      { slug: 'taking-attendance', title: 'Taking attendance (on a laptop or phone)', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/governance/meetings/[id]', 'GV4'] },
      { slug: 'minutes', title: 'Recording and approving minutes', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['GV5'] },
      { slug: 'attendance-history', title: 'Attendance history and rates', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/governance/attendance', 'GV6'] },
      { slug: 'cancelling-or-postponing', title: 'Cancelling or postponing a meeting', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['GV2'] },
      { slug: 'meeting-reminders', title: 'Automatic meeting reminders', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['jobs/meeting-jobs.ts'] },
    ],
  },
  {
    slug: 'elections',
    title: 'Elections & polls',
    icon: 'Vote',
    navGroup: 'Community',
    pages: [
      { slug: 'index', title: 'Elections & polls', type: 'overview', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'how-elections-work', title: 'How an election runs, start to finish', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'creating-an-election', title: 'Creating an election and its positions', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/governance/elections/new', 'GV8'] },
      { slug: 'nominations-and-candidates', title: 'Nominations, self-nomination and approving candidates', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['GV9', 'C6'] },
      { slug: 'running-the-vote', title: 'Opening and closing voting', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['GV9'] },
      { slug: 'publishing-results', title: 'Publishing results', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['GV9', 'C8'] },
      { slug: 'voter-eligibility-and-turnout', title: 'Who can vote, and tracking turnout', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/governance/voting'] },
      { slug: 'creating-a-poll', title: 'Creating a quick poll', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/governance/polls/new', 'GV10'] },
      { slug: 'poll-results', title: 'Poll results', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['C10'] },
    ],
  },
  {
    slug: 'welfare',
    title: 'Welfare',
    icon: 'HeartHandshake',
    navGroup: 'Community',
    pages: [
      { slug: 'index', title: 'Welfare', type: 'overview', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'welfare-funds', title: 'Setting up welfare funds', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/welfare/social-funds', 'WF2'] },
      { slug: 'recording-contributions', title: 'Recording and confirming contributions', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/welfare/contributions', 'WF3'] },
      { slug: 'eligibility', title: 'Who is eligible for support', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/welfare/eligibility'] },
      { slug: 'payout-requests', title: 'Handling support requests', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/welfare/requests', 'WF4'] },
      { slug: 'bereavement-support', title: 'Bereavement support', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'disbursing-payouts', title: 'Approving and paying out support', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['WF4'] },
    ],
  },
  {
    slug: 'cooperatives',
    title: 'Cooperatives',
    icon: 'PiggyBank',
    navGroup: 'Community',
    pages: [
      { slug: 'index', title: 'Cooperatives', type: 'overview', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'savings-accounts', title: 'Opening savings accounts', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/cooperatives/savings', 'CP2'] },
      { slug: 'deposits-and-withdrawals', title: 'Recording deposits and withdrawals', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['CP2'] },
      { slug: 'depositing-into-your-savings', title: 'Depositing into your savings (members)', type: 'task', audience: ['member'], platforms: ['web'], covers: ['/dashboard/cooperatives/my-savings'] },
      { slug: 'approving-savings-deposits', title: 'Approving member savings deposits', type: 'task', audience: ['officer'], platforms: ['web'], covers: ['/dashboard/cooperatives/savings-deposits'] },
      { slug: 'loan-products', title: 'Setting up loan products', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/cooperatives/loan-products', 'CP3'] },
      { slug: 'savings-rule-and-held-savings', title: 'Your savings rule and held savings', type: 'concept', audience: ['officer', 'member'], platforms: ['web'], covers: ['/dashboard/cooperatives/loan-products', '/dashboard/cooperatives/apply'] },
      { slug: 'applying-for-a-loan', title: 'Applying for a loan (members)', type: 'task', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/cooperatives/apply', 'M19'] },
      { slug: 'guarantors', title: 'Guarantors: requesting and responding', type: 'task', audience: ['member'], platforms: ['web', 'mobile'], covers: ['/dashboard/cooperatives/guarantors', 'money/guarantor-requests', 'M20'] },
      { slug: 'reviewing-and-disbursing-loans', title: 'Reviewing, approving and disbursing loans', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/cooperatives/applications*', 'CP4'] },
      { slug: 'repayments-and-schedules', title: 'Repayments and repayment schedules', type: 'concept', audience: ['officer', 'member'], platforms: ['web', 'mobile'], covers: ['/dashboard/cooperatives/loans', 'CP5', 'M18'] },
      { slug: 'paying-your-loan', title: 'Paying towards your loan (members)', type: 'task', audience: ['member'], platforms: ['web'], covers: ['/dashboard/cooperatives/my-loans'] },
      { slug: 'approving-loan-repayments', title: 'Approving member loan repayments', type: 'task', audience: ['officer'], platforms: ['web'], covers: ['/dashboard/cooperatives/loan-repayments'] },
      { slug: 'member-cooperative-profile', title: "A member's cooperative profile", type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/cooperatives/members/:id/profile'] },
    ],
  },
  {
    slug: 'communication',
    title: 'Communication',
    icon: 'MessageSquare',
    navGroup: 'Community',
    pages: [
      { slug: 'index', title: 'Communication', type: 'overview', audience: ['officer'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'announcements', title: 'Sending an announcement', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/communication/announcements/new', 'CM2'] },
      { slug: 'in-app-notifications', title: 'The notifications centre', type: 'concept', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/notifications', 'N1'] },
      { slug: 'email', title: 'Email notifications', type: 'task', audience: ['officer'], platforms: ['web'], covers: ['/dashboard/communication/email'] },
      { slug: 'sending-sms', title: 'Sending an SMS', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/communication/sms', 'CM3'] },
      { slug: 'sms-campaigns', title: 'SMS campaigns', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['/dashboard/communication/sms/campaigns', 'CM4'] },
      { slug: 'sms-templates', title: 'SMS templates', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['CM5'] },
      { slug: 'sms-history', title: 'SMS history and delivery status', type: 'task', audience: ['officer'], platforms: ['web', 'mobile'], covers: ['CM6'] },
      { slug: 'buying-sms-credits', title: 'Buying SMS credits', type: 'task', audience: ['officer'], platforms: ['web'], covers: ['/dashboard/communication/sms/credits'] },
      { slug: 'reminder-schedules', title: 'Automatic payment reminders', type: 'concept', audience: ['officer'], platforms: ['web'], covers: ['/dashboard/finance/reminders'] },
    ],
  },
  {
    slug: 'ai',
    title: 'AI assistant',
    icon: 'Bot',
    navGroup: 'Admin',
    pages: [
      { slug: 'index', title: 'AI assistant', type: 'overview', audience: ['admin'], platforms: ['web', 'mobile'], module: 'ai', covers: [] },
      { slug: 'asking-questions', title: "Asking questions about your association's finances", type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], module: 'ai', covers: ['/dashboard/ai/assistant', '/dashboard/ai/query', 'AI1'] },
      { slug: 'smart-reminders', title: 'Smart reminders', type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], module: 'ai', covers: ['/dashboard/ai/reminders', 'AI2'] },
      { slug: 'ai-reports', title: 'Generating AI reports', type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], module: 'ai', covers: ['/dashboard/ai/reports', 'AI3'] },
      { slug: 'document-questions', title: 'Asking questions about your documents', type: 'task', audience: ['admin'], platforms: ['web'], module: 'ai', covers: ['/dashboard/ai/documents'] },
      { slug: 'limits-and-privacy', title: 'AI usage limits and data privacy', type: 'concept', audience: ['admin'], platforms: ['web', 'mobile'], module: 'ai', covers: ['/dashboard/ai/usage'] },
    ],
  },
  {
    slug: 'settings',
    title: 'Settings, users & roles',
    icon: 'Settings',
    navGroup: 'Admin',
    pages: [
      { slug: 'index', title: 'Settings', type: 'overview', audience: ['admin'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'association-profile', title: 'Association profile and logo', type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['/dashboard/settings/association', 'ST2'] },
      { slug: 'financial-settings', title: 'Financial settings', type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['/dashboard/settings/financial', 'ST3'] },
      { slug: 'payment-settings', title: 'Payment settings', type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['/dashboard/settings/payments', 'ST4'] },
      { slug: 'notification-settings', title: 'Association notification settings', type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['/dashboard/settings/notifications', 'ST5'] },
      { slug: 'members-and-access', title: 'Members & access settings', type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['/dashboard/settings/members-access', 'ST6'] },
      { slug: 'managing-users', title: 'Managing user accounts', type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['/dashboard/settings/users', 'ST7'] },
      { slug: 'custom-roles', title: 'Creating custom roles', type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['/dashboard/settings/roles', 'ST8'] },
      { slug: 'assigning-roles', title: 'Assigning and removing roles', type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['ST8'] },
      { slug: 'audit-log', title: 'The audit log', type: 'concept', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['/dashboard/settings/audit-logs', 'ST9'] },
      { slug: 'data-and-privacy', title: 'Data and privacy: exporting your data', type: 'task', audience: ['admin'], platforms: ['web'], covers: ['/dashboard/settings/data-privacy'] },
      { slug: 'integrations', title: 'Integrations', type: 'concept', audience: ['admin'], platforms: ['web'], covers: ['/dashboard/settings/integrations'] },
      { slug: 'accounting-integration', title: 'Accounting integration settings', type: 'task', audience: ['admin'], platforms: ['web'], covers: ['/dashboard/settings/accounting-integration'] },
      { slug: 'help-content', title: 'Adding your own help articles and FAQs', type: 'task', audience: ['admin'], platforms: ['web'], covers: ['/dashboard/settings/help-content'] },
    ],
  },
  {
    slug: 'plan-billing',
    title: 'Plan & billing',
    icon: 'CreditCard',
    navGroup: 'Admin',
    pages: [
      { slug: 'index', title: 'Plan & billing', type: 'overview', audience: ['admin'], platforms: ['web'], covers: [] },
      { slug: 'plans-and-whats-included', title: 'Understanding your plan and what’s included', type: 'concept', audience: ['admin'], platforms: ['web'], covers: ['/dashboard/subscription/plans'] },
      { slug: 'free-trial', title: 'Your free trial', type: 'concept', audience: ['admin'], platforms: ['web'], covers: ['subscription-jobs.ts'] },
      { slug: 'subscribing-and-paying', title: 'Subscribing and paying', type: 'task', audience: ['admin'], platforms: ['web'], covers: ['/dashboard/subscription/checkout'] },
      { slug: 'changing-your-plan', title: 'Upgrading or downgrading', type: 'task', audience: ['admin'], platforms: ['web'], covers: ['change-plan'] },
      { slug: 'cancelling-and-reactivating', title: 'Cancelling and reactivating', type: 'task', audience: ['admin'], platforms: ['web'], covers: ['cancel', 'reactivate'] },
      { slug: 'billing-history', title: 'Billing history and receipts', type: 'concept', audience: ['admin'], platforms: ['web'], covers: ['PaymentHistory'] },
      { slug: 'when-a-subscription-ends', title: 'What happens when a subscription ends', type: 'concept', audience: ['admin'], platforms: ['web'], covers: [] },
    ],
  },
  {
    slug: 'mobile-app',
    title: 'Mobile app',
    icon: 'Smartphone',
    navGroup: 'Apps & help',
    pages: [
      { slug: 'index', title: 'The SocietyLedger mobile app', type: 'overview', audience: ['all'], platforms: ['mobile'], covers: [] },
      { slug: 'getting-the-app', title: 'Getting the app', type: 'platform', audience: ['all'], platforms: ['mobile'], covers: ['A1', 'A2'] },
      { slug: 'signing-in-on-mobile', title: 'Signing in with your association code', type: 'platform', audience: ['all'], platforms: ['mobile'], covers: ['A3', 'A4'] },
      { slug: 'finding-your-way-around', title: 'Finding your way around: tabs and menus', type: 'platform', audience: ['all'], platforms: ['mobile'], covers: [] },
      { slug: 'paying-on-mobile', title: 'Paying on your phone', type: 'platform', audience: ['member'], platforms: ['mobile'], covers: ['M2', 'M3', 'M4', 'M5'] },
      { slug: 'push-notifications', title: 'Push notifications', type: 'platform', audience: ['all'], platforms: ['mobile'], covers: ['N2'] },
      { slug: 'officer-tasks-on-the-go', title: 'Officer tasks on the go', type: 'platform', audience: ['officer'], platforms: ['mobile'], covers: ['PY3', 'GV4', 'CP4'] },
      { slug: 'offline-and-saved-data', title: 'Using the app with poor or no internet', type: 'platform', audience: ['all'], platforms: ['mobile'], covers: [] },
      { slug: 'whats-web-only', title: 'What you still do on the web', type: 'platform', audience: ['all'], platforms: ['mobile'], covers: [] },
      { slug: 'updating-the-app', title: 'Keeping the app up to date', type: 'platform', audience: ['all'], platforms: ['mobile'], covers: [] },
    ],
  },
  {
    slug: 'help-support',
    title: 'Help & support',
    icon: 'LifeBuoy',
    navGroup: 'Apps & help',
    pages: [
      { slug: 'in-app-help-center', title: 'The in-app help centre', type: 'task', audience: ['all'], platforms: ['web', 'mobile'], covers: ['/dashboard/help*', 'profile/help*', 'P5', 'P6', 'P7', 'P12'] },
      { slug: 'support-tickets', title: 'Opening and following a support ticket', type: 'task', audience: ['all'], platforms: ['web', 'mobile'], covers: ['/dashboard/help/tickets*', 'profile/help/tickets*', 'P8', 'P9', 'P10'] },
      { slug: 'handling-support-tickets', title: 'Handling support tickets', type: 'task', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['/dashboard/help/tickets*', 'manage/support*', 'ST11'] },
      { slug: 'contacting-support', title: 'Contacting SocietyLedger support', type: 'concept', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
    ],
  },
  {
    slug: 'troubleshooting-faq',
    title: 'Troubleshooting & FAQ',
    icon: 'CircleQuestionMark',
    navGroup: 'Apps & help',
    pages: [
      { slug: 'account-and-login-faq', title: 'Account & sign-in FAQ', type: 'faq', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'payments-faq', title: 'Payments FAQ (member and officer)', type: 'faq', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'finance-faq', title: 'Finance FAQ', type: 'faq', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'members-faq', title: 'Members FAQ', type: 'faq', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'governance-faq', title: 'Meetings, elections & polls FAQ', type: 'faq', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'cooperatives-welfare-faq', title: 'Cooperatives & welfare FAQ', type: 'faq', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'communication-faq', title: 'Communication & SMS FAQ', type: 'faq', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'billing-faq', title: 'Plan & billing FAQ', type: 'faq', audience: ['all'], platforms: ['web'], covers: [] },
      { slug: 'mobile-app-faq', title: 'Mobile app FAQ', type: 'faq', audience: ['all'], platforms: ['mobile'], covers: [] },
    ],
  },
  {
    slug: 'reference',
    title: 'Reference',
    icon: 'Library',
    navGroup: 'Apps & help',
    pages: [
      { slug: 'permissions', title: 'Permissions reference', type: 'reference', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['apps/api/src/lib/permissions.ts', '/rbac/permissions'] },
      { slug: 'statuses', title: 'Statuses reference', type: 'reference', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['schema.prisma'] },
      { slug: 'payment-methods', title: 'Payment methods', type: 'reference', audience: ['admin'], platforms: ['web', 'mobile'], covers: [] },
      { slug: 'modules-by-plan', title: 'Modules by plan', type: 'reference', audience: ['admin'], platforms: ['web', 'mobile'], covers: ['seed-plans.ts', 'platform-modules.seed.ts'] },
      { slug: 'release-notes', title: "What's new", type: 'reference', audience: ['all'], platforms: ['web', 'mobile'], covers: [] },
    ],
  },
];

export const rootNavOrder = [
  'getting-started',
  'core-concepts',
  'account-security',
  'member-guide',
  'members',
  'finance',
  'payments',
  'accounting',
  'accounting-guide',
  'reports',
  'meetings',
  'elections',
  'welfare',
  'cooperatives',
  'communication',
  'ai',
  'settings',
  'plan-billing',
  'mobile-app',
  'help-support',
  'troubleshooting-faq',
  'reference',
];

export const totalPageCount =
  1 /* content/docs/index.mdx, outside every section */ +
  sections.reduce((sum, section) => sum + section.pages.length, 0);
