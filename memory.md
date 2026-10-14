# Memory — SocietyLedger: Docs D6 complete, Track R (Gap Remediation) created

Last updated: 2026-10-14

## What was built

**Docs Phase D6 (Reference, integration & launch) — D6.1–D6.3 shipped, D6.4 handed off to the owner.**

- **D6.1 Reference pages**: `apps/docs/scripts/gen-reference.ts` rewritten (was a stub) to generate `permissions`/`statuses`/`payment-methods`/`modules-by-plan` by **statically parsing** `apps/api` source — never importing/executing it (no DB/env dependency). New `apps/docs/scripts/reference/` module: `parse-ts-const.ts` (TypeScript-compiler-API literal evaluator), `parse-prisma-enums.ts`, `build-permissions.ts`, `build-statuses.ts`, `build-payment-methods.ts`, `build-modules-by-plan.ts`, `render.ts`. `release-notes.mdx` hand-written as an empty template. All 5 reference pages published.
- **D6.2 Troubleshooting & FAQ**: 8 of 9 pages published (`mobile-app-faq` stays draft until D7), H2-per-question template, grounded entirely in already-verified D1–D5 content/gaps. Backfilled two already-published pages (`member-guide/notification-preferences.mdx`, `core-concepts/notifications-and-channels.mdx`) that contradicted the known G42 finding. Added `apps/docs/scripts/search-test.json` (30 queries).
- **D6.3 Web integration**: `packages/shared/src/docs-links.ts` (first real consumer of the previously-unused `@societyledger/shared` package — added as a workspace dependency to `apps/web`, transpiled via `next.config.js`), `apps/web/src/lib/docs.ts` (`docsUrl()` + dynamic-route-matching `getHelpDocsPath()`), `apps/web/src/components/docs/HelpLink.tsx`. Header/Footer docs links now external; `next.config.js` redirects `/documentation*` to the docs site; "User manual" link added to `Sidebar.tsx`/`MemberSidebar.tsx`; Help Center card + onboarding link added; `HelpLink` wired into all 25 mapped dashboard page headers.
- **D6.4 Launch**: only the non-browser-dependent checks done (zero drafts outside mobile-only exception, zero pending screenshots) — everything else (full QA, Lighthouse, real search-test run, starting production Dokploy, Search Console/Bing submission, the announcement) needs a real browser or the owner's direct action. **Confirmed handed off** — owner will return to D7 after mobile M2.

**Track R — Gap Remediation (new, owner-requested 2026-10-14).** Every open Backend gap organized into 7 strictly-sequential phases, inserted into `build-plan.md`'s Master sequence **between Docs D6 and Admin A1** (orders 7–13, everything after renumbered). Full detail in `build-plan.md`'s "Track R" section; checklist mirrored in `progress-tracker.md` before Track A.
- **R0 — Decisions needed** (6 items, nothing else starts until these are made): module/plan gating enforcement (G13), member `_own`-permission scope (G16), member payment verification model (G17), behavioral settings scope (G53), SMS implementation direction — delete orphaned vs rewrite linked (G38), tenant self-registration approval screen (G65)
- **R1 — Security, financial integrity & tooling** (6): fix `apps/api`'s broken type-check first (G69), export RBAC (G25), meeting-minutes auth (G26), free SMS credits (G41), false accounting banner (G45), self-signup enforcement (G52)
- **R2 — Governance core functionality** (7): voting dead-end (G28), candidates (G29), results (G30), meeting lifecycle/edit (G27), election/poll edit links (G31), turnout (G32), member my-meetings/my-voting (G19)
- **R3 — Communication & notifications** (6): scope set by R0's SMS decision (G38), payload fixes (G39), campaign message box (G40), payment reminders (G43), duplicate announcement page (G44), notification preferences (G14/G42)
- **R4 — Settings & billing correctness** (5): downgrade timing (G54), PAST_DUE (G55), trial claim (G56), audit log (G51), member ID format (G20)
- **R5 — Accounting completeness** (5): welfare/coop sync (G46), periods (G47), double-posting (G48), dead code (G49), unmapped categories (G50)
- **R6 — Remaining functional gaps & hygiene** (16 items) → **Milestone RL: gap log clear**

