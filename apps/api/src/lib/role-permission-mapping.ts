/**
 * The single source of truth for which permission keys each default system role gets.
 * Shared between `prisma/seeds/rbac-seed.ts` (re-seeding existing associations) and
 * `associations.controller.ts`'s `signup()` (new associations) — these two previously
 * maintained independent, drifted copies (G66): signup's own copy was missing an entire
 * `financial_secretary` role and roughly a dozen permissions per role that rbac-seed.ts
 * already had, so every association created through real signup was under-permissioned
 * compared to one seeded directly.
 */
export const ROLE_PERMISSION_MAPPING = {
  admin: [
    "members.view", "members.view_all", "members.view_own", "members.create", "members.edit", "members.edit_all", "members.edit_own",
    "members.disable", "members.bulk_import", "members.manage_roles",
    "ledger.view", "ledger.view_all", "ledger.view_own", "ledger.create", "ledger.edit", "ledger.reverse",
    "ledger.export", "ledger.view_member_statement",
    "payments.view", "payments.view_all", "payments.view_own", "payments.manual_create", "payments.approve", "payments.delete",
    "payments.nigerian.view", "payments.nigerian.record", "payments.nigerian.verify", "payments.nigerian.reconcile", "payments.nigerian.import",
    // Cash collected at meetings: collect, lodge into the bank, verify a lodgment (never your own), view it.
    "cash.collect", "cash.lodge", "cash.verify", "cash.view",
    "reports.generate", "reports.export", "reports.financial_summary",
    "roles.view", "roles.create", "roles.edit", "roles.assign", "permissions.manage",
    "settings.view", "settings.edit", "settings.billing", "settings.integrations",
    "audit.view", "audit.export",
    "communication.sms.view", "communication.sms.send", "communication.sms.campaign", "communication.sms.template",
    "notifications.view", "notifications.send",
    "exports.financial", "exports.members", "exports.view_history",
    "meetings.manage_minutes", "meetings.manage_attendance",
    "elections.view_own", "elections.nominate_own", "elections.vote_own", "polls.view_own", "polls.vote_own",
    // Officers are members too: they can declare a deposit into their own savings.
    "cooperatives.savings_deposit_own", "cooperatives.repay_own",
    "system.cron.view", "system.cron.trigger",
    "help.view", "help.manage", "support.create", "support.view_own", "support.view_all", "support.manage", "support.respond", "support.escalate"
  ],
  treasurer: [
    "members.view", "members.view_all",
    "ledger.view", "ledger.view_all", "ledger.create", "ledger.edit", "ledger.export",
    "ledger.view_member_statement",
    "payments.view", "payments.view_all", "payments.manual_create", "payments.approve",
    "payments.nigerian.view", "payments.nigerian.record", "payments.nigerian.verify", "payments.nigerian.reconcile", "payments.nigerian.import",
    // Cash collected at meetings: collect, lodge into the bank, verify a lodgment (never your own), view it.
    "cash.collect", "cash.lodge", "cash.verify", "cash.view",
    "reports.generate", "reports.export", "reports.financial_summary",
    "exports.financial", "exports.members", "exports.view_history",
    "meetings.manage_minutes", "meetings.manage_attendance",
    "elections.view_own", "elections.nominate_own", "elections.vote_own", "polls.view_own", "polls.vote_own",
    // Officers are members too: they can declare a deposit into their own savings.
    "cooperatives.savings_deposit_own", "cooperatives.repay_own",
    "communication.sms.view",
    "notifications.view",
    "settings.view",
    "help.view", "support.create", "support.view_own"
  ],
  financial_secretary: [
    "members.view", "members.view_all",
    "ledger.view", "ledger.view_all", "ledger.create", "ledger.edit", "ledger.export",
    "payments.view", "payments.view_all", "payments.manual_create",
    "payments.nigerian.view", "payments.nigerian.record", "payments.nigerian.reconcile", "payments.nigerian.import",
    // Cash collected at meetings: collect, lodge into the bank, verify a lodgment (never your own), view it.
    "cash.collect", "cash.lodge", "cash.verify", "cash.view",
    "reports.generate", "reports.export", "reports.financial_summary",
    "exports.financial", "exports.members", "exports.view_history",
    "meetings.manage_minutes", "meetings.manage_attendance",
    "elections.view_own", "elections.nominate_own", "elections.vote_own", "polls.view_own", "polls.vote_own",
    // Officers are members too: they can declare a deposit into their own savings.
    "cooperatives.savings_deposit_own", "cooperatives.repay_own",
    "communication.sms.view",
    "notifications.view",
    "settings.view",
    "help.view", "support.create", "support.view_own"
  ],
  member: [
    "members.view_own", "members.edit_own",
    "ledger.view_own",
    "payments.view_own",
    "payments.nigerian.view",
    "reports.generate",
    "notifications.view",
    "exports.view_history",
    "elections.view_own", "elections.nominate_own", "elections.vote_own", "polls.view_own", "polls.vote_own",
    "welfare.view_own", "welfare.request_own",
    "cooperatives.view_own", "cooperatives.apply_own", "cooperatives.guarantor_own", "cooperatives.savings_deposit_own", "cooperatives.repay_own",
    "help.view", "support.create", "support.view_own"
  ]
} satisfies Record<string, string[]>;
