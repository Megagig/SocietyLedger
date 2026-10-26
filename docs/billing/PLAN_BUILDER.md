# Plan Builder, subscriptions and entitlements

How plans, prices and access work, how to deploy the change, and how to test it.

## How it works

- **The database is the only source of plans.** The landing page, homepage, pricing page, plan chooser and checkout all read the same API (`GET /api/public/pricing` and `GET /api/subscriptions/plans`). The web app has no plan or price written in it; a test fails if one is added.
- **Plans are versioned.** A plan's name and copy can change at any time. Its prices, limits and the modules and features it includes change by publishing a new version from a draft. A subscription stays on the version it was sold on until you migrate it (Plans, Migrations tab).
- **Prices are whole kobo.** The server prices every checkout. The browser sends only the plan, interval and add-ons.
- **Access is time-based.** Whether an association can use the app is decided on each request from its stored period end and the server clock, plus the grace period setting. The hourly job only tidies status and sends mail.
- **Only a verified, matching payment activates.** `activateFromPayment` is the single path. The amount Paystack confirms must equal the quote stored at checkout, and a payment can be applied once however many times it is reported. A mismatch is kept on the "Payments needing attention" tab.
- **Staff actions need a reason** (10+ characters) and are written to the platform action log.

## Deploying

1. The API container runs `prisma migrate deploy` on start, which applies `20261104_plan_versions_addons_terms`. It copies each existing plan into version 1 and links every subscription to it. Plans still at the old default prices (5,000 / 15,000 / 35,000) are set to the launch prices (8,000 / 10,000 / 15,000 a month); a plan you edited keeps its price.
2. The entrypoint then runs the seeds. `plans.seed.ts` only creates a plan that does not exist yet, so it never undoes what you publish.
3. Optional variables (all in `.env.dokploy.example`):
   - `WEB_REVALIDATE_URL` and `REVALIDATE_SECRET` (same secret on the API and web services) so a publish updates the website at once. Without them, pages catch up within about a minute.
   - `SUBSCRIPTION_NOMBA_ENABLED=true` to offer Nomba at subscription checkout again once its KYC is done.
   - `FEATURE_FLAG_MODE=shadow` only as an emergency switch. Modules and features are enforced by default.

Things that behave differently after this change: modules and features are enforced from the plan version; the member limit is enforced when adding members one at a time or by bulk import; a returning association can no longer start a self-service trial (the onboarding policy decides what a new association is given).

## Testing

Unit tests run with `pnpm -F @societyledger/api test`. The database suites in `apps/api/__tests__/billing/*.integration.test.ts` need a migrated, disposable database whose name contains `test`:

```
createdb sl_billing_test
DATABASE_URL=postgresql://USER:PASS@localhost:5432/sl_billing_test DIRECT_URL=<same> pnpm -F @societyledger/api exec prisma migrate deploy
BILLING_TEST_DATABASE_URL=postgresql://USER:PASS@localhost:5432/sl_billing_test pnpm -F @societyledger/api exec jest __tests__/billing
```

Without `BILLING_TEST_DATABASE_URL` those suites are skipped. If the migration history cannot build a database from scratch, create the database from the schema with `prisma db push` and apply the migration SQL by hand, as was done when this was built.