The 9 old "Known issues" bullets were folded into the Backend gaps table as **G64–G72**; G6 marked resolved (D6.3 shipped its fix). Excluded from Track R (already closed/accepted/sequenced elsewhere): G2, G4, G5, G6, G7, G8, G9, G10, G11, G12, G61–G63.

## Decisions made

- **Reference-page generator statically parses `apps/api` source via TS-AST/regex, never imports/executes it** — `apps/docs` has no workspace dependency on `apps/api`, and seed files instantiate `PrismaClient` at module scope, so importing would need a DB/env this script must not depend on.
- **Permissions reference sources from seed-file registries (`rbac-seed.ts` + `help-permissions.seed.ts`), not `permissions.ts`** — the latter is legacy aliases only; cross-referencing found 11 dead constants (now G57) and no other drift.
- **Statuses reference includes every `schema.prisma` enum ending in `Status` except a small platform/CMS exclusion list** (`WebhookEventStatus`, `PostStatus`, `CommentStatus`, `DocStatus`).
- **Payment methods reference documents the six-value lowercase canonical set** (3 of 4 source modules agree); `member-finance.controller.ts`'s divergent uppercase+POS set logged as G58, not reconciled.
- **D6.3's link map had two stale entries, corrected rather than copied verbatim**: CM3 pointed at the orphaned `/dashboard/communication/sms` (G38) — fixed to the real `/dashboard/communications`; the bank-transfer route was paired with the member-facing doc but is actually the officer's screen — fixed to `/docs/payments/recording-bank-transfers`.
- **Track R is fully sequential and owner-approved to edit `apps/api`/`apps/web` beyond architecture.md rule #14's usual mobile/admin-only restriction**, specifically for this remediation work. Severity-first phase ordering (security/financial first) with all product-decision gaps front-loaded into R0, chosen by the owner over domain-grouped or chronological alternatives.
- **Admin Phase A1 does not start until Track R reaches Milestone RL** — explicit owner instruction, overrides the build-plan's earlier "D and A can run in parallel" note for this point in the sequence.

## Problems solved

- `parsePrismaEnums` initially captured trailing `// comment` text as part of enum values (e.g. `` `PENDING // Not yet marked` ``) — fixed by stripping `//...` and taking only the first token per line.
- `humanizeEnumName` initially mangled acronym-containing names (`SMSStatus` → "Sms status") — fixed with an acronym-aware boundary regex that preserves all-caps words.
- `apps/web`'s production build failed twice with `EPERM` renaming the Prisma query-engine DLL (a lingering Windows file lock from another process) — worked around by skipping `prisma generate` (a valid client already existed from `pnpm install`'s postinstall) and running `next build` directly.
- `apps/web` has no ESLint config at all — `next lint` prompts an interactive setup wizard that blocks non-interactively; verification fell back to `type-check` + a full production build (logged as G60).

## Current state

- Docs site: 182/196 pages published (every section done except Mobile app + one mobile-only FAQ page, both correctly deferred to D7). All D6.1–D6.3 work is **staged but not committed** in git.
- `apps/web`: 25 dashboard pages + Header/Footer/both sidebars/Help Center/onboarding all wired to the real docs site; `type-check` and full production build both pass clean. Also staged, not committed.
- `build-plan.md` and `progress-tracker.md` both updated with the full Track R structure, staged, not committed.
- **Nothing has been committed to git this session** — everything from D6.1 through Track R's creation is sitting staged (`git add`ed) awaiting the user's go-ahead to commit.

## Next session starts with

**R0.1 — Module/plan gating enforcement (G13)**: work through this decision with the owner (whether/when to flip `FEATURE_FLAG_MODE` to `enforce`, and whether the frontend's locked/upgrade state ships before or alongside that). Then R0.2–R0.6 in order. **Nothing else in Track R starts until all of R0 is resolved** — this is the explicit gate the owner set.

Before starting R0, consider whether the user wants these staged-but-uncommitted changes committed first (D6.1–D6.3 + the Track R planning docs) — this wasn't explicitly asked/answered this session.

## Open questions

- All of R0's 6 decisions are genuinely open and need the owner's input — see Track R's R0 section in `build-plan.md` for exactly what each one is asking.
- Whether to commit the large staged changeset now or keep accumulating further work unstaged-but-tracked before a single commit — not yet decided.
- G24 (unconfirmed whether real Paystack checkout completes end-to-end) remains an open question, not a confirmed bug — excluded from Track R since it's not actionable without a real outbound-network environment.
