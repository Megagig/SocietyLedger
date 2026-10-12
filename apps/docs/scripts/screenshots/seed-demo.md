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

```bash
# Against whichever database apps/api's DATABASE_URL currently points to.
pnpm -F @societyledger/api seed:demo
```

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

**Unverified** — written against the real `schema.prisma` field names and
type-checked against the generated `@prisma/client` types (zero errors),
but never actually run against a database. Run it yourself and read the
console output before trusting it; if a `prisma.<model>.create` call fails,
the model names and required fields above should get you most of the way
to the fix, but Prisma unique-constraint or FK-ordering issues can only
surface at runtime, not at the type level.
