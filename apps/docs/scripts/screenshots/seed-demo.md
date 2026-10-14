# Seeding the demo association (D1.6)

The screenshot pipeline captures real app UI, so it needs a real tenant
with real-looking (entirely fictional) data behind it — never production
data or real member PII (`architecture.md §14.12` rule 4).

**Staging/local only. Never run this against production.**

## What it creates

`apps/api/prisma/seeds/demo-association.seed.ts` creates one association
(`subdomain: demo`, name "Umuoji Cooperative Society") with:

- 60 members (Nigerian names), the first 3 of which are the named personas
  behind the three demo logins below, matching the fictional names
  `code-standards.md §17.1` already uses in docs prose examples
  (Adaeze Okafor, Tunde Bakare, Ngozi Eze).
- 12 months of dues per member (2026), ₦5,000/month, across 4 payment-status
  buckets so finance/report screenshots show a believable mix: fully paid
  (most members), a slow payer (some overdue + some not-yet-due), a later
  payer, and a few partial payers.
- A levy campaign ("Building Fund Levy 2026") assigned to all 60 members,
  40 paid / 20 pending.
- An election ("2026 Executive Committee Election") in `NOMINATIONS_OPEN`
  status with 3 positions and 4 candidates (one still pending approval).
- Two meetings: a completed AGM (June 2026) and an upcoming quarterly
  meeting (November 2026).
- A cooperative loan product, one disbursed loan (partway through
  repayment).
- A welfare fund with 10 confirmed contributions and one disbursed payout.

Every date is a fixed, absolute value (`2026-...`), never computed from
the real current time — required for deterministic screenshots
(`architecture.md §14.7`). The Playwright config
(`capture.config.ts`) additionally freezes the browser's clock to a fixed
instant during capture, so the app's own "3 days ago"-style relative-time
text doesn't drift between runs either — fixed seed dates alone aren't
enough for that, since the app computes those relative to the real clock
at the moment it's viewed.

## Running it

Run the base seed **first**, then this one — in that order:

```bash
# Against whichever database apps/api's DATABASE_URL currently points to.
pnpm -F @societyledger/api db:seed    # base data: plans, RBAC, platform modules, super admin (must be id=1)
pnpm -F @societyledger/api seed:demo  # this association, on top
```

`db:seed`'s super-admin step is `prisma.user.upsert({ where: { id: 1 }, ... })` —
on a fresh database it creates `megagigdev@gmail.com` as the platform super
admin. If `seed:demo` runs first, it takes `id: 1` for `admin@demo.com`
instead, and the base seed's upsert then just grants *that* tenant admin
`platformRole: SUPER_ADMIN` rather than creating the real platform account —
no error, just a quietly wrong account. Found by running both for real
against a local database for the first time (2026-10-12).

Idempotent for the association and the three login users (safe to re-run
without duplicating those). **Not** idempotent for the bulk data — members,
transactions, the election, etc. are created unconditionally, so re-running
after a successful seed duplicates them. To reseed, delete the `demo`
association's rows first (cascades through its tenant-scoped data) or
restore a database snapshot, then re-run.

## Demo logins

| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.com` | `password123` |
| Treasurer | `treasurer@demo.com` | `password123` |
| Member | `member@demo.com` | `password123` |

Same credentials `apps/api/scripts/create-demo-admin.ts` already uses for
`admin@demo.com` — running that script after this one is a harmless no-op
(it finds the user already exists).

## What's not seeded yet

Savings accounts, loan guarantors, and repayment schedules aren't created
— nothing in D1.6's sample flow (the dashboard) needs them. Add them here
if a later docs section (e.g. D4.4 Cooperatives) needs a screenshot that
depends on one.

## Status

**Verified** — run for real against a local database at D2.1 (2026-10-12).
Two bugs found and fixed:

- The two `Meeting.create()` calls passed a date-*and*-time string (e.g.
  `'2026-06-14T10:00:00'`) through the `utc()` helper, which appends its
  own `T00:00:00.000Z` — every other call site passes a date-only string,
  so this produced a malformed, invalid `Date`. Fixed by constructing
  those three timestamps directly (`new Date('2026-06-14T10:00:00Z')`)
  instead of routing them through `utc()`.
- `ensureUser()` set `isActive: true` and an `approved` `userApproval`,
  but never `emailVerified: true`. Login requires email verification, so
  **none of the three demo logins could actually sign in** — a real
  blocker for the Playwright capture pipeline, not just a cosmetic gap.
  Fixed by setting `emailVerified: true` in `ensureUser()`. If you seeded
  before this fix, patch the existing rows directly rather than
  reseeding (the bulk data isn't idempotent):
  `UPDATE users SET email_verified = true WHERE email IN ('admin@demo.com','treasurer@demo.com','member@demo.com');`
