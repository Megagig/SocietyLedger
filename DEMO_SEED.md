# Demo data seed

A one-time, idempotent seed that puts a complete set of **demo tenants** into the real database, so testers can explore every module, as
every role, on web and mobile, without touching a real customer's data. Code: `apps/api/prisma/seeds/demo/`. Tests: `apps/api/__tests__/demo-seed/`.

> The older `seed:demo` script (`demo-association.seed.ts`) is the docs-screenshot fixture and is unrelated. Do not run it on production.
> This seed is `seed:demo-tenants`.

## What is seeded

Eight tenants, about 55 logins, every one flagged `is_demo`. Tenant code (the subdomain) is what mobile asks for.

| Tenant code | Name | Plan | What it shows |
|---|---|---|---|
| `demo-unity` | Unity Estate Residents Association | Enterprise | Everything: 60 members, 12 months of dues, a levy, donations (one of ₦25,000,000.00), expenses with approval, welfare funds and payouts, cooperative savings and loans, 7 meetings with attendance and minutes, a finished election, one open for voting, one taking nominations, two polls, announcements, a rotating Ajo circle |
| `demo-umuahia` | Umuahia Progressive Town Union | Professional | Dues, levy, donations, welfare, meetings, elections, polls. Cooperative and accounting are plan-gated off |
| `demo-lagoscoop` | Lagos Traders Cooperative Society | Enterprise | Savings accounts, three loans (on schedule, overdue, repaid), a rejected, a pending and a waiting-for-guarantor application, a withdrawal request, collector thrift inside the society. Welfare, elections and polls are empty on purpose |
| `demo-alumni`, `demo-grace`, `demo-club` | Alumni, church and club | Starter | Lightly populated: dues and meetings |
| `demo-balogun` | Balogun Market Ajo (standalone thrift group) | Thrift | Three rotating circles: **in progress** (10 people, ₦5,000 a round, pot ₦50,000, rounds 1-3 paid out, round 4 with 8 of 10 paid), **completed**, **not started** |
| `demo-mamangozi` | Mama Ngozi Daily Contributions (standalone thrift group) | Thrift | Collector thrift: 10 savers, 80 days of daily cash and handovers, 30-day cycles, a withdrawal with the collector fee, a saver in arrears |

Edge states: overdue and partial dues, a failed gateway attempt, a refunded payment (undone the way the app undoes a payment), a rejected
loan, a rejected welfare payout, a suspended and a pending-approval login, a very long member name, empty modules in some tenants.

Records are created through the app's own code where it can be (Ajo services, expenses service, ledger and books repair, ledger service),
and written directly only where a service needs a web request. The member ledgers and the books are derived by the app's own
`repairAssociation` (the code that runs on every container start). Dates are offsets from the day you run the seed, so the demo looks current.
Names and phones come from a fixed-seed generator, so two runs produce the same people.

### Not seeded, and why
- **Documents**: there is no association documents module in the app (only payment proofs, expense receipts and cooperative receipts, which need file storage).
- **Receipt and proof files**: they need real object storage. Expense receipt limits are raised for demo tenants so vouchers go through without files.
- **Dividends**: the cooperative module has no dividend feature.
- **Penalties, bank-transfer reconciliation, cash collections**: not populated in v1.
- **Welfare, savings and loan postings to the books**: those rows are not synced to the accounting books, so books for demo tenants include dues, levies, donations and expenses only.
- **Platform Super Admin**: deliberately not given to testers (see below).

## Logins

Passwords and every email are written to `demo-accounts.local.md` (gitignored, mode 600), listing for each account: tenant code, role,
email, situation, and what to test. Emails are `<role>.<tenant>@demo.societyledger.com.ng`; the one person who exists in two tenants
(for testing context switching) is `amaka.dual@demo.societyledger.com.ng`, in `demo-unity` and `demo-balogun`.

- All accounts share one password: `DEMO_PASSWORD` if set (min 10 characters), otherwise a generated one written only to the sheet.
- Web: `https://demo-unity.societyledger.com.ng` (the tenant's subdomain). Mobile: enter the tenant code, then email and password.
- Pending and suspended personas cannot sign in on purpose (those are the blocked states).

## Safety controls

| Control | How |
|---|---|
| Explicit trigger only | Nothing runs on deploy. It is not in the container start-up seed list. Needs `SEED_DEMO=true` |
| Backup first | On any database that does not look local, or when `NODE_ENV=production`, it refuses without `--confirm-backup` |
| Run once | A `system_seeds` row (`demo`, version 1) is written only after every integrity check passes; a second run exits and changes nothing |
| Half-finished runs | If a run fails, the next run refuses and tells you to use `--reset-demo`, which clears the partial data and starts clean |
| Demo-only writes | Every demo tenant and user has `is_demo = true`. The seed refuses to continue if a subdomain or email already exists and is not demo. `--reset-demo` deletes by following foreign keys down from `is_demo = true` rows, in one transaction |
| No emails, SMS, push | The seed process replaces every sender with a no-op, whatever the database says. At runtime, mail to `@demo.societyledger.com.ng` is dropped, SMS for demo tenants is a no-op (and uses no credits), pushes skip demo users |
| No gateway charges | Paystack/Nomba checkout, subscription checkout, add-on checkout, SMS-credit and AI-credit purchases return 403 `DEMO_*` for demo tenants. (There is no gateway test mode in the app, so this is a block, not a simulated success.) Seeded payments carry `DEMO-` references and receipts |
| No billing | Demo subscriptions are `ACTIVE`, complimentary, ending 2099, plus a `BYPASS_BILLING` override. Billing emails go to demo-domain addresses and are dropped |
| Out of analytics | Platform statistics (tenant, user, member and subscription counts and tier mix) exclude `is_demo`. Demo tenants have no payment history, so revenue is unaffected |
| Abuse limits | Demo tenants cannot change passwords or reset them, send SMS, send member invites, create members with a non-demo email, or upload more than 1 MB |
| Tenant isolation | Tokens are tenant-bound (the existing check). Tests prove demo users cannot read a real tenant and a real user cannot read demo data |

### Platform Super Admin
Testers get **no** platform Super Admin on production: it would expose real customers. To test the admin console (`admin.societyledger.com.ng`),
use a staging environment where you run this seed and create a Super Admin there. A restricted "demo platform viewer" role was proposed but not built.

## Run it

Required in the API container's environment (already present in production): `DATABASE_URL`, `TOTP_ENCRYPTION_KEY` (Ajo encrypts group bank
details with it), and the reference seeds having run (roles, modules, plans, Ajo add-ons: they run on every start).

