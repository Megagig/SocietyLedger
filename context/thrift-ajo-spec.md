# Thrift (Ajo) Add-on — Product & Technical Specification

> Source of truth for the Thrift/Ajo add-on across `apps/api`, `apps/web`, `apps/mobile`, `apps/admin` and `apps/docs`. Written 2026-10-27 from the owner's research and specification. Build order lives in `build-plan.md` (Track T), status in `progress-tracker.md` (Track T), data model and rules in `architecture.md §18`, screens and docs pages in `project-overview.md §12`.
>
> **Reading rule:** items marked **OWNER DECISION** were decided by the owner and are built as written. Items marked **FLAG** are risks or gaps the agent raised; they are gated in the plan, not silently changed. Items marked **ASSUMPTION** were filled in by the agent where the owner did not say, and need confirmation.

---

## 1. What this is

An add-on that lets an association — or a standalone thrift group — run Ajo/Esusu/Adashe savings circles inside SocietyLedger: define a group and its rules, verify who is taking part, record every contribution with a receipt, calculate and approve payouts, handle late and defaulting members, and report on all of it. It is sold through the existing plan builder as an add-on (`module: ajo`), so only associations that buy it see it.

Two models, both to be built (**OWNER DECISION**):
1. **Collector thrift** — contributors pay a fixed amount daily, weekly or monthly, usually to a collector who visits them (the model markets and associations use most). The collector's fee is kept from the cycle; the contributor is paid out at cycle end.
2. **Rotating pot (esusu/adashe)** — a fixed group each pays the same amount every period and one member takes the whole pot each round until everyone has had a turn.

Names: Ajo (Yoruba), Esusu/Isusu (also Igbo), Adashe/Adashi (Hausa), Akawo, Osusu, Susu.

## 2. Why it should sell (research summary)

- It is a large, long-standing habit: traders, artisans, civil servants and low-income earners save this way in markets, neighbourhoods, workplaces and chat groups. A 2023 EFInA survey reportedly found about 10% of adults rely on informal groups as their only financial channel (secondary report, not verified against the survey).
- The pain is operational, not the idea: collectors disappearing with a month or more of contributions, lost notebooks, disputes about who paid, late payers holding up payouts, and groups outgrowing real trust.
- Existing digital products (My Ajo App, CircleFunds, Thrifto, Loopsave, Alajo App; bank/agent products such as Sterling OneBank and LibertyPay) target generic groups or individual collectors. None found is built for associations. Their fees: My Ajo App reports 2%; CircleFunds a platform levy capped at ₦10,000 per cycle plus up to ₦3,000 per participant; traditional collectors keep about one day's contribution per 30-day cycle (~3.33%, a single commentary source).
- When products removed the human organiser, participation weakened. **Keep the human organiser (collector/officer/admin) in the loop.**
- The promise: no more disappearing collector, and every member gets a receipt for every contribution.

## 3. Roles (**OWNER DECISION**)

| Role | What they do |
|---|---|
| **Contributor** | Joins a group, accepts the rules, completes KYC, pays contributions, sees their own schedule, receipts, balance and payout position. |
| **Collector** | Visits contributors (daily/weekly), records collections, hands cash over, sees assigned contributors and daily targets. Cannot edit past entries; corrections are reversals with a logged reason. |
| **Officer** | Manages groups day to day: members, schedules, reconciliation of cash and transfers, follow-up on arrears, prepares payouts. |
| **Admin** | The association/group administrator. **Approves payouts.** Sets group rules, chooses the settlement mode, manages roles. |

**ASSUMPTION (separation of duties):** whoever prepares a payout cannot also approve it. If the admin prepares it, a second authorised person approves, unless the group has only one admin, in which case the single approval is logged with an extra confirmation step.

## 4. Who can use it (**OWNER DECISION**)

1. **Association members** form circles inside their association (the association has bought the Ajo add-on).
2. **Outsiders** can sign up to use only the Ajo module. They register a **standalone thrift group** (a tenant restricted to core + Ajo), invite their own contributors, and are billed on the Ajo tiers.

**FLAG F2 — standalone/public groups.** Letting people outside any association use the module is the part of the design closest to what the research warned about: deposit-taking from the public and advertising for deposits (BOFIA 2020 s.44 as read in secondary sources). Build the architecture so it is possible (tenant kind `THRIFT_GROUP`), but keep standalone sign-up behind a platform flag until the legal opinion in T0.1 is in hand.

