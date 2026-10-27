# Project Overview — SocietyLedger Docs, Admin Console & Mobile

> Source of truth for **what** we are building. If a screen, page, feature or behaviour is not described here, it is out of scope until this file is updated. Update this file (don't rewrite it) when scope changes, and record the change in the Change Log at the bottom.

This project has **three deliverables**, built in one pnpm + Turborepo monorepo, deployed on **Dokploy**, and governed by the same nine context files:

| Deliverable | Folder | Where it lives | Spec |
|---|---|---|---|
| **A. Documentation site / user manual** | `apps/docs` | `https://docs.societyledger.com.ng` | §9 |
| **C. Platform admin console** (Super Admin, split out of the web app) | `apps/admin` | `https://admin.societyledger.com.ng` | §10 |
| **B. Mobile app (iOS + Android)** | `apps/mobile` | App Store, Google Play | §1–§8 |

The web app (`apps/web`) is finished; the docs site documents it first. The admin console then takes everything Super Admin out of the web app so the tenant app and the platform console are built, secured and deployed separately. The mobile app follows. Both the web app and the mobile app link to the docs site (§9.8); nothing in the tenant web app or the mobile app links to the admin console.

**Platform today (Oct 2026):** pnpm 9 workspaces + Turborepo; `apps/api` (Express + Prisma) and `apps/web` (Next.js) deployed as separate Dokploy applications; PostgreSQL 16 runs as a Dokploy-managed database (migrated from Neon); Redis optional.

---

## 1. The product

> §1–§8 specify **Deliverable B — the mobile app**. The documentation site is specified in §9.

**SocietyLedger** is a multi-tenant SaaS for running associations across Africa (Nigeria first): homeowners' associations, cooperatives, town unions, alumni groups, clubs, professional bodies and religious bodies. Each association is a **tenant** identified by a **subdomain** (e.g. `opuogunstate.societyledger.com.ng`). The platform already exists as:

- `apps/api` — Express + Prisma + PostgreSQL API (deployed on Dokploy; database is a Dokploy-managed PostgreSQL, migrated from Neon; base domain `societyledger.com.ng`)
- `apps/web` — Next.js 14 web app (Mantine + Tailwind, teal brand), the tenant app on `*.societyledger.com.ng` (deployed on Dokploy)
- `apps/admin` — platform admin console (deliverable C, §10) on `admin.societyledger.com.ng`

**SocietyLedger Mobile** (`apps/mobile`) is a native iOS + Android app built with **Expo**, consuming the **same API**. It gives members and officers near-full parity with the web dashboard, designed for phones first: pay dues in two taps, vote from anywhere, check in to meetings, approve payments and loan requests on the go, and get push notifications instead of waiting for SMS.

### One-line pitch
> "Your association in your pocket — dues, meetings, votes, savings and welfare, for every member and every officer."

### The problem it solves
| Problem today | How mobile solves it |
|---|---|
| Members rarely open the web dashboard; dues go unpaid because paying is friction-heavy (find link → log in on subdomain → navigate). | App remembers the association, unlocks with biometrics, and puts **Outstanding balance → Pay** on the home screen. |
| Officers approve payments, transfers and loan applications only when they're at a laptop, so members wait days. | Approval queues with push alerts; approve/reject from a notification in under 10 seconds. |
| Announcements and reminders depend on SMS credits (paid) and email (ignored). | Free push notifications for every in-app notification, respecting the user's preferences. |
| Voting and polls get low turnout. | Push "Voting is open" → one-tap ballot. |
| Meeting attendance is taken on paper and typed in later. | Officers mark attendance live on a phone list with search; members see their attendance history. |
| Bank-transfer payers must email screenshots as proof. | Snap/upload the transfer receipt directly from the camera roll as a payment proof. |

---

## 2. Who it's for

### 2.1 Personas
| Persona | Description | Primary jobs on mobile |
|---|---|---|
| **Member** (`role: member`) | Ordinary member of an association. Often non-technical, Android, mid-range phone, patchy data. | See what I owe, pay, upload transfer proof, download statement, see meetings, vote, save/borrow (cooperatives), request welfare support, read announcements, contact support. |
| **Financial officer** (`treasurer`, `financial_secretary`) | Collects and records money. | Record payments, verify transfers and proofs, see who's overdue, send reminders, view ledgers and reports, approve loans/welfare payouts. |
| **Association admin** (`admin`) | Executive / secretary who runs the association. | Everything officers can do plus members, meetings, elections, communication, settings, users and roles. |
| **Custom-role officer** | Any role created through the dynamic RBAC system (e.g. "Welfare Officer", "Auditor"). | Whatever their permissions allow — the UI is **permission-driven, not role-name-driven**. |
| **New association founder** | Someone creating a brand-new association. | Sign up, complete onboarding wizard, invite members. |

### 2.2 Explicitly NOT for
- **Platform staff** (`platformRole`: `SUPER_ADMIN`, `SUPPORT_AGENT`, `FINANCE_ADMIN`, `COMPLIANCE_ADMIN`). They use the admin console (§10) at `admin.societyledger.com.ng`. If one tries to log in on mobile, the API answers `PLATFORM_LOGIN_REQUIRED` and the app shows **"Platform staff sign in at admin.societyledger.com.ng"** with a Sign out button. No platform admin screens exist in the mobile app.
- Public website visitors (marketing pages, blog, public documentation, pricing).

### 2.3 Access model (how the app decides what a user sees)
1. **Tenant**: every request carries the association's subdomain in the `X-Tenant` header. A user belongs to exactly one association per account (`User.associationId`); the same email may exist in several associations as separate accounts.
2. **Permissions**: `/api/auth/login` and `/api/auth/me` return `user.permissions: string[]` (e.g. `ledger.view`, `payments.approve`). **Every** gated screen, tab, button and menu item is controlled by these permission keys via the `can()` helper. Role names are only displayed, never used for gating (exception: `role === 'admin'` + `requiresOnboarding` triggers the onboarding wizard, mirroring the API).
3. **Modules**: the association's plan may disable modules (`accounting`, `welfare`, `voting`, `meetings`, `sms`, `cooperatives`, `loans`, `savings`, `levies`, `donations`, `penalties`, `reports`…). The API answers `403 { error: 'MODULE_DISABLED', module, upgradeRequired }`. The app shows the **Module Locked** state for that screen and hides the module's entry points after the first 403 for the session.
4. **Subscription**: an expired/missing subscription returns 403 with a subscription message; the app shows the **Subscription Inactive** state (read-only, explains that the admin must renew on the web).

---

## 3. Platform & scope boundaries

- **Platforms**: iOS (16.4+) and Android (API 24+ / Android 7+), phones first. Tablets render the phone layout centred with max content width (no tablet-specific layouts in v1).
- **Orientation**: portrait only.
- **Languages**: English only in v1 (all strings through the i18n helper so more languages can be added later).
- **Currency**: NGN (`₦`) default; amounts formatted from the association's settings currency when present.
- **Theme**: light and dark, follows system by default, user override in Settings.
- **Connectivity**: online-first with a **persisted read cache** (last-viewed data is shown offline with an "Offline — showing saved data" banner). **No offline writes** in v1; mutations are disabled while offline.

---

## 4. Core user flows

### 4.1 First launch → signed in (member)
```
Splash ─► Welcome (carousel, 3 slides) ─► "Get started"
      ─► Association Code screen: user types "opuogunstate"
           └─ GET /api/associations/check-subdomain?subdomain=opuogunstate
           └─ shows association card (logo, name) ─► "Continue"
      ─► Login (email + password)  ── POST /api/auth/login  (X-Tenant: opuogunstate, X-Client: mobile)
           ├─ EMAIL_NOT_VERIFIED ─► Verify Email (6-digit code)
           ├─ PENDING_APPROVAL   ─► Pending Approval screen
           ├─ ACCOUNT_REJECTED / ACCOUNT_SUSPENDED ─► Account Blocked screen
           ├─ PLATFORM_LOGIN_REQUIRED ─► Platform staff screen (A12)
           └─ success ─► store tokens in SecureStore
                      ─► (admin && requiresOnboarding? ─► Onboarding wizard)
                      ─► Enable biometrics prompt (once) ─► Enable notifications prompt (once)
                      ─► Home tab
```
Returning user: Splash ─► (biometric/PIN unlock if enabled) ─► Home. Association and tokens are remembered; "Switch association" in Profile clears the session and returns to the Association Code screen. The last 5 associations used on the device are offered as quick picks.

### 4.2 Invite acceptance (deep link)
Admin invites member (web or mobile) ─► member receives email/SMS with `/auth/activate?token=…` link ─► web page offers **"Open in the SocietyLedger app"** (`societyledger://invite?token=…&tenant=…`) ─► app opens **Accept Invite** (`GET /api/member-invites/verify`) ─► set password (`POST /api/member-invites/accept`) ─► auto login ─► Home.

### 4.3 Pay outstanding dues online
Home "You owe ₦25,000" card ─► **Pay** ─► Outstanding list (select items, defaults to all) ─► Review total ─► **Pay with card / bank (Paystack)**
 ─► `POST /api/payments/paystack/initialize` with `callbackUrl` = mobile return URL
 ─► in-app secure browser (`WebBrowser.openAuthSessionAsync`) shows Paystack checkout
 ─► Paystack redirects to API bridge ─► bridge redirects to `societyledger://payments/return?reference=…`
 ─► browser closes ─► app calls `GET /api/payments/paystack/verify/:reference`
 ─► Payment Result screen (success / pending / failed) ─► invalidates finance queries ─► receipt shareable.

### 4.4 Pay by bank transfer + proof
Pay ─► **I paid by bank transfer** ─► shows association bank accounts (`GET /api/payments/nigerian/bank-accounts`) with copy buttons ─► user enters amount, date, sender name/bank, reference ─► attaches receipt photo/PDF ─► `POST /api/payments/nigerian/proofs` (multipart) ─► "Submitted for verification" ─► officer verifies ─► push "Your payment of ₦X was confirmed".

### 4.5 Officer approval loop
Push "New payment proof from Ada Obi" ─► tap ─► Proof Detail ─► view image fullscreen ─► **Verify** (match to transaction) or **Reject** (reason) ─► member notified.
Same pattern for: bank transfers, loan applications (review/approve/disburse), welfare payout requests (review/approve/disburse), guarantor requests (member side), pending user approvals, minutes approval, candidate approval.

### 4.6 Vote in an election
Push "Voting is open: 2026 Executive Election" ─► Election Detail ─► **Cast ballot** ─► one position per step (select candidate) ─► review ─► confirm (biometric/PIN re-auth) ─► `POST /api/voting/elections/:id/vote/bulk` ─► "Vote recorded" ─► results visible when published.

### 4.7 Create a new association (founder)
Welcome ─► "Create an association" ─► Signup form (association name, subdomain with live availability check, admin details) ─► `POST /api/associations/signup` ─► Verify Email ─► Login ─► Onboarding wizard (Profile → Finance → Members → Team → Complete) ─► Home. Subscription purchase is **not** done in-app (see §7).

---

## 5. Navigation model

### 5.1 App shell
- **Bottom tabs** (permission-aware):
  1. **Home** — personal dashboard; officers get a `Me | Association` segmented switch.
  2. **Money** — the user's own finances (my-finances + cooperatives savings/loans).
  3. **Community** — meetings, voting, polls, welfare, announcements.
  4. **Manage** — officer hub. **Only shown if the user holds at least one management permission** (see §6.9 for the list). Members without any management permission get 4 tabs.
  5. **Profile** — profile, settings, help, sign out.
- **Header bell** with unread badge on every tab root → Notifications Inbox.
- **Stacks**: every tab owns a stack; detail screens push onto it. Create/edit forms present as **modal stacks** (slide-up on iOS, full-screen on Android).
- **Bottom sheets** for filters, quick actions, pickers and confirmations.

### 5.2 Global states every data screen must implement
`Loading (skeleton)` · `Empty` · `Error (retry)` · `Offline (cached data + banner, writes disabled)` · `Module Locked` · `Subscription Inactive` · `No Permission` (only reachable via deep link). Defined in `ui-rules.md`.

---

## 6. Screen-by-screen specification

Notation: **Route** = Expo Router path under `apps/mobile/app`. **Perm** = permission key(s) required (any-of unless stated). **API** = endpoints used (all prefixed `/api`). "Officer" = holds the listed perm. Money values always use the `Money` component.

### 6.1 Entry & authentication — `app/(auth)/`

| # | Screen | Route | Purpose & content | Actions | API |
|---|---|---|---|---|---|
| A1 | Splash | `index.tsx` | Brand mark, restores session from SecureStore, decides destination. Max 1.5 s, then routes. | — | `GET /auth/me` (if token) |
| A2 | Welcome | `(auth)/welcome.tsx` | 3-slide carousel: "Pay dues in seconds", "Never miss a meeting or vote", "Run your association from your phone". | Get started · Create an association | — |
| A3 | Association Code | `(auth)/association.tsx` | Text input "Association code" with helper "It's the first part of your association's web address, e.g. **opuogunstate**.societyledger.com.ng". Recent associations list (max 5) as tappable cards. Debounced lookup shows a confirmation card with logo + name. Errors: not found, inactive/cancelled, suspended. | Continue (enabled after valid lookup) | `GET /associations/check-subdomain?subdomain=` |
| A4 | Login | `(auth)/login.tsx` | Association card at top (tap to change). Email, password (show/hide). "Forgot password?" link. Error mapping for `EMAIL_NOT_VERIFIED`, `PENDING_APPROVAL`, `ACCOUNT_REJECTED`, `ACCOUNT_SUSPENDED`, invalid credentials, rate-limited (429). | Sign in · Register · Forgot password | `POST /auth/login` |
| A5 | Register | `(auth)/register.tsx` | Self-registration into the selected association: first name, last name, email, password + confirm, terms checkbox. Explains admin approval may be required. | Create account | `POST /auth/register` or `POST /member-invites/self-register` (if association uses member-ID self-registration) |
| A6 | Verify Email | `(auth)/verify-email.tsx` | 6-digit OTP input (auto-advance, paste support), resend with 60 s cooldown. | Verify · Resend | `POST /auth/verify-email`, `POST /auth/resend-verification` |
| A7 | Forgot Password | `(auth)/forgot-password.tsx` | Email field; always shows the same success message (no account enumeration). | Send reset link | `POST /auth/forgot-password` |
| A8 | Reset Password | `(auth)/reset-password.tsx` | Opened from deep link `societyledger://reset-password?token=&tenant=`. New password + confirm, strength meter. | Reset | `POST /auth/reset-password` |
| A9 | Accept Invite | `(auth)/accept-invite.tsx` | Opened from deep link. Shows association + member name from verification, password + confirm. | Activate account | `GET /member-invites/verify`, `POST /member-invites/accept` |
| A10 | Pending Approval | `(auth)/pending.tsx` | Illustration, explanation, "We'll notify you when an admin approves your account". | Check again · Sign out | `POST /auth/login` (retry) |
| A11 | Account Blocked | `(auth)/blocked.tsx` | Variant copy for rejected / suspended accounts and suspended / cancelled associations. | Contact support (mailto) · Switch association | — |
| A12 | Platform staff (admin console only) | `(auth)/web-only.tsx` | Shown on `PLATFORM_LOGIN_REQUIRED`: "Platform staff sign in at admin.societyledger.com.ng." No link button (avoid steering staff credentials through a phone flow); plain text with copy-to-clipboard. | Sign out | — |
| A13 | Create Association | `(auth)/create-association.tsx` | 2-step form: (1) association name, type, subdomain with live availability + preview URL; (2) admin first/last name, email, phone, password. Terms. | Create | `GET /associations/check-subdomain`, `POST /associations/signup` |
| A14 | App Lock | `(lock)/unlock.tsx` | Shown on cold start / after 5 min in background when biometrics enabled. Face ID / fingerprint prompt, fallback to device passcode. | Unlock · Sign out | — |

### 6.2 Onboarding wizard (new association admins) — `app/(app)/onboarding/`
Shown when `user.role === 'admin' && user.requiresOnboarding`. Progress bar with 4 steps; each step skippable; resumable.

| # | Screen | Route | Content | API |
|---|---|---|---|---|
| O1 | Profile | `onboarding/profile.tsx` | Association logo upload, display name, address, phone, email, primary colour (preset swatches). | `GET /onboarding/status`, `PATCH /settings/association/profile`, `POST /settings/association/logo`, `PATCH /onboarding/complete-step` |
| O2 | Finance | `onboarding/finance.tsx` | Default dues amount & frequency, add first financial categories, add bank account for transfers. | `POST /finance/categories`, `POST /payments/nigerian/bank-accounts`, `PATCH /onboarding/complete-step` |
| O3 | Members | `onboarding/members.tsx` | Add members one by one (quick form) or "Import later on the web". | `POST /members`, `PATCH /onboarding/complete-step` |
| O4 | Team | `onboarding/team.tsx` | Invite officers by email and assign a role. | `POST /member-invites…`, `POST /rbac/assign`, `PATCH /onboarding/complete-step` |
| O5 | Complete | `onboarding/complete.tsx` | Success state, checklist summary. | `POST /onboarding/skip` (if skipped) |

### 6.3 Home tab — `app/(app)/(tabs)/home/`

| # | Screen | Route | Perm | Content | Actions | API |
|---|---|---|---|---|---|---|
| H1 | Home — Me | `home/index.tsx` | any member | Greeting + association logo; **Balance card** (outstanding total, next due date, overdue badge) with Pay CTA; quick actions grid (Pay, Upload proof, Statement, Savings, Apply loan, Support) filtered by permissions/modules; Upcoming meeting card; Active vote/poll card; Recent payments (3); Latest announcements (3). Pull to refresh. | Pay · quick actions · see all links | `GET /members/me/finance-summary`, `GET /meetings/upcoming`, `GET /voting/active`, `GET /members/me/payments?limit=3`, `GET /notifications?type=announcement&limit=3` |
| H2 | Home — Association | `home/index.tsx` (segment) | `ledger.view` or `reports.generate` or `members.view` | KPI tiles (active members + change, this-month revenue + change, collection rate + change, current balance), revenue trend chart (6 months, expected vs actual), payment method donut, outstanding dues, pending/overdue counts, **Needs your attention** list (pending proofs, transfers, approvals, loan applications, welfare requests — each with count, tap → queue), recent transactions. | Tap any tile → relevant list | `GET /dashboard/overview`, counts from respective list endpoints with `status=pending&limit=1` |

### 6.4 Money tab (own finances) — `app/(app)/(tabs)/money/`
Perm for all: `ledger.view_own` (or `ledger.view`). Cooperative screens additionally require the `cooperatives`/`savings`/`loans` module.

| # | Screen | Route | Content | Actions | API |
|---|---|---|---|---|---|
| M1 | Money Overview | `money/index.tsx` | Summary: total due, total paid this year, balance; breakdown chips (Dues, Levies, Penalties, Donations) each with amount; savings balance and active loan summary (if cooperative). Links to every sub-screen. | Pay · Donate | `GET /members/me/finance-summary`, `GET /cooperatives/my-profile` |
| M2 | Outstanding & Pay | `money/pay/index.tsx` | Selectable list of outstanding items (title, category, due date, amount, balance, overdue tag). Sticky footer with selected total. | Pay online · I paid by transfer | `GET /members/me/outstanding` |
| M3 | Pay Online | `money/pay/online.tsx` | Review the selected item + amount, fee note, Paystack button. **One item per online checkout in v1** (API accepts a single `transactionId`); if several items are selected, the screen pays them one after another ("Item 1 of 3") or the user picks one. Launches checkout; handles return. | Pay | `POST /payments/paystack/initialize`, `GET /payments/paystack/verify/:reference` |
| M4 | Pay by Transfer | `money/pay/transfer.tsx` | Association bank accounts with copy-to-clipboard; proof form (amount, transfer date, sender name, sender bank via bank picker, reference, notes, attachment from camera/gallery/files). | Submit proof | `GET /payments/nigerian/bank-accounts`, `GET /payments/nigerian/banks`, `POST /payments/nigerian/proofs` |
| M5 | Payment Result | `money/pay/result.tsx` | Success (animated check, amount, reference, date) / Pending / Failed with retry. | Share receipt · Done | — |
| M6 | My Ledger | `money/ledger/index.tsx` | Running-balance list of debits/credits grouped by month; summary header (opening, debits, credits, closing); date-range filter sheet. | Export statement (PDF) | `GET /member-ledger/my-ledger/summary`, `/entries`, `/balance`, `POST /member-ledger/my-ledger/export` |
| M7 | Statement | `money/ledger/statement.tsx` | Period picker; statement preview; download/share PDF via share sheet. | Share | `GET /member-ledger/my-ledger/statement` |
| M8 | My Dues | `money/dues.tsx` | List with status chips (paid/partial/unpaid/overdue), filters. Tap → Transaction Detail. | — | `GET /members/me/dues` |
| M9 | My Levies | `money/levies.tsx` | Levy assignments with campaign name, amount, paid, progress bar. | Pay | `GET /members/me/levies` |
| M10 | My Penalties | `money/penalties.tsx` | Penalties with reason, amount, waived flag. | Pay | `GET /members/me/penalties` |
| M11 | My Donations | `money/donations/index.tsx` | Donation history; total given. | Donate | `GET /members/me/donations` |
| M12 | Donate | `money/donations/new.tsx` | Allocation/cause picker, amount keypad with presets, note, method (online / transfer). | Donate | `GET /finance/advanced/donations/allocations`, `POST /members/me/donate` |
| M13 | Payment History | `money/payments.tsx` | All payments made (amount, method, date, reference, status). | Tap → receipt sheet | `GET /members/me/payments` |
| M14 | Transaction Detail (own) | `money/transaction/[id].tsx` | Item detail, payments applied, remaining balance. | Pay remaining | from list cache + `GET /members/me/dues` |
| M15 | My Savings | `money/savings/index.tsx` | Savings accounts (type, balance, status), recent transactions per account. | Account detail | `GET /cooperatives/my-profile`, `GET /cooperatives/savings-accounts`, `GET /cooperatives/savings-transactions` |
| M16 | Savings Account Detail | `money/savings/[id].tsx` | Balance, interest, transaction history. | — | `GET /cooperatives/savings-accounts/:id` |
| M17 | My Loans | `money/loans/index.tsx` | Active/closed loans: principal, outstanding, next repayment, progress; my applications with status. | Apply · loan detail | `GET /cooperatives/loans`, `GET /cooperatives/loan-applications` |
| M18 | Loan Detail | `money/loans/[id].tsx` | Repayment schedule table (due date, amount, status), repayments made, guarantors. | — | `GET /cooperatives/loans/:id`, `GET /cooperatives/loan-repayments` |
| M19 | Apply for Loan | `money/loans/apply.tsx` | 3 steps: product picker (rate, max amount, tenure) → amount/tenure with live repayment estimate → purpose + guarantor selection (member search) → review. | Submit | `GET /cooperatives/loan-products`, `GET /members` (guarantor search), `POST /cooperatives/loan-applications` |
| M20 | Guarantor Requests | `money/guarantor-requests.tsx` | Requests where I'm a guarantor: applicant, amount, product. | Accept · Decline (reason) | `GET /cooperatives/guarantor-requests/pending`, `POST /cooperatives/guarantor-requests/:id/respond` |

### 6.5 Community tab — `app/(app)/(tabs)/community/`

| # | Screen | Route | Perm | Content | Actions | API |
|---|---|---|---|---|---|---|
| C1 | Community Hub | `community/index.tsx` | any | Sections: Next meeting, Active votes & polls, Welfare (my contributions summary), Latest announcements. Each with "See all". | — | `GET /meetings/upcoming`, `GET /voting/active`, `GET /welfare/my-profile` |
| C2 | Meetings (member) | `community/meetings/index.tsx` | `MEETING_VIEW` | Upcoming / Past segmented list; meeting card (type, date/time, venue or online link, status). | Detail | `GET /meetings/upcoming`, `GET /meetings/recent` |
| C3 | Meeting Detail (member view) | `community/meetings/[id].tsx` | any | Title, type, date, venue (open in Maps), online link (open), agenda list, my attendance status, approved minutes (read). | Add to calendar · Open link | `GET /meetings/:id`, `GET /meetings/:id/minutes` |
| C4 | My Attendance | `community/meetings/attendance.tsx` | any | Attendance rate ring, history list. | — | `GET /meetings/attendance-history` |
| C5 | Elections & Votes | `community/voting/index.tsx` | any | Active, upcoming, past elections; my voter status per election. | Detail | `GET /voting/dashboard`, `GET /voting/elections` |
| C6 | Election Detail | `community/voting/[id].tsx` | any | Status timeline (Draft → Nominations → Voting → Closed → Results), positions with candidates (photo, manifesto expandable). | Self-nominate (during nominations) · Cast ballot (during voting) · View results | `GET /voting/elections/:id`, `GET /voting/elections/:id/candidates`, `GET /voting/elections/:id/voter-status`, `POST /voting/elections/:id/self-nominate` |
| C7 | Ballot | `community/voting/[id]/ballot.tsx` | eligible voter | Stepper, one position per page, radio cards per candidate; review page; re-auth before submit; irreversible warning. | Submit vote | `POST /voting/elections/:id/vote/bulk` |
| C8 | Election Results | `community/voting/[id]/results.tsx` | any (after publish) | Per position: winner highlight, bar per candidate with votes and %. Turnout stat. | Share | `GET /voting/elections/:id/results` |
| C9 | Polls | `community/polls/index.tsx` | any | Active and closed polls. | — | `GET /voting/polls` |
| C10 | Poll Detail | `community/polls/[id].tsx` | any | Question, options (single/multi per poll type), respond, results after responding or close (per poll settings). | Respond | `GET /voting/polls/:id`, `POST /voting/polls/:id/respond`, `GET /voting/polls/:id/results` |
| C11 | Welfare (member) | `community/welfare/index.tsx` | any | My welfare profile & eligibility, funds I contribute to, contribution history, my payout requests and status. | Contribute · Request payout | `GET /welfare/my-profile`, `GET /welfare/eligibility`, `GET /welfare/contributions`, `GET /welfare/payouts` |
| C12 | Request Payout | `community/welfare/request.tsx` | eligible | Fund picker, payout type (bereavement, medical, wedding, childbirth… from enum), amount, description, supporting documents. Bereavement variant form. | Submit | `GET /welfare/funds`, `POST /welfare/payouts` or `POST /welfare/payouts/bereavement` |
| C13 | Announcements | `community/announcements/index.tsx` | any | Feed of announcement-type notifications, newest first. | Detail | `GET /notifications?type=announcement` |

### 6.6 Notifications — `app/(app)/notifications/`

| # | Screen | Route | Content | Actions | API |
|---|---|---|---|---|---|
| N1 | Inbox | `notifications/index.tsx` | All / Unread segmented; grouped by Today / This week / Earlier; type icon; swipe to mark read / delete. Tap routes to the related entity (see push routing table in architecture.md). | Mark all read | `GET /notifications`, `GET /notifications/unread-count`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `DELETE /notifications/:id` |
| N2 | Notification Preferences | `notifications/preferences.tsx` | Toggles per category × channel (push, email, SMS); device push permission status with "Open settings" if denied. | Save | `GET/PUT /notifications/preferences` |

### 6.7 Profile tab — `app/(app)/(tabs)/profile/`

| # | Screen | Route | Content | Actions | API |
|---|---|---|---|---|---|
| P1 | Profile Home | `profile/index.tsx` | Avatar (initials), name, member ID, role chips, association card. Menu: My profile, Security, Notifications, Appearance, Help & support, About, Switch association, Sign out. | — | `GET /auth/me` |
| P2 | My Profile | `profile/details.tsx` | View/edit personal info: phone, address, city, state, country, occupation, DOB, gender, emergency contact. Email read-only. | Save | `GET /members/me/profile`, `POST /members/me/profile` (or `PATCH /members/me`) |
| P3 | Security | `profile/security.tsx` | Change password; biometric unlock toggle; auto-lock timeout; signed-in devices count (from refresh tokens) with "Sign out other devices". | Save | `POST /auth/change-password`, `GET /auth/sessions`, `POST /auth/sessions/revoke-others` |
| P4 | Appearance | `profile/appearance.tsx` | System / Light / Dark. | — | local |
| P5 | Help Center | `profile/help/index.tsx` | Search, quick actions, article categories, FAQs entry, "Ask AI" entry (if `ai` module), contact support. | — | `GET /help`, `GET /help/quick-actions`, `GET /help/categories/articles` |
| P6 | Article | `profile/help/article/[slug].tsx` | Rendered article (markdown/HTML subset), "Was this helpful?" | Helpful yes/no | `GET /help/articles/:slug`, `POST /help/articles/:id/helpful` |
| P7 | FAQs | `profile/help/faqs.tsx` | Accordion by category, search. | — | `GET /help/faqs/by-category` |
| P8 | My Tickets | `profile/help/tickets/index.tsx` | Tickets with status chips. | New ticket | `GET /support/tickets` |
| P9 | New Ticket | `profile/help/tickets/new.tsx` | Category, priority, subject, description, attachments; AI suggested articles shown while typing (debounced). | Submit | `POST /support/tickets`, `POST /help/ai/suggest-articles` |
| P10 | Ticket Thread | `profile/help/tickets/[id].tsx` | Chat-style thread of responses, reply composer, close/reopen. | Reply · Close · Reopen | `GET /support/tickets/:id`, `POST /support/tickets/:id/respond`, `/close`, `/reopen` |
| P11 | About | `profile/about.tsx` | App version + build, OTA update channel, terms & privacy (open web), licences, "User manual" link to the docs site. | Check for updates | expo-updates |
| P12 | User manual (link) | row in P1 and P5 | Opens `https://docs.societyledger.com.ng/docs` (or the mobile section) in the in-app browser. Not a screen — a link row. | Open | — (docs site, §9.8) |

> **Contextual help links (all tabs):** screens listed in the docs link map (`architecture.md §15.4`) show a `?` icon in the header that opens the matching docs page in the in-app browser. Links never point to `plan-billing/*` docs pages from the mobile app (store billing rules).

### 6.8 Manage tab — officer hub — `app/(app)/(tabs)/manage/`
`manage/index.tsx` is a **grouped menu** of the sections below, each row visible only if the user has the section perm **and** the module is enabled. Each row shows a pending-count badge where applicable.

#### 6.8.1 Members — Perm `members.view` / `members.view_all`
| # | Screen | Route | Content | Actions (perm) | API |
|---|---|---|---|---|---|
| MG1 | Members List | `manage/members/index.tsx` | Search (name, member ID, email, phone), filter sheet (status, category, login status), stats header (total/active/new this month), infinite list. | Add (`members.create`) · Invite (`members.create`) | `GET /members`, `GET /members/stats` |
| MG2 | Member Detail | `manage/members/[id].tsx` | Header (avatar, name, ID, status chip), tabs: Profile · Finance (summary + ledger link) · Attendance · Cooperative · Welfare. | Call · WhatsApp · Email · Edit (`members.edit_all`) · Disable (`members.disable`) · Record payment (`payments.manual_create`) · Statement | `GET /members/:id`, `GET /finance/members/:memberId/summary`, `GET /cooperatives/members/:id/profile`, `GET /welfare/members/:memberId/profile` |
| MG3 | Create / Edit Member | `manage/members/form.tsx` | Sectioned form mirroring web (personal, contact, membership: category, status, join date; emergency contact; notes). | Save | `POST /members`, `PATCH /members/:id` |
| MG4 | Invite Member | `manage/members/invite.tsx` | Pick existing member without login, choose channel (email/SMS), send; list of pending invites with resend/revoke. | Send · Resend · Revoke | `/member-invites/*` |
| MG5 | Pending Approvals | `manage/members/approvals.tsx` | Self-registered users awaiting approval. | Approve · Reject (reason) (`members.manage_roles`) | approvals endpoints used by web `settings/users` |

#### 6.8.2 Finance — Perm `ledger.view`
| # | Screen | Route | Content | Actions (perm) | API |
|---|---|---|---|---|---|
| FN1 | Finance Overview | `manage/finance/index.tsx` | Balance, inflow/outflow this month, outstanding, collection rate, category breakdown chart; links to all finance screens. | — | `GET /finance/dashboard`, `GET /finance/categories/stats` |
| FN2 | Transactions | `manage/finance/transactions/index.tsx` | Filterable list (type, category, status, member, date range), stats header. | Create (`ledger.create`) · bulk select → delete (`ledger.reverse`) | `GET /finance/transactions`, `GET /finance/transactions/stats` |
| FN3 | Transaction Detail | `manage/finance/transactions/[id].tsx` | Full detail, payments applied, audit trail, accounting sync status. | Edit (`ledger.edit`) · Void & replace (`ledger.edit`) · Delete + Undo (`ledger.reverse`) · Record payment (`payments.manual_create`) | `GET /finance/transactions/:id`, `PUT /finance/transactions/:id/edit`, `POST …/void-and-replace`, `DELETE …`, `POST /finance/transactions/undo-delete/:auditLogId` |
| FN4 | Create Transaction | `manage/finance/transactions/new.tsx` | Single member or bulk (multi-member picker / all members by category). Category, amount, due date, description. | Save | `POST /finance/transactions`, `POST /finance/transactions/bulk` |
| FN5 | Record Payment | `manage/finance/payments/new.tsx` | Member picker → their outstanding items → amount, method, date, reference, notes. | Save (`payments.manual_create`) | `POST /finance/payments` |
| FN6 | Categories | `manage/finance/categories.tsx` | List with type (income/expense), default amount, usage count. | Create/Edit/Delete (`ledger.create`/`ledger.edit`) | `/finance/categories*` |
| FN7 | Dues | `manage/finance/dues.tsx` | Dues transactions with status filter and totals. | — | `GET /finance/transactions?type=dues` |
| FN8 | Levy Campaigns | `manage/finance/levies/index.tsx` | Campaigns with progress bars (collected vs target). | Create (`ledger.create`) | `GET /finance/advanced/levies/campaigns` |
| FN9 | Levy Detail | `manage/finance/levies/[id].tsx` | Progress, assignments list (paid/unpaid), stats. | Assign members · Remove assignment · Edit · Close | `/finance/advanced/levies/campaigns/:id*` |
| FN10 | Donations | `manage/finance/donations.tsx` | Stats, allocations (causes) with totals, donation records. | Record donation · Manage allocations · Share receipt | `/finance/advanced/donations*` |
| FN11 | Penalties | `manage/finance/penalties.tsx` | Stats, rules list, applied penalties, waivers. | Create/edit rule · Apply late fees now · Waive (reason) | `/finance/advanced/penalties*` |
| FN12 | Overdue | `manage/finance/overdue.tsx` | Members with overdue balances sorted by amount/days. | Send reminder (single/bulk) · Call | `GET /finance/reminders/members`, `POST /finance/reminders/send` |
| FN13 | Member Ledgers | `manage/finance/ledgers/index.tsx` | Members with balances; search. | Detail | `GET /member-ledger/ledger/members` |
| FN14 | Member Ledger Detail | `manage/finance/ledgers/[memberId].tsx` | Same layout as M6 for a member. | Export statement · Resync (`ledger.edit`) | `/member-ledger/ledger/:memberId/*` |

#### 6.8.3 Payments verification (Nigerian payments) — Perm `payments.nigerian.view`
| # | Screen | Route | Content | Actions (perm) | API |
|---|---|---|---|---|---|
| PY1 | Payments Hub | `manage/payments/index.tsx` | Unmatched dashboard counts: pending proofs, pending transfers, unmatched statement entries. | — | `GET /payments/nigerian/unmatched-dashboard` |
| PY2 | Payment Proofs Queue | `manage/payments/proofs/index.tsx` | Pending / verified / rejected tabs. | — | `GET /payments/nigerian/proofs` |
| PY3 | Proof Detail | `manage/payments/proofs/[id].tsx` | Pinch-zoom image / PDF viewer, submitted details, member's outstanding items to match. | Verify / Reject (`payments.nigerian.verify`) | `GET /payments/nigerian/proofs/:id`, `POST …/:id/verify` |
| PY4 | Bank Transfers | `manage/payments/transfers/index.tsx` | List with status filter. | Record transfer (`payments.nigerian.record`) | `GET /payments/nigerian/bank-transfers` |
| PY5 | Transfer Detail | `manage/payments/transfers/[id].tsx` | Details, match status. | Verify (`payments.nigerian.verify`) · Edit | `GET/PATCH …/bank-transfers/:id`, `POST …/:id/verify` |
| PY6 | Record Transfer | `manage/payments/transfers/new.tsx` | Member, amount, date, sender bank, reference, receiving account. | Save | `POST /payments/nigerian/bank-transfers` |
| PY7 | Bank Accounts | `manage/payments/bank-accounts.tsx` | Association accounts (bank, number, name, default flag). | Add/Edit/Delete (`settings.edit`) | `/payments/nigerian/bank-accounts*` |
| PY8 | Reconciliation | `manage/payments/reconciliation.tsx` | Statement imports list; upload CSV/XLSX statement (document picker); unmatched entries with suggested matches; auto-match preview & apply; history. | Import (`payments.nigerian.import`) · Match/confirm (`payments.nigerian.reconcile`) | `POST /payments/nigerian/import-statement`, `GET /statement-imports`, `GET /statement-entries`, `POST /auto-match`, `POST /auto-match/apply`, `POST /reconcile`, `POST /reconciliations/:id/confirm`, `GET /reconciliations` |

#### 6.8.4 Accounting — Perm `ledger.view`, module `accounting`
| # | Screen | Route | Content | Actions | API |
|---|---|---|---|---|---|
| AC1 | Accounting Dashboard | `manage/accounting/index.tsx` | Totals by account type, period status, sync status/errors. | Sync now (`ledger.edit`) | `GET /accounting/dashboard`, `GET /accounting/sync/status`, `GET /accounting/sync/errors` |
| AC2 | Chart of Accounts | `manage/accounting/accounts.tsx` | Grouped by type (Asset, Liability, Equity, Income, Expense), balances; initialize if empty. | Add/Edit/Delete | `/accounting/chart-of-accounts*` |
| AC3 | Journal Entries | `manage/accounting/journal/index.tsx` | List by status (draft, pending, approved, posted, rejected). | New entry | `GET /accounting/journal-entries` |
| AC4 | Journal Entry Detail / Form | `manage/accounting/journal/[id].tsx` | Lines (account, debit, credit) with live balanced check; status actions. | Save · Submit · Approve/Reject (`payments.approve`) · Post | `GET/POST/PUT /accounting/journal-entries*`, `/submit`, `/approval`, `/post` |
| AC5 | Financial Statements | `manage/accounting/statements.tsx` | Segmented: Income Statement · Balance Sheet · Cash Flow; period picker; collapsible sections; totals. | Export (PDF) | `GET /accounting/income-statement`, `/balance-sheet`, `/cash-flow` |
| AC6 | Budgets | `manage/accounting/budgets/index.tsx` + `[id].tsx` | Budget list; detail with items and variance bars (budget vs actual). | Create/Edit · Approve · Activate | `/accounting/budgets*`, `/budgets/:id/variance` |

#### 6.8.5 Reports & Exports — Perm `reports.generate`
| # | Screen | Route | Content | API |
|---|---|---|---|---|
| RP1 | Reports Hub | `manage/reports/index.tsx` | Cards for each report. | — |
| RP2 | Financial Summary | `manage/reports/financial-summary.tsx` (`reports.financial_summary`) | Period picker; income vs expense; category table; chart. | `GET /reports/financial-summary` |
| RP3 | Member Balances | `manage/reports/member-balances.tsx` | Sortable list of members with balances. | `GET /reports/member-balances` |
| RP4 | Aging Analysis | `manage/reports/aging.tsx` | Buckets 0–30/31–60/61–90/90+ stacked bar + member list per bucket. | `GET /reports/aging-analysis` |
| RP5 | Collection Rate | `manage/reports/collection-rate.tsx` | Rate over time line chart, by category. | `GET /reports/collection-rate` |
| RP6 | By Category | `manage/reports/by-category.tsx` | Category breakdown bars. | `GET /reports/by-category` |
| RP7 | Exports | `manage/reports/exports.tsx` (`reports.export`) | Generate: financial PDF/Excel, members Excel, member statement; history list; download → share sheet. | `POST /exports/financial-pdf`, `/financial-excel`, `/members-excel`, `/member-statement/:memberId`, `GET /exports/history`, `GET /exports/download/:id` |

#### 6.8.6 Governance (officer) — Perm `meetings`/`elections`/`polls` management perms (see §6.9)
| # | Screen | Route | Content | Actions | API |
|---|---|---|---|---|---|
| GV1 | Meetings Admin | `manage/meetings/index.tsx` | Stats, upcoming/recent/all with filters. | Create | `GET /meetings/stats`, `GET /meetings` |
| GV2 | Meeting Form | `manage/meetings/form.tsx` | Title, type (enum), date/time, duration, venue or online link, description, agenda items (reorderable). | Save · Cancel meeting · Delete | `POST/PATCH /meetings/:id`, `/agenda*`, `/cancel`, `DELETE` |
| GV3 | Meeting Admin Detail | `manage/meetings/[id].tsx` | Overview, agenda, attendance summary, minutes status. | Take attendance · Minutes | `GET /meetings/:id` |
| GV4 | Take Attendance | `manage/meetings/[id]/attendance.tsx` | Initialize roster; searchable member list with Present/Absent/Excused/Late segmented per row; bulk "mark all present"; live counts; optimistic updates. | Save | `POST /meetings/:id/attendance/initialize`, `GET/POST /meetings/:id/attendance`, `POST …/attendance/bulk` |
| GV5 | Minutes | `manage/meetings/[id]/minutes.tsx` | Rich-ish text editor (markdown), decisions, action items. | Save · Approve | `GET/POST/PATCH /meetings/:id/minutes`, `POST …/approve` |
| GV6 | Attendance History (all) | `manage/meetings/attendance.tsx` | Rates per member/meeting. | — | `GET /meetings/attendance-history` |
| GV7 | Elections Admin | `manage/elections/index.tsx` | Voting dashboard stats + elections list. | Create | `GET /voting/dashboard`, `GET /voting/elections` |
| GV8 | Election Form | `manage/elections/form.tsx` | Title, type, description, nomination & voting windows, eligibility; positions (add/edit/remove). | Save · Delete | `POST/PUT/DELETE /voting/elections*`, `/positions*` |
| GV9 | Election Control | `manage/elections/[id].tsx` | Lifecycle buttons gated by status: Start nominations → Close nominations → Start voting → Close voting → Publish results; Cancel. Candidates per position with approve/withdraw/add; live turnout during voting. | Lifecycle · Candidate approve/add | `/voting/elections/:id/start-nominations` … `/publish-results`, `/cancel`, `/candidates*`, `/candidates/:id/approve`, `/withdraw` |
| GV10 | Polls Admin | `manage/polls/index.tsx` + `form.tsx` + `[id].tsx` | Create poll (question, type, options, schedule), start/close/cancel, results. | CRUD + lifecycle | `/voting/polls*`, `/options/:id` |

#### 6.8.7 Welfare (officer) — Perm `welfare.view` (+ contribution/payout perms)
| # | Screen | Route | Content | Actions | API |
|---|---|---|---|---|---|
| WF1 | Welfare Dashboard | `manage/welfare/index.tsx` | Fund summaries, pending payouts, contributions this month. | — | `GET /welfare/dashboard`, `GET /welfare/fund-summaries` |
| WF2 | Funds | `manage/welfare/funds/index.tsx` + `form.tsx` | Fund list (type, balance, status); create/edit. | CRUD | `/welfare/funds*` |
| WF3 | Contributions | `manage/welfare/contributions.tsx` | List with pending confirmations. | Record · Bulk record · Confirm | `GET/POST /welfare/contributions`, `/bulk`, `/:id/confirm` |
| WF4 | Payout Requests | `manage/welfare/payouts/index.tsx` + `[id].tsx` | Queue by status; detail with documents. | Review (approve/reject) · Disburse · Cancel | `GET /welfare/payouts`, `/:id/review`, `/:id/disburse`, `/:id/cancel` |

#### 6.8.8 Cooperatives (officer) — Perm `payments.approve` for management, module `cooperatives`
| # | Screen | Route | Content | Actions | API |
|---|---|---|---|---|---|
| CP1 | Cooperative Dashboard | `manage/cooperatives/index.tsx` | Total savings, loans outstanding, pending applications, repayments due. | — | `GET /cooperatives/dashboard` |
| CP2 | Savings Admin | `manage/cooperatives/savings.tsx` | All accounts; open account; record deposit/withdrawal. | Create account · Record transaction | `GET/POST /cooperatives/savings-accounts`, `POST /cooperatives/savings-transactions` |
| CP3 | Loan Products | `manage/cooperatives/products.tsx` | Products CRUD (rate, interest type, tenure, limits, guarantors required). | Create/Edit | `/cooperatives/loan-products*` |
| CP4 | Loan Applications | `manage/cooperatives/applications/index.tsx` + `[id].tsx` | Queue; detail with member profile, guarantor statuses, affordability. | Review (approve/reject) · Disburse | `GET /cooperatives/loan-applications*`, `/:id/review`, `/:id/disburse` |
| CP5 | Loans & Repayments | `manage/cooperatives/loans.tsx` | Active loans; record repayment. | Record repayment | `GET /cooperatives/loans`, `POST /cooperatives/loan-repayments` |

#### 6.8.9 Communication — Perm `notifications.send` / `communication.sms.*`
| # | Screen | Route | Content | Actions | API |
|---|---|---|---|---|---|
| CM1 | Communication Hub | `manage/communication/index.tsx` | Compose announcement, SMS dashboard (credit balance, sent this month). | — | `GET /sms/dashboard`, `GET /sms/credits/balance` |
| CM2 | New Announcement | `manage/communication/announcement.tsx` | Title, message, audience (all / category / selected), also email toggle. Sends in-app + push. | Send | `POST /notifications/announcement` |
| CM3 | Quick SMS | `manage/communication/sms/send.tsx` (`communication.sms.send`) | Recipients (members picker/category/all), template picker, message with character & page counter, cost estimate. | Send | `POST /sms/send`, `GET /sms/templates` |
| CM4 | SMS Campaigns | `manage/communication/sms/campaigns/*` | List, create, detail (stats), start/cancel/delete. | CRUD + lifecycle | `/sms/campaigns*` |
| CM5 | SMS Templates | `manage/communication/sms/templates.tsx` | CRUD by category. | CRUD | `/sms/templates*` |
| CM6 | SMS History | `manage/communication/sms/history.tsx` | Messages with delivery status; credits history. | — | `GET /sms/messages`, `GET /sms/credits/history` |

#### 6.8.10 AI Assistant — module `ai`
| # | Screen | Route | Content | API |
|---|---|---|---|---|
| AI1 | Assistant Chat | `manage/ai/index.tsx` | Chat UI with suggested prompts ("Who owes the most?", "Summarise this month's collections"), streaming-style reveal, rate-limit indicator, usage. Responses can include tables rendered as cards. | `POST /ai/chat`, `POST /ai/query`, `POST /ai/financial/ask`, `GET /ai/rate-limit`, `GET /ai/usage` |
| AI2 | Smart Reminders | `manage/ai/reminders.tsx` | AI-suggested reminder targets → send. | `GET /ai/reminders/suggestions`, `POST /finance/reminders/send` |
| AI3 | AI Report | `manage/ai/report.tsx` | Generate narrative report for a period; share. | `POST /ai/reports/generate` |

#### 6.8.11 Settings (association) — Perm `settings.view` (edit: `settings.edit`)
| # | Screen | Route | Content | API |
|---|---|---|---|---|
| ST1 | Settings Hub | `manage/settings/index.tsx` | Rows for each category below. | — |
| ST2 | Association Profile | `manage/settings/association.tsx` | Name, logo (upload/remove), contact, address, primary colour. | `GET/PATCH /settings/association/profile`, `POST/DELETE /settings/association/logo` |
| ST3 | Financial Settings | `manage/settings/financial.tsx` | Currency, financial year start, dues defaults, late fee defaults. | `GET/PATCH /settings/financial` |
| ST4 | Payment Settings | `manage/settings/payments.tsx` | Enabled methods, Paystack status (read-only keys info). | `GET/PATCH /settings/payments` |
| ST5 | Notification Settings | `manage/settings/notifications.tsx` | Association-level defaults (reminder schedules, channels). | `GET/PATCH /settings/notifications` |
| ST6 | Members & Access | `manage/settings/members-access.tsx` | Self-registration on/off, approval required, member ID format. | `GET/PATCH /settings/members-access` |
| ST7 | Users | `manage/settings/users.tsx` | Users with login, role chips, active toggle. | `GET /rbac/users` |
| ST8 | Roles & Permissions | `manage/settings/roles/index.tsx` + `[id].tsx` (`roles.view`; edit `roles.edit`; assign `roles.assign`) | Role list; role detail with permissions grouped by category (toggle list); assign/remove role to users. | `GET /rbac/permissions`, `GET/POST/PUT/DELETE /rbac/roles*`, `POST /rbac/assign`, `POST /rbac/remove` |
| ST9 | Audit Log | `manage/settings/audit.tsx` (`audit.view`) | Filterable activity feed. | settings/audit endpoint used by web |
| ST10 | Subscription (read-only) | `manage/settings/subscription.tsx` (`settings.billing`) | Current plan, status, renewal/expiry date, modules included. Plain text: "Billing is managed on the SocietyLedger website." No purchase, upgrade or price-comparison UI, no outbound purchase link. | `GET /subscriptions/current` |
| ST11 | Support Tickets (all) | `manage/support/index.tsx` + `[id].tsx` (`support.view_all`) | All association tickets, assign, respond, AI suggested reply. | `/support/tickets*`, `POST /help/ai/suggest-response` |

### 6.9 Permission → section map (Manage tab visibility)
| Manage section | Visible if user has any of |
|---|---|
| Members | `members.view`, `members.view_all` |
| Finance | `ledger.view` |
| Payments verification | `payments.nigerian.view`, `payments.nigerian.verify` |
| Accounting | `ledger.view` **and** module `accounting` |
| Reports & Exports | `reports.generate`, `reports.financial_summary`, `reports.export` |
| Meetings admin | `MEETING_CREATE` (`members.create`) or `MEETING_EDIT` (`members.edit`) |
| Elections & Polls admin | `ELECTION_MANAGE` / `POLL_MANAGE` (both `members.create`) |
| Welfare admin | `WELFARE_MANAGE` (`ledger.create`) or `WELFARE_PAYOUT_APPROVE` (`payments.approve`) |
| Cooperatives admin | `payments.approve` **and** module `cooperatives` |
| Communication | `notifications.send`, `communication.sms.view` |
| AI Assistant | module `ai` **and** `reports.generate` |
| Settings | `settings.view`, `roles.view`, `audit.view` |
| Support (all tickets) | `support.view_all` |

> **How permission keys work in this codebase:** the database holds ~60 base keys (`members.view`, `ledger.view`, `payments.approve`…). Feature names like `MEETING_EDIT` or `WELFARE_VIEW` are **aliases** that map onto base keys (e.g. `WELFARE_VIEW → 'ledger.view'`, `MEETING_VIEW → 'members.view_own'`). The mobile app copies the alias map into `src/lib/permissions.ts` (F1.6) and always gates by **alias name**, so a future remap only touches one file.
> Known drift to resolve in F1.6: `MEETING_MINUTES` is `members.view_own` in `apps/api/src/lib/permissions.ts` but `members.edit` in `apps/web/src/lib/permissions.ts`. The **API file wins** for what the server allows; the mobile app hides minute editing unless the user has `members.edit` (stricter) until the owner decides.
> Screen-level "Perm" values in §6 written as `meetings`/`welfare.view` etc. refer to these aliases: `welfare.view` = `WELFARE_VIEW`, `payments.approve` for co-op management = `COOPERATIVE_LOANS_MANAGE`.

---

## 7. In scope vs out of scope

### 7.1 In scope (v1)
- Everything in §6.
- Association-code tenant selection with recent associations.
- Email/password auth, email verification, password reset, invite acceptance, self-registration, association signup + onboarding.
- **Refresh-token sessions** for mobile (backend addition).
- **Push notifications** via Expo (backend addition), with deep-link routing.
- **Paystack checkout in an in-app auth session** with a mobile return bridge (backend addition).
- Biometric app lock, auto-lock timeout, re-auth before voting and before irreversible money actions (void, disburse).
- Light/dark theme.
- Persisted read cache + offline banner.
- File upload (proofs, logo, ticket attachments, bank statements) from camera, gallery and files.
- File download + share sheet for exports, statements, receipts.
- OTA updates via EAS Update; builds via EAS Build; store submission via EAS Submit.
- Crash/error reporting.
- Small web change: "Open in app" links on `/auth/activate` and `/auth/reset-password`.
- "User manual" and contextual `?` help links from the mobile app to the docs site (§9.8).

### 7.2 Out of scope (v1) — do not build, do not stub
- Any **platform / Super Admin** screen (tenants, modules, analytics, cron, webhooks, blog/docs admin, settlements, impersonation) — these live only in the admin console (§10).
- Public marketing site, blog, pricing pages **inside the mobile app** (the documentation site is deliverable A — the app only links to it).
- **In-app purchase or payment of the association's SocietyLedger subscription, plan upgrades/changes, and SMS credit purchases** (App Store / Play billing rules). These remain web-only; the app shows read-only status and a plain-text note.
- Nomba gateway checkout (Paystack only on mobile).
- WhatsApp channel screen and the legacy duplicate `/dashboard/communications/*` campaign screens (mobile uses the `/sms` module only).
- Bulk member import from spreadsheet (web only), custom report builder (`exports/custom`), help-content authoring (`settings/help-content`), data-privacy export (`settings/data-privacy`), accounting-integration settings, integrations settings.
- AI document upload/RAG management (`ai/documents`) and AI usage admin beyond the usage indicator.
- Offline mutations / sync queue.
- Multiple simultaneous signed-in associations (switching = sign out + sign in).
- Social login, SMS OTP login, 2FA enrolment (2FA enforcement flag exists on Association but no API flow yet).
- Tablet-optimised layouts, landscape, widgets, Apple Watch / Wear OS.
- Languages other than English.
- Universal/App Links on subdomains (custom scheme `societyledger://` only in v1).
- QR self check-in for meetings (no API support yet).

### 7.3 Scope rules for the agent
1. If a request is not in §6, §7.1, §9 or §10, stop and ask; do not "helpfully" add it.
2. If the API lacks an endpoint a screen needs, do **not** invent one in the app. Record it under "Backend gaps" in `progress-tracker.md` and ask.
3. Backend changes are limited to those listed in `architecture.md §9` (mobile) and `architecture.md §16.6` (admin console).

---

## 8. Success criteria
- Member can go from cold start to completed Paystack payment in ≤ 6 taps with a remembered session.
- Officer can verify a payment proof from a push notification in ≤ 3 taps.
- Cold start to interactive Home ≤ 2.5 s on a mid-range Android (e.g. Samsung A14) on 4G with warm cache.
- Crash-free sessions ≥ 99.5 %.
- Every gated control is hidden (not just disabled) for users without the permission.
- Docs site: see §9.10.

---

## 9. Deliverable A — Documentation site (docs.societyledger.com.ng)

### 9.1 What it is
A public, searchable **user manual** for SocietyLedger at `https://docs.societyledger.com.ng/docs`, living in the monorepo at `apps/docs`. It explains **every area of the application** — web and mobile — in plain language, organised by what people are trying to get done. It is modelled on the BusinessCopilot docs (`https://docs.businesscopilot.com.ng/docs`): grouped sidebar by module, ⌘K search, "On this page" table of contents, short task pages with numbered steps, bold UI labels and arrow menu paths, screenshots, cross-links to concept pages, and per-module FAQs.

### 9.2 The problem it solves
| Problem today | How the docs site solves it |
|---|---|
| Admins learn SocietyLedger by trial and error or by messaging support. | Step-by-step task pages for every screen, with screenshots. |
| Members don't know how to pay, upload proof, read their statement or vote. | A dedicated **Member guide** written for non-technical members, linkable from reminders and announcements. |
| Officers with custom roles don't understand why they can or can't see something. | Every page states who can use it (permission/role) and on which plan; a full permissions reference. |
| Help content is scattered: `help-guides/*.md` in the repo, a DB-backed `/documentation` section on the web, in-app Help articles. | One canonical, versioned, searchable manual; `help-guides/` content migrated in; web `/documentation` redirects to it. |
| Support repeatedly answers the same questions. | Troubleshooting & FAQ section per area; pages linked from support replies and from in-app `?` icons. |
| SEO: prospects search "how to collect association dues online Nigeria". | Indexable, fast static pages with metadata, sitemap and structured data. |

### 9.3 Audiences
| Audience | What they need | Where they start |
|---|---|---|
| **Founder / new admin** | Create the association, finish onboarding, configure finance, invite officers and members. | Getting started |
| **Officers** (treasurer, financial secretary, secretary, welfare officer, custom roles) | Do their module's tasks correctly; understand approvals and statuses. | Module sections (Finance, Payments, Meetings…) |
| **Members** | Sign in, pay, upload proof, read statement, vote, use savings/loans/welfare, get help. | Member guide |
| **Prospects** (pre-signup) | Understand what SocietyLedger does and how it works before buying. | Introduction, Core concepts |
| **Support staff** | Canonical answers to link to. | Troubleshooting & FAQ, Reference |

Platform/Super Admin features are **not** documented on the public site.

### 9.4 Site structure & global navigation
- **URL scheme:** `https://docs.societyledger.com.ng/docs/<section>/<page>`; `/` redirects to `/docs`.
- **Header:** SocietyLedger Docs logo (→ `/docs`), search (⌘K / Ctrl K, `/` on mobile tap), links: *Open SocietyLedger* (→ `https://www.societyledger.com.ng`), *Get the app* (→ `/docs/mobile-app/getting-the-app`), theme toggle.
- **Sidebar:** sections in the order of §9.6, collapsible; each section's index page lists its pages as cards.
- **Every page shows:** breadcrumb, title, one-sentence description, **Applies to** line (audience · platform badges *Web* / *Mobile* · plan/module if gated · permission if gated), content, "On this page" TOC (desktop right rail; collapsible on phones), *Related* cards, previous/next links, *Was this page helpful?* (yes/no + optional comment), *Last updated* date, *Edit on GitHub* link (repo is private → link shown only in preview builds).
- **Footer:** © SocietyLedger by Megagig Software Solutions, links to main site, privacy, terms, contact support (`admin@megagigsolution.com`), status of the docs build (version/date).
- **Responsive:** fully usable on phones (members will open links from WhatsApp/SMS).

### 9.5 Page types (templates are defined in `code-standards.md §17`)
| Type | Purpose | Shape |
|---|---|---|
| **Overview** (section index) | Orient and route | 2–3 sentence intro, "Start here" cards, list of all pages as cards, link to section FAQ |
| **Task** | Do one thing | Purpose sentence → Before you start (permission, plan, prerequisites) → numbered Steps with bold UI labels and **Menu → Path** → screenshot(s) → What happens next → Related |
| **Concept** | Understand how something works | Plain explanation, diagram or worked example (e.g. how a partial payment reduces a balance), "Why it matters", Related tasks |
| **Reference** | Look something up | Tables (statuses, permissions, payment methods, modules by plan), generated where possible |
| **FAQ** | Answer common questions | Question as H2, short answer, link to task page |
| **Platform guide** | Mobile-specific usage | Same as Task with mobile screenshots and *Mobile* badge |

### 9.6 Page-by-page sitemap
Legend — **Aud.**: All · Mem (member) · Off (officer with module permission) · Adm (association admin) · Fnd (founder). **Plat.**: W = web, M = mobile, W+M = both. **Source** = the app screens/routes the page documents (web routes under `apps/web/src/app`, mobile IDs from §6). Every page's content must be verified against these sources.

#### 9.6.1 Introduction & Getting started — `/docs`, `/docs/getting-started/`
| Slug | Title | Type | Aud. | Plat. | Covers / source |
|---|---|---|---|---|---|
| `/docs` | SocietyLedger documentation | Overview | All | W+M | What SocietyLedger is, "Start here" by role (I run an association · I'm a member · I'm an officer), all sections |
| `getting-started` | Getting started | Overview | All | W+M | Paths for founders, officers, members |
| `getting-started/create-your-association` | Creating your association | Task | Fnd | W | `/signup`, choosing a subdomain (address rules, availability check), free trial, verify email (A13) |
| `getting-started/onboarding-wizard` | Finishing the setup wizard | Task | Adm | W+M | `/onboarding/*`: profile, finance, members, team, complete; skipping and resuming (O1–O5) |
| `getting-started/your-first-week` | Your first week: a setup checklist | Task | Adm | W | Categories, dues, bank account, invite officers, add members, first announcement |
| `getting-started/joining-as-a-member` | Joining your association as a member | Task | Mem | W+M | Invite email → `/auth/activate`, self-registration, pending approval (A5, A9, A10) |
| `getting-started/signing-in` | Signing in for the first time | Task | All | W+M | Association web address vs association code, `/auth/login`, verify email (A3, A4, A6) |
| `getting-started/install-the-mobile-app` | Installing the mobile app | Task | All | M | Store links, first launch, association code (A1–A3) |

#### 9.6.2 Core concepts — `/docs/core-concepts/`
| Slug | Title | Type | Aud. | Covers |
|---|---|---|---|---|
| `your-association` | Your association, explained | Concept | All | Association = workspace, subdomain/address, association code, logo, data isolation |
| `members-and-user-accounts` | Members and login accounts | Concept | Adm | Member record vs user login, login status (`no_login`, invited, active), member ID |
| `roles-and-permissions` | Roles & what each person can see | Concept | Adm | System roles (admin, treasurer, financial secretary, member), custom roles, permission-driven menus |
| `plans-and-modules` | Plans & modules | Concept | Adm | Tiers, modules (ledger, levies, donations, penalties, accounting, welfare, voting, meetings, SMS, cooperatives, loans, savings, reports, AI), what "not on your plan" looks like |
| `money-in-societyledger` | How money is tracked | Concept | All | Categories → charges (transactions) → payments; statuses paid/partial/unpaid/overdue; worked example |
| `the-member-ledger` | The member ledger and statements | Concept | All | Debits, credits, running balance, how payments apply, statement periods |
| `notifications-and-channels` | Notifications: in-app, email, SMS and push | Concept | All | Which channel is used when, preferences, SMS credits |
| `glossary` | Glossary | Reference | All | Association, member ID, dues, levy, penalty, waiver, proof, reconciliation, journal entry, guarantor, quorum… |

#### 9.6.3 Account & security — `/docs/account-security/`
| Slug | Title | Type | Aud. | Plat. | Covers |
|---|---|---|---|---|---|
| `signing-in-and-out` | Signing in and out | Task | All | W+M | Login, logout, session expiry |
| `verifying-your-email` | Verifying your email | Task | All | W+M | 6-digit code, resend, expired code |
| `resetting-your-password` | Resetting a forgotten password | Task | All | W+M | `/auth/forgot-password`, `/auth/reset-password`, deep link on mobile |
| `changing-your-password` | Changing your password | Task | All | W+M | `/dashboard/member/settings`, P3 |
| `account-approval-status` | Pending, rejected or suspended accounts | Concept | Mem | W+M | What each status means, who to contact (A10, A11) |
| `signed-in-devices` | Signed-in devices | Task | All | M | Sessions list, sign out other devices (P3; after F0.3) |
| `app-lock-and-biometrics` | App lock, Face ID and fingerprint | Task | All | M | A14, P3 |
| `switching-associations` | Belonging to more than one association | Concept | All | W+M | Separate accounts per association, switching on mobile |

#### 9.6.4 Member guide — `/docs/member-guide/` (written for members, no officer jargon)
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `index` | Member guide | W+M | Overview |
| `your-dashboard` | Your dashboard at a glance | W+M | `/dashboard/member`, H1 |
| `what-you-owe` | Seeing what you owe | W+M | `/dashboard/my-finances`, M1, M2 |
| `paying-online` | Paying online with card or bank (Paystack) | W+M | `/dashboard/my-finances/pay`, M3, M5 |
| `paying-by-bank-transfer` | Paying by bank transfer and uploading proof | W+M | `/dashboard/payments/bank-transfers/new`, M4 |
| `your-statement` | Reading and downloading your statement | W+M | `/dashboard/my-finances/ledger`, M6, M7 |
| `dues-levies-and-penalties` | Your dues, levies and penalties | W+M | `/dashboard/my-finances/dues|levies|penalties`, M8–M10 |
| `making-a-donation` | Making a donation | W+M | `/dashboard/my-finances/donations`, M11, M12 |
| `payment-history-and-receipts` | Payment history and receipts | W+M | `/dashboard/my-finances/payments`, M13 |
| `your-profile` | Keeping your profile up to date | W+M | `/dashboard/member/my-profile`, P2 |
| `meetings-and-attendance` | Your meetings and attendance | W+M | `/dashboard/member/my-meetings`, C2–C4 |
| `voting` | Voting in elections and polls | W+M | `/dashboard/member/my-voting`, C5–C10 |
| `welfare` | Welfare contributions and support requests | W+M | `/dashboard/welfare/*`, C11, C12 |
| `savings-and-loans` | Your savings and loans | W+M | `/dashboard/cooperatives/my-*`, M15–M20 |
| `notification-preferences` | Choosing which notifications you get | W+M | `/dashboard/notifications/preferences`, N2 |
| `getting-help` | Getting help | W+M | `/dashboard/help`, P5–P10 |

#### 9.6.5 Members (for officers) — `/docs/members/`
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `index` | Managing members | W+M | Overview |
| `your-member-list` | Finding members: search and filters | W+M | `/dashboard/members`, MG1 |
| `adding-a-member` | Adding a member | W+M | `/dashboard/members/create`, MG3 |
| `editing-and-disabling` | Editing or disabling a member | W+M | `/dashboard/members/[id]/edit`, MG2, MG3 |
| `categories-and-statuses` | Member categories and statuses | W | Reference of `category`, `status`, `loginStatus` |
| `inviting-members-to-log-in` | Inviting members to log in | W+M | `/dashboard/members/invite`, MG4 |
| `self-registration-and-approvals` | Self-registration and approving accounts | W+M | `/dashboard/settings/members-access`, `/dashboard/settings/users`, MG5 |
| `importing-members` | Importing members from a spreadsheet | W | bulk import (`POST /members/bulk`) |
| `the-member-profile` | The member profile: finance, attendance, cooperative | W+M | `/dashboard/members/[id]`, MG2 |
| `exporting-members` | Exporting your member list | W | `/dashboard/exports` |

#### 9.6.6 Finance — `/docs/finance/`
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `index` | Finance | W+M | Overview |
| `finance-overview` | Understanding the finance overview | W+M | `/dashboard/finance/overview`, FN1 |
| `financial-categories` | Setting up financial categories | W+M | `/dashboard/finance/categories`, FN6 |
| `creating-charges` | Charging members: single and bulk | W+M | `/dashboard/finance/transactions/create`, FN4 |
| `setting-up-dues` | Setting up recurring dues | W | `/dashboard/finance/dues`, financial settings |
| `recording-a-payment` | Recording a payment a member made | W+M | FN5, `/dashboard/finance/transactions/[id]` |
| `editing-voiding-and-deleting` | Editing, voiding or deleting a transaction (and undo) | W+M | FN3; `TRANSACTION_EDITING_UI_GUIDE.md` in repo |
| `levy-campaigns` | Running a levy campaign | W+M | `/dashboard/finance/levies*`, FN8, FN9 |
| `donations-and-causes` | Donations and causes | W+M | `/dashboard/finance/donations`, FN10 |
| `penalties-and-late-fees` | Penalties and automatic late fees | W+M | `/dashboard/finance/penalties`, FN11 |
| `waiving-a-penalty` | Waiving a penalty | W+M | FN11 |
| `overdue-and-reminders` | Following up overdue members | W+M | `/dashboard/finance/overdue|reminders`, FN12 |
| `member-ledgers` | Member ledgers and statements | W+M | `/dashboard/finance/member-ledger*`, FN13, FN14 |
| `transaction-statuses` | Transaction and payment statuses | W+M | Reference |

#### 9.6.7 Payments & bank reconciliation — `/docs/payments/`
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `index` | Payments & reconciliation | W+M | Overview |
| `how-members-pay` | Ways members can pay | W+M | Paystack, bank transfer + proof, cash/POS recorded by officers |
| `online-payments-with-paystack` | Online payments with Paystack | W | `/dashboard/settings/payments`, `/dashboard/finance/payments/verify` |
| `association-bank-accounts` | Adding your association's bank accounts | W+M | `/dashboard/payments/nigerian/bank-accounts`, PY7 |
| `verifying-payment-proofs` | Verifying payment proofs | W+M | `/dashboard/payments/nigerian/verification`, PY2, PY3 |
| `recording-bank-transfers` | Recording and verifying bank transfers | W+M | `/dashboard/payments/nigerian/transfers*`, PY4–PY6 |
| `importing-a-bank-statement` | Importing a bank statement | W+M | `/dashboard/payments/nigerian/statements`, PY8 |
| `matching-and-reconciliation` | Matching payments and reconciling | W+M | `/dashboard/payments/nigerian/reconciliation`, auto-match |
| `reconciliation-history` | Reconciliation history | W | `/dashboard/payments/nigerian/reconciliation-history` |

#### 9.6.8 Accounting — `/docs/accounting/` (at a glance) and `/docs/accounting-guide/` (in depth)
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `accounting/index` | Accounting | W+M | Overview, plan requirement |
| `accounting/what-happens-automatically` | What happens automatically when money moves | W | accounting-integration sync, `/dashboard/settings/accounting-integration` |
| `accounting/accounting-dashboard` | The accounting dashboard | W+M | `/dashboard/accounting`, AC1 |
| `accounting/income-statement-at-a-glance` | Your income statement at a glance | W+M | AC5 |
| `accounting/balance-sheet-at-a-glance` | Your balance sheet at a glance | W+M | AC5 |
| `accounting/budgets` | Budgets in brief | W+M | AC6 |
| `accounting-guide/chart-of-accounts` | The chart of accounts | W+M | `/dashboard/accounting/chart-of-accounts`, AC2 |
| `accounting-guide/how-transactions-post` | How charges and payments post to accounts | W | Concept, `docs/Accounting/*` in repo |
| `accounting-guide/journal-entries` | Journal entries: draft, approve, post | W+M | `/dashboard/accounting/journal-entries`, AC3, AC4 |
| `accounting-guide/income-statement` | Income statement in depth | W+M | `/dashboard/accounting/income-statement` |
| `accounting-guide/balance-sheet` | Balance sheet in depth | W+M | `/dashboard/accounting/balance-sheet` |
| `accounting-guide/cash-flow` | Cash flow statement | W+M | `/dashboard/accounting/cash-flow` |
| `accounting-guide/budgets-and-variance` | Budgets, approval and variance | W+M | `/dashboard/accounting/budgets` |
| `accounting-guide/accounting-periods` | Accounting periods and closing | W | AccountingPeriod |
| `accounting-guide/sync-status-and-errors` | Sync status and fixing sync errors | W+M | `/accounting/sync/*` |

#### 9.6.9 Reports & exports — `/docs/reports/`
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `index` | Reports & exports | W+M | Overview |
| `finding-the-report-you-need` | Finding the report you need | W+M | Decision table: question → report |
| `association-dashboard` | The association dashboard | W+M | `/dashboard`, H2 |
| `financial-summary` | Financial summary report | W+M | `/dashboard/reports/financial-summary`, RP2 |
| `member-balances` | Member balances report | W+M | RP3 |
| `aging-analysis` | Aging analysis: how long money has been owed | W+M | RP4 |
| `collection-rate` | Collection rate | W+M | RP5 |
| `income-by-category` | Income by category | W+M | RP6 |
| `exporting-reports` | Exporting to PDF and Excel | W+M | `/dashboard/exports`, RP7 |
| `custom-exports` | Building a custom export | W | `/dashboard/exports/custom` |
| `export-history` | Export history and downloads | W+M | `/dashboard/exports/history` |

#### 9.6.10 Meetings & attendance — `/docs/meetings/`
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `index` | Meetings | W+M | Overview |
| `scheduling-a-meeting` | Scheduling a meeting | W+M | `/dashboard/governance/meetings/create`, GV2 |
| `building-an-agenda` | Building the agenda | W+M | GV2 |
| `taking-attendance` | Taking attendance (on a laptop or phone) | W+M | `/dashboard/governance/meetings/[id]`, GV4 |
| `minutes` | Recording and approving minutes | W+M | GV5 |
| `attendance-history` | Attendance history and rates | W+M | `/dashboard/governance/attendance`, GV6 |
| `cancelling-or-postponing` | Cancelling or postponing a meeting | W+M | GV2 |
| `meeting-reminders` | Automatic meeting reminders | W+M | `jobs/meeting-jobs.ts` |

#### 9.6.11 Elections & polls — `/docs/elections/`
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `index` | Elections & polls | W+M | Overview |
| `how-elections-work` | How an election runs, start to finish | W+M | Lifecycle diagram: draft → nominations → voting → closed → results |
| `creating-an-election` | Creating an election and its positions | W+M | `/dashboard/governance/elections/new`, GV8 |
| `nominations-and-candidates` | Nominations, self-nomination and approving candidates | W+M | GV9, C6 |
| `running-the-vote` | Opening and closing voting | W+M | GV9 |
| `publishing-results` | Publishing results | W+M | GV9, C8 |
| `voter-eligibility-and-turnout` | Who can vote, and tracking turnout | W+M | `/dashboard/governance/voting` |
| `creating-a-poll` | Creating a quick poll | W+M | `/dashboard/governance/polls/new`, GV10 |
| `poll-results` | Poll results | W+M | C10 |

#### 9.6.12 Welfare — `/docs/welfare/`
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `index` | Welfare | W+M | Overview |
| `welfare-funds` | Setting up welfare funds | W+M | `/dashboard/welfare/social-funds`, WF2 |
| `recording-contributions` | Recording and confirming contributions | W+M | `/dashboard/welfare/contributions`, WF3 |
| `eligibility` | Who is eligible for support | W+M | `/welfare/eligibility` |
| `payout-requests` | Handling support requests | W+M | `/dashboard/welfare/requests`, WF4 |
| `bereavement-support` | Bereavement support | W+M | bereavement payout flow |
| `disbursing-payouts` | Approving and paying out support | W+M | WF4 |

#### 9.6.13 Cooperatives (savings & loans) — `/docs/cooperatives/`
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `index` | Cooperatives | W+M | Overview, plan requirement |
| `savings-accounts` | Opening savings accounts | W+M | `/dashboard/cooperatives/savings`, CP2 |
| `deposits-and-withdrawals` | Recording deposits and withdrawals | W+M | CP2 |
| `loan-products` | Setting up loan products | W+M | `/dashboard/cooperatives/loan-products`, CP3 |
| `applying-for-a-loan` | Applying for a loan (members) | W+M | `/dashboard/cooperatives/apply`, M19 |
| `guarantors` | Guarantors: requesting and responding | W+M | `/dashboard/cooperatives/guarantors`, M20 |
| `reviewing-and-disbursing-loans` | Reviewing, approving and disbursing loans | W+M | `/dashboard/cooperatives/applications*`, CP4 |
| `repayments-and-schedules` | Repayments and repayment schedules | W+M | `/dashboard/cooperatives/loans`, CP5, M18 |
| `member-cooperative-profile` | A member's cooperative profile | W+M | `/cooperatives/members/:id/profile` |

#### 9.6.14 Communication — `/docs/communication/`
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `index` | Communication | W+M | Overview |
| `announcements` | Sending an announcement | W+M | `/dashboard/communication/announcements/new`, CM2 |
| `in-app-notifications` | The notifications centre | W+M | `/dashboard/notifications`, N1 |
| `email` | Email notifications | W | `/dashboard/communication/email` |
| `sending-sms` | Sending an SMS | W+M | `/dashboard/communication/sms`, CM3 |
| `sms-campaigns` | SMS campaigns | W+M | `/dashboard/communication/sms/campaigns`, CM4 |
| `sms-templates` | SMS templates | W+M | CM5 |
| `sms-history` | SMS history and delivery status | W+M | CM6 |
| `buying-sms-credits` | Buying SMS credits | W | `/dashboard/communication/sms/credits` |
| `reminder-schedules` | Automatic payment reminders | W | `/dashboard/finance/reminders`, notification settings |

#### 9.6.15 AI assistant — `/docs/ai/`
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `index` | AI assistant | W+M | Overview, plan requirement |
| `asking-questions` | Asking questions about your association's finances | W+M | `/dashboard/ai/assistant|query`, AI1 |
| `smart-reminders` | Smart reminders | W+M | `/dashboard/ai/reminders`, AI2 |
| `ai-reports` | Generating AI reports | W+M | `/dashboard/ai/reports`, AI3 |
| `document-questions` | Asking questions about your documents | W | `/dashboard/ai/documents` |
| `limits-and-privacy` | AI usage limits and data privacy | W+M | `/dashboard/ai/usage`, rate limits |

#### 9.6.16 Settings, users & roles — `/docs/settings/`
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `index` | Settings | W+M | Overview |
| `association-profile` | Association profile and logo | W+M | `/dashboard/settings/association`, ST2 |
| `financial-settings` | Financial settings | W+M | `/dashboard/settings/financial`, ST3 |
| `payment-settings` | Payment settings | W+M | `/dashboard/settings/payments`, ST4 |
| `notification-settings` | Association notification settings | W+M | `/dashboard/settings/notifications`, ST5 |
| `members-and-access` | Members & access settings | W+M | `/dashboard/settings/members-access`, ST6 |
| `managing-users` | Managing user accounts | W+M | `/dashboard/settings/users`, ST7 |
| `custom-roles` | Creating custom roles | W+M | `/dashboard/settings/roles`, ST8 |
| `assigning-roles` | Assigning and removing roles | W+M | ST8 |
| `audit-log` | The audit log | W+M | `/dashboard/settings/audit-logs`, ST9 |
| `data-and-privacy` | Data and privacy: exporting your data | W | `/dashboard/settings/data-privacy` |
| `integrations` | Integrations | W | `/dashboard/settings/integrations` |
| `accounting-integration` | Accounting integration settings | W | `/dashboard/settings/accounting-integration` |
| `help-content` | Adding your own help articles and FAQs | W | `/dashboard/settings/help-content` |

#### 9.6.17 Plan & billing — `/docs/plan-billing/` (web only; never linked from the mobile app)
| Slug | Title | Source |
|---|---|---|
| `index` | Plan & billing | Overview |
| `plans-and-whats-included` | Understanding your plan and what's included | `/dashboard/subscription/plans` (no prices on docs; link to `/pricing`) |
| `free-trial` | Your free trial | trial rules, `subscription-jobs.ts` |
| `subscribing-and-paying` | Subscribing and paying | `/dashboard/subscription/checkout`, Paystack |
| `changing-your-plan` | Upgrading or downgrading | `change-plan` |
| `cancelling-and-reactivating` | Cancelling and reactivating | `cancel`, `reactivate` |
| `billing-history` | Billing history and receipts | PaymentHistory |
| `when-a-subscription-ends` | What happens when a subscription ends | grace, read-only states, renewal reminders |

#### 9.6.18 Mobile app — `/docs/mobile-app/` (published as the mobile app ships — D7)
| Slug | Title | Source |
|---|---|---|
| `index` | The SocietyLedger mobile app | Overview, what's on mobile vs web |
| `getting-the-app` | Getting the app | store listings (A1, A2) |
| `signing-in-on-mobile` | Signing in with your association code | A3, A4 |
| `finding-your-way-around` | Finding your way around: tabs and menus | §5 navigation |
| `paying-on-mobile` | Paying on your phone | M2–M5 |
| `push-notifications` | Push notifications | N2, F3.1 |
| `officer-tasks-on-the-go` | Officer tasks on the go | Manage tab, PY3, GV4, CP4 |
| `offline-and-saved-data` | Using the app with poor or no internet | offline banner, cached data |
| `whats-web-only` | What you still do on the web | §7.2 list |
| `updating-the-app` | Keeping the app up to date | OTA + store updates |

#### 9.6.19 Help & support — `/docs/help-support/`
| Slug | Title | Plat. | Source |
|---|---|---|---|
| `in-app-help-center` | The in-app help centre | W+M | `/dashboard/help*`, P5–P7 |
| `support-tickets` | Opening and following a support ticket | W+M | `/dashboard/help/tickets*`, P8–P10 |
| `contacting-support` | Contacting SocietyLedger support | W+M | email, response times |

#### 9.6.20 Troubleshooting & FAQ — `/docs/troubleshooting-faq/`
| Slug | Title |
|---|---|
| `account-and-login-faq` | Account & sign-in FAQ |
| `payments-faq` | Payments FAQ (member and officer) |
| `finance-faq` | Finance FAQ |
| `members-faq` | Members FAQ |
| `governance-faq` | Meetings, elections & polls FAQ |
| `cooperatives-welfare-faq` | Cooperatives & welfare FAQ |
| `communication-faq` | Communication & SMS FAQ |
| `billing-faq` | Plan & billing FAQ |
| `mobile-app-faq` | Mobile app FAQ |

#### 9.6.21 Reference — `/docs/reference/`
| Slug | Title | Generated from |
|---|---|---|
| `permissions` | Permissions reference | `apps/api/src/lib/permissions.ts` + `/rbac/permissions` seed (script) |
| `statuses` | Statuses reference | `schema.prisma` enums + string statuses (script) |
| `payment-methods` | Payment methods | Payment method enum |
| `modules-by-plan` | Modules by plan | plan/module seeds (`seed-plans.ts`, `platform-modules.seed.ts`) |
| `release-notes` | What's new | Hand-written per release (web + mobile) |

**Total: 197 pages** across 21 sections (some sections share a folder group in the sidebar).

### 9.7 Content sources (what writers must read before writing a page)
1. The app source for the screens in the "Source" column (web pages/components, API controllers for rules and limits) — **the code is the truth**.
2. Existing material, migrated and rewritten in the docs voice: `help-guides/*/README.md` (members, finance, meetings, elections, communications, payments, cooperatives, roles, settings), `TRANSACTION_EDITING_UI_GUIDE.md`, `docs/*` feature folders (Accounting, Elections, welfare, cooperative, finances, member-finance, settings…), the DB-seeded docs in `apps/api/prisma/seeds/blog-docs.seed.ts` and `help-content.seed.ts`.
3. The live staging app with the seeded demo association (for screenshots and to click through every step).
Never document behaviour that can't be reproduced in the app.

### 9.8 Links from the web app and the mobile app
| Where | Link | Target |
|---|---|---|
| Web public header ("Docs") and footer | replaces `/documentation` | `https://docs.societyledger.com.ng/docs` |
| Web `/documentation`, `/documentation/[slug]`, `/documentation/search` | 301 redirect | docs home, mapped slug (redirect map) or docs search |
| Web dashboard sidebars (admin + member) | "User manual" item at the bottom, external-link icon | `/docs` (members → `/docs/member-guide`) |
| Web dashboard page headers | `?` "Help for this page" icon on mapped routes | page from the docs link map |
| Web Help Center (`/dashboard/help`) | "Read the full user manual" card | `/docs` |
| Web onboarding wizard | "Need help? See the setup guide" | `/docs/getting-started/onboarding-wizard` |
| Mobile Profile → Help, About | "User manual" row (P12) | `/docs` or `/docs/member-guide` by role |
| Mobile screen headers | `?` icon on mapped screens | docs link map (never `plan-billing/*`) |
| Docs site header | "Open SocietyLedger" | `https://www.societyledger.com.ng` |
All outbound links from apps to docs carry `?utm_source=web|mobile&utm_medium=<surface>` for analytics.

### 9.9 In scope / out of scope (docs)
**In scope:** every page in §9.6; search; dark/light; responsive; screenshots for every task page (web, plus mobile for W+M pages once mobile ships); SEO (metadata, sitemap, robots, Open Graph images, JSON-LD `TechArticle` + `BreadcrumbList`); `llms.txt` / `llms-full.txt`; analytics + page feedback; link checking in CI; preview deploys; the web/mobile links in §9.8; migration of `help-guides/` content; redirects from web `/documentation`.

**Out of scope (v1):** platform/Super Admin documentation; developer/API reference; languages other than English; versioned docs per release (single "current" version, plus release notes); video production (embedding existing videos is allowed); user accounts/comments on docs; an AI chat widget on the docs site; deleting the DB-backed documentation CMS API (not migrated to the admin console, unlinked everywhere, endpoints kept until the owner decides — G6); changing in-app Help article content in the database.

### 9.10 Docs success criteria
- Every in-scope web route has at least one docs page that documents it (coverage checklist in `progress-tracker.md` passes).
- Zero broken internal links and zero pending screenshots at launch.
- Lighthouse ≥ 95 for performance, accessibility, SEO on a typical task page (mobile profile).
- Search finds the right page in the top 3 results for the 30 support questions in the FAQ seed list.
- Within 60 days of launch: support tickets in categories covered by docs fall measurably (tracked via support ticket categories).

---

## 10. Deliverable C — Platform admin console (admin.societyledger.com.ng)

### 10.1 What it is
A separate Next.js application, `apps/admin`, served only at `https://admin.societyledger.com.ng`, used by SocietyLedger's own staff to run the platform: associations (tenants), subscriptions and billing overrides, modules and features, approvals, analytics, settlements, logs, platform settings, webhooks, cron jobs, the public blog, platform help content and the support desk.

Today these screens live inside the tenant web app under `apps/web/src/app/admin/**` (~13,400 lines across 14 areas) plus Super-Admin branches in the web's sidebar, login redirect, guards and stores. This deliverable **moves them out**, hardens how platform staff sign in and impersonate, and then deletes the Super Admin code from `apps/web`.

### 10.2 Why separate it
| Problem with Super Admin inside the tenant web app | What the split gives |
|---|---|
| Platform staff sign in on a tenant login page; the session cookie is set for `.societyledger.com.ng` and is readable by every tenant subdomain. | Platform staff sign in only at the admin host; the admin session lives in a **host-only** cookie on `admin.societyledger.com.ng` that no tenant subdomain can read. |
| Super Admin code ships in every tenant's JavaScript bundle and every tenant page carries `platformRole` branches. | Tenant bundle has no platform code; the attack surface and the code paths are smaller. |
| Admin and tenant releases are coupled; a risky tenant deploy can break platform tools and vice versa. | Independent build, deploy, rollback and scaling on Dokploy. |
| Super Admins browse tenant data through an `X-Association-Id` context switch inside the tenant UI. | Cross-tenant access only through **explicit, audited, time-limited impersonation** that opens the tenant's own subdomain. |
| No way to add stricter controls (IP allowlist, 2FA, shorter sessions) without affecting tenants. | Admin-only controls: optional IP allowlist, TOTP 2FA for platform users, 8-hour sessions, `noindex`. |

### 10.3 Who uses it
| Platform role (`User.platformRole`) | v1 access |
|---|---|
| `SUPER_ADMIN` | Everything in §10.6. |
| `SUPPORT_AGENT`, `FINANCE_ADMIN`, `COMPLIANCE_ADMIN` | The enum exists but the API currently guards platform routes with `SUPER_ADMIN` only. v1: these roles can sign in and see only the sections the API allows them (initially none except Support desk and Help content if those endpoints accept them). A role → section matrix is proposed in §10.7; widening API guards is a **backend gap** for the owner to approve. |

Association users (any user without `platformRole`) can never sign in to the admin console.

### 10.4 Access & security model
1. **Separate login.** `admin.societyledger.com.ng/login` → admin server route → `POST /api/admin/auth/login` (new). Accepts only users with a `platformRole`. Response token TTL **8 h**, no refresh token.
2. **TOTP two-factor** (new, recommended — owner can defer): platform users enrol an authenticator app on first login; every login needs a 6-digit code; 10 single-use recovery codes. Enforced by the API, not the UI.
3. **Host-only session.** The admin Next.js server keeps the API token in an `httpOnly`, `Secure`, `SameSite=Strict` cookie **without a `Domain` attribute** (host-only). Browser code never sees the token: all API calls go through the admin app's own server proxy (`/bff/*`), which attaches `Authorization: Bearer …`.
4. **Tenant login refuses platform users.** `POST /api/auth/login` returns `403 { code: 'PLATFORM_LOGIN_REQUIRED' }` for users with a `platformRole` (web, mobile). The web login shows "Platform staff sign in at the admin console."
5. **Reserved subdomains.** `admin`, `docs`, `www`, `api`, `app`, `platform`, `mail`, `status`, `staging`, `preview`, `cdn`, `static`, `help`, `support`, `blog` can never be registered as association subdomains, and tenant resolution ignores them.
6. **Impersonation handoff** (§10.5.2): the JWT never appears in a URL; a single-use 60-second code is exchanged by the tenant web app.
7. **Optional IP allowlist** (`ADMIN_IP_ALLOWLIST`) enforced both by the admin app and by the API on `/api/admin/*`, `/api/cron/*`, `/api/webhooks` management routes.
8. **Every write is logged** in `PlatformActionLog` (existing) with the actor, target and a **reason** that destructive actions require.
9. `noindex, nofollow` on every page, `robots.txt` disallow all, strict CSP, no third-party analytics.

### 10.5 Core flows

#### 10.5.1 Sign in
```
admin.societyledger.com.ng/login ─► email + password ─► POST /bff/session (admin server)
   ─► POST /api/admin/auth/login
        ├─ not a platform user / wrong password ─► "Email or password is incorrect" (same message for both)
        ├─ 2FA not enrolled ─► Enrol screen (QR + secret + confirm code) ─► recovery codes (download/print once)
        ├─ 2FA enrolled ─► Code screen (6 digits, or "Use a recovery code")
        └─ success ─► admin server sets host-only cookie ─► Dashboard
Session ends after 8 h, on Sign out, on password change, or when another Super Admin uses "Force sign-out".
```

#### 10.5.2 Impersonate an association
```
Admin console ─► Association detail ─► "Open as this association" ─► dialog: reason (required) + duration (30 min / 1 h / 4 h max)
   ─► POST /api/admin/impersonate/:associationId { reason, durationMinutes }
        └─ returns { handoffCode (single use, 60 s), subdomain }   ← no JWT returned to the browser
   ─► admin opens new tab: https://<subdomain>.societyledger.com.ng/auth/impersonate?code=<handoffCode>
   ─► tenant web: POST /api/auth/impersonation/exchange { code } ─► impersonation JWT in the tenant cookie (as today)
   ─► tenant web shows the amber impersonation banner (existing ContextIndicator): "You're viewing Opuogun State Union as platform staff · ends 14:32 · End now"
   ─► "End now" ─► POST /api/admin/end-impersonation ─► tenant session cleared ─► tab closes / shows "Impersonation ended"
Every step is written to PlatformActionLog and AuditLog with the reason.
```

#### 10.5.3 Suspend, restore or delete a tenant
Destructive actions (suspend, soft delete, permanent delete, force sign-out, billing credit) open a confirmation dialog that states the consequence, requires a **reason**, and for permanent delete requires typing the association's subdomain. Permanent delete is only possible after a soft delete.

### 10.6 Screen-by-screen specification
Route = path in `apps/admin/src/app`. "From web" = the existing page to migrate (under `apps/web/src/app`). API endpoints are existing unless marked **new**.

| # | Screen | Route | From web | Content | Key actions | API |
|---|---|---|---|---|---|---|
| X1 | Sign in | `/login` | `/auth/login` (platform branch) | Email, password; environment badge (Production / Staging); no sign-up, no "forgot password" self-service (reset by another Super Admin or via email reset limited to platform users) | Sign in | **new** `POST /admin/auth/login` |
| X2 | Two-factor enrol | `/login/2fa/setup` | — | QR code, manual secret, confirm code, recovery codes shown once | Confirm, Download codes | **new** `POST /admin/auth/2fa/setup`, `/2fa/confirm` |
| X3 | Two-factor code | `/login/2fa` | — | 6-digit input, "Use a recovery code" | Verify | **new** `POST /admin/auth/2fa/verify` |
| X4 | Dashboard | `/` | `/admin` | KPIs (associations by status, active subscriptions, MRR if available from analytics, pending approvals, failed webhooks 24 h, cron failures), tier distribution, subscription status, pending approvals list, recent action log | Jump to queues | `GET /admin/stats`, `/admin/analytics/overview`, `/admin/approvals`, `/admin/action-logs?limit=10` |
| X5 | Associations | `/associations` | `/admin/associations` | Searchable, filterable table (name, subdomain, tier, status, members, created, subscription), saved filters in URL | Open, Suspend, Reactivate | `GET /admin/associations`, `POST …/suspend`, `…/reactivate` |
| X6 | Association detail | `/associations/[id]` | `/admin/associations/[id]` + `/admin/tenants/[id]` (merged) | Tabs: **Overview** (details, users, members, tier, status, created, deletion info) · **Subscription & billing** (plan, status, cycle, period end; billing actions; active overrides; override history) · **Modules & features** (module management, feature toggles with source: plan / override) · **Security** (force 2FA, password policy, session timeout, IP restrictions) · **Activity** (action log filtered to this tenant) | Open as this association (impersonate), Suspend/Reactivate, Soft delete/Restore, Permanent delete, Force sign-out, Extend trial, Apply credit, Billing override, Revoke override, Module/feature override, Update security | `GET /admin/associations/:id`, `/admin/tenants/:id/status`, `/billing`, `/billing/history`, `/modules`, `POST /admin/tenants/:id/*`, `/admin/associations/:id/override`, `/admin/billing/overrides/:id/revoke` |
| X7 | Tenant operations | `/tenants` | `/admin/tenants` | Lifecycle-focused list (active, suspended, soft-deleted with restore deadline), bulk-safe actions | Restore, Permanent delete | `GET /admin/tenants` … |
| X8 | User approvals | `/approvals` | (admin stats card + `/api/admin/approvals`) | Pending association sign-ups/users needing platform approval; bulk approve/reject with reason | Approve, Reject, Bulk | `GET /admin/approvals`, `PATCH /admin/approvals/:userId`, `POST /admin/approvals/bulk` |
| X9 | Analytics | `/analytics` | `/admin/analytics` | Overview, tier distribution, subscription status, module adoption, churn, revenue; date range | Export CSV (client-side) | `GET /admin/analytics`, `/analytics/overview`, `/module-adoption`, `/churn`, `/revenue` |
| X10 | Settlements | `/settlements` | `/admin/settlements` | Daily, pending, monthly settlement views for gateway payments | Export | `GET /admin/payment-settlements/daily|pending|monthly` |
| X11 | Modules & features catalogue | `/modules` | `/admin/modules` | Platform modules and features, which plans include them | — (catalogue read-only in v1 unless endpoints exist) | `GET /admin/modules`, `/admin/features` |
| X12 | Action log | `/logs/actions` | `/admin/action-logs` | Platform staff actions: actor, action, target, reason, time; filters; stats | Export | `GET /admin/action-logs`, `/stats`, `/export` |
| X13 | Audit log | `/logs/audit` | `/admin/audit-logs` | Cross-tenant audit events; filters by association, user, type | — | `GET /admin/audit-logs` |
| X14 | Platform settings | `/settings` | `/admin/settings` + `/admin/settings/platform` (merged) | General settings, trial & billing defaults, feature flags, platform stats | Save (reason) | `GET/PATCH /admin/settings/platform`, `GET /admin/settings/platform/stats` |
| X15 | Webhooks | `/webhooks`, `/webhooks/events`, `/webhooks/test` | `/admin/webhooks*` | Paystack / custom / all webhook views, event log with status and retries, test sender | Retry, Send test | webhooks management routes |
| X16 | Scheduled jobs | `/jobs`, `/jobs/[jobId]` | `/admin/cron` + `/admin/cron-jobs` (**two duplicate pages → one**) | System status, subscription stats, job list with last run/next run/status, run history, job config, enable/disable | Run now, Toggle, Edit config | `GET /cron/status`, `/cron/logs`, `/cron/logs/:id`, `GET/PUT /cron/jobs/:jobId/config`, `PATCH …/toggle`, `POST /cron/trial-expiry|renewal-reminders|late-fees|update-overdue` |
| X17 | Blog | `/blog`, `/blog/posts/new`, `/blog/posts/[id]/edit`, `/blog/categories`, `/blog/tags`, `/blog/comments` | `/admin/blog/**` | Posts list with status, rich editor (existing Quill editor component moves with it), categories, tags, comment moderation | Publish, Schedule, Moderate | `/admin/blog/*` |
| X18 | Help content | `/help-content` | `/dashboard/settings/help-content` (Super Admin branch) | Platform-wide help articles and FAQs shown in every association's in-app Help Center | Create, Edit, Delete | `/help/articles*`, `/help/faqs*` (platform scope) |
| X19 | Support desk | `/support`, `/support/[id]` | `/dashboard/settings/support` (Super Admin branch) | All associations' tickets, filters (status, priority, category, association), assign, respond, AI suggested reply | Assign, Respond, Close | `/support/tickets*` (platform scope), `POST /help/ai/suggest-response` |
| X20 | Impersonation sessions | `/impersonation` | — | Active and recent impersonation sessions (who, which association, reason, started, ends) | End session | **new** `GET /admin/impersonation-sessions`, existing `end-impersonation` |
| X21 | My account | `/account` | — | Name, email, change password, 2FA (regenerate recovery codes), active admin session | Save | `POST /auth/change-password`, **new** 2FA endpoints |
| X22 | Not found / no access | `not-found`, `/forbidden` | — | Plain message + back to dashboard | — | — |

**Not migrated:** the DB-backed documentation CMS (`/admin/documentation/**`) — the docs site (§9) replaces it. Its API endpoints remain until the owner decides (G6). The admin console shows no link to it.

### 10.7 Proposed platform-role matrix (needs API changes to enforce — owner approval)
| Section | SUPER_ADMIN | SUPPORT_AGENT | FINANCE_ADMIN | COMPLIANCE_ADMIN |
|---|---|---|---|---|
| Dashboard | ✓ | ✓ (limited) | ✓ | ✓ |
| Associations (read) | ✓ | ✓ | ✓ | ✓ |
| Tenant lifecycle, security, modules | ✓ | — | — | — |
| Billing overrides, credits, settlements, revenue analytics | ✓ | — | ✓ | — |
| Impersonation | ✓ | ✓ (with reason, 1 h max) | — | — |
| Support desk, help content | ✓ | ✓ | — | — |
| Logs (action, audit) | ✓ | — | — | ✓ |
| Settings, webhooks, jobs, blog | ✓ | — | — | — |
Until approved, v1 behaves as today: platform routes require `SUPER_ADMIN`.

### 10.8 Changes to the tenant web app (cutover)
- Delete `apps/web/src/app/admin/**`, `components/admin/SuperAdminDashboardGuard.tsx`, `TenantSelector.tsx`, `components/admin/documentation/**`, the Super Admin block and "Manage Content/Manage Tickets" injection in `Sidebar.tsx`, `hooks/useSuperAdminContext.ts` and the `X-Association-Id` header logic, the `platformRole === 'SUPER_ADMIN'` redirects in `/auth/login` and `/dashboard`, the Super Admin branches in `NotificationBell`, `help/page.tsx`, `usePermissions`, and `/dashboard/debug-permissions`.
- Keep: `ContextIndicator` impersonation banner (now driven by the exchanged impersonation token), add `/auth/impersonate` exchange page.
- `next.config.js` redirect: `/admin/:path*` → `https://admin.societyledger.com.ng/:path*` (permanent).
- `/auth/login` shows a notice on `PLATFORM_LOGIN_REQUIRED`.
- `apps/web/middleware.ts`: drop `/admin` from protected routes.

### 10.9 In scope / out of scope (admin console)
**In scope:** every screen in §10.6; separate login with host-only session; TOTP 2FA (recommended, can be deferred by the owner without blocking the split); reserved subdomains; impersonation handoff; optional IP allowlist; Dokploy deployment on `admin.societyledger.com.ng` with staging; removal of Super Admin code from `apps/web`; internal runbook `apps/admin/README.md` (how to deploy, rotate secrets, add a platform user, recover 2FA).

**Out of scope (v1):** a mobile admin app or admin screens in the mobile app; public documentation of admin features (the docs site never covers them); creating/managing platform staff accounts from the UI (no API exists — platform users are created by seed/script; logged as a gap); widening platform-role permissions (§10.7) unless approved; redesigning admin screens beyond the shared shell and tokens (migration keeps behaviour, improves layout only where noted); migrating the DB documentation CMS; SSO/SAML.

### 10.10 Admin success criteria
- Zero Super Admin code paths remain in `apps/web` (grep for `SUPER_ADMIN`, `platformRole`, `/admin` returns only the login notice and impersonation banner).
- A platform user cannot obtain a session on any tenant subdomain or in the mobile app except through the impersonation handoff.
- The admin session cookie is host-only (verified in browser dev tools) and the token never reaches browser JavaScript.
- Every destructive action has a reason recorded in `PlatformActionLog`.
- Admin and web deploy independently on Dokploy; rolling back one does not affect the other.
- All 22 admin screens reach parity with the web pages they replace (checklist in `progress-tracker.md`).

---

## 11. Change log
| Date | Change | By |
|---|---|---|
| 2026-10-27 | Added deliverable D: the Thrift (Ajo) add-on (§12) — roles, screens (THM/THC/THO/THX), documentation pages and success criteria; plan in `build-plan.md` Track T, specification in `thrift-ajo-spec.md`. Scope: one money-flow mode (the group's own bank account), no government-ID verification. | Owner + agent |
| 2026-10-11 | Added deliverable C: platform admin console `apps/admin` at admin.societyledger.com.ng (§10), splitting all Super Admin features out of `apps/web`. Recorded the move to pnpm, Dokploy hosting for every app, and Dokploy-managed PostgreSQL (from Neon). | Owner + agent |
| 2026-10-10 | Added deliverable A: documentation site `apps/docs` at docs.societyledger.com.ng (§9), modelled on docs.businesscopilot.com.ng; docs links from web and mobile. Docs track built before the mobile track. | Owner + agent |
| 2026-10-10 | Initial version. Scope decisions: near-full parity minus platform admin; `apps/mobile` in monorepo; association-code tenant entry; backend additions: push notifications, mobile payment callback, refresh tokens. | Owner + agent |

---

## 12. Deliverable D — Thrift (Ajo) add-on

> Full specification: `thrift-ajo-spec.md`. Plan: `build-plan.md` Track T. Engineering contract: `architecture.md §18`. This section lists who uses it, the screens, and the documentation pages.

### 12.1 What and for whom
A paid add-on that runs contribution circles (collector thrift and rotating pot) with officer approval of participants, versioned rules, receipts for every contribution, approved payouts, default handling and reports. **SocietyLedger is record-keeping software: the group's own bank account holds the money.** Sold through the plan builder as the **Ajo add-on** in four tiers by active contributors (Starter ≤30, Growth 31–150, Business 151–500, Enterprise custom). Used by associations (members form circles) and by standalone thrift groups (outsiders using only Ajo).

| Role | Uses it to |
|---|---|
| **Contributor** | Join a group, accept the rules, pay, see schedule, receipts, balance and payout position. |
| **Collector** | See assigned contributors and today's list, record collections and cash, hand over cash (online only in the first release). |
| **Officer** | Approve participants, manage schedules, reconcile cash and transfers, follow up arrears and disputes, prepare payouts. |
| **Admin** | Create groups, set rules, manage roles, **approve payouts**. |
| **Platform staff** | Verify participants (second step), configure the add-on (levy parameters, standalone sign-up), oversee groups and payouts, see analytics (admin console). |

### 12.2 Screens (IDs use prefix `TH`; M = mobile, W = web, X = admin console)
**Contributor**
| ID | Screen | Platforms |
|---|---|---|
| THM1 | My thrift — my groups, next due, payout position | M, W |
| THM2 | Group detail — schedule, my contributions, receipts, rules | M, W |
| THM3 | Pay contribution — the group's bank details to copy, proof upload | M, W |
| THM4 | Rules & acceptance — read and accept the current rule version | M, W |
| THM5 | My payout account — enter bank name, number, account name (shown masked) | M, W |
| THM6 | Guarantor consent — guarantor reviews and accepts the recorded wording | M, W (link) |
| THM7 | My trust score — inputs shown in plain language | M, W |
| THM8 | Raise a dispute — "I paid" with evidence | M, W |
| THM9 | Verification status — group approval and SocietyLedger verification, and what is still needed | M, W |

**Collector**
| ID | Screen | Platforms |
|---|---|---|
| THC1 | Today — assigned contributors, due amounts, daily target (needs internet) | M, W |
| THC2 | Record collection — member, amount, date, reference; marked "cash received — awaiting reconciliation" | M, W |
| THC3 | End-of-day handover — expected, collected, in hand, handed over, difference | M, W |

**Officer / admin**
| ID | Screen | Platforms |
|---|---|---|
| THO1 | Groups — list with status, members, collected vs expected | M, W |
| THO2 | Create / edit group — wizard: model, frequency, amount, duration, participants, collector fee, the group's bank account, rules | W (M view + simple edit) |
| THO3 | Members & approvals — approve participants, see SocietyLedger verification status, guarantors | M, W |
| THO4 | Contributions & reconciliation — confirm transfers, reconcile cash handovers, reverse with reason | M, W |
| THO5 | Payouts — prepare, preview (pot, fee, shortfall), approve (admin), record as paid, void | M, W |
| THO6 | Defaults & cases — overdue, post-payout default cases, repayment plans, disputes, waive fee | M, W |
| THO7 | Reports — eight reports with filters and exports | W (M summaries) |
| THO8 | Collectors — assign contributors, targets, performance | W (M view) |
| THO9 | Standalone group sign-up and onboarding | W |
| THO10 | Payout order — recorded draw, swap requests, emergency exceptions | M, W |

**Admin console (platform)**
| ID | Screen |
|---|---|
| THX1 | Ajo settings — levy parameters, standalone sign-up switch |
| THX2 | Groups & payouts oversight |
| THX3 | Add-on analytics — adoption, active contributors, revenue |
| THX4 | Verification review queue — checklist, verify or reject with a reason |

### 12.3 Documentation pages (section `ajo-thrift`, apps/docs)
Audience guides: **administrators**, **collectors**, **members**. Pages:
1. `index` — what Ajo/thrift is in SocietyLedger and how it is sold (no prices; link to `/pricing`).
2. `getting-started` — buying the add-on, creating your first group.
3. `creating-a-group` — models, frequency, amount, duration, participants, collector fee, the group's bank account.
4. `group-rules` — late fees, grace days, guarantors, default procedure, reminders; how rule versions work.
5. `joining-and-approval` — how a member joins, officer approval, SocietyLedger verification (what is checked, how long it takes, what a rejection means), accepting the rules, optional phone confirmation, the payout account.
6. `contributions-and-schedules` — due dates, grace periods, receipts, what "reported" and "confirmed" mean.
7. `collector-operations` — daily list, recording cash, end-of-day handover, reconciliation.
8. `transfers-and-reconciliation` — paying into the group's account, proofs, confirming.
9. `payouts` — preparing, approving, recording that the group paid, voiding.
10. `guarantors-defaults-and-disputes` — what happens when someone stops paying, repayment plans, raising a dispute.
11. `reports-and-exports` — the eight reports and CSV/PDF exports.
12. `permissions-and-roles` — contributor, collector, officer, admin.
13. `plans-billing-and-limits` — tiers by active contributors, trial, grace and read-only mode (separate from members' contributions).
14. `staying-safe` — how records are protected, what the app does and does not do (it never holds your group's money), payout-account controls.
15. `faq-and-troubleshooting` — at least 8 Q&As.
16. `payout-order-and-swaps` — the recorded draw, swaps before the first payout, emergency exceptions, the optional rule for "At risk" participants, and what the trust bands mean.
Every task page follows the Docs Definition of Done (`build-plan.md`); mobile steps via `PlatformTabs`; the plan-billing page stays out of the mobile app docs filter per architecture rule 16.

### 12.4 Success criteria
- A pilot group (2–3 real groups) runs a full cycle with every contribution receipted and the group's totals reconciling to the ledger with no manual spreadsheet.
- A collector can record a day's collections and hand over cash with zero unexplained difference.
- No full bank account number appears in any response or log (test-enforced).
- No code path in `modules/ajo/` collects, holds or moves contribution money (test-enforced).
- A payout cannot be prepared or approved for anyone SocietyLedger has not verified (test-enforced).
- An expired add-on leaves all Ajo history readable and exportable.