### 1. Back up first
```bash
# On the Dokploy host. Writes a custom-format dump you can restore with pg_restore.
docker exec societyledger-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/pre-demo-seed.dump'
docker cp societyledger-postgres:/tmp/pre-demo-seed.dump ./pre-demo-seed-$(date +%F).dump
ls -lh ./pre-demo-seed-*.dump    # check it is not empty, and copy it off the server
```
To restore if needed: `pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists pre-demo-seed.dump`.

### 2. Deploy this branch, then see the plan (writes nothing)
```bash
docker exec societyledger-api node_modules/.bin/tsx prisma/seeds/demo/index.ts --dry-run
```

### 3. Run it once
```bash
docker exec -it societyledger-api sh -c 'SEED_DEMO=true DEMO_PASSWORD="choose-a-strong-shared-password" \
  node_modules/.bin/tsx prisma/seeds/demo/index.ts --confirm-backup --credentials-out=/tmp/demo-accounts.local.md'
```
It takes about 8 minutes on a laptop (allow 15 on the server) (the Ajo history goes through the real services). The log shows each tenant and the integrity checks; it
never prints passwords. Then fetch the sheet and delete it from the server:
```bash
docker cp societyledger-api:/tmp/demo-accounts.local.md ./demo-accounts.local.md
docker exec societyledger-api rm /tmp/demo-accounts.local.md
```

### Local or staging
`SEED_DEMO=true pnpm -F @societyledger/api seed:demo-tenants` (add `-- --dry-run`, `-- --only=alumni,balogun` to limit tenants).

## Reset the demo data
Deletes **only** `is_demo` records and the seed marker, then seeds again:
```bash
docker exec -it societyledger-api sh -c 'SEED_DEMO=true DEMO_PASSWORD="..." \
  node_modules/.bin/tsx prisma/seeds/demo/index.ts --reset-demo --confirm-backup --credentials-out=/tmp/demo-accounts.local.md'
```
It asks you to type `DELETE DEMO DATA` (or set `DEMO_RESET_CONFIRM` to that phrase when there is no terminal). `--reset-demo --dry-run`
prints how many rows it would delete. Reset also restores every demo password and email, so testers cannot lock themselves out.

## Adding data for new features (seed version 2)
1. Add the new data as its own function in `prisma/seeds/demo/` (a new file per feature), taking `(ctx, tenant)` like `seedWelfare`.
   Create it through the feature's service where possible and give anything that can leave the building (references, receipts) a `DEMO-` prefix.
2. Call it from `run.ts` in tenant order, add its records to `invariants.ts` if it holds a balance, and to `config.ts` if it needs a persona or module flag.
3. Bump `SEED_VERSION` to `2` in `config.ts` and make the run for v2 do **only** the new step for tenants that already exist (look the tenant up by
   `subdomainOf()`, the same find-or-create used by `ensureTenant`). v1 stays recorded in `system_seeds`, so nothing recreates it.
4. Add the new counts to the tests, then run `--dry-run` and the test suite on a copy of production before the real run.

## Tests
```bash
# Unit: gates, guard middleware, determinism, no hard-coded passwords. No database.
pnpm -F @societyledger/api exec jest __tests__/demo-seed/demo-seed.unit.test.ts --forceExit

# Integration: needs a scratch database with all migrations and the reference seeds applied.
DEMO_TEST_DATABASE_URL=postgresql://.../sl_demo_test TOTP_ENCRYPTION_KEY=<32+ chars> \
  pnpm -F @societyledger/api exec jest __tests__/demo-seed/demo-seed.integration.test.ts --forceExit
```
The integration run seeds three tenants, then checks: dry run writes nothing; a second run changes nothing; all integrity invariants pass;
a fingerprint of every non-demo row is identical before and after seeding and after reset; every seeded login behaves as designed and its
permissions equal its role's; a collector-thrift saver sees only their own records and the circle board is refused for them; a rotating-circle
member sees all 10 people; demo and real tenants cannot see each other; the abuse limits return 403.
