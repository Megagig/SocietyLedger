# Thrift (Ajo) Add-on — Product & Technical Specification

> Source of truth for the Thrift/Ajo add-on across `apps/api`, `apps/web`, `apps/mobile`, `apps/admin` and `apps/docs`. Written 2026-10-27 from the owner's research and specification; **scope reduced 2026-10-27 by the owner** (see §14). Build order lives in `build-plan.md` (Track T), status in `progress-tracker.md` (Track T), data model and rules in `architecture.md §18`, screens and docs pages in `project-overview.md §12`.
>
> **Reading rule:** items marked **OWNER DECISION** were decided by the owner and are built as written. Items marked **ASSUMPTION** were filled in by the agent where the owner did not say, and need confirmation. Items marked **OPEN** are product questions still to settle.

---

## 1. What this is

An add-on that lets an association — or a standalone thrift group — run Ajo/Esusu/Adashe savings circles inside SocietyLedger: define a group and its rules, record every contribution with a receipt, calculate and approve payouts, handle late and defaulting members, and report on all of it. It is sold through the existing plan builder as an add-on (`module: ajo`), so only associations that buy it see it.

Two models, both to be built (**OWNER DECISION**):
1. **Collector thrift** — contributors pay a fixed amount daily, weekly or monthly, usually to a collector who visits them (the model markets and associations use most). The collector's fee is kept from the cycle; the contributor is paid out at cycle end.
2. **Rotating pot (esusu/adashe)** — a fixed group each pays the same amount every period and one member takes the whole pot each round until everyone has had a turn.

Names: Ajo (Yoruba), Esusu/Isusu (also Igbo), Adashe/Adashi (Hausa), Akawo, Osusu, Susu.

## 2. Why it should sell (research summary)

- It is a large, long-standing habit: traders, artisans, civil servants and low-income earners save this way in markets, neighbourhoods, workplaces and chat groups.
- The pain is operational, not the idea: collectors disappearing with a month or more of contributions, lost notebooks, disputes about who paid, late payers holding up payouts, and groups outgrowing real trust.
- Existing digital products (My Ajo App, CircleFunds, Thrifto, Loopsave, Alajo App) target generic groups or individual collectors. None found is built for associations. Their fees: My Ajo App reports 2%; CircleFunds a platform levy capped at ₦10,000 per cycle plus up to ₦3,000 per participant; traditional collectors keep about one day's contribution per 30-day cycle (~3.33%, a single commentary source).
- When products removed the human organiser, participation weakened. **Keep the human organiser (collector/officer/admin) in the loop.**
- The promise: no more disappearing collector, and every member gets a receipt for every contribution.

## 3. Positioning (read this before building anything)

**SocietyLedger is record-keeping software. The group's own bank account holds the money; SocietyLedger never holds, collects or pays out contribution money.** Everything below is designed around that. Consequences that engineering must keep true:

- There is **one money-flow mode: the group's own bank account** ("Mode A"). Contributors pay into the account the group provides; officers confirm what arrived; the group pays out from that account and records the payout here.
- No code path moves contribution money through SocietyLedger's Paystack account or any wallet, escrow or settlement account. Paystack in this product is used only for the add-on **subscription** (existing billing).
- Marketing and in-app wording describe a record-keeping tool for groups, never an invitation to the public to deposit money with SocietyLedger.
- **Subscription money is never contribution money.** The add-on subscription (existing billing) and a member's contribution are different payment purposes and different tables.

## 4. Roles (**OWNER DECISION**)

| Role | What they do |
|---|---|
| **Contributor** | Joins a group, accepts the rules, pays contributions, sees their own schedule, receipts, balance and payout position. |
| **Collector** | Visits contributors (daily/weekly), records collections, hands cash over, sees assigned contributors and daily targets. Cannot edit past entries; corrections are reversals with a logged reason. |
| **Officer** | Manages groups day to day: members, schedules, reconciliation of cash and transfers, follow-up on arrears, prepares payouts. |
| **Admin** | The association/group administrator. **Approves payouts.** Sets group rules, manages roles. |

