/**
 * Shared web-route / mobile-screen-ID → docs-page map (architecture.md
 * §15.4). Both `apps/web` and (once built) `apps/mobile` import this so a
 * route and its mobile screen always point at the identical docs page.
 *
 * Extend this as more docs pages publish — it only needs an entry for a
 * route that actually has a `HelpLink` or an equivalent mobile `?` icon.
 */
export const DOCS_LINKS: Record<string, string> = {
  '/dashboard': '/docs/reports/association-dashboard',
  H2: '/docs/reports/association-dashboard',

  '/dashboard/member': '/docs/member-guide/your-dashboard',
  H1: '/docs/member-guide/your-dashboard',

  '/dashboard/my-finances': '/docs/member-guide/what-you-owe',
  M1: '/docs/member-guide/what-you-owe',

  '/dashboard/my-finances/pay': '/docs/member-guide/paying-online',
  M2: '/docs/member-guide/paying-online',
  M3: '/docs/member-guide/paying-online',

  // architecture.md §15.4 originally paired this web route with mobile
  // screen M4 under the member-facing paying-by-bank-transfer doc — but
  // `/dashboard/payments/bank-transfers/new` is actually the *officer's*
  // "Record Bank Transfer" screen (Can/PERMISSIONS-gated), not a member
  // self-service page; members pay by bank transfer from
  // `/dashboard/my-finances/pay`'s payment-method dropdown instead. M4 (the
  // future mobile member screen) keeps the member-facing doc; the web route
  // gets the correct officer one.
  '/dashboard/payments/bank-transfers/new': '/docs/payments/recording-bank-transfers',
  M4: '/docs/member-guide/paying-by-bank-transfer',

  '/dashboard/my-finances/ledger': '/docs/member-guide/your-statement',
  M6: '/docs/member-guide/your-statement',

  '/dashboard/members': '/docs/members/your-member-list',
  MG1: '/docs/members/your-member-list',

  '/dashboard/members/create': '/docs/members/adding-a-member',
  MG3: '/docs/members/adding-a-member',

  '/dashboard/members/invite': '/docs/members/inviting-members-to-log-in',
  MG4: '/docs/members/inviting-members-to-log-in',

  '/dashboard/finance/overview': '/docs/finance/finance-overview',
  FN1: '/docs/finance/finance-overview',
  FN5: '/docs/finance/recording-a-payment',
  '/dashboard/finance/transactions': '/docs/finance/creating-charges',
  FN2: '/docs/finance/creating-charges',
  FN3: '/docs/finance/creating-charges',
  FN4: '/docs/finance/creating-charges',

  '/dashboard/finance/categories': '/docs/finance/financial-categories',
  FN6: '/docs/finance/financial-categories',

  '/dashboard/finance/dues': '/docs/finance/setting-up-dues',
  FN7: '/docs/finance/setting-up-dues',

  '/dashboard/finance/levies': '/docs/finance/levy-campaigns',
  '/dashboard/finance/levies/[id]': '/docs/finance/levy-campaigns',
  FN8: '/docs/finance/levy-campaigns',
  FN9: '/docs/finance/levy-campaigns',

  '/dashboard/finance/donations': '/docs/finance/donations-and-causes',
  FN10: '/docs/finance/donations-and-causes',

  '/dashboard/finance/penalties': '/docs/finance/penalties-and-late-fees',
  FN11: '/docs/finance/penalties-and-late-fees',

  '/dashboard/finance/overdue': '/docs/finance/overdue-and-reminders',
  FN12: '/docs/finance/overdue-and-reminders',

  '/dashboard/finance/member-ledger': '/docs/finance/member-ledgers',
  '/dashboard/finance/member-ledger/[memberId]': '/docs/finance/member-ledgers',
  FN13: '/docs/finance/member-ledgers',
  FN14: '/docs/finance/member-ledgers',

  '/dashboard/payments/nigerian/verification': '/docs/payments/verifying-payment-proofs',
  '/dashboard/payments/verification': '/docs/payments/verifying-payment-proofs',
  PY1: '/docs/payments/verifying-payment-proofs',
  PY2: '/docs/payments/verifying-payment-proofs',
  PY3: '/docs/payments/verifying-payment-proofs',

  // Cash collected from members at meetings, lodged into the bank, and checked by a second officer.
  '/dashboard/cash': '/docs/cash/how-cash-collections-work',
  CA1: '/docs/cash/how-cash-collections-work',
  '/dashboard/cash/collections': '/docs/cash/collecting-cash-from-members',
  '/dashboard/cash/collections/[id]': '/docs/cash/collecting-cash-from-members',
  CA2: '/docs/cash/collecting-cash-from-members',
  CA3: '/docs/cash/collecting-cash-from-members',
  CA4: '/docs/cash/collecting-cash-from-members',
  CA5: '/docs/cash/collecting-cash-from-members',
  '/dashboard/cash/lodge': '/docs/cash/lodging-cash-into-the-bank',
  CA6: '/docs/cash/lodging-cash-into-the-bank',
  '/dashboard/cash/lodgments': '/docs/cash/verifying-cash-lodgments',
  '/dashboard/cash/lodgments/[id]': '/docs/cash/verifying-cash-lodgments',
  CA7: '/docs/cash/verifying-cash-lodgments',
  CA8: '/docs/cash/verifying-cash-lodgments',

  '/dashboard/payments/nigerian/reconciliation': '/docs/payments/matching-and-reconciliation',
  PY8: '/docs/payments/matching-and-reconciliation',

  '/dashboard/accounting/journal-entries': '/docs/accounting-guide/journal-entries',
  AC3: '/docs/accounting-guide/journal-entries',

  '/dashboard/reports': '/docs/reports/finding-the-report-you-need',
  RP1: '/docs/reports/finding-the-report-you-need',

  '/dashboard/governance/meetings/[id]': '/docs/meetings/taking-attendance',
  GV1: '/docs/meetings/scheduling-a-meeting',
  GV2: '/docs/meetings/scheduling-a-meeting',
  GV3: '/docs/meetings/taking-attendance',
  GV4: '/docs/meetings/taking-attendance',
  GV5: '/docs/meetings/minutes',
  GV6: '/docs/meetings/attendance-history',

  // Elections and polls for the Election Committee (GV7–GV10) and their web equivalents.
  '/dashboard/governance/elections': '/docs/elections/how-elections-work',
  GV7: '/docs/elections/how-elections-work',
  '/dashboard/governance/elections/rules': '/docs/elections/voting-rules',
  '/dashboard/governance/elections/new': '/docs/elections/creating-an-election',
  GV8: '/docs/elections/creating-an-election',
  '/dashboard/governance/elections/[id]': '/docs/elections/how-elections-work',
  GV9: '/docs/elections/how-elections-work',
  '/dashboard/governance/polls': '/docs/elections/creating-a-poll',
  '/dashboard/governance/polls/new': '/docs/elections/creating-a-poll',
  '/dashboard/governance/polls/[id]': '/docs/elections/poll-results',
  GV10: '/docs/elections/creating-a-poll',

  C7: '/docs/member-guide/voting',

  '/dashboard/welfare/requests': '/docs/welfare/payout-requests',
  WF4: '/docs/welfare/payout-requests',

  // Welfare officer screens on mobile (WF1–WF3) and their web equivalents.
  '/dashboard/welfare': '/docs/welfare/welfare-funds',
  WF1: '/docs/welfare/welfare-funds',
  '/dashboard/welfare/social-funds': '/docs/welfare/welfare-funds',
  WF2: '/docs/welfare/welfare-funds',
  '/dashboard/welfare/contributions': '/docs/welfare/recording-contributions',
  WF3: '/docs/welfare/recording-contributions',

  '/dashboard/cooperatives/apply': '/docs/cooperatives/applying-for-a-loan',
  M19: '/docs/cooperatives/applying-for-a-loan',

  // Member cooperatives screens (mobile M15–M20, web equivalents) and the officer queues that confirm their receipts.
  '/dashboard/cooperatives/my-savings': '/docs/cooperatives/depositing-into-your-savings',
  M15: '/docs/cooperatives/depositing-into-your-savings',
  M16: '/docs/cooperatives/depositing-into-your-savings',

  '/dashboard/cooperatives/my-loans': '/docs/cooperatives/paying-your-loan',
  M17: '/docs/cooperatives/paying-your-loan',
  M18: '/docs/cooperatives/paying-your-loan',

  '/dashboard/cooperatives/guarantors': '/docs/cooperatives/guarantors',
  M20: '/docs/cooperatives/guarantors',

  '/dashboard/cooperatives/savings-deposits': '/docs/cooperatives/approving-savings-deposits',
  '/dashboard/cooperatives/loan-repayments': '/docs/cooperatives/approving-loan-repayments',
  '/dashboard/cooperatives/loan-products': '/docs/cooperatives/loan-products',

  '/dashboard/cooperatives/applications': '/docs/cooperatives/reviewing-and-disbursing-loans',
  CP4: '/docs/cooperatives/reviewing-and-disbursing-loans',

  // Cooperatives officer screens on mobile (CP1–CP5) and their web equivalents.
  '/dashboard/cooperatives': '/docs/cooperatives',
  CP1: '/docs/cooperatives',
  '/dashboard/cooperatives/savings': '/docs/cooperatives/savings-accounts',
  CP2: '/docs/cooperatives/deposits-and-withdrawals',
  CP3: '/docs/cooperatives/loan-products',
  '/dashboard/cooperatives/loans': '/docs/cooperatives/repayments-and-schedules',
  CP5: '/docs/cooperatives/repayments-and-schedules',

  // architecture.md §15.4 originally listed `/dashboard/communication/sms`
  // (singular) for CM3 — that route is the orphaned, unreachable SMS
  // implementation (G38 in progress-tracker.md). The real, linked route is
  // plural `/dashboard/communications`, which `sending-sms.mdx` documents.
  '/dashboard/communications': '/docs/communication/sending-sms',
  CM1: '/docs/communication/sending-sms',
  CM2: '/docs/communication/announcements',
  CM3: '/docs/communication/sending-sms',
  CM4: '/docs/communication/sms-campaigns',
  CM5: '/docs/communication/sms-templates',
  CM6: '/docs/communication/sms-history',
  '/dashboard/communication/announcements': '/docs/communication/announcements',
  '/dashboard/communications/quick-send': '/docs/communication/sending-sms',
  '/dashboard/communications/campaigns': '/docs/communication/sms-campaigns',
  '/dashboard/communications/templates': '/docs/communication/sms-templates',
  '/dashboard/communications/history': '/docs/communication/sms-history',
  '/dashboard/communications/credits': '/docs/communication/buying-sms-credits',

  // Reports and exports for officers on mobile (RP1–RP7) and the web drill-down lists.
  '/dashboard/reports/charges': '/docs/reports/drilling-into-a-figure',
  '/dashboard/reports/payments': '/docs/reports/drilling-into-a-figure',
  RP2: '/docs/reports/financial-summary',
  RP3: '/docs/reports/member-balances',
  RP4: '/docs/reports/aging-analysis',
  RP5: '/docs/reports/collection-rate',
  RP6: '/docs/reports/income-by-category',
  RP7: '/docs/reports/exporting-reports',

  '/dashboard/settings/roles': '/docs/settings/custom-roles',
  ST8: '/docs/settings/custom-roles',

  '/dashboard/subscription': '/docs/plan-billing/plans-and-whats-included',

  '/onboarding': '/docs/getting-started/onboarding-wizard',
  O1: '/docs/getting-started/onboarding-wizard',
  O2: '/docs/getting-started/onboarding-wizard',
  O3: '/docs/getting-started/onboarding-wizard',
  O4: '/docs/getting-started/onboarding-wizard',
  O5: '/docs/getting-started/onboarding-wizard',

  '/dashboard/help': '/docs/help-support/in-app-help-center',
  P5: '/docs/help-support/in-app-help-center',

  '/dashboard/help/tickets': '/docs/help-support/support-tickets',
  '/dashboard/help/tickets/new': '/docs/help-support/support-tickets',
  '/dashboard/help/tickets/[id]': '/docs/help-support/support-tickets',
  P8: '/docs/help-support/support-tickets',
  P9: '/docs/help-support/support-tickets',
  P10: '/docs/help-support/support-tickets',
  ST11: '/docs/help-support/support-tickets',
};

/** The mobile app must never deep-link into plan-billing docs (architecture.md §15.4). */
export function isPlanBillingDocsPath(docsPath: string): boolean {
  return docsPath.startsWith('/docs/plan-billing');
}
