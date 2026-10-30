# Memory: Thrift/Ajo, T11 docs, standalone-group alignment, payments, payout order (2026-10-30)

Last updated: 2026-10-30

> Replaces the earlier "T8 mobile follow-ups and transparency work" memory (that work is in `context/progress-tracker.md` and `context/thrift-ajo-spec.md`). No secrets here. Nothing below was run in a browser or on a phone unless it says so.

## What was built (all recorded in `context/progress-tracker.md`)

- **T11 Documentation:** 31 pages under `apps/docs/content/docs/ajo-thrift/` (six sidebar groups), registered in `scripts/sitemap-data.ts`; demo seed `apps/api/prisma/seeds/demo-ajo.seed.ts` (+ `_demo-stubs.ts`), screenshot flow `scripts/screenshots/flows/ajo-thrift.ts` (~42 shots), reference pages regenerated. Review fixes done. Docs checks and build pass.
- **Account kind in the session (Track T-A):** API puts `kind` (ASSOCIATION | THRIFT_GROUP) on `req.tenant` (login and `/auth/me`); web `user.association.kind`, mobile `SessionUser.tenantKind`; `useAjoNav().thriftOnly` is known from first render (no association flash). Mobile: landing = Thrift tab, route guard `thriftRouteGuard.ts`, Circle tab for members AND officers of a rotating pot (`useRotatingCircles`, `mergeRotatingCircles`), thrift-only person screen. Web: `ThriftHome` (the dashboard for a standalone group; **no redirect**), `thriftScope.ts` route allow-list, trimmed Settings, own sidebar (Thrift Home, My Thrift with circles and boards, My Payments, Payments with waiting badge, People, Settings), breadcrumbs say "Thrift circles / <name>".
- **Roles in a standalone group:** `apps/api/src/lib/thrift-roles.ts`; roles carry no `welfare.`/`cooperatives.` permissions (migration `20261122_thrift_group_role_permissions`), roles list hides treasurer / financial_secretary / election_committee and names Officer / Collector.
- **Screens for every API (Track T-A TA.4/5/6):** member cases + "Add your explanation", My payouts, officer prepare-all payouts, "Check again" on a turned-down payout check, on-time record column, send waiting receipts, per-person Circles card (`GET /ajo/members/:memberId/circles`), 83 server messages now say "circle", invitation email worded for standalone groups.
- **Payments (Track T-B):** `POST /ajo/groups/:id/contributions/record-received` (confirm permission; bank reference + note required; own payment refused; marks `selfConfirmed`, label `recordedByOfficer`), `GET /ajo/payments/waiting` and `/waiting/count`; web `/dashboard/ajo/payments`, `/dashboard/my-thrift/payments`, `RecordPaymentDialog`, shared `ConfirmPaymentDialog`; mobile `manage/thrift/payments.tsx`, `money/thrift/payments.tsx`, `RecordPaymentSheet`. Collector role unchanged by owner decision (records cash; officer handover count confirms it).
- **Payout order (Track T-C):** migration `20261123_ajo_order_method` (`AjoOrderMethod` RANDOM_DRAW | ADMIN_SET, `ajo_groups.order_method`, order event type ADMIN_SET); `setOrderByAdmin`, `verifyOrder`, pure `verifyDraw` (new draws save `atRiskMembershipIds`); order response has `current/stale/staleBecause/canDraw/canSet/method/madeBy/reason/verifiable/pendingPeople`; web+mobile: method choice (wizard, Edit settings), Payout order page with out-of-date notice and **Draw again**, admin editor (move up/down + required reason), member `PayoutOrderCard` with **Verify this draw**; warning before drawing while people are unapproved.
- **Smaller fixes:** rules publish sent flat body (now `{ rules }`); start-date change in Edit settings; Circle board card on the circle overview (web+mobile) with on/off and "turns on <date>", and the member "not on yet" message now carries the date; collector/officer checkbox `e.currentTarget` bug in admin forms.

## Decisions made (owner-approved)

- "Circle" is the main word, "Thrift" the product area; a standalone group has its own home, menus, People, Settings and wording; association with the add-on keeps the Circle board under My thrift.
- Payments: one Payments entry per role; officers who can confirm may record a payment already seen at the bank (one step, guardrails above); manage-only officers' form records it as Reported.
- Payout order: automatic recorded draw stays the default and untouched; admin-set is a second per-circle option, approve-payout permission only, reason 10+ characters, locked once the circle starts, same out-of-date rule.
- Rule changes (including the board on/off) need 7 days' notice; owner was offered an instant switch for open circles and has not decided.

## Problems solved (do not repeat)

- Dev DB has drift: apply migrations with `docker exec -i societyledger-postgres psql -U user -d societyledger < migration.sql` (needs `-i`) then `prisma migrate resolve --applied <name>`; scratch DB `sl_ajo_test` with `migrate deploy`. Run Ajo tests with `AJO_TEST_DATABASE_URL` (the dev URL with the database name swapped, never printed) and `--forceExit --runInBand`.
- `prisma generate` hits EPERM while the user's dev API runs; the types still regenerate, the engine file does not.
- The Windows shell mangles big heredocs and escaped regexes: write patch scripts with the Write tool; page `.mdx` alt text must not contain double quotes.
- Docs link checker validates against `scripts/sitemap-data.ts`, not the files on disk.
- A web client test that mocks `@/lib/axios` and asserts the request body catches wrong-shape bugs (found the rules publish bug).

## Current state

- Last full runs: API Ajo + RBAC suites 871 pass (47 suites incl. integration); web 53; mobile Ajo+session 113; docs checks and build pass. Pre-existing, untouched: 3 mobile member-row suites and 2 multi-tenancy suites fail identically without these changes.
- **Not verified live:** every screen above in a browser or on a phone; docs screenshots for payments, payout order, record-a-payment, board card, person Circles card; a standalone demo tenant for screenshots does not exist.

## Next session starts with

1. Ask the owner what they want for the mobile **Manage** and **Circle** tabs (see open question), then run `/architect` again. Do not build before they confirm.
2. Have the owner test: start the Opemulero circle (approve everyone, set or draw the order, start), report a transfer as a member, confirm as admin, record a payment as officer, check the Payout order section as a member, and the board turn-on date (6 Nov 2026 for version 2).

## Open questions

- **Mobile Manage and Circle tabs:** the owner said my reading was wrong and halted it. The Manage tab shows an empty "Officer hub, arrives in the next releases" for someone who holds a manage-list permission but no hub entry (tab list `MANAGE_TAB_PERMISSIONS` and the hub's `can*` checks disagree); the Circle tab shows nothing when the board is off. The owner has not said what they want.
- Instant (no-notice) Circle board switch for an open circle: undecided.
- Member names on the payout order are full names (the Circle board uses first name and initial): confirm which is wanted.
- F7 (standalone sign-up closed by default) and F8 (Enterprise price) remain "owner to confirm".