## 5. Where the money sits (**OWNER DECISION**: the admin chooses per group)

| Mode | How it works | SocietyLedger's role | Gate |
|---|---|---|---|
| **A. Group's own bank account** | Contributors pay into the account the group provides. Officers confirm receipts (statement/proof/reconciliation). Payouts are made by the group from that account and recorded here. | Record-keeper only. Never touches funds. | None. **Build first.** |
| **B. Payment partner's escrow** | A licensed partner holds the pooled funds and moves them on instruction. | Instructs and records. | Partner selection + legal (T0.2). Built behind an adapter interface. |
| **C. SocietyLedger's Paystack account** | Contributors pay directly into SocietyLedger's Paystack account; SocietyLedger later settles/pays out the participants. | **Holds and moves customer money.** | **Behind flag `ajo.custodial_settlement`, off until T0.1 sign-off.** |

**FLAG F1 — Mode C is custody.** The research found no esusu exemption in BOFIA 2020 commentary and enforcement is active (46 microfinance bank licences revoked, July 2026). Collecting group money into SocietyLedger's own account and paying it out is exactly "holding funds", and may need CBN payment-service licensing or a licensed partner. Competitors say they avoid custody (CircleFunds: licensed partner custodians; My Ajo App: Paystack, "never custodies the pot"; both are their own claims). Therefore: Mode C is built but **not enabled in production** until a Nigerian financial-services lawyer confirms the structure in writing. Mode A ships first and does not depend on that answer.

Rules for every mode:
- **Subscription money is never contribution money.** The add-on subscription (existing billing) and a member's contribution are different payment purposes and different tables. A subscription payment must never be recorded as a contribution, and vice versa. Paystack references for Ajo money use the prefix `AJO-`.
- **Reported ≠ confirmed.** Every contribution carries a status that separates *reported* (member/collector says it was paid) from *confirmed* (the money is verified in the relevant account). Cash a collector holds is *Cash received — awaiting reconciliation* until the organisation confirms the handover.
- All amounts are integer kobo.

## 6. Verification (KYC) (**OWNER DECISION** for scope; levels are the owner's recommendation)

Everyone who uses the Ajo add-on, including association members who already exist, must complete KYC before joining a group. Required evidence:

- Verified residential address.
- One accepted ID: **NIN slip**, **international passport**, **driver's licence** or **voter's card**. Verify through an authorised provider where possible; do not rely only on an uploaded image.
- Verified phone (OTP). Bank account verified (name match) before any payout.

Three levels (product design, not a regulatory tier):

| Requirement | L1 Basic | L2 Verified | L3 Enhanced |
|---|---|---|---|
| Phone OTP | Yes | Yes | Yes |
| Legal name + date of birth | Declared | Verified against ID source | Verified |
| NIN/BVN | As applicable | Verified | Both, if required |
| Government ID | Uploaded | Verified | Required |
| Selfie/liveness | Optional | Risk-based | Risk-based |
| Bank account verification | Before payout | Required | Required |
| Residential address | Declared | Verified if required | Verified |
| Source of funds | No | If risk warrants | Required where applicable |
| Contribution and payout limits | Low | Moderate | Higher |

**ASSUMPTION:** L1 is the minimum to join and contribute; L2 is required before the first payout; L3 raises the limits. **FLAG F3:** the limit amounts per level are not specified; set in T0.5. Whether CBN tiered-KYC rules apply directly depends on the final money-flow mode (Mode B/C more likely than A); confirm with counsel.

Data captured per member (only what is needed): legal name, date of birth, phone, optional email, residential address (house, street, town, LGA, state), occupation/source of income where relevant, ID type/number/verification reference/date, bank name/number/verified account name, optional guarantor/referrer with consent, group membership details, rule acceptance records, risk flags (duplicate identities, repeated failed verification, suspicious account changes, disputed transactions).

Protection of that data (**Nigeria Data Protection Act 2023** applies): privacy notice and lawful basis per category; encrypt identity and banking data at rest with restricted access; mask NIN/BVN and account numbers in screens and logs (never log them); audit log for every staff view/edit/approval of a KYC record; retention and deletion policy; use the provider's secure flow instead of collecting extra biometric data ourselves; extra checks before changing payout details. **FLAG F4:** NDPC registration/DPIA needs confirming in T0.4.

