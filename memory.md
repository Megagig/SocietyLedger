# Memory — Mobile Phase 4 groundwork (cooperatives API + web + docs)

Last updated: 2026-10-21, evening

## What was built

Phase 4 (F4.1–F4.5, "Cooperatives & support") was architected, then the whole **API + web + docs groundwork** was built so mobile can follow. **No mobile screens exist yet; F4.1–F4.5 are NOT ticked in `context/progress-tracker.md`** (a "Phase 4 backend groundwork" note sits above them). `ui-registry.md` has a "Cooperatives savings & loans" web section.

**API (apps/api)**
- Own-scoped permissions `cooperatives.view_own | apply_own | guarantor_own | savings_deposit_own | repay_own` (`lib/permissions.ts`, `role-permission-mapping.ts`, `rbac-seed.ts`). Member gets all five; admin/treasurer/financial_secretary get the last two. Backfill: `scripts/grant-member-cooperatives-permissions.ts` (**run on dev only**).
- `cooperatives.controller.ts`: `canSeeAllCooperatives` (members.view_all / either manage key) — loans, applications, savings txns, repayments, deposits, repayment requests are server-scoped to the caller's member; single-record GETs 404 others'. Closed two money holes: `POST /savings-transactions` and `POST /loan-repayments` were open to `ledger.view`, now officer-only.
- Savings deposits by receipt: `SavingsDepositRequest` (migration `20261021_add_savings_deposit_requests`); `POST/GET /cooperatives/savings-deposits`, `/:id/receipt?format=json`, `/:id/approve`, `/:id/reject`. Claim-then-credit, reverts to PENDING on failure, in-app notification to member.
- Loan repayments by receipt: `LoanRepaymentRequest` (migration `20261021_add_loan_repayment_requests`); same shape under `/loan-repayment-requests`. Capped at outstanding (checked at submit and approve); approve calls `processLoanRepayment`.
- Savings-to-loan rule + lien: reuses existing `LoanProduct.maxLoanToSavingsRatio` (2 = up to twice savings), new `lockSavings`; `SavingsLien` (migration `20261021_add_savings_liens`); logic in `modules/cooperatives/savings-lien.ts`. Hold = principal ÷ ratio at disbursement, released pro-rata with principal repaid; rule checked on apply, approve, disburse against *available* savings (balance − liens); held savings can't be withdrawn. `/my-profile` returns `lockedSavings`/`availableSavings`.
- `GET /cooperatives/guarantor-candidates?search=` (names only) — members can't list `/members`.
- Tests: `__tests__/cooperatives/{cooperatives-scoping,savings-deposit.service,savings-lien,loan-repayment-request.service}.test.ts` (all pass; 83 across cooperatives+welfare+meetings).

**Web (apps/web)**
- `my-savings` rebuilt (receipt-upload deposit, My Deposits, held vs available, activity; direct Deposit/Withdraw removed). `my-loans`: Pay Now (receipt upload) + My Payments; officers keep Record Payment. New officer queues `/dashboard/cooperatives/savings-deposits` and `/loan-repayments` (+ Sidebar/AdminSidebar entries). `loan-products` now editable with Savings rule (multiplier + hold switch). `apply` shows borrowing limit/held amount, guarantor search via candidates endpoint.
- `/dashboard/cooperatives` landing: officers (`ledger.view`/`payments.approve`) get the old dashboard; everyone else gets new `MemberOverview.tsx`; "Overview" link added to `MemberSidebar`.

**Docs (apps/docs)** — 5 new pages under `content/docs/cooperatives/` (depositing-into-your-savings, approving-savings-deposits, paying-your-loan, approving-loan-repayments, savings-rule-and-held-savings), registered in `scripts/sitemap-data.ts` + `meta.json`; fixed now-false text in loan-products, applying-for-a-loan, repayments-and-schedules, reviewing-and-disbursing-loans, deposits-and-withdrawals, member-guide/savings-and-loans, cooperatives-welfare-faq; release-notes entry; reference pages regenerated (fixed `scripts/reference/build-permissions.ts` path to `src/lib/role-permission-mapping.ts`). Build, `check:frontmatter` (204/0 failed), `check:links` (390/0 broken) all pass.

## Decisions made

- Savings deposits and loan repayments are **never self-credited**: member uploads receipt → pending → officer confirms money landed → only then the balance/loan moves (owner-approved, incl. repayments).
- **Lien (hold), not debit**: savings stay in the account; per-loan-product multiplier set by each cooperative's admin in Loan Products. No extra "lien amount" setting — derived as principal ÷ multiplier.
- Officer approval of mobile-side deposits/repayments stays web-only for now (mobile officer tooling is Phase 5/6).
- Don't run `prettier --write`; edit CRLF files via scripts/Edit, not shell one-liners (scratch helpers lived in the session scratchpad).

## Problems solved

- "No visible change / `…is not a function`" in the browser = **web dev server (Next, port 3000) running since before the edits**; fix is stop it, `rm -rf apps/web/.next`, `pnpm -F @societyledger/web dev`, hard refresh. Happened twice.
- `prisma generate` EPERM on `query_engine-windows.dll.node` = a node process (stray Jest / dev server) holding the DLL; stop it, regenerate, restart API (API port is **4001**, web 3000, subdomain `oko-youth-forum`).
- Members couldn't use cooperatives at all: web mapped to `ledger.view_own` but API required `ledger.view`; and couldn't pick guarantors (`GET /members` needs `members.view`).
- Docs `check:links` validates against `scripts/sitemap-data.ts`, not `out/` — new pages must be registered there.

## Current state

All of the above is implemented and unit/type/build-checked; **nothing has been click-tested in a browser**. The user was about to restart the web dev server to confirm the landing-page 403 (`/cooperatives/dashboard`) is gone for a member (DB shows that member has no officer keys, so the new page shouldn't call it). The test member (turningpointcodes@gmail.com, tenant 15 Oko Youth Forum) has **no savings account** — an officer must create one (All Savings) and set a product's multiplier before the new UI shows. Docs new pages use `<Screenshot pending>` placeholders and `lastVerified: 2026-10-21` though steps were not click-verified. Nothing is committed.

## Next session starts with

1. Ask the user how their click-through went (checklist: officer creates savings account + sets multiplier 2 → member deposits with receipt → officer approves → apply shows ₦200k limit → disburse holds ₦100k → member pays loan with receipt → officer approves → hold releases). Fix what breaks.
2. Before docs deploy: capture the pending screenshots and click-verify the steps in the 5 new docs pages.
3. Then mobile F4.1–F4.5 (Savings, Loans & apply, Guarantor requests, Help center, Support tickets), reusing `useModuleAccess`/`useMemberId`/`ModuleLockedScreen`/`NoMemberProfile`/`ErrorState`; mobile savings/loan screens must follow the receipt-upload + lien model above. Tick tracker + update ui-registry per feature.

## Open questions

- Run `grant-member-cooperatives-permissions.ts` (and the earlier welfare one) on every non-dev environment before release.
- `multi-tenancy/subdomain` and `isolation` Jest suites fail (full-server integration tests against dev DB); cause never investigated, and they must not be run casually (they write to the dev DB).
- Web aliases `COOPERATIVE_SAVINGS_MANAGE` to `payments.approve`, so a financial secretary (API allows) won't see the Savings Deposits sidebar item — pre-existing alias mismatch.
- Poll detail still lacks per-option results; whether Money/Profile tabs get `popToTopOnBlur` (only Community has it).
