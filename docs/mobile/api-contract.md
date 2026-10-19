# Mobile API contract (F0.1)

> Verified directly against `apps/api/src` controller/route source on 2026-10-19. Where this disagrees with `architecture.md §6`'s generic envelope description, this doc is authoritative — the real API is **not uniform** across endpoints. Line numbers are a point-in-time aid, not a guarantee; re-check the source if a future change moves them.

## 0. Routing & tenant-resolution facts (read this before anything below)

- **Global middleware**: `tenantMiddleware` runs on *every* request in `server.ts` before any route-specific middleware. A module's own `router.use(tenantMiddleware)` is usually a no-op repeat of the global one, not an independent check.
- **Tenant header names actually read**: `X-Tenant-Id` (numeric association id) or `X-Tenant` (subdomain/slug) — both work. `architecture.md §6.1`'s `X-Tenant: <subdomain>` is correct but incomplete; `X-Tenant-Id` also works if the mobile client ever has the numeric id cached.
- **Paths excluded from tenant resolution** (association comes from the JWT's `associationId` instead): `/api/auth/login|register|me|logout|verify-email|resend-verification|forgot-password|reset-password`, `/api/auth/impersonation/exchange`, `/api/associations/check-subdomain`, `/api/associations/signup`, `/api/members/me*`, `/api/member-ledger*`, `/api/notifications*`, `/api/subscriptions/plans`, `/api/subscriptions/verify/*`, `/api/health`, `/api/admin*`, `/api/exports*`, `/api/reports*`, `/api/accounting*`, `/api/dashboard*`, `/api/help*`, `/api/support*`, `/api/member-invites/verify|accept`.
- **Everything else requires a resolvable tenant** or gets `400 { success:false, message: 'Association not found. Provide a valid subdomain or tenant header.' }`. A `SUSPENDED` or `CANCELLED` association's requests get `403`.
- **Mount-path surprises** (the real path is not always what the module folder name suggests):
  | What you'd guess | Real path |
  |---|---|
  | `/api/member-finance/*` | `/api/members/me/*` (member-finance routes mount *under* `/api/members/me`) |
  | `/api/nigerian-payments/*` | `/api/payments/nigerian/*` |
  | Paystack routes under `/api/paystack` | `/api/payments/paystack/*` |
- Because of the exclusion list above: `/api/members/me/*`, `/api/member-ledger/*`, `/api/notifications/*` need **no `X-Tenant` header** (JWT carries the association). `/api/meetings/*`, `/api/voting/*`, `/api/payments/paystack/*`, `/api/payments/nigerian/*` **do** need one, even though reading `voting.routes.ts` alone wouldn't tell you that (it has no explicit `tenantMiddleware` call — the global one still applies).

## 1. Auth — `modules/auth/auth.routes.ts` + `auth.controller.ts`

### `POST /api/auth/login` — public, tenant optional
Request (zod `loginSchema`): `{ email: string (email), password: string (min 1) }`

Success `200`:
```jsonc
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 0,                 // number, NOT string — see §10 diff
      "email": "", "role": "",
      "member": { "id": 0, "firstName": "", "lastName": "", "memberId": "" } | null,
      "association": { "id": 0, "name": "", "subdomain": "", "isPlatformAssociation?": true },
      "platformRole": "SUPER_ADMIN" | null,
      "requiresOnboarding": false,
      "permissions": ["..."], "roles": ["..."],
      "isPlatformLogin": false
    },
    "token": "<jwt>"
    // NO refreshToken field exists yet — F0.3 adds it when X-Client: mobile is sent
  }
}
```
Also sets an HTTP-only `token` cookie (7-day, `secure:true, sameSite:'none'`) — irrelevant to mobile, which never reads cookies.

Errors: `401 Invalid credentials` · `401 {code:'PLATFORM_LOGIN_REQUIRED'}` (only if env flag set) · `401 {code:'EMAIL_NOT_VERIFIED'}` · `401 {code:'PENDING_APPROVAL'}` · `401 {code:'ACCOUNT_REJECTED'}` · `401 {code:'ACCOUNT_SUSPENDED'}` · `400` Zod `errors[]` · `500`.

### `POST /api/auth/register` — public, **tenant required**
`{ email, password (min 6), firstName?, lastName? }` → `201 { data: { user: { id, email, emailVerified, approvalStatus } } }`.
Errors: `400` no tenant · `403 {code:'SELF_SIGNUP_DISABLED'}` · `400` email exists · `400` Zod · `500`.

### `POST /api/auth/logout` — public, no body → `200`. Clears cookie (no-op for mobile, which has no cookie).

### `GET /api/auth/me` — authenticated, rate-limited (`sessionRateLimit`)
```jsonc
{ "success": true, "data": { "user": {
  "id": 0, "email": "", "role": "", "isActive": true, "emailVerified": true,
  "associationId": 0, "platformRole": null,
  "member": { "id": 0, "firstName": "", "lastName": "", "memberId": "", "email": "", "phone": "" } | null,
  "userApproval": { "approvalStatus": "" } | null,   // NOT present on the login response — see note below
  "association": { "...": "same shape as login" },
  "requiresOnboarding": false, "permissions": ["..."], "roles": ["..."]
} } }
```
**Note:** `/me` and `/login` are not the same shape — `/me` spreads the raw Prisma user row (includes `userApproval`), login does not. Don't assume they're interchangeable.
Errors: `401 Not authenticated` · `404 User not found` · `500`.

### `POST /api/auth/verify-email` — `{ email, code: string(6) }` → `200`. Errors: `404` · `400` (bad code) · `400` Zod · `500`.
### `POST /api/auth/resend-verification` — `{ email }` → always `200` (anti-enumeration) except `400` if already verified.
### `POST /api/auth/forgot-password` — `{ email }` → always `200` (anti-enumeration).
### `POST /api/auth/reset-password` — `{ token, password (min 6) }` → `200` / `400` (bad/expired token) / `500`.
### `POST /api/auth/change-password` — authenticated, plain body (no Zod): `{ currentPassword, newPassword }` → `200` / `400` (missing, too short, or wrong current password) / `404` / `500`.
### `POST /api/auth/impersonation/exchange` — public, tenant-optional (admin-track feature, not mobile-relevant, documented for completeness): `{ code }` → `200 { data: { token, association } }` / `404`/`409`/`410`/`403`/`400`/`500`.

**No `/auth/refresh` endpoint exists yet** — that's F0.3's deliverable, next.

## 2. Associations — `associations.routes.ts`

### `GET /api/associations/check-subdomain?subdomain=<string>` — public
Query param is **`subdomain`** (lower-cased server-side). Success `200 { data: { id, name, slug, subdomain, tier, status, logo, primaryColor } }` — confirmed exactly these 7 fields exist via the controller's explicit Prisma `select`; matches `architecture.md §7.1`'s assumption exactly, no change needed.
Errors: `400` empty · `409 {code:'SUBDOMAIN_RESERVED'}` · `404 Not found` · `403 Inactive` (status CANCELLED) · `500`.

### `POST /api/associations/signup` — public, out of mobile's Phase 0–3 scope (F8.1 territory) — documented in full in the agent research if needed later, skipped here.

## 3. Members (self) — `members.routes.ts`

### `GET /api/members/me` — looks up by `{associationId, userId}` (not email). `200 { data: <raw Member row> }` (all Member columns). Errors: `400` missing context · `404 Member profile not found` · `500`.
### `PATCH /api/members/me` — body = `createMemberSchema.partial()` (firstName/lastName/email/phone/dateOfBirth/gender/address/city/state/country/occupation/category/status/joinDate/emergencyContact*/notes). **`memberId` in the body is silently ignored** (create-only field). `200 { data: <updated Member row> }`. Errors: `400` missing context · `400` email in use · `404` · `400` Zod · `500`.

## 4. Member finance & ledger (self-service) — real path is `/api/members/me/*` and `/api/member-ledger/*`, **no `X-Tenant` needed** (tenant-excluded)

### `GET /api/members/me/finance-summary`
No member profile → still `200`, all-zero shape with `hasMemberProfile:false`. Normal path → `200 { data: { totalDue, totalPaid, paidThisMonth, totalOutstanding, overdueAmount, overdueCount, duesSummary:{total,paid,outstanding,count}, leviesSummary:{...}, penaltiesSummary:{...}, donationsSummary:{total,count}, upcomingPayments:[{id,category:{id,name,type},amount,balance,dueDate,status}], recentTransactions:[{id,category,amount,paid,balance,status,createdAt}] } }` — **no `hasMemberProfile:true` on this branch**, don't rely on that flag always being present. Errors: `400` · `500`.

### `GET /api/members/me/outstanding`
`200 { data: { items: [{id, type:'dues'|'levy'|'penalty', category:{id,name,type}, campaign?:{name}, amount, balance, dueDate}] } }` — **no pagination at all**, unlike other list endpoints. Errors: `400` · `404 Member profile not found` · `500`.

### `GET /api/members/me/payment-proofs` → `200 { data: { proofs: PaymentProof[] } }` (max 50, newest first; empty array, not 404, if no member profile).
### `GET /api/members/me/bank-accounts` → `200 { data: { accounts: [{id,bankName,accountName,accountNumber,isDefault}] } }` (member-safe, `isActive:true` only subset).
### `POST /api/members/me/pay` — `{ transactionIds: number[] (min 1), paymentMethod: 'cash'|'bank_transfer'|'card'|'mobile_money'|'cheque'|'other', declarationNote: string (min 20), reference?, notes? }`.
### `POST /api/members/me/donate` — `{ categoryId: number (positive), amount: number (positive), paymentMethod? (default 'bank_transfer'), reference?, notes?, isAnonymous? (default false) }`.
### `GET /api/members/me/profile`, `POST /api/members/me/profile` — profile link check/create; not fully traced, revisit if F2.x needs them.

### `GET /api/member-ledger/my-ledger/summary` → `200 { data: { currentBalance, totalDebits, totalCredits, byCategory: Record<string,{debits,credits}>, recentEntries: MemberFinancialLedger[] (last 10) } }`. Errors: `400`/`404 Member profile not found`/`500`.

### `GET /api/member-ledger/my-ledger/entries?startDate&endDate&category&page&limit`
Query zod: `category?` one of `DUES|LEVY|PENALTY|DONATION|REFUND|WAIVER|ADJUSTMENT|SAVINGS_DEPOSIT|SAVINGS_WITHDRAWAL|LOAN_DISBURSEMENT|LOAN_REPAYMENT|OTHER`; `page`/`limit` default 1/50.
`200 { data: { entries: MemberFinancialLedger[], pagination: {page,limit,total,totalPages} } }` — **this is `{data:{entries,pagination}}`**, a different shape than `outstanding`'s `{data:{items}}` with no pagination at all. Do not share one TS type between the two.

### `GET /api/member-ledger/my-ledger/statement?startDate&endDate` (both required)
`200 { data: { member:{id,memberId,firstName,lastName,email}, period:{startDate,endDate}, openingBalance, entries:[{id,date,description,category,debit,credit,balance,reference}], totals:{totalDebits,totalCredits}, closingBalance } }`.
**Gap**: a missing member on this specific endpoint surfaces as `500 Failed to generate statement`, not `404` (the service throws a plain `Error`, uncaught by a specific handler) — unlike the other my-ledger endpoints which 404 correctly. Mobile's error mapping must special-case this endpoint or it'll show a generic/retry error for what's really a "no profile" state.

### `GET /api/member-ledger/my-ledger/balance?asOfDate` → `200 { data: { memberId, memberNumber (the string business code, not the numeric id), balance, asOfDate } }`.
### `POST /api/member-ledger/my-ledger/export` — PDF export, not fully traced; revisit at F2.6.

## 5. Paystack — real base path `/api/payments/paystack` (tenant **required**)

### `POST /api/payments/paystack/initialize` — auth + tenant + `PAYMENT_CREATE`
Request: `{ transactionId: number (positive int, singular — NOT an array), callbackUrl?: string (url) }`. Confirms `architecture.md §9.3`'s claim exactly: the existing schema already accepts the API's own `mobile-return` URL with no schema change needed.
`200 { message: 'Payment initialized successfully', data: { reference, authorizationUrl, accessCode, amount, amountInKobo } }`.
Errors: `400` no association · `400` Paystack disabled for this association (`integrations.paystackEnabled`) · `404 Transaction not found` · `400` no member email · `400` already fully paid · `400` Zod · `500`.

### `GET /api/payments/paystack/verify/:reference`
Already-verified → `200 { data: { status:'success', reference, amount, transactionId } }`. Paystack verify call itself fails → `400`. Paystack status not `success` → `400 { data: { status, reference, gatewayResponse } }`. Real success → `200 { data: { status:'success', reference, amount, receiptNumber, transactionId, transactionStatus:'paid'|'partial', paidAt } }`. Errors: `400`/`404 Payment record not found`/`500`.

### `GET /api/payments/paystack/status/:reference`
`200 { data: { reference, status, amount, provider:'paystack', webhookReceived, transaction:{id,referenceNumber,amount,status,member:{firstName,lastName},category:{name}} | null, createdAt } }`. Errors: `400`/`404`/`500`.

## 6. Nigerian payments — real base path `/api/payments/nigerian` (tenant **required**)

### `GET /api/payments/nigerian/banks` — requires `FINANCE_VIEW` (**officer permission, not member-safe** — mobile members cannot call this; use `/api/members/me/bank-accounts` instead, §4). `200 { data: { banks: NIGERIAN_BANKS } }` (static list).
### `GET /api/payments/nigerian/bank-accounts` — requires `SETTINGS_VIEW` (**also officer-only**, same caveat). `200 { data: { bankAccounts: [...] } }`.
### `POST /api/payments/nigerian/proofs` — upload (member-reachable via `requireAnyPermission([PAYMENT_CREATE, PAYMENT_VIEW, PAYMENTS_VIEW_OWN])`)
Multer field name is exactly **`file`** (`upload.single('file')`), disk storage, 5MB cap, mimetypes `image/jpeg|png|gif`, `application/pdf`. A bad mimetype throws an `Error` that is **not confirmed to be JSON-wrapped** — treat as a risk: mobile should expect a possible non-JSON/500 response on an invalid file type until this is verified live during F2.9.
Text fields (all strings over multipart): `transactionId?` / `bankTransferId?` / `transactionIds?` (JSON-encoded array string, e.g. `'[12,13]'`) — at least one required; `paymentMethod?`; `declarationNote?` (min 20 chars if present); `notes?`. Either `file` or `declarationNote` is required.
`201 { message: '...', data: <PaymentProof row> }`. Errors: `400` (several validation cases) · `500`.
### `POST /api/payments/nigerian/proofs/:id/verify` — officer-only (`PAYMENT_CONFIRM`), not mobile member-facing; documented for completeness. `{ status:'APPROVED'|'REJECTED', rejectionReason? (required if REJECTED), notes? }`.

## 7. Notifications — `/api/notifications/*` (no `X-Tenant` needed)

### `GET /api/notifications/?page&limit&unread` → `200 { data: { notifications: Notification[], total, unreadCount, page, limit, totalPages } }` — **a fourth distinct pagination shape** (flat fields on `data`, array key is `notifications` not `items`/`entries`). See §10 — do not reuse one generic `PaginatedResponse<T>` type across endpoints.
### `GET /api/notifications/unread-count` → `200 { data: { unreadCount } }`.
### `GET /api/notifications/preferences` → `200 { data: <preferences row or defaults> }`.
### `PUT /api/notifications/preferences` — **no server-side Zod validation on this endpoint today** — body is spread directly into the Prisma upsert. Mobile must validate client-side; don't assume the server will reject a malformed payload.
### `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all`, `DELETE /api/notifications/:id` — scoped to the caller's own notifications; `404` if not theirs.

### Real `Notification.type` inventory (grepped every write site, not just the declared enum)
| Value | Declared | Actually auto-dispatched today | Where |
|---|---|---|---|
| `payment_due` | yes (`NotificationKind` + admin enum) | **no** — only reachable via manual admin `POST /api/notifications` | — |
| `payment_received` | yes | **yes** | `finance.controller.ts` on payment recorded (unless `payments.receiptAutoGenerate` disabled) |
| `system` | yes | **yes** | `meeting-jobs.ts` (`notifyAttendanceMarked`), `tenant-management.service.ts` (suspension/deletion notices) |
| `approval` | yes | **no** — manual-admin-only, same as `payment_due` | — |
| `announcement` | yes | **yes** | `notifications.controller.ts` (`createAnnouncement`), `meeting-jobs.ts` (reminder cron, scheduled, cancelled) |

F0.2 maps these (plus the new event types it adds dispatch calls for — payment proof submitted/verified/rejected, bank transfer pending/verified, loan/guarantor/welfare/election/poll events, support ticket reply, user approval pending) to the push-routing table in `architecture.md §8.2`. The 2 types with zero live call sites today (`payment_due`, `approval`) should either get a real dispatch call added as part of F0.2, or be left undocumented in the push-routing table if out of scope — flag to the owner if ambiguous when F0.2 starts.

## 8. Meetings (member-visible) — `/api/meetings/*` (tenant required)

### `GET /api/meetings/upcoming?limit` (default 5) → `200 { data: Meeting[] }` — **bare array**, no wrapper, no pagination. `status:'SCHEDULED'`, future `startTime`.
### `GET /api/meetings/recent?limit` → `200 { data: Meeting[] }` — bare array, `status:'COMPLETED'`.
### `GET /api/meetings/:id` → `200 { data: { ...meeting, attendanceStats } }` — attendanceStats merged flat into the meeting object, not nested. Errors: `400`/`404 Meeting not found`/`500`.

## 9. Voting (member-visible) — `/api/voting/*` (tenant required, even though `voting.routes.ts` has no explicit tenant middleware call — the global one still applies)

### `GET /api/voting/dashboard` → `200 { data: { totalElections, activeElections, completedElections, totalPolls, activePolls, upcomingElections, averageVoterTurnout, recentElections: [...] (max 5), recentPolls: [...] (max 5) } }`.
### `GET /api/voting/active` → `200 { data: { activeElections: [...], activePolls: [...] } }` — **two separate lists, not one merged feed.**
### `GET /api/voting/elections/:id` → `200 { data: <election with nested positions[].candidates[] (approved only) + flat candidates[] (all statuses) + creator + _count> }`.
**Gap**: a non-existent election id returns `500 { message: 'Election not found' }`, not `404` — the service throws a plain `Error` that the controller's generic catch turns into a 500. Mobile's error mapping must special-case this message string rather than treating every 500 as fatal/retry-worthy.

## 10. `packages/shared` vs. reality — confirms gap G2

`packages/shared/src/types.ts` is the only file defining `User`/`Member`/`PaginatedResponse`. Verified mismatches:

1. **`User.id: string`** is wrong — real Prisma type and every real response is `number`.
2. **`Member.id: string`** is wrong — real type is `number`. (`Member.memberId: string` — the separate human-readable business code — is correctly typed.)
3. **`User` is missing** `associationId`, `platformRole`, `permissions: string[]`, `roles: string[]`, `requiresOnboarding: boolean`, `association: {...}`, and (login-only) `isPlatformLogin: boolean` — all of which the real response always includes.
4. **`PaginatedResponse<T> = { data: T[], pagination: {...} }`** matches none of the 4 real pagination shapes seen above (`{data:{entries,pagination}}`, `{data:{items}}` with no pagination, `{data:{notifications,total,unreadCount,page,limit,totalPages}}` flat, bare `{data: T[]}` with no pagination at all on meetings). Do not reuse one generic type across endpoints — F1.3 types each endpoint individually from this doc.
5. No `refreshToken` field exists on either side yet — consistent, not a mismatch; F0.3 adds it to the real API only.

**Conclusion**: mobile does not import `packages/shared`'s `User`/`Member`/`PaginatedResponse` (per `architecture.md §2`'s existing rule). F1.3 generates `src/types/api/*` directly from this contract doc instead. Gap **G2** stays open in `progress-tracker.md` until F1.3; nothing in Phase 0 touches `packages/shared`.

## Endpoints referenced by the build-plan but not yet re-verified in this pass
`GET /api/members/me/profile` detail, `POST /api/member-ledger/my-ledger/export`, officer-only Nigerian-payments list/detail routes, `associations/signup`. None are on the Phase 2–3 member-facing critical path; verify when the feature that needs them starts (F1.3 or later), not retroactively here.