Onboarding flow: create account (phone + OTP) → personal details → verify identity → verify payout account → accept group rules → approve membership (automatic if verified, otherwise an exception goes to the officer/admin).

## 7. Group rules and defaults (**OWNER DECISION**: configurable per group)

The admin sets the rules when creating a group; every member sees and accepts them before joining; the system enforces them. Rules are **versioned records** — changes apply prospectively and old versions stay on file.

| Rule | Options |
|---|---|
| Late fee | None / fixed amount (e.g. ₦500) / percentage; optional cap per missed contribution (e.g. ₦1,500) |
| Grace period | N days after the due date (default 3), in the group's timezone and cutoff time; paused while a payment is being verified or a dispute is open |
| Guarantor | Not required / optional / required before joining (name, verified phone, relationship, explicit timestamped acceptance of exactly what is guaranteed) |
| Post-payout default | Notify admin and open a case / offer a repayment plan / open a case and offer a plan |
| Reminders | Before and after the due date, on/off |

Safe defaults (**from the owner's brief**): 3 grace days, reminders on, guarantor optional or group-required, admin review plus a documented repayment-plan process for post-payout defaults, **late fees disabled until the legal/contract review is done**.

What happens when a member stops paying after being paid:
1. Contribution missed → installment marked overdue, reminder sent.
2. Grace period ends → any pre-agreed fee is calculated, shown and notified (never undisclosed, never retroactive).
3. Admin review → a case is created with the payout record, schedule and outstanding balance.
4. Resolution → the member's explanation, agreed repayment plan or dispute is recorded.
5. Unresolved → escalate under the group agreement and applicable law; every action recorded.

What is owed is the member's remaining agreed contributions adjusted for payments and valid credits and any applicable terms — **not** automatically the full payout plus arbitrary penalties. The system never confiscates other members' savings or deducts a guarantor's money without a valid legal basis; a guarantor is not automatically liable (**FLAG F5:** guarantee wording needs legal review).

Trust score: a reliability rating shown to admins (and to members for themselves) based on on-time payment history, KYC level and disputes. **FLAG F6:** the formula is not specified; define in T0.6 and document it plainly so it is not an opaque penalty.

## 8. Collector tools (**OWNER DECISION**: online only)

A dedicated collector interface, available only while online: assigned contributors, contributions due today, collection history and daily targets. No offline mode or local payment queue in the first release (**FLAG F7:** collectors in markets often have weak connectivity; revisit after the pilot).

- **Cash collection:** the collector records member, amount, date and a collection reference online. It is marked *Cash received — awaiting reconciliation* until an officer confirms the handover. End-of-day summary: expected, collected, cash in hand, handed over, difference.
- **Digital payment:** bank transfer through the payment provider the group admin selects (per §5). Receipt (SMS/push/email) to the contributor for every confirmed or recorded contribution.
- Past entries are never edited: a correction is a reversal entry with a reason, visible in the audit trail.

## 9. Fees and revenue (**OWNER DECISION**)

- **Group-set fees:** circle duration, number of participants (admin chooses), weekly or monthly cycles advised for rotating pots; collector fee set per scheme (fixed amount, or a number of days' contribution — **ASSUMPTION**).
- **Platform levy:** up to **₦5,000 per cycle** plus up to **₦1,000 per participant**. **FLAG F8:** define exactly how it is computed (per cycle cap, per participant cap, interaction with the collector fee), who pays it, and — for Mode A, where SocietyLedger never touches the money — how it is collected (billed on the subscription invoice, not deducted from contributions).
- **Subscription (add-on)** tiers by active contributors (**OWNER DECISION**, prices not yet set):

| Tier | Active contributors | Includes |
|---|---|---|
| Starter | up to 30 | Group management, schedules, member ledger, basic reports |
| Growth | 31–150 | + collector management, automated reminders, payout tracking, advanced reports |
| Business | 151–500 | + expanded administration, audit reports, finer permissions |
| Enterprise | 500+ | Custom pricing, onboarding, support |

Pricing rules: monthly and annual billing (annual discount if viable); a defined trial; count **active** contributors, not invited ones; grace period for failed renewals; **read-only mode after expiry — financial records are never deleted or hidden**; payment-processing fees shown separately from the subscription; upgrade/downgrade rules say when new limits take effect. **FLAG F9:** the existing billing lockout blocks a whole tenant when its plan expires; an expired Ajo add-on must instead leave Ajo data readable (read-only) — needs explicit handling in T1.2. Prices are not set: T0.5.

## 10. Reports (**OWNER DECISION**)

Contributions (expected/received/overdue/outstanding) · Member ledger (payments, fees, adjustments, balances) · Collector performance (collections, assignments, cash awaiting reconciliation) · Payouts (scheduled/completed/pending/beneficiaries) · Defaults and arrears (late, post-payout defaults, plans, disputes) · Group financial summary (contributions, payouts, obligations, reconciled cash) · Fees and revenue (late fees, waived fees, subscription revenue) · Audit and activity (changes, approvals, reversals, timestamps).

All reports use consistent definitions, date and group filters, permission checks, and export as CSV and PDF (Excel-compatible where needed).

## 11. Documentation to ship (**OWNER DECISION**)

A new "Ajo / Thrift" docs section: getting started and creating a group; member onboarding and KYC; contribution schedules, grace periods and late fees; collector operations and recording cash; online payments and reconciliation; payout scheduling and failed payments; guarantors, defaults, disputes and repayment plans; reports, exports and permissions; subscription plans, billing and usage limits; FAQ and troubleshooting. Separate guides for group administrators, collectors and members, and a clear explanation of payment status and cash reconciliation.

## 12. Data model (proposed; see `architecture.md §18` for the full list)

Reuse the existing `Member` as the contributor identity in both association groups and standalone groups (a standalone thrift group is a tenant of kind `THRIFT_GROUP`). New tables: `AjoGroup`, `AjoGroupRuleVersion`, `AjoRuleAcceptance`, `AjoMembership`, `AjoInstallment`, `AjoContribution`, `AjoCollectorAssignment`, `AjoCashHandover`, `AjoPayout`, `AjoLateFeeAssessment`, `AjoDefaultCase`, `AjoRepaymentPlan`, `AjoGuarantorAgreement`, `AjoKycProfile`, `AjoKycEvent`, `AjoLedgerEntry` (append-only), `AjoTrustSnapshot`, `AjoDispute`. All money in integer kobo; every money-moving write has an idempotency key; ledger entries are append-only with reversal entries.

## 13. Release plan (**ASSUMPTION**, sequencing only — nothing the owner asked for is dropped)

- **Release 1:** Mode A (own bank account) + both models + KYC L1–L2 + online collector + reports + docs + pilot with 2–3 real groups.
- **Release 2:** Mode B/C and standalone groups, enabled only after T0.1 (legal sign-off) and T0.2 (rails) are complete; KYC L3.

## 14. Flags and open questions (all tracked in `progress-tracker.md`, Track T)

| ID | Flag / question | Resolved in |
|---|---|---|
| F1 | Mode C (SocietyLedger holds/moves funds) may need CBN licensing or a licensed partner; no esusu exemption found | T0.1, T5.3 |
| F2 | Standalone/public groups raise public deposit-taking and advertising restrictions | T0.1, T1.3, T7.6 |
| F3 | KYC level limits and CBN tier applicability unspecified | T0.5, T0.1 |
| F4 | NDPA 2023: NDPC registration, DPIA, retention periods | T0.4 |
| F5 | Guarantor liability wording and default remedies need legal review | T0.1, T0.6 |
| F6 | Trust-score formula undefined | T0.6, T6.4 |
| F7 | Collector online-only vs weak connectivity in markets | revisit after T12.3 pilot |
| F8 | Platform levy formula and collection method per mode | T0.5, T5.5 |
| F9 | Add-on expiry must give read-only Ajo access, not a full lockout | T1.2 |
| F10 | KYC provider (cost, coverage of NIN/BVN/ID/bank-name/liveness) not chosen | T0.3 |
| F11 | Paystack transfer/escrow capabilities and approval rules must be verified against current Paystack docs before Mode C | T0.2 |
| F12 | Payout order rules (fixed, draw, need-based) not specified | T0.6 |