**ASSUMPTION (separation of duties):** whoever prepares a payout cannot also approve it. If the admin prepares it, a second authorised person approves, unless the group has only one admin, in which case the single approval is logged with an extra confirmation step.

## 5. Who can use it (**OWNER DECISION**)

1. **Association members** form circles inside their association (the association has bought the Ajo add-on).
2. **Outsiders** can sign up to use only the Ajo module. They register a **standalone thrift group** (a tenant restricted to core + Ajo), invite their own contributors, and are billed on the Ajo tiers.

## 6. Joining a group — approval and verification (replaces KYC)

**OWNER DECISION 2026-10-27:** no government-ID, NIN or BVN verification, no KYC levels and no KYC provider. Verification is done in two steps by people, not by an identity service.

**Step 1 — the group approves.** An officer or admin who knows the person approves them for the circle. The person also accepts the current group rules (a recorded acceptance), the guarantor consents if the group requires one (§7), and — only if the group turns it on (default off) — the person confirms their phone with an SMS one-time code (reuses the existing SMS integration and credits).

**Step 2 — SocietyLedger verifies.** After the group's approval, SocietyLedger staff review what the person submitted — **full name, phone, residential address and payout account name** — in the admin console against a short checklist: (a) the name matches the payout account name, (b) the phone number is confirmed, (c) the address is filled in. The result is *verified* or *rejected with a reason* (shown to the group admin). **No ID numbers and no ID photos are collected.**

**What a person can do at each step (OWNER DECISION, from the owner's acceptance of the agent's recommendation):** once the group approves they can join and contribute; **no payout can be prepared or approved until they are SocietyLedger-verified**.

Member details used by the add-on: the existing member record (name, phone, address as already held), membership status, group membership, rule acceptance and verification status. For payouts, a **payout account** the member (or an officer for them) enters: bank name, account number, account name. It is **recorded, not verified by a payment or identity service** (SocietyLedger's step-2 check compares the account name with the person's name); it is shown masked (••••1234); it is never written to logs; and changing it after a payout has been approved voids that approval, sends the person back to step 2 and starts a short cool-off, so a payout cannot be redirected quietly.

## 7. Group rules and defaults (**OWNER DECISION**: configurable per group)

The admin sets the rules when creating a group; every member sees and accepts them before joining; the system enforces them. Rules are **versioned records** — changes apply prospectively and old versions stay on file.

| Rule | Options |
|---|---|
| Late fee | None / fixed amount (e.g. ₦500) / percentage; optional cap per missed contribution (e.g. ₦1,500) |
| Grace period | N days after the due date (default 3), in the group's timezone and cutoff time; paused while a payment is being verified or a dispute is open |
| Guarantor | Not required / optional / required before joining (name, phone, relationship, explicit timestamped acceptance of exactly what is recorded) |
| Post-payout default | Notify admin and open a case / offer a repayment plan / open a case and offer a plan |
| Reminders | Before and after the due date, on/off |

