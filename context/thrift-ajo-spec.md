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

## 6. Joining a group — member approval (replaces KYC)

**OWNER DECISION 2026-10-27:** no government-ID, NIN or BVN verification, no KYC levels and no KYC provider. Trust comes from the group itself: the officers who run a circle already know the people in it.

A person becomes an active participant when all of these are true:
1. They are a member of the association (or were invited into the standalone group by its admin).
2. An **officer or admin approves** them for the circle.
3. They have **accepted the current group rules** (a recorded acceptance).
4. If the group requires a guarantor (§7), the guarantor has consented.
5. Optional per group (default off): their phone number is confirmed with a one-time code sent by SMS (reuses the existing SMS integration and credits).

Member details used by the add-on: the existing member record (name, phone, address as already held), membership status, group membership and rule acceptance. For payouts, a **payout account** the member (or an officer for them) enters: bank name, account number, account name. It is **recorded, not verified by a service**; it is shown masked (••••1234); it is never written to logs; and changing it after a payout has been approved voids that approval and starts a short cool-off, so a payout cannot be redirected quietly.

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

Trust score: a reliability rating shown to admins (and to members for themselves) based on on-time payment history and disputes. **OPEN:** the formula is not specified; define it plainly (§14).

## 8. Collector tools (**OWNER DECISION**: online only)

A dedicated collector interface, available only while online: assigned contributors, contributions due today, collection history and daily targets. No offline mode or local payment queue in the first release (**OPEN:** collectors in markets often have weak connectivity; revisit after the pilot).

- **Cash collection:** the collector records member, amount, date and a collection reference online. It is marked *Cash received — awaiting reconciliation* until an officer confirms the handover. End-of-day summary: expected, collected, cash in hand, handed over, difference.
- **Bank transfer:** the contributor pays into the group's own bank account and uploads a proof; an officer confirms it against the account. Receipt (SMS/push/email) to the contributor for every recorded or confirmed contribution.
- **Reported ≠ confirmed:** every contribution carries a status that separates *reported* (someone says it was paid) from *confirmed* (verified against the group's account or cash handover).
- Past entries are never edited: a correction is a reversal entry with a reason, visible in the audit trail.

## 9. Fees and revenue (**OWNER DECISION**)

- **Group-set fees:** circle duration, number of participants (admin chooses), weekly or monthly cycles advised for rotating pots; collector fee set per scheme (fixed amount, or a number of days' contribution — **ASSUMPTION**).
- **Platform levy:** up to **₦5,000 per cycle** plus up to **₦1,000 per participant**. **OPEN:** define exactly how it is computed (per-cycle cap, per-participant cap, interaction with the collector fee) and who pays it. Because SocietyLedger never touches contribution money, the levy is **billed on the add-on subscription invoice**, never deducted from contributions.
- **Subscription (add-on)** tiers by active contributors (**OWNER DECISION**, prices not yet set):

| Tier | Active contributors | Includes |
|---|---|---|
| Starter | up to 30 | Group management, schedules, member ledger, basic reports |
| Growth | 31–150 | + collector management, automated reminders, payout tracking, advanced reports |
| Business | 151–500 | + expanded administration, audit reports, finer permissions |
| Enterprise | 500+ | Custom pricing, onboarding, support |

Pricing rules: monthly and annual billing (annual discount if viable); a defined trial; count **active** contributors, not invited ones; grace period for failed renewals; **read-only mode after expiry — financial records are never deleted or hidden**; payment-processing fees shown separately from the subscription; upgrade/downgrade rules say when new limits take effect. **OPEN:** the existing billing lockout blocks a whole tenant when its plan expires; an expired Ajo add-on must instead leave Ajo data readable (read-only) — needs explicit handling in T1.2. Prices are not set (T0.1).

## 10. Reports (**OWNER DECISION**)

Contributions (expected/received/overdue/outstanding) · Member ledger (payments, fees, adjustments, balances) · Collector performance (collections, assignments, cash awaiting reconciliation) · Payouts (scheduled/completed/pending/beneficiaries) · Defaults and arrears (late, post-payout defaults, plans, disputes) · Group financial summary (contributions, payouts, obligations, reconciled cash) · Fees and revenue (late fees, waived fees, subscription revenue) · Audit and activity (changes, approvals, reversals, timestamps).

All reports use consistent definitions, date and group filters, permission checks, and export as CSV and PDF (Excel-compatible where needed).

## 11. Documentation to ship (**OWNER DECISION**)

A new "Ajo / Thrift" docs section: getting started and creating a group; joining a group and member approval; contribution schedules, grace periods and late fees; collector operations and recording cash; transfers and reconciliation; payout scheduling; guarantors, defaults, disputes and repayment plans; reports, exports and permissions; subscription plans, billing and usage limits; FAQ and troubleshooting. Separate guides for group administrators, collectors and members, and a clear explanation of payment status and cash reconciliation.

## 12. Data model (proposed; see `architecture.md §18`)

Reuse the existing `Member` as the contributor identity in both association groups and standalone groups (a standalone thrift group is a tenant of kind `THRIFT_GROUP`). New tables: `AjoGroup`, `AjoGroupRuleVersion`, `AjoRuleAcceptance`, `AjoMembership`, `AjoInstallment`, `AjoContribution`, `AjoCollectorAssignment`, `AjoCashHandover`, `AjoPayout`, `AjoPayoutAccount`, `AjoLateFeeAssessment`, `AjoDefaultCase`, `AjoRepaymentPlan`, `AjoGuarantorAgreement`, `AjoLedgerEntry` (append-only), `AjoTrustSnapshot`, `AjoDispute`. All money in integer kobo; every money-recording write has an idempotency key; ledger entries are append-only with reversal entries.

## 13. Release plan

One release: Mode A (the group's own bank account), both models, member approval, online collector, payouts recorded, reports, docs, and a pilot with 2–3 real groups.

## 14. Scope decisions and open questions

**Removed by the owner on 2026-10-27** (not to be built, and not to be re-added without a new owner decision):
- Mode B (payment-partner escrow) and Mode C (SocietyLedger's Paystack account holding and settling contributions). One mode only: the group's own bank account.
- NIN/BVN and government-ID verification, KYC levels, a KYC provider, bank-account-name verification services, address-verification services, per-level limits, and the data-protection/legal planning items that came with them.
- The legal-opinion gate on custody and on standalone groups.

**Still open (product questions, tracked in `progress-tracker.md` Track T):**

| ID | Question | Resolved in |
|---|---|---|
| F1 | Trust-score formula | T0.2, T6.4 |
| F2 | Collector tools are online only; weak connectivity in markets is a real risk | revisit after the T12.3 pilot |
| F3 | Platform-levy formula (caps, interaction with collector fee, who pays) | T0.1, T5.4 |
| F4 | Expired add-on must leave history readable (existing billing locks a whole tenant) | T1.2 |
| F5 | Payout order rules (fixed, recorded random draw, need-based by admin) | T0.2, T3.4 |