Safe defaults (**from the owner's brief**): 3 grace days, reminders on, guarantor optional or group-required, admin review plus a documented repayment-plan process for post-payout defaults, **late fees off by default**.

What happens when a member stops paying after being paid:
1. Contribution missed → installment marked overdue, reminder sent.
2. Grace period ends → any pre-agreed fee is calculated, shown and notified (never undisclosed, never retroactive).
3. Admin review → a case is created with the payout record, schedule and outstanding balance.
4. Resolution → the member's explanation, agreed repayment plan or dispute is recorded.
5. Unresolved → the group decides what to do outside the app; every action in the app is recorded.

What is owed is the member's remaining agreed contributions adjusted for payments and valid credits — **not** automatically the full payout plus arbitrary penalties. The system never deducts from other members or guarantors. A guarantor record is **a recorded consent only**; SocietyLedger does not create or enforce a legal guarantee.

Trust score (**OWNER DECISION 2026-10-27: on-time percentage**): on-time payments ÷ payments due over the last 12 months, shown as a band — **95%+ Excellent, 85–94% Good, 70–84% Fair, under 70% At risk**; a new member shows **No history yet**. A payment under dispute is not counted until the dispute is resolved; a waived payment is not counted either way. It is an aid for officers and a view for the member themselves (with the counts behind it); **it never blocks or penalises anyone automatically.**

## 7a. Payout order for the rotating pot (**OWNER DECISION 2026-10-27: hybrid**)

Collector thrift has no order (everyone is paid at the end of the cycle). For the rotating pot:
1. **Default: recorded random draw.** The system draws positions, saves the seed and the result, and shows both to every participant. The draw can be reproduced from the seed.
2. **Swaps before the first payout.** Two participants can agree to swap positions; the admin approves; every swap is logged.
3. **After the first payout,** the positions of people already paid never change. The only change allowed is an **emergency exception** approved by the admin with a written reason, logged and visible to the group.
4. **Optional group rule (default off):** participants whose trust band is *At risk* cannot take the first positions, so the group is protected from someone collecting early and then stopping.

## 8. Collector tools (**OWNER DECISION**: online only)

A dedicated collector interface, available only while online: assigned contributors, contributions due today, collection history and daily targets. No offline mode or local payment queue in the first release (**OPEN:** collectors in markets often have weak connectivity; revisit after the pilot).

- **Cash collection:** the collector records member, amount, date and a collection reference online. It is marked *Cash received — awaiting reconciliation* until an officer confirms the handover. End-of-day summary: expected, collected, cash in hand, handed over, difference.
- **Bank transfer:** the contributor pays into the group's own bank account and uploads a proof; an officer confirms it against the account. Receipt (SMS/push/email) to the contributor for every recorded or confirmed contribution.
- **Reported ≠ confirmed:** every contribution carries a status that separates *reported* (someone says it was paid) from *confirmed* (verified against the group's account or cash handover).
- Past entries are never edited: a correction is a reversal entry with a reason, visible in the audit trail.

## 9. Fees and revenue (**OWNER DECISION**)

- **Group-set fees:** circle duration, number of participants (admin chooses), weekly or monthly cycles advised for rotating pots; collector fee set per scheme (fixed amount, or a number of days' contribution — **ASSUMPTION**).
- **Platform levy (**OWNER DECISION 2026-10-27**, within the owner's caps of ₦5,000 per cycle and ₦1,000 per participant):**
  - **Cycle levy** = 0.5% of the cycle's total scheduled contributions, minimum ₦500, maximum ₦5,000.
  - **Participant levy** = 0.25% of that participant's scheduled contributions for the cycle, minimum ₦50, maximum ₦1,000.
  - **Starter-tier groups are exempt** (they pay the subscription only). The levy is independent of the collector fee.
  - Because SocietyLedger never touches contribution money, the levy is **billed to the group admin on the add-on subscription invoice**, never deducted from contributions.
  - Worked examples (Growth tier or above): 10 people paying ₦5,000 weekly for 10 weeks (₦500,000 scheduled) → ₦2,500 + 10 × ₦125 = ₦3,750 (0.75%). 40 people paying ₦500 daily for 31 days (₦620,000 scheduled) → ₦3,100 + 40 × ₦50 = ₦5,100 (about 0.8%).
- **Subscription (add-on)** tiers by active contributors (**OWNER DECISION 2026-10-27**, prices accepted from the agent's suggestion; to be tested with the pilot groups):

| Tier | Active contributors | Monthly | Annual | Includes |
|---|---|---|---|---|
| Starter | up to 30 | ₦3,000.00 | ₦30,000.00 | Group management, schedules, member ledger, basic reports |
| Growth | 31–150 | ₦8,000.00 | ₦80,000.00 | + collector management, automated reminders, payout tracking, advanced reports |
| Business | 151–500 | ₦20,000.00 | ₦200,000.00 | + expanded administration, audit reports, finer permissions |
| Enterprise | 500+ | from ₦40,000.00 (custom) | custom | Custom pricing, onboarding, support |

Pricing rules: monthly and annual billing (annual = 10 × monthly, i.e. two months free); a 14-day trial at the Starter limit; count **active** contributors, not invited ones; grace period for failed renewals; **read-only mode after expiry — financial records are never deleted or hidden**; payment-processing fees shown separately from the subscription; upgrade/downgrade rules say when new limits take effect. **Decided:** the existing billing lockout blocks a whole tenant when its plan expires; an expired Ajo add-on must instead leave Ajo data readable (read-only) — built in T1.2.

## 10. Reports (**OWNER DECISION**)

Contributions (expected/received/overdue/outstanding) · Member ledger (payments, fees, adjustments, balances) · Collector performance (collections, assignments, cash awaiting reconciliation) · Payouts (scheduled/completed/pending/beneficiaries) · Defaults and arrears (late, post-payout defaults, plans, disputes) · Group financial summary (contributions, payouts, obligations, reconciled cash) · Fees and revenue (late fees, waived fees, subscription revenue) · Audit and activity (changes, approvals, reversals, timestamps).

All reports use consistent definitions, date and group filters, permission checks, and export as CSV and PDF (Excel-compatible where needed).

## 11. Documentation to ship (**OWNER DECISION**)

A new "Ajo / Thrift" docs section: getting started and creating a group; joining a group and member approval; contribution schedules, grace periods and late fees; collector operations and recording cash; transfers and reconciliation; payout scheduling; guarantors, defaults, disputes and repayment plans; reports, exports and permissions; subscription plans, billing and usage limits; FAQ and troubleshooting. Separate guides for group administrators, collectors and members, and a clear explanation of payment status and cash reconciliation.

## 12. Data model (proposed; see `architecture.md §18`)

Reuse the existing `Member` as the contributor identity in both association groups and standalone groups (a standalone thrift group is a tenant of kind `THRIFT_GROUP`). New tables: `AjoGroup`, `AjoGroupRuleVersion`, `AjoRuleAcceptance`, `AjoMembership`, `AjoInstallment`, `AjoContribution`, `AjoCollectorAssignment`, `AjoCashHandover`, `AjoPayout`, `AjoPayoutAccount`, `AjoLateFeeAssessment`, `AjoDefaultCase`, `AjoRepaymentPlan`, `AjoGuarantorAgreement`, `AjoVerification`, `AjoPayoutOrderEvent`, `AjoLedgerEntry` (append-only), `AjoTrustSnapshot`, `AjoDispute`. All money in integer kobo; every money-recording write has an idempotency key; ledger entries are append-only with reversal entries.

## 13. Release plan

One release: Mode A (the group's own bank account), both models, member approval, online collector, payouts recorded, reports, docs, and a pilot with 2–3 real groups.

## 14. Scope decisions and open questions

**Removed by the owner on 2026-10-27** (not to be built, and not to be re-added without a new owner decision):
- Mode B (payment-partner escrow) and Mode C (SocietyLedger's Paystack account holding and settling contributions). One mode only: the group's own bank account.
- NIN/BVN and government-ID verification, KYC levels, a KYC provider, bank-account-name verification services, address-verification services, per-level limits, and the data-protection/legal planning items that came with them.
- The legal-opinion gate on custody and on standalone groups.

**Decided on 2026-10-27:** add-on prices and trial; the platform-levy formula; two-step verification; payout order (hybrid); trust score (on-time percentage); read-only mode when the add-on expires.

**Still open (product questions, tracked in `progress-tracker.md` Track T):**

| ID | Question | Resolved in |
|---|---|---|
| F2 | Collector tools are online only; weak connectivity in markets is a real risk | revisit after the T12.3 pilot |

## 15. Standalone thrift-group onboarding (T7.6b) — **OWNER-APPROVED 2026-10-29**

> Fills the gap in `build-plan.md` T7.6, `project-overview.md` THO9 and §5 above, which said "onboarding" without defining it. Built 2026-10-29; see "As built" at the end for where it differs from the plan.

**Purpose.** The admin of a standalone thrift group (`Association.kind = THRIFT_GROUP`) goes from "account approved" to "first circle ready to open, with its people in it" in about ten minutes, without seeing anything that belongs to an association (dues, levies, finance setup, association profile, association roles). Applies to that admin only; associations (including ones that bought Ajo) keep their five-step onboarding unchanged. Web only (THO9). Nothing here collects or moves contribution money; the only bank details captured are the group's own account, in the circle wizard.

**Routing.** After sign-in, an admin who still needs onboarding goes to `/onboarding` (association) or `/onboarding/thrift` (`THRIFT_GROUP`), chosen from `onboardingFlow` returned by login and `/auth/me`. Each kind that opens the other's onboarding address is redirected to its own. Skipping, or finishing, always ends in Ajo, never in association screens. Non-admins never see onboarding.

| # | Step | What happens | Required | Skippable |
|---|---|---|---|---|
| — | Welcome | What is ahead, trial end date, start or skip | — | skip all |
| 1 | Group profile | Name, contact phone (required), email, area and state, logo | yes | yes |
| 2 | Your first circle | The same wizard as Ajo's "New group" (`GroupWizard`), saved as a draft; two plain examples; "use the circle you already have" | yes | yes |
| 3 | Contributors | Create people one by one or from a CSV (up to 200), add them to the circle, optionally approve them and record rule acceptance on their behalf, optionally email login links | yes | yes |
| 4 | Team and collectors | Invite a co-admin, Ajo officers, collectors (collector only for a collector-thrift circle) | no | yes |
| 5 | Review and open | Checklist with Fix links, what happens next, open the circle or keep it as a draft | yes | — |

**Decisions (all taken as recommended).** D1 **A**: the trial includes Growth features (collector thrift, reminders) with Starter's cap of 30 active contributors. D2: step 4 is included, optional. D3: approval and on-behalf rule acceptance are both offered in step 3 with explicit checkboxes; approval ticked by default, on-behalf unticked; both logged. D4: login links by email on, SMS off (SMS costs credits). D5: a new bulk endpoint, answered per row.

**API.** `GET /onboarding/status` returns `flow` and the step list; `PATCH /onboarding/complete-step` and `POST /onboarding/team` validate against the tenant's kind (a thrift group cannot complete association steps, or invite as Treasurer, and the other way round). No migration: `OnboardingProgress` is reused and the association-only flags are left alone for thrift groups. New `POST /ajo/groups/:id/members/bulk` (`ajo.manage`).

**Acceptance (met, with the tests that prove them).** Kind-aware steps, completion and roles: `ajo-thrift-onboarding.test.ts`. Bulk add, idempotency, per-row results, own-approval refused, limit, isolation: `ajo-bulk.integration.test.ts` and the routes test. Trial add-on and standalone checkout: `thrift-checkout.integration.test.ts`. Routing guards: not covered by an automated test (they are web code).

### As built: where it differs from the plan above
1. **People staged in a draft circle.** The existing rule refused anyone added to a draft, but the plan adds people in step 3 and opens in step 5. Only the bulk add may now stage people in a draft (`addMember(allowDraft)`). They can be approved and have rules recorded, and stay `PENDING` ("0 active yet") until the circle is opened; opening the circle activates everyone who is ready. Everywhere else a draft still takes nobody.
2. **Repeating a list.** Instead of a stored idempotency key, a person is matched by phone number within the association, so the same list twice adds nobody and records nothing twice. A half-done list is finished by sending it again with approval ticked.
3. **Trial (D1).** A hidden, non-purchasable add-on `ajo-trial` (Growth features, 30 contributors, never levied) is granted at the start of a standalone group's trial instead of `ajo-starter`. It has to exist in each database (the Ajo seed creates it, and runs on container start). Groups already in a trial keep the Starter add-on.
4. **Step 1.** Area and state are saved in the group's address line; there are no new profile fields.
5. **Step 3.** "I'm also a contributor" is a note, not a toggle: add yourself as a row and another officer approves you. Contributor limit is enforced before sending when approval is ticked (an over-limit list is refused with an upgrade link); the server still reports a person it cannot activate for the plan.
6. **Step 4.** Assigning contributors to a new collector is not offered: an invited collector has no login until they accept. The page says to assign from Collectors afterwards.
7. **Resume and re-run.** The resume card appears on the Thrift Groups page (dismissed for the visit only), and "Setup guide" on that page re-runs setup. It is not under Settings.
8. **Not built here.** The mobile "finish on the web" card (T8). The Ajo docs page "Setting up your thrift group": the docs site has no Ajo section yet, so it belongs to T11.1.
