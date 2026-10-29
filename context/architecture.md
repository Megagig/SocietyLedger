# Architecture — SocietyLedger Mobile, Docs Site & Admin Console

> How the mobile app (`apps/mobile`), the documentation site (`apps/docs`) and the platform admin console (`apps/admin`) are built and how they connect to the existing platform. §1–§13 cover the mobile app and shared infrastructure; §14–§15 the docs site and the links into it; §16 the admin console; §17 deployment of every app on Dokploy. The **Rules** in §12 (mobile), §14.12 (docs) and §16.10 (admin) are non-negotiable; if a task seems to require breaking one, stop and ask.

---

## 1. System context

```
┌──────────────────────────┐        HTTPS (JSON, Bearer JWT, X-Tenant)        ┌───────────────────────────┐
│  apps/mobile (Expo)      │ ───────────────────────────────────────────────► │  apps/api (Express)       │
│  iOS + Android           │ ◄─────────────────────────────────────────────── │  Dokploy app, port 4000   │
│                          │                                                  │  Prisma ─► PostgreSQL 16  │
│  SecureStore (tokens)    │                                                  │  (Dokploy DB, ex-Neon)    │
│                          │                                                  │  Redis (optional)         │
│  MMKV (cache, prefs)     │                                                  │  Resend (email)           │
└──────┬─────────▲─────────┘                                                  │  Termii (SMS)             │
       │         │ push                                                       │  Paystack (payments)      │
       │   ┌─────┴──────────────┐   expo-server-sdk    ┌──────────────────┐   │  OpenRouter (AI)          │
       │   │ Expo Push Service  │ ◄──────────────────── │ push.service.ts  │◄──┤                           │
       │   │ (APNs / FCM)       │                       │ (new, in api)    │   └───────────────────────────┘
       │   └────────────────────┘                       └──────────────────┘
       │ openAuthSessionAsync
       ▼
┌────────────────────┐  redirect   ┌───────────────────────────────┐  302   societyledger://payments/return?reference=…
│ Paystack checkout  │ ──────────► │ GET /api/payments/mobile-return│ ─────► (closes browser, app verifies)
└────────────────────┘             └───────────────────────────────┘
```

- The mobile app is a **pure client** of `apps/api`. It never talks to the database, Paystack secret APIs, Termii, Resend or OpenRouter directly.
- `apps/web` is unaffected except for two "Open in app" links (F0.6) and the docs links/redirects (D6.3, §15).
- `apps/docs` is a **static site** (no API calls, no auth) deployed to `docs.societyledger.com.ng`; it only links out to the web app.
- `apps/admin` is the platform console at `admin.societyledger.com.ng` (§16). It talks to the same API through its own server-side proxy; nothing in `apps/web` or `apps/mobile` links to it.
- All apps run as services of **one Dokploy Compose application** (`docker-compose.dokploy.yml`, one git-triggered stack), not as separate Dokploy Applications — see §17.1.

---

## 2. Monorepo placement

```
societyledger/                 (Turborepo + pnpm 9 workspaces — pnpm-workspace.yaml)
├── apps/
│   ├── api/                   existing — receives the backend additions in §9
│   ├── web/                   existing tenant app — "open in app", docs links, Super Admin removal (§16.8)
│   ├── admin/                 NEW — platform admin console (Next.js) → admin.societyledger.com.ng
│   ├── docs/                  NEW — documentation site (Fumadocs, static export) → docs.societyledger.com.ng
│   └── mobile/                NEW — Expo app
├── packages/
│   └── shared/                existing — types + zod validators, consumed by mobile
├── context/                   the 9 context files (this folder)
└── turbo.json
```

- Package manager is **pnpm** (`packageManager: pnpm@9.15.0`). Use `pnpm --filter <name> <script>` (or `pnpm -F`), `pnpm add -F <name> <pkg>`, `pnpm dlx` instead of `npx` for one-off CLIs. Never commit `package-lock.json`; `pnpm-lock.yaml` is the only lockfile. Root scripts that still say `npm run … --workspace` (`api:dev`, `web:dev`) and `engines.npm` are leftovers to fix in the first feature that touches the root `package.json`.
- `apps/mobile` is a pnpm workspace package named `@societyledger/mobile`. **Expo + pnpm:** SDK 54+ supports pnpm's isolated `node_modules`; start isolated. If Metro or a native module fails to resolve, set `node-linker=hoisted` in the root `.npmrc` (affects every app — record in Decisions) rather than adding per-package hacks.
- Metro must be configured for the monorepo (`watchFolders` = repo root, `nodeModulesPaths` = app + root `node_modules`). Expo's `expo/metro-config` monorepo defaults handle this on SDK 52+; verify on scaffold.
- `packages/shared` currently has stale types (`User.id: string`, while the API returns numbers). **Mobile does not import stale types.** F1.3 adds correct, API-verified types under `packages/shared/src/mobile/` (or fixes the existing ones if the web is not using them — check with `grep` first). Zod validators in `packages/shared/src/validators.ts` may be reused where they match API schemas.
- Turbo tasks for mobile: `dev` (expo start), `lint`, `type-check`, `test`. Mobile is **not** part of `turbo build` (EAS builds it).
- `apps/docs` is a pnpm workspace package named `@societyledger/docs` with `dev` (port 3001), `build` (static export to `apps/docs/out`), `lint`, `type-check`, `check:links`, `gen:reference`. Its `build` **is** part of `turbo build` (outputs `out/**`, `.source/**`).
- `apps/admin` is a pnpm workspace package named `@societyledger/admin` with `dev` (port 3002), `build` (Next.js `output: 'standalone'`), `start`, `lint`, `type-check`, `test`; part of `turbo build`.
- **Dependency versions differ per app** (web and admin: Next 14 + React 18 + Mantine 7 at migration time; docs: the Next/React versions Fumadocs requires; mobile: React 19.2 via Expo). Each app declares its own `react`, `react-dom`, `next` in its own `package.json`; never add them to the root. pnpm's isolated layout keeps them apart; verify with `pnpm why react -r` after installs. Do not add `public-hoist-pattern` for React.

---

## 3. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Runtime | **Expo SDK 56** (React Native 0.85, React 19.2, New Architecture) | Pin exact SDK at scaffold. Node ≥ 20.19.4. iOS ≥ 16.4. |
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true` | |
| Navigation | **Expo Router** (file-based; `Stack`, `Tabs`, modals) | SDK 56 Router no longer wraps React Navigation — import navigation primitives from `expo-router` only. |
| Styling | **NativeWind** (Tailwind for RN) with **CSS variables** from `src/theme/global.css` | Tokens in `ui-tokens.md`. Use the latest NativeWind line verified compatible with SDK 56 at scaffold (v4.2+ stable or v5 if stable); token file is the same either way. |
| Server state | **TanStack Query v5** + `@tanstack/query-async-storage-persister` backed by MMKV | Same mental model as web (web uses v4). |
| Client state | **Zustand** (session, tenant, UI prefs) with MMKV persistence for non-secret slices | |
| Forms | **react-hook-form** + **zod** (`@hookform/resolvers`) | Same as web. |
| HTTP | **axios** single instance with interceptors | Same as web. |
| Secure storage | **expo-secure-store** | Access + refresh tokens only. |
| Fast KV storage | **react-native-mmkv** | Query cache, prefs, recent associations. Requires dev build (no Expo Go). |
| Push | **expo-notifications** + **expo-device**; server: **expo-server-sdk** | |
| Auth browser | **expo-web-browser** (`openAuthSessionAsync`) + **expo-linking** | Paystack checkout. |
| Biometrics | **expo-local-authentication** | App lock, re-auth. |
| Files | **expo-image-picker**, **expo-document-picker**, **expo-file-system**, **expo-sharing**, **expo-print** (receipt PDFs) | |
| Images | **expo-image** | Caching, placeholders. |
| Lists | **@shopify/flash-list** | All lists > 20 rows. |
| Animation / gestures | **react-native-reanimated**, **react-native-gesture-handler** | Watch SDK 56 Hermes v1 + worklets memory regression; upgrade to SDK 57 when available. |
| Bottom sheets | **@gorhom/bottom-sheet** | |
| Charts | **react-native-gifted-charts** (SVG, no Skia) | Line, bar, donut. Chosen at F5.1 over victory-native: it was already installed and used by Home and Finance, and needs no native Skia dependency. |
| Icons | **lucide-react-native** + `react-native-svg` | Web already uses lucide; keeps visual parity. (`@expo/vector-icons` is deprecated in SDK 56.) |
| Toasts | **sonner-native** | |
| Dates | **date-fns** (+ `date-fns-tz` if needed) | Web uses date-fns too. Display in device locale, `Africa/Lagos` default. |
| Money | **decimal.js-light** | Never float arithmetic on money. |
| Clipboard / haptics | **expo-clipboard**, **expo-haptics** | |
| Calendar | **expo-calendar** (new API) | Add meeting to calendar. |
| Errors / crashes | **@sentry/react-native** (Expo plugin) | |
| Updates | **expo-updates** + EAS Update | Channels: `development`, `preview`, `production`. |
| Testing | **jest-expo**, **@testing-library/react-native**, **msw** (API mocks); **Maestro** for E2E flows | |
| Lint/format | ESLint (`eslint-config-expo`) + Prettier | |
| Build/deploy | **EAS Build**, **EAS Submit** | Bundle IDs below. |

App identity: name **SocietyLedger**; iOS bundle `ng.com.societyledger.app`; Android package `ng.com.societyledger.app`; URL scheme `societyledger`.

---

## 4. Folder structure — `apps/mobile`

```
apps/mobile/
├── app/                              # Expo Router — ROUTES ONLY (thin screens)
│   ├── _layout.tsx                   # Providers, fonts, splash, theme, push listeners
│   ├── index.tsx                     # Splash/redirect logic
│   ├── +not-found.tsx
│   ├── (auth)/                       # Unauthenticated stack
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx  association.tsx  login.tsx  register.tsx
│   │   ├── verify-email.tsx  forgot-password.tsx  reset-password.tsx
│   │   ├── accept-invite.tsx  pending.tsx  blocked.tsx  web-only.tsx
│   │   └── create-association.tsx
│   ├── (lock)/unlock.tsx
│   └── (app)/                        # Authenticated area (guarded in _layout)
│       ├── _layout.tsx               # Auth guard, onboarding guard, push registration
│       ├── (tabs)/
│       │   ├── _layout.tsx           # Tabs (Manage tab conditional)
│       │   ├── home/       (index.tsx, _layout.tsx)
│       │   ├── money/      (index, pay/*, ledger/*, dues, levies, penalties, donations/*, payments, transaction/[id], savings/*, loans/*, guarantor-requests)
│       │   ├── community/  (index, meetings/*, voting/*, polls/*, welfare/*, announcements/*)
│       │   ├── manage/     (index, members/*, finance/*, payments/*, accounting/*, reports/*, meetings/*, elections/*, polls/*, welfare/*, cooperatives/*, communication/*, ai/*, settings/*, support/*)
│       │   └── profile/    (index, details, security, appearance, about, help/*)
│       ├── notifications/  (index, preferences)
│       └── onboarding/     (profile, finance, members, team, complete)
├── src/
│   ├── api/                          # HTTP layer — no React, no UI
│   │   ├── client.ts                 # axios instance + interceptors (auth, tenant, refresh, errors)
│   │   ├── errors.ts                 # ApiError class + code mapping
│   │   ├── envelope.ts               # unwrap {success,data,message}
│   │   └── endpoints/                # one file per API module: auth.ts, members.ts, memberFinance.ts,
│   │                                 # memberLedger.ts, finance.ts, financeAdvanced.ts, payments.ts,
│   │                                 # nigerianPayments.ts, accounting.ts, reports.ts, exports.ts,
│   │                                 # meetings.ts, voting.ts, welfare.ts, cooperatives.ts,
│   │                                 # notifications.ts, sms.ts, ai.ts, help.ts, support.ts,
│   │                                 # settings.ts, rbac.ts, onboarding.ts, associations.ts,
│   │                                 # subscriptions.ts, devices.ts, dashboard.ts
│   ├── features/                     # Feature modules (domain hooks + feature components)
│   │   └── <feature>/
│   │       ├── queries.ts            # useQuery hooks + query keys
│   │       ├── mutations.ts          # useMutation hooks + invalidation
│   │       ├── schemas.ts            # zod form schemas
│   │       ├── types.ts              # feature-local types (API DTOs live in src/types/api)
│   │       └── components/           # components used only by this feature
│   ├── components/                   # Shared, domain-agnostic UI (design system)
│   │   ├── ui/                       # Button, Text, Card, Badge, Input, Money, Avatar, Chip, Skeleton…
│   │   ├── layout/                   # Screen, ScreenHeader, Section, StickyFooter, ListItem…
│   │   ├── feedback/                 # EmptyState, ErrorState, OfflineBanner, ModuleLocked, Toast…
│   │   ├── forms/                    # FormField wrappers for RHF: TextField, AmountField, DateField, SelectSheet…
│   │   └── charts/                   # LineChart, BarChart, DonutChart, ProgressRing wrappers
│   ├── lib/                          # Pure utilities (no React unless named use*)
│   │   ├── permissions.ts            # alias map + can()/canAny()
│   │   ├── money.ts                  # toDecimal, formatMoney
│   │   ├── dates.ts                  # formatters
│   │   ├── storage.ts                # MMKV instance + typed helpers
│   │   ├── secure.ts                 # SecureStore wrappers
│   │   ├── push.ts                   # permission, token, routing map
│   │   ├── linking.ts                # deep-link parsing
│   │   ├── biometrics.ts
│   │   ├── files.ts                  # upload FormData builders, download+share
│   │   ├── docs.ts                   # docsUrl/openDocs → docs site (§15), filters plan-billing targets
│   │   └── i18n.ts                   # t() helper, en.json
│   ├── stores/                       # Zustand stores
│   │   ├── session.ts                # user, permissions, tokens status
│   │   ├── tenant.ts                 # current association + recent list
│   │   ├── modules.ts                # modules found disabled this session
│   │   └── prefs.ts                  # theme, biometrics, auto-lock
│   ├── hooks/                        # Cross-feature hooks: useCan, useOnline, useAppState, useRefreshOnFocus…
│   ├── providers/                    # QueryProvider, ThemeProvider, SessionProvider
│   ├── theme/                        # global.css (CSS variables), tokens.ts (JS mirror for charts/nav)
│   ├── types/
│   │   └── api/                      # DTOs matching API responses (verified against controllers)
│   └── config/
│       └── env.ts                    # typed EXPO_PUBLIC_* access
├── assets/                           # fonts, images, icon, splash
├── e2e/                              # Maestro flows (*.yaml)
├── __tests__/ or co-located *.test.ts(x)
├── app.config.ts                     # dynamic Expo config (env-specific)
├── eas.json
├── tailwind.config.js
├── metro.config.js
├── babel.config.js
├── tsconfig.json                     # paths: "@/*" → "src/*"
└── package.json
```

---

## 5. Layer boundaries & data flow

```
app/ (route screen) ──uses──► features/<x>/queries|mutations ──calls──► api/endpoints/<x> ──► api/client ──► HTTP
        │                              │
        └──renders──► components/ (ui, layout, feedback, forms, charts) + features/<x>/components
                                        stores/ ◄── read by hooks; written by api/client (session) and features
```

| Layer | May import | Must NOT import |
|---|---|---|
| `app/**` (routes) | `features/*`, `components/*`, `hooks/*`, `lib/*`, `stores/*` (read via hooks) | `api/*` directly, `axios` |
| `features/<x>/*` | `api/endpoints/*`, `components/*`, `lib/*`, `stores/*`, `hooks/*`, `types/*` | other features' internals (only their `queries.ts` exports, for cross-feature invalidation), `app/*` |
| `components/**` | `lib/*`, `theme/*`, other `components/*` | `api/*`, `features/*`, `stores/*`, `app/*` (pure presentational, props in/out) |
| `api/**` | `lib/secure`, `stores/session` + `stores/tenant` (client.ts only), `types/api` | React, `components/*`, `features/*`, `app/*` |
| `lib/**` | other `lib/*`, `types/*` | `api/*`, `components/*`, `features/*`, `app/*` |
| `stores/**` | `lib/*`, `types/*` | `api/*` (except calling nothing — stores hold state only), `components/*`, `features/*` |

Request lifecycle:
1. Screen calls `useMemberOutstanding()` (features/memberFinance/queries.ts).
2. Hook runs `memberFinanceApi.getOutstanding()` (api/endpoints/memberFinance.ts).
3. `client` interceptor adds `Authorization: Bearer <access>`, `X-Tenant: <subdomain>`, `X-Client: mobile`, `X-App-Version`.
4. Response passes through `unwrapEnvelope` → returns `data` or throws `ApiError`.
5. On `401` with refresh available → single-flight refresh → retry once → else sign out.
6. On `403 MODULE_DISABLED` → `modules` store marks module disabled → screen renders `ModuleLocked`.
7. TanStack Query caches; persister writes to MMKV (whitelisted keys only).

---

## 6. API contract (what the mobile client relies on)

### 6.1 Base & headers
- Base URL from `EXPO_PUBLIC_API_URL` (production API domain on Dokploy: `https://api.societyledger.com.ng`, confirmed; `http://<LAN-IP>:4000` dev). All paths start `/api`.
- Headers on every request after tenant selection: `X-Tenant: <subdomain>`; after login: `Authorization: Bearer <accessToken>`; always `X-Client: mobile`, `X-App-Version: <version>+<build>`.
- No cookies. Mobile never reads or relies on the `token` cookie. Requests have no `Origin`, which the API's CORS already allows.

### 6.2 Response envelope
```ts
// success
{ success: true, data: T, message?: string }
// list with pagination (shape used by members and most lists)
{ success: true, data: { <items>: T[], pagination: { page, limit, totalCount, totalPages, hasMore } } }
// failure
{ success: false, message: string, code?: string, error?: string, errors?: ZodIssue[] }
```
Not every endpoint is uniform (some return arrays directly in `data`, some name the list key differently). **Every endpoint function in `api/endpoints/*` must be verified against its controller before use** and normalise to `{ items, pagination }` for lists.

### 6.3 Error codes the app handles
| Signal | Source | App behaviour |
|---|---|---|
| `401` + `code: EMAIL_NOT_VERIFIED` | login | → Verify Email |
| `401` + `code: PENDING_APPROVAL` | login | → Pending screen |
| `401` + `code: ACCOUNT_REJECTED` / `ACCOUNT_SUSPENDED` | login | → Blocked screen |
| `403` + `code: PLATFORM_LOGIN_REQUIRED` | login (after admin backend A1.2) | → Platform staff screen (A12) |
| `401` other on authed request | auth middleware | refresh → retry → sign out with toast "Session expired" |
| `403` "Access denied for this association" | tenant mismatch | sign out, clear tenant |
| `403` `error: MODULE_DISABLED` | module middleware | `ModuleLocked` state |
| `403` subscription messages (no active subscription / expired / trial ended) | subscription middleware | `SubscriptionInactive` state. Add `code: SUBSCRIPTION_INACTIVE` server-side in F0.5 so matching isn't string-based. |
| `403` "Insufficient permissions" | rbac | `NoPermission` state; also re-fetch `/auth/me` (permissions may have changed) |
| `400` "Association not found…" / `403` suspended/cancelled association | tenant middleware | Blocked screen (association variant) |
| `400` with `errors[]` (Zod) | controllers | map to form fields via `setError` |
| `429` | rate limiter (auth 10/min, standard 100/min, `/auth/me` 200/min) | toast "Too many attempts, try again in a minute"; never auto-retry |
| network error / timeout (15 s) | — | offline handling, retry button |

### 6.4 Money & dates in responses
- Prisma `Decimal` fields serialise as **strings** (e.g. `"25000.00"`); some controllers convert to `Number`. The app accepts `string | number` and converts through `lib/money.ts → toDecimal()` immediately in the endpoint layer. UI receives `Decimal`-backed values or formatted strings, never raw floats for arithmetic.
- Dates are ISO strings (UTC). Parse in the endpoint layer to strings kept as ISO; format only in UI via `lib/dates.ts`.

### 6.5 Pagination
Use `useInfiniteQuery` with `page`/`limit` (default `limit=20`). Stop when `hasMore === false` (or `page >= totalPages` when `hasMore` absent).

---

## 7. Authentication, session & tenant

### 7.1 Tenant selection
- Association code → `GET /api/associations/check-subdomain?subdomain=` returns `{ id, name, slug, subdomain, tier, status, logo, primaryColor }` (404 not found, 403 cancelled).
- Stored in `stores/tenant` (persisted to MMKV): `current`, `recent[]` (max 5, most recent first).
- `X-Tenant` = `subdomain`. Changing association = full sign out (revoke refresh token, clear query cache, clear session) then set new tenant.
- Logos: if `logo` is a relative `/uploads/...` path, prefix with API origin.

### 7.2 Tokens (after backend F0.3)
- Login/accept-invite with `X-Client: mobile` returns `{ user, token, refreshToken, accessTokenExpiresAt }`. `token` = short-lived access JWT (15 min) with the same payload as today; `refreshToken` = opaque random 256-bit string (30 days, rotating).
- Both stored in **SecureStore** (`keychainAccessible: AFTER_FIRST_UNLOCK`). Never in MMKV, Zustand-persisted state, logs, Sentry breadcrumbs or query cache.
- `client.ts` refreshes proactively when < 60 s left and reactively on 401, **single-flight** (one refresh promise shared by concurrent requests).
- `POST /api/auth/refresh { refreshToken }` → new pair; old token revoked. Reuse of a revoked token revokes the whole family (theft detection) → app signs out.
- Logout: `POST /api/auth/logout { refreshToken }` (best effort) → delete SecureStore keys → unregister push token → clear MMKV query cache → reset stores → `(auth)/association` (tenant kept) or `(auth)/welcome` if "Switch association".
- Until F0.3 ships, the app works with the existing 7-day JWT (no refresh); the client code path handles absence of `refreshToken`.

### 7.3 Session bootstrap
`app/index.tsx`: read tenant + tokens → if none → Welcome/Association. If tokens → `GET /auth/me` (from cache first for instant UI) → route by user state (platform role → web-only; requiresOnboarding → onboarding; else tabs). App lock applied by `(app)/_layout` when enabled.

### 7.4 Permissions in the client
- `stores/session.user.permissions: string[]` from login/me. `lib/permissions.ts` exports `PERMISSIONS` alias map (copied from web/API) and `can(perms, alias)`, `canAny`, `canAll`.
- `hooks/useCan(alias | alias[])` is the only way components check permissions.
- `/auth/me` refetched on app foreground (max once per 5 min) and after any 403 "Insufficient permissions".

### 7.5 App lock
- Optional, prompted once after first login. `expo-local-authentication` with device-passcode fallback.
- Lock on cold start and after `autoLockMinutes` (default 5) in background. Lock screen hides content (blur) in the app switcher via `AppState` + privacy overlay.
- Re-auth (biometric prompt) required before: casting a vote, void-and-replace, deleting transactions, disbursing loans/welfare, posting journal entries.

---

## 8. Push notifications, deep links & payments

### 8.1 Push registration (client)
1. After login (and on each app start while signed in), if permission granted: get Expo push token (`getExpoPushTokenAsync({ projectId })`).
2. `POST /api/devices/register { expoPushToken, platform, deviceName, appVersion }`.
3. On logout / association switch: `POST /api/devices/unregister { expoPushToken }` before clearing tokens.
4. Android channels: `default`, `payments`, `governance`, `announcements` (importance HIGH for payments/governance).

### 8.2 Push payload contract (server → app)
```json
{ "to": "ExponentPushToken[...]", "title": "...", "body": "...",
  "data": { "type": "payment.confirmed", "entityId": 123, "associationId": 7, "notificationId": 991 },
  "channelId": "payments", "sound": "default" }
```
`lib/push.ts` maps `type` → route. If `associationId` ≠ current tenant id, show the notification but route to a prompt "This is for <association>. Switch?".

| `type` | Route |
|---|---|
| `payment.confirmed`, `payment.received` | `/(app)/(tabs)/money/payments` |
| `payment.proof_submitted` (officer) | `/(app)/(tabs)/manage/payments/proofs/[entityId]` |
| `transfer.pending` (officer) | `/(app)/(tabs)/manage/payments/transfers/[entityId]` |
| `dues.reminder`, `dues.overdue`, `levy.assigned`, `penalty.applied` | `/(app)/(tabs)/money/pay` |
| `meeting.scheduled`, `meeting.reminder`, `meeting.cancelled` | `/(app)/(tabs)/community/meetings/[entityId]` |
| `election.nominations_open`, `election.voting_open`, `election.results` | `/(app)/(tabs)/community/voting/[entityId]` |
| `poll.open` | `/(app)/(tabs)/community/polls/[entityId]` |
| `loan.application_submitted` (officer) | `/(app)/(tabs)/manage/cooperatives/applications/[entityId]` |
| `loan.application_updated`, `loan.repayment_due` | `/(app)/(tabs)/money/loans` |
| `guarantor.requested` | `/(app)/(tabs)/money/guarantor-requests` |
| `welfare.payout_requested` (officer) | `/(app)/(tabs)/manage/welfare/payouts/[entityId]` |
| `welfare.payout_updated` | `/(app)/(tabs)/community/welfare` |
| `announcement` | `/(app)/(tabs)/community/announcements` |
| `support.ticket_reply` | `/(app)/(tabs)/profile/help/tickets/[entityId]` |
| `user.approval_pending` (officer) | `/(app)/(tabs)/manage/members/approvals` |
| anything else | `/(app)/notifications` |

The API's existing `Notification.type` strings must be mapped to these keys in `push.service.ts` (F0.2 inventories current types).

### 8.3 Deep links (custom scheme `societyledger://`)
| Link | Screen |
|---|---|
| `societyledger://invite?token=&tenant=` | Accept Invite (sets tenant first) |
| `societyledger://reset-password?token=&tenant=` | Reset Password |
| `societyledger://payments/return?reference=&status=` | Payment Result (verifies) |
| `societyledger://notifications/<route>` | used internally by push routing |
All parameters validated with zod in `lib/linking.ts`; unknown links → Home.

### 8.4 Paystack flow
1. `POST /api/payments/paystack/initialize { transactionId, callbackUrl: <API>/api/payments/mobile-return }` → `{ authorizationUrl, reference }` (one transaction per checkout in v1).
2. `WebBrowser.openAuthSessionAsync(authorizationUrl, 'societyledger://payments/return')`.
3. Paystack redirects to `/api/payments/mobile-return?reference=…&trxref=…` → API 302 → `societyledger://payments/return?reference=…`.
4. App always calls `GET /api/payments/paystack/verify/:reference` (never trusts the redirect alone). If the user dismissed the browser, still verify with the stored reference; if pending, poll `GET /status/:reference` 3× over 10 s, then show "Pending — we'll notify you".
5. Webhook remains the source of truth server-side.

---

## 9. Backend additions (the ONLY permitted `apps/api` changes)

All additions are backward compatible: web behaviour must not change. Each ships with a Prisma migration (`prisma migrate dev --name …`), Zod validation, tests, and a docs note in `docs/mobile/`.

### 9.1 Refresh tokens (F0.3)
```prisma
model RefreshToken {
  id           Int       @id @default(autoincrement())
  userId       Int       @map("user_id")
  associationId Int?     @map("association_id")
  tokenHash    String    @unique @map("token_hash")     // sha256 of the opaque token
  familyId     String    @map("family_id")             // rotation chain id (uuid)
  deviceName   String?   @map("device_name")
  platform     String?                                  // ios | android
  expiresAt    DateTime  @map("expires_at")
  revokedAt    DateTime? @map("revoked_at")
  replacedById Int?      @map("replaced_by_id")
  lastUsedAt   DateTime? @map("last_used_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([familyId])
  @@map("refresh_tokens")
}
```
Endpoints (under `/api/auth`, tenant-optional list in `tenant.middleware.ts` updated):
- `POST /login`, `POST /member-invites/accept`: when header `X-Client: mobile`, issue 15-min access token + refresh token; response adds `refreshToken`, `accessTokenExpiresAt`. Without the header: unchanged (7-day token + cookie).
- `POST /refresh { refreshToken }` → rotate; reuse detection revokes family; re-checks `user.isActive`, approval and association status.
- `POST /logout { refreshToken? }` → also revokes the refresh token.
- `GET /sessions` → active refresh families for the user (device, platform, lastUsedAt). `POST /sessions/revoke-others`.
- `POST /change-password` and `POST /reset-password` revoke all refresh tokens for the user.
- Rate limit `/auth/refresh` with `sessionRateLimit`.

### 9.2 Push notifications (F0.2)
```prisma
model DeviceToken {
  id            Int       @id @default(autoincrement())
  userId        Int       @map("user_id")
  associationId Int?      @map("association_id")
  expoPushToken String    @unique @map("expo_push_token")
  platform      String                                  // ios | android
  deviceName    String?   @map("device_name")
  appVersion    String?   @map("app_version")
  lastSeenAt    DateTime  @default(now()) @map("last_seen_at")
  disabledAt    DateTime? @map("disabled_at")           // set on DeviceNotRegistered receipts
  createdAt     DateTime  @default(now()) @map("created_at")
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, associationId])
  @@map("device_tokens")
}
```
- New module `apps/api/src/modules/devices/` → `POST /api/devices/register`, `POST /api/devices/unregister` (auth required; upsert by token, reassign to current user).
- New `apps/api/src/services/push.service.ts` using `expo-server-sdk`: chunked sends, receipt checking (job every 15 min via existing `node-cron` pattern), disables tokens on `DeviceNotRegistered`.
- New `apps/api/src/services/notification-dispatch.service.ts`: single function `dispatchNotification({ associationId, userIds, title, message, type, entityId? })` that writes `Notification` rows **and** enqueues push respecting user notification preferences. Refactor the three current writers to call it: `modules/notifications/notifications.controller.ts` (create, createMany, announcement), `jobs/meeting-jobs.ts`, `services/tenant-management.service.ts`. Add `entityId`-carrying calls at key events (payment confirmed, proof submitted/verified, loan/welfare status changes, election phase changes, guarantor requests, ticket replies, user approvals) — inventoried in F0.2.
- Push failures never fail the originating request (fire-and-forget with logging).
- Env: `EXPO_ACCESS_TOKEN` (optional, enhanced security).

### 9.3 Mobile payment return bridge (F0.4)
- `GET /api/payments/mobile-return` (public, before tenant middleware): reads `reference`/`trxref`, responds `302 Location: societyledger://payments/return?reference=<urlencoded>`. Target scheme is **hard-coded** (no open redirect; ignore any `redirect` param). Also renders a tiny HTML fallback with a button link in case the redirect is blocked.
- `paystack.controller.ts initialize` currently accepts **one** `transactionId` and an optional `callbackUrl` (`z.string().url()`); passing the API's own `/api/payments/mobile-return` URL already validates, so **no schema change is needed**. Multi-item checkout (`transactionIds[]`) is **not** part of this addition — it is logged as a backend gap in `progress-tracker.md` for the owner to decide.

### 9.4 Small supporting changes (F0.5)
- Add `code` fields: `SUBSCRIPTION_INACTIVE` (subscription middleware), `INSUFFICIENT_PERMISSIONS` (rbac), `TENANT_MISMATCH` (auth middleware), `ASSOCIATION_SUSPENDED` / `ASSOCIATION_CANCELLED` / `ASSOCIATION_NOT_FOUND` (tenant middleware). Messages unchanged.
- Add `/api/devices` and `/api/payments/mobile-return` to the correct place in `server.ts` / `tenant.middleware.ts`.

### 9.5 Web change (F0.6)
`apps/web` `/auth/activate` and `/auth/reset-password` show an "Open in the SocietyLedger app" button linking to the `societyledger://` URLs (with `tenant` = current subdomain), visible on mobile user agents only.

---

## 10. Data model reference (read-only for mobile)

The app never touches the DB, but screens map 1:1 to these Prisma models (`apps/api/prisma/schema.prisma`, ~3,000 lines). Key models and the fields the mobile UI shows:

| Domain | Models | Key fields used by mobile |
|---|---|---|
| Tenancy | `Association` | id, name, subdomain, slug, logo, primaryColor, status (`ACTIVE`/`SUSPENDED`/`CANCELLED`…), tier |
| Identity | `User`, `UserApproval`, `Member`, `MemberInvite` | User: id, email, role, platformRole, isActive, emailVerified · Member: id, memberId, firstName, lastName, email, phone, address, city, state, country, gender, dateOfBirth, occupation, category, status, loginStatus, joinDate, emergency contact · Approval: approvalStatus |
| RBAC | `Permission`, `Role`, `RolePermission`, `UserRole` | role name/description/isSystem, permission key/category |
| Plans | `Plan`, `PlanVersion` (prices, limits, modules, features), `Subscription` (points at a version), `Addon`/`TenantAddon`, `PlatformModule`, `TenantModule` | current plan name, status, expiresAt, modules |
| Finance | `FinancialCategory`, `Transaction`, `Payment`, `MemberFinancialLedger` | Transaction: amount, dueDate, status, type/category, member, referenceNumber, description · Payment: amountPaid, paymentDate, paymentMethod (`BANK_TRANSFER`/`CASH`/`CARD`/`POS`/`MOBILE_MONEY`), reference |
| Advanced finance | `LevyCampaign`, `LevyCampaignAssignment`, `DonationAllocation`, `DonationRecord`, `PenaltyRule`, `AppliedPenalty`, `PenaltyWaiver` | campaign target/collected/status, assignment amount/paid |
| Nigerian payments | `AssociationBankAccount`, `BankTransfer`, `BankStatementImport`, `BankStatementEntry`, `PaymentReconciliation`, `PaymentProof` | bank name/account number/account name, transfer status, proof status (`PENDING`/`VERIFIED`/`REJECTED`), file URL |
| Gateway | `PaymentGatewayTransaction`, `PaymentHistory` | reference, status |
| Accounting | `ChartOfAccount`, `JournalEntry`, `JournalEntryLine`, `Budget`, `BudgetItem`, `AccountingPeriod` | account type (`ASSET`/`LIABILITY`/`EQUITY`/`INCOME`/`EXPENSE`), entry status (`DRAFT`→`POSTED`), budget status |
| Cooperatives | `SavingsAccount`, `SavingsTransaction`, `LoanProduct`, `LoanApplication`, `LoanGuarantor`, `Loan`, `LoanRepaymentSchedule`, `LoanRepayment` | balances, rates, `LoanApplicationStatus`, `LoanStatus`, `GuarantorStatus`, `RepaymentStatus` |
| Governance | `Meeting`, `MeetingAgenda`, `MeetingAttendance`, `MeetingMinutes`, `Election`, `ElectionPosition`, `Candidate`, `Vote`, `Poll`, `PollOption`, `PollResponse` | `MeetingType`, `MeetingStatus` (`SCHEDULED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`/`POSTPONED`), `AttendanceStatus`, `ElectionStatus`, `CandidateStatus`, `PollType`, `PollStatus` |
| Welfare | `WelfareFund`, `WelfareContribution`, `WelfarePayoutRequest` | `WelfareFundType`, `WelfarePayoutType`, `WelfarePayoutStatus` |
| Comms | `Notification`, `SMSMessage`, `SMSCampaign`, `SMSTemplate`, `SMSCreditBalance` | Notification: title, message, type, isRead, createdAt |
| Support | `HelpArticle`, `FAQItem`, `SupportTicket`, `TicketResponse`, `TicketAttachment` | `TicketCategory`, `TicketPriority`, `TicketStatus` |
| New (mobile) | `RefreshToken`, `DeviceToken` | §9 |

Enum values used in UI (status chips, pickers) are mirrored as TS string-literal unions in `src/types/api/enums.ts`, generated by reading `schema.prisma` (F1.3). Do not hand-type enum values from memory.

---

## 11. Caching, offline & performance

- QueryClient defaults: `staleTime 60_000`, `gcTime 24h`, `retry: (count, err) => count < 2 && isNetworkError(err)`, `refetchOnReconnect: true`. `focusManager` wired to `AppState`; `onlineManager` wired to `@react-native-community/netinfo`.
- **Persisted** (MMKV, `maxAge 24h`, buster = app version + user id + tenant): own finance summary, outstanding, payment history, ledger first page, upcoming meetings, active votes, notifications first page, profile, `/auth/me`. **Never persist**: admin lists with other members' PII beyond first page, AI chats, files.
- Persisted cache is wiped on logout / tenant switch.
- Mutations disabled while offline (`useOnline()`); buttons show "You're offline".
- Lists use FlashList with `estimatedItemSize`; images via expo-image with memory+disk cache.
- Query keys: `['<tenant>', '<domain>', '<resource>', params]` — tenant first so switching never leaks data.

---

## 12. Rules the agent must never violate

1. **Routes are thin.** Files in `app/` compose feature hooks and components; no `axios`, no `fetch`, no business logic, no inline styles beyond layout props.
2. **Only `src/api/` makes HTTP calls.** Only `src/api/client.ts` touches tokens and headers.
3. **`src/components/` contains no domain or API knowledge** — no imports from `api`, `features`, `stores`, or `app`.
4. **Features never import another feature's components or internals.** Shared UI moves to `components/`; cross-feature data access goes through the other feature's exported query hooks/keys only.
5. **No hard-coded colours, spacing, radii or font sizes.** Use NativeWind classes backed by tokens (`ui-tokens.md`). JS-side values (charts, navigation themes) come from `src/theme/tokens.ts`, which mirrors the CSS variables.
6. **Tokens live only in SecureStore.** Never log, persist elsewhere, or send them to Sentry. Sentry `beforeSend` scrubs `Authorization`, `refreshToken`, `password`, `token`.
7. **Every request carries the tenant.** Query keys start with the tenant subdomain. Switching tenants always clears cache and session.
8. **Permission checks go through `useCan()` with alias names.** Never check `user.role === '…'` for gating (only for display, and the onboarding rule).
9. **Hide, don't disable,** controls the user lacks permission for. Disabled state is for transient conditions (offline, invalid form, in-flight).
10. **Money is never a float.** Convert API values with `toDecimal()` at the API boundary; display with `<Money>` / `formatMoney()`; amounts sent to the API are converted from Decimal at the last moment in the expected type.
11. **Never trust client-side checks for security.** The API enforces permissions/modules; the client mirrors them for UX only.
12. **Never verify a payment from the redirect alone.** Always call the verify endpoint.
13. **Do not invent API endpoints or response fields.** Verify against the controller source; if missing, log a Backend gap and ask.
14. **Backend changes are limited to §9 (mobile) and §16.6 (admin); web changes are limited to §9.5, §15.3 and §16.8.** No other edits to `apps/api` or `apps/web` without explicit approval.
15. **Platform/Super Admin features never ship in mobile or in the tenant web app** — they live only in `apps/admin`.
16. **No in-app selling of SocietyLedger subscriptions or SMS credits**, and no links that steer to web purchase.
17. **All user-facing strings go through `t()`** (`src/lib/i18n.ts`, `en.json`).
18. **Every data screen implements loading, empty, error, offline and module-locked states** using the shared feedback components.
19. **Irreversible actions require confirmation**, and the ones listed in §7.5 require biometric re-auth.
20. **Update the living docs**: `ui-registry.md` when a reusable component is created or changed, `progress-tracker.md` when a feature ships.

---

## 13. Environments & configuration

> Docs-site environment variables are in §14.10; the docs URL used by web and mobile is in §15.1.

| Variable (`EXPO_PUBLIC_*` unless noted) | dev | preview | production |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://<LAN-IP>:4000` | staging API URL | production API URL |
| `EXPO_PUBLIC_WEB_URL` | `http://localhost:3000` | staging web | `https://www.societyledger.com.ng` |
| `EXPO_PUBLIC_BASE_DOMAIN` | `localhost` | — | `societyledger.com.ng` |
| `EXPO_PUBLIC_DOCS_URL` | `http://localhost:3001` | `https://docs.societyledger.com.ng` | `https://docs.societyledger.com.ng` |
| `EXPO_PUBLIC_SENTRY_DSN` | — | set | set |
| `EAS_PROJECT_ID` (app.config) | set | set | set |
| `SENTRY_AUTH_TOKEN` (EAS secret, build-time) | — | set | set |

`app.config.ts` selects values by `APP_VARIANT` (`development` | `preview` | `production`) and gives dev/preview builds distinct bundle IDs/names (`… (Dev)`) so they install side by side.

EAS profiles (`eas.json`): `development` (dev client, internal), `preview` (internal distribution, channel `preview`), `production` (store, channel `production`, autoIncrement build numbers).

---

## 14. Documentation site — `apps/docs`

### 14.1 Stack
| Concern | Choice | Notes |
|---|---|---|
| Framework | **Fumadocs** (`fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`) on **Next.js App Router** | Matches the BusinessCopilot docs look (grouped sidebar, ⌘K search, "On this page", cards). Use the Next.js/React/Tailwind versions the current Fumadocs release requires — confirm on fumadocs.dev at D1.1 and pin. |
| Content | **MDX** files in `apps/docs/content/docs/**` with typed frontmatter (zod schema in `source.config.ts`) | Content is code: reviewed in PRs, versioned in git. |
| Output | **Static export** (`output: 'export'`) to `apps/docs/out` | No server, no API calls, no auth. Cheap, fast, cacheable. |
| Search | Fumadocs built-in **static search** (client-side index generated at build) | Works with static export; no third-party service. Implementation has changed across Fumadocs releases (Orama → built-in static client) — follow the current docs at D1.5. |
| Styling | Tailwind CSS (version required by Fumadocs UI) + Fumadocs UI theme variables overridden with our tokens (`ui-tokens.md §14`) | |
| Fonts | Manrope (via `next/font/google`), self-hosted at build | Same family as mobile. |
| Icons | `lucide-react` | Same set as web/mobile. |
| Diagrams | Static SVG files in `public/diagrams/` authored by hand (lifecycles, money flow) | No runtime Mermaid (keeps export static and fast). |
| Images | WebP screenshots in `public/images/`, rendered with a `Screenshot` component (width/height required, lazy, zoom on click) | `next/image` with `unoptimized: true` (static export). |
| Screenshots | **Playwright** script against staging with a seeded demo association; mobile screenshots from Maestro runs (D7) | §14.7 |
| SEO | Next.js Metadata API per page, `sitemap.ts`, `robots.ts`, Open Graph images generated at build (Fumadocs OG / `next/og` at build time), JSON-LD | |
| AI-readable | `/llms.txt` and `/llms-full.txt` generated from content (Fumadocs supports this) | Lets support AI and external assistants read the manual. |
| Analytics | Google Analytics 4 (same property family as web, separate data stream) via `@next/third-parties` | Page views, search terms, feedback events, outbound "Open SocietyLedger" clicks. |
| Link checking | `lychee` (GitHub Action) or a Node script over `out/` | Fails CI on broken internal links. |
| Hosting | **Dokploy** application serving `apps/docs/out` from an **Nginx** container (multi-stage Dockerfile: pnpm build → `nginx:alpine` with our `nginx.conf`) | Domain `docs.societyledger.com.ng` on the Dokploy app (Traefik, Let's Encrypt). Explicit router priority above the tenant wildcard (§17.3). |

### 14.2 Folder structure
```
apps/docs/
├── app/
│   ├── layout.tsx                    # RootProvider (Fumadocs), fonts, theme, GA
│   ├── page.tsx                      # redirect "/" → "/docs"
│   ├── docs/
│   │   ├── layout.tsx                # DocsLayout: sidebar tree, nav links, banner
│   │   └── [[...slug]]/page.tsx      # DocsPage: renders MDX, TOC, breadcrumb, footer nav, feedback
│   ├── api/search/route.ts           # static search index (exported at build)
│   ├── og/[...slug]/route.tsx        # build-time Open Graph images
│   ├── llms.txt/route.ts             # generated, static
│   ├── llms-full.txt/route.ts
│   ├── sitemap.ts
│   ├── robots.ts
│   └── not-found.tsx                 # friendly 404 with search
├── content/
│   └── docs/
│       ├── index.mdx                 # /docs
│       ├── meta.json                 # root sidebar order (sections)
│       ├── getting-started/
│       │   ├── meta.json             # title, icon, page order
│       │   ├── index.mdx
│       │   └── create-your-association.mdx …
│       ├── core-concepts/ … account-security/ … member-guide/ … members/ … finance/ …
│       ├── payments/ … accounting/ … accounting-guide/ … reports/ … meetings/ …
│       ├── elections/ … welfare/ … cooperatives/ … communication/ … ai/ …
│       ├── settings/ … plan-billing/ … mobile-app/ … help-support/ …
│       ├── troubleshooting-faq/ …
│       └── reference/                # permissions.mdx & statuses.mdx are GENERATED — do not hand-edit
├── components/
│   ├── mdx/                          # MDX components registered in mdx-components.tsx (catalogue: ui-registry.md)
│   │   ├── AppliesTo.tsx  Callout.tsx  Steps.tsx  Screenshot.tsx  MenuPath.tsx  UiLabel.tsx
│   │   ├── PlatformBadge.tsx  PermissionNote.tsx  PlanNote.tsx  RoleTabs.tsx  PlatformTabs.tsx
│   │   ├── StatusChip.tsx  CardGrid.tsx  Faq.tsx  Glossary.tsx  Diagram.tsx  VideoEmbed.tsx
│   └── layout/                       # Feedback.tsx, LastUpdated.tsx, Footer.tsx, HeaderLinks.tsx
├── lib/
│   ├── source.ts                     # Fumadocs loader (pageTree, getPage)
│   ├── metadata.ts                   # per-page metadata + JSON-LD builders
│   ├── analytics.ts                  # gtag event helpers (feedback, search, outbound)
│   └── links.ts                      # APP_URL, outbound link builder with UTM
├── scripts/
│   ├── gen-reference.ts              # writes reference/permissions.mdx, statuses.mdx, payment-methods.mdx from repo sources
│   ├── screenshots/                  # Playwright: capture.config.ts, flows/*.ts (one per section), seed-demo.md
│   ├── check-links.ts                # internal link + anchor check over out/
│   ├── check-frontmatter.ts          # every page has required fields; no `status: draft` at launch; no pending screenshots
│   └── coverage.ts                   # compares tenant web routes (apps/web/src/app/**/page.tsx, excluding /admin/**, /dashboard/debug-permissions and marketing pages) with frontmatter `covers` → report
├── public/
│   ├── images/<section>/<page>-<n>[-dark].webp
│   ├── diagrams/*.svg
│   ├── favicon.ico, logo.svg, og-default.png
│   └── (no redirects file here — redirects live in nginx/redirects.conf)
├── source.config.ts                  # fumadocs-mdx collections + frontmatter zod schema
├── mdx-components.tsx
├── next.config.mjs                   # output: 'export', images.unoptimized, trailingSlash: false
├── tailwind / postcss config         # per Fumadocs version
├── Dockerfile                        # pnpm build → nginx:alpine serving out/
├── nginx/
│   ├── nginx.conf                    # caching, security headers, clean URLs (try_files $uri $uri.html $uri/ =404), 404 page
│   └── redirects.conf                # `rewrite ^/docs/old$ /docs/new permanent;` per moved page
├── tsconfig.json
└── package.json
```

### 14.3 Content model (frontmatter)
Defined once in `apps/docs/lib/docs-schema.ts` with zod (re-exported from `lib/source.ts`, where `defineDocs` is called); the build fails if a page doesn't match. **Not** a `source.config.ts` — this Fumadocs version's `defineDocs` (`fumadocs-mdx/macro`) is a compile-time macro with no fixed config-file convention, so there's no file-path contract to honour (corrected at D1.3; confirmed by reading the installed `fumadocs-mdx@15.4.7` source, the same way the `@fumadocs/base-ui` rename was confirmed at D1.1).
```yaml
---
title: Verifying payment proofs                  # sentence case, ≤ 60 chars
description: Check a member's transfer receipt and confirm or reject the payment.   # ≤ 160 chars, used for SEO + cards
type: task                                       # overview | task | concept | reference | faq | platform
audience: [officer]                              # member | officer | admin | founder | all
platforms: [web, mobile]                         # web | mobile
permission: PAYMENT_VERIFY                       # optional; alias name from permissions.ts → rendered as plain words via a map
module: payments                                 # optional; module code → "Available on plans that include Payments"
covers: ["/dashboard/payments/nigerian/verification", "PY2", "PY3"]   # web routes and mobile screen IDs documented
related: [/docs/payments/recording-bank-transfers, /docs/payments/how-members-pay]
status: published                                # draft | review | published
lastVerified: 2026-10-20                         # date the steps were re-checked against the app
icon: BadgeCheck                                 # optional lucide name for cards
---
```
- `AppliesTo` box is rendered automatically from `audience`, `platforms`, `permission`, `module` — authors don't hand-write it.
- `status: draft` pages are excluded from the production sidebar, search and sitemap, and shown with a banner in preview builds.
- `lastVerified` drives the "Last updated" line (falls back to git commit date).

### 14.4 Navigation (sidebar) model
- Root `content/docs/meta.json` lists sections in the order of `project-overview.md §9.6`, with separators: *Start* (Introduction, Getting started, Core concepts, Account & security) · *For members* (Member guide) · *Running your association* (Members, Finance, Payments, Accounting, Accounting guide, Reports) · *Community* (Meetings, Elections, Welfare, Cooperatives, Communication) · *Admin* (AI assistant, Settings, Plan & billing) · *Apps & help* (Mobile app, Help & support, Troubleshooting & FAQ, Reference).
- Each section folder has `meta.json` with `title`, `icon`, `pages` order, `defaultOpen: false` (except Getting started).
- Section index pages render a `CardGrid` of their pages automatically (from the page tree), plus hand-written intro.

### 14.5 Rendering of a page
`DocsPage` = breadcrumb → title → description → `AppliesTo` → MDX body → `Related` cards (from frontmatter) → `Feedback` → previous/next → `LastUpdated`. Right rail: TOC (H2/H3). Mobile: TOC collapses to a "On this page" dropdown at the top.

### 14.6 Search
- Index built at build time from title, description, headings and body text of `published` pages; result groups by section; keyboard shortcut ⌘K / Ctrl K.
- Synonyms list in `lib/search-synonyms.ts` (e.g. "dues" ↔ "subscription fee", "levy" ↔ "contribution", "proof" ↔ "receipt", "exco" ↔ "officer") applied by indexing synonyms into each page's hidden keywords field (`keywords` optional frontmatter).
- Search queries (not personal data) sent to GA4 as `docs_search` events for content-gap analysis.

### 14.7 Screenshots pipeline
- A **demo association** on staging (`demo` subdomain) seeded with realistic Nigerian data (60 members with Nigerian names, 12 months of dues, levies, a running election, meetings, a cooperative with loans, welfare fund). Seed steps documented in `scripts/screenshots/seed-demo.md` — use staging only, never production data or real member PII.
- Playwright logs in as `demo-admin`, `demo-treasurer`, `demo-member` (credentials in CI secrets), runs one flow file per section, captures at 1280×800 (desktop) and 390×844 (phone web), light and dark, saves WebP (quality 80) to `public/images/<section>/<page>-<n>[-dark].webp`.
- Annotations (numbered markers) are added in MDX via the `Screenshot` component's `markers` prop, not burned into images, so re-captures don't need re-editing.
- Mobile app screenshots (D7) come from Maestro flows on preview builds (iPhone 15 + Pixel 7 frames off).
- Pending screenshots are written as `<Screenshot pending="Proof detail with Verify and Reject buttons" />`; the frontmatter check fails launch builds if any remain.

### 14.8 Feedback & analytics
- `Feedback` component: "Was this page helpful?" Yes / No; on No, optional 280-char textarea. Sends GA4 event `docs_feedback { slug, helpful, comment_length }`; the comment text goes to GA only if the owner approves (default: not sent; store count only). No backend endpoint (the API's `DocFeedback` model is tied to the old DB docs and is not used).
- Outbound clicks to the app tracked as `docs_outbound`.
- Cookie/consent: GA loads with consent mode defaults; a minimal consent banner if required by NDPR guidance (decide at D1.5).

### 14.9 Build, CI & deploy
- CI (GitHub Actions, on PRs touching `apps/docs/**` or `context/**`): install → `gen:reference` (fails if generated files changed but weren't committed) → `type-check` → `lint` → `build` → `check:links` → `check:frontmatter` → `coverage` report as PR comment.
- Dokploy: production app tracks `main` → `docs.societyledger.com.ng`; a staging app tracks `develop` (or Dokploy preview deployments for PRs, if enabled for the GitHub provider) at `docs-staging.societyledger.com.ng`, which sends `X-Robots-Tag: noindex`. Dokploy builds from git via its auto-deploy webhook; branch protection makes CI pass before merge.
- Headers: long cache for `/_next/static/*` and `/images/*`; `X-Robots-Tag: noindex` on preview domains; security headers (CSP allowing GA only).

### 14.10 Docs environment variables
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://docs.societyledger.com.ng` (staging: `https://docs-staging.societyledger.com.ng`) |
| `NEXT_PUBLIC_APP_URL` | `https://www.societyledger.com.ng` |
| `NEXT_PUBLIC_GA_ID` | docs GA4 measurement ID |
| `NEXT_PUBLIC_SHOW_DRAFTS` | `true` in previews only |
| `DOCS_SCREENSHOT_BASE_URL`, `DOCS_SCREENSHOT_DEMO_PASSWORD` (CI secrets) | staging demo association. One shared password, not one per role (`DOCS_SCREENSHOT_*_PASSWORD` as originally written here) — `demo-association.seed.ts` gives all three demo logins the same password, so three identical secrets would be redundant (corrected at D1.6) |

### 14.11 Redirects
- Inside docs: renamed/moved pages get an entry in `nginx/redirects.conf` (301). Never delete a published URL without a redirect.
- From web: §15.3.

### 14.12 Rules the agent must never violate (docs)
1. **The app is the source of truth.** Every step must be reproducible in the current app; verify against the route/component/controller listed in `covers` before writing, and set `lastVerified`.
2. **No invented features, fields, buttons or limits.** If unsure, read the code; if still unsure, mark the page `status: review` with a `{/* QUESTION: … */}` comment and log it in `progress-tracker.md`.
3. **Never document platform/Super Admin features, internal endpoints, environment variables or security internals** on the public site.
4. **No real personal data** in screenshots or examples — demo association only; Nigerian-style fictional names and amounts.
5. **No prices** on the docs site (they change); link to the pricing page on the main site from plan-billing pages only.
6. **Generated reference pages are never hand-edited** — change the generator or the source.
7. **No hard-coded colours or fonts** in docs components — use the docs tokens (`ui-tokens.md §14`).
8. **Every published URL is permanent** — moves need redirects.
9. **Every task page has at least one screenshot** (or a `pending` placeholder before launch) and a "Before you start" section stating permission/plan.
10. **Write for the reader's goal, in the docs voice** (`code-standards.md §17`).
11. When an app feature changes (web or mobile), the affected docs pages are updated **in the same PR** (`covers` makes them findable: `grep -r "PY3" apps/docs/content`).

---

## 15. Links into the docs from web and mobile

### 15.1 Configuration
| App | Variable | Value |
|---|---|---|
| web | `NEXT_PUBLIC_DOCS_URL` | `https://docs.societyledger.com.ng` |
| mobile | `EXPO_PUBLIC_DOCS_URL` | `https://docs.societyledger.com.ng` |

### 15.2 Helpers
- Web: `apps/web/src/lib/docs.ts` → `docsUrl(path = '/docs', surface: string): string` (adds UTM). Mobile: `apps/mobile/src/lib/docs.ts` → same signature + `openDocs(path, surface)` using `WebBrowser.openBrowserAsync` (in-app browser, toolbar colour from tokens).
- A shared map lives in `packages/shared/src/docs-links.ts` (`DOCS_LINKS: Record<string, string>` keyed by web route pattern or mobile screen ID) so both apps use identical targets.

### 15.3 Permitted web changes (D6.3)
1. Header "Docs" and Footer "Documentation" links → `docsUrl('/docs', 'web_header' | 'web_footer')`, opening in a new tab.
2. `next.config.js` `redirects()`: `/documentation` → docs `/docs` (301); `/documentation/:slug` → mapped docs path via a static map (unmapped → `/docs`); `/documentation/search` → `/docs`.
3. "User manual" item at the bottom of `Sidebar.tsx` and `MemberSidebar.tsx` (members → member guide).
4. `HelpLink` component (`?` icon button with tooltip "Help for this page") added to dashboard page headers for routes in `DOCS_LINKS`.
5. Help Center (`/dashboard/help`) card "Read the full user manual"; onboarding wizard "See the setup guide" link.
No other web changes. The DB-backed documentation CMS (`/admin/documentation`, `/api/docs`, `DocPage` models) is left untouched and unlinked from public navigation.

### 15.4 Docs link map (initial; extend as pages publish)
| Key (web route / mobile ID) | Docs path |
|---|---|
| `/dashboard`, H2 | `/docs/reports/association-dashboard` |
| `/dashboard/member`, H1 | `/docs/member-guide/your-dashboard` |
| `/dashboard/my-finances`, M1 | `/docs/member-guide/what-you-owe` |
| `/dashboard/my-finances/pay`, M2, M3 | `/docs/member-guide/paying-online` |
| M4, `/dashboard/payments/bank-transfers/new` | `/docs/member-guide/paying-by-bank-transfer` |
| `/dashboard/my-finances/ledger`, M6 | `/docs/member-guide/your-statement` |
| `/dashboard/members`, MG1 | `/docs/members/your-member-list` |
| `/dashboard/members/create`, MG3 | `/docs/members/adding-a-member` |
| `/dashboard/members/invite`, MG4 | `/docs/members/inviting-members-to-log-in` |
| `/dashboard/finance/transactions*`, FN2–FN4 | `/docs/finance/creating-charges` |
| `/dashboard/finance/levies*`, FN8 | `/docs/finance/levy-campaigns` |
| `/dashboard/finance/penalties`, FN11 | `/docs/finance/penalties-and-late-fees` |
| `/dashboard/finance/overdue`, FN12 | `/docs/finance/overdue-and-reminders` |
| `/dashboard/payments/nigerian/verification`, PY3 | `/docs/payments/verifying-payment-proofs` |
| `/dashboard/payments/nigerian/reconciliation`, PY8 | `/docs/payments/matching-and-reconciliation` |
| `/dashboard/accounting/journal-entries`, AC3 | `/docs/accounting-guide/journal-entries` |
| `/dashboard/reports`, RP1 | `/docs/reports/finding-the-report-you-need` |
| `/dashboard/governance/meetings/[id]`, GV4 | `/docs/meetings/taking-attendance` |
| `/dashboard/governance/elections/[id]`, GV9 | `/docs/elections/how-elections-work` |
| C7 (ballot) | `/docs/member-guide/voting` |
| `/dashboard/welfare/requests`, WF4 | `/docs/welfare/payout-requests` |
| `/dashboard/cooperatives/apply`, M19 | `/docs/cooperatives/applying-for-a-loan` |
| `/dashboard/cooperatives/applications`, CP4 | `/docs/cooperatives/reviewing-and-disbursing-loans` |
| `/dashboard/communication/sms`, CM3 | `/docs/communication/sending-sms` |
| `/dashboard/settings/roles`, ST8 | `/docs/settings/custom-roles` |
| `/dashboard/subscription*` (web only) | `/docs/plan-billing/plans-and-whats-included` |
| `/onboarding/*`, O1–O5 | `/docs/getting-started/onboarding-wizard` |
| `/dashboard/help`, P5 | `/docs/help-support/in-app-help-center` |
Rule: the mobile app must never use a `plan-billing/*` target; `lib/docs.ts` in mobile filters them out and a unit test enforces it.

---

## 16. Platform admin console — `apps/admin`

### 16.1 Stack
| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js App Router**, `output: 'standalone'` (Node server) | Server needed for the session proxy and auth guard. Start on the **same Next 14 / React 18 versions as `apps/web`** so pages move with minimal change; upgrading is a separate, later decision. |
| UI | **Mantine 7** (`@mantine/core`, `dates`, `form`, `hooks`, `modals`, `notifications`) + Tailwind (preflight off), **@tabler/icons-react**, **recharts** | Same as the pages being migrated — lift and shift, then align with admin tokens (`ui-tokens.md §15`). |
| Data | **TanStack Query** (upgrade to v5 during migration — small API changes) + **axios** pointing at the admin app's own `/bff` proxy | Never call the API host directly from the browser. |
| Client state | **Zustand** (UI prefs only — no tokens, no tenant context) | |
| Forms | react-hook-form + zod (new forms); existing Mantine forms may stay until touched | |
| Session | Host-only `httpOnly` cookie `sl_admin_session` holding the API token, set by admin route handlers; read with `cookies()` in server code only (`import 'server-only'`) | No `Domain` attribute → never shared with `*.societyledger.com.ng`. |
| Guard | `middleware.ts`: unauthenticated → `/login`; optional IP allowlist check (`ADMIN_IP_ALLOWLIST`, uses `x-forwarded-for` from Traefik); adds `X-Robots-Tag: noindex` | |
| Rich text | existing Quill editor component (moves from web with the blog screens) | |
| Tests | Jest/Vitest + Testing Library for components; Playwright smoke tests (login + 2FA, impersonation handoff, suspend/reactivate on staging) | |
| Errors | Sentry (Next.js SDK) with PII scrubbing, separate project from web | |
| Hosting | Dokploy application, domain `admin.societyledger.com.ng` (§17) | |

### 16.2 Folder structure
```
apps/admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # MantineProvider (admin theme), QueryProvider, Notifications, Modals
│   │   ├── (auth)/login/page.tsx       # X1
│   │   ├── (auth)/login/2fa/page.tsx   # X3
│   │   ├── (auth)/login/2fa/setup/page.tsx  # X2
│   │   ├── (console)/layout.tsx        # AppShell: nav, header (env badge, user menu), impersonation sessions pill
│   │   ├── (console)/page.tsx          # X4 dashboard
│   │   ├── (console)/associations/…    # X5, X6
│   │   ├── (console)/tenants/…         # X7
│   │   ├── (console)/approvals/…       # X8
│   │   ├── (console)/analytics/…       # X9
│   │   ├── (console)/settlements/…     # X10
│   │   ├── (console)/modules/…         # X11
│   │   ├── (console)/logs/actions|audit/…  # X12, X13
│   │   ├── (console)/settings/…        # X14
│   │   ├── (console)/webhooks/…        # X15
│   │   ├── (console)/jobs/…            # X16
│   │   ├── (console)/blog/…            # X17
│   │   ├── (console)/help-content/…    # X18
│   │   ├── (console)/support/…         # X19
│   │   ├── (console)/impersonation/…   # X20
│   │   ├── (console)/account/…         # X21
│   │   ├── bff/[...path]/route.ts      # server proxy → API (GET/POST/PUT/PATCH/DELETE), attaches Bearer, strips cookies
│   │   ├── bff/session/route.ts        # POST login, DELETE logout, GET current admin (proxies /api/admin/auth/*)
│   │   ├── robots.ts                   # Disallow: /
│   │   └── not-found.tsx, forbidden/page.tsx
│   ├── features/<area>/                # queries.ts, mutations.ts, schemas.ts, components/ (same pattern as mobile)
│   ├── components/                     # shared admin UI: DataTable, FilterBar, StatCard, ConfirmDestructive, ReasonField, StatusBadge, EmptyState, PageHeader, EnvBadge
│   ├── lib/
│   │   ├── api.ts                      # axios instance baseURL '/bff'
│   │   ├── session.server.ts           # read/write session cookie (server-only)
│   │   ├── env.ts                      # typed env (server + public)
│   │   ├── permissions.ts              # platform-role → section map (§10.7)
│   │   └── format.ts                   # money/date formatting (shared rules with mobile)
│   └── theme/                          # Mantine theme built from admin tokens
├── middleware.ts
├── Dockerfile                          # turbo prune → pnpm install → next build → standalone runner
├── next.config.js                      # output: 'standalone', headers (CSP, noindex), no images from external hosts except API uploads
└── package.json
```

### 16.3 Session & proxy
1. `POST /bff/session { email, password }` → server calls `POST {API_URL}/api/admin/auth/login` with header `X-Client: admin`.
2. If the API replies `{ requires2fa: true, challengeId }` (or `{ requires2faSetup: true, challengeId }`), the server stores `challengeId` in a short-lived host-only cookie (`sl_admin_challenge`, 5 min) and the UI moves to X3/X2.
3. On success the server sets `sl_admin_session` = API token (`httpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`, **no Domain**).
4. `/bff/[...path]` forwards method, query, JSON/multipart body to `{API_URL}/api/<path>` with `Authorization: Bearer <token>`; it **only forwards to an allow-listed set of prefixes**: `admin/`, `cron/`, `webhooks/`, `admin/blog/`, `help/`, `support/`, `auth/change-password`, `subscriptions/plans`. Anything else → 404.
5. API `401` → proxy clears the cookie and returns 401 → client redirects to `/login?expired=1`.
6. CSRF: `SameSite=Strict` + the proxy rejects requests whose `Origin` isn't the admin host.

### 16.4 Impersonation handoff (end to end)
```
admin UI ──POST /bff/admin/impersonate/:id {reason, durationMinutes}──► API
API: create ImpersonationHandoff { codeHash, adminUserId, associationId, reason, expiresAt = now+60s, usedAt = null }
     ◄── { handoffCode, subdomain, expiresAt }
admin UI: window.open(`https://${subdomain}.${BASE_DOMAIN}/auth/impersonate?code=${handoffCode}`, '_blank', 'noopener')
tenant web /auth/impersonate: POST /api/auth/impersonation/exchange { code }
API: verify hash, not expired, not used, admin still SUPER_ADMIN (or allowed role), association active →
     mark used, issue impersonation JWT (existing payload: isImpersonating, originalAssociationId, impersonationTimestamp; exp = durationMinutes ≤ 4 h),
     set tenant cookie exactly as login does, write PlatformActionLog + AuditLog
tenant web: ContextIndicator banner; "End now" → POST /api/admin/end-impersonation → cookie cleared
```
The existing `POST /api/admin/impersonate/:associationId` that returns a JWT is changed to return a handoff code (the web's old in-app impersonation is removed in the same cutover, so no client depends on the old response).

### 16.5 Tenant resolution & reserved subdomains
- `RESERVED_SUBDOMAINS` constant in `packages/shared/src/reserved-subdomains.ts`: `admin, docs, www, api, app, platform, mail, status, staging, preview, cdn, static, help, support, blog, docs-staging, admin-staging, api-staging`.
- API: signup and `check-subdomain` reject them (`409 { code: 'SUBDOMAIN_RESERVED' }`); `extractSubdomain` / `extractSubdomainFromOrigin` return `null` for them, so an `Origin: https://admin.societyledger.com.ng` never resolves a tenant.
- Web signup form and mobile association-code screen validate against the same list.
- One-off check before deploying: confirm no existing association already uses a reserved subdomain (query in A1.2; if one exists, owner decides).

### 16.6 Backend additions for the admin console (the ONLY permitted `apps/api` changes for track A)
| # | Change | Details |
|---|---|---|
| B1 | **Platform login endpoint** | `POST /api/admin/auth/login` (before tenant middleware, `authRateLimit`): accepts only users with `platformRole`; same error message for wrong password and non-platform user; returns 8 h token (new `PLATFORM_TOKEN_EXPIRY`, default `8h`) or a 2FA challenge. `GET /api/admin/auth/me`. |
| B2 | **Tenant login refuses platform users** (ships at cutover, A3.1 — not before the admin console is live) | `POST /api/auth/login`: if the matched user has `platformRole` → `403 { code: 'PLATFORM_LOGIN_REQUIRED' }`. Remove the "platform login via any subdomain" branch. |
| B3 | **Reserved subdomains** | §16.5. |
| B4 | **Impersonation handoff** | Prisma `ImpersonationHandoff` model; changed `POST /api/admin/impersonate/:associationId` (requires `reason`, `durationMinutes` ≤ 240); new `POST /api/auth/impersonation/exchange` (tenant-optional path in tenant middleware); `GET /api/admin/impersonation-sessions`. |
| B5 | **TOTP 2FA for platform users** (recommended; owner may defer) | Prisma fields on `User`: `totpSecretEnc` (encrypted with `TOTP_ENCRYPTION_KEY`, AES-256-GCM), `totpEnabledAt`, plus `RecoveryCode { userId, codeHash, usedAt }`; endpoints `POST /api/admin/auth/2fa/setup`, `/confirm`, `/verify`, `/recovery`, `POST /api/admin/auth/2fa/regenerate-recovery`; library `otplib`. Login challenge stored server-side (`AdminLoginChallenge`, 5 min). |
| B6 | **Admin IP allowlist (optional)** | Middleware on `/api/admin/*`, `/api/cron/*`, `/api/webhooks` management routes reading `ADMIN_IP_ALLOWLIST` (comma-separated CIDRs; empty = off). Uses `app.set('trust proxy', …)` correctly for Traefik. |
| B7 | **Reasons on destructive actions** | Suspend, soft delete, permanent delete, force logout, billing override/credit, module override, platform settings change require `reason` (zod) and store it in `PlatformActionLog`. |
| B8 | **CORS** | Add `https://admin.societyledger.com.ng` (and the staging host) explicitly to `allowedOrigins` (the existing subdomain regex already matches, but explicit is auditable). The admin browser normally doesn't call the API directly (proxy), so this is defence in depth. |
Each addition ships with a Prisma migration (`pnpm -F @societyledger/api prisma migrate dev --name …`), zod validation, tests and a note in `docs/admin/`.

### 16.7 Data & API contract
- Admin uses the existing `/api/admin/*`, `/api/cron/*`, webhooks management, `/api/admin/blog/*`, and platform-scope `/api/help/*`, `/api/support/*` endpoints. **Verify each endpoint's request/response against its controller** before building a screen (same rule as mobile §6.2).
- Response envelopes as §6.2. Lists normalised to `{ items, pagination }` in `features/<area>/queries.ts`.
- Money values from analytics/settlements are Decimal strings → format with the shared rules; never float maths for sums shown to staff.

### 16.8 Cutover of `apps/web` (the ONLY permitted web changes for track A)
Listed in `project-overview.md §10.8`. Implementation notes:
- Delete files rather than leaving dead branches; run `pnpm -F @societyledger/web type-check` and `lint` after each deletion batch.
- `authStore` keeps `isImpersonating` + `impersonatedAssociation` (banner) but drops `startImpersonation` from in-app admin pages.
- Add `/auth/impersonate/page.tsx` (exchange code → redirect to `/dashboard`; on failure: "This link has expired. Start impersonation again from the admin console.").
- `next.config.js` `redirects()`: `{ source: '/admin/:path*', destination: 'https://admin.societyledger.com.ng/:path*', permanent: true }`.

### 16.9 Admin environment variables
| Variable | Scope | Value |
|---|---|---|
| `API_URL` | server | internal API URL on the Dokploy network (e.g. `http://societyledger-api:4000`) — avoids the public round trip |
| `NEXT_PUBLIC_ADMIN_ENV` | public | `production` / `staging` (drives the environment badge) |
| `NEXT_PUBLIC_BASE_DOMAIN` | public | `societyledger.com.ng` (impersonation URLs) |
| `ADMIN_IP_ALLOWLIST` | server | optional CIDR list |
| `SESSION_COOKIE_NAME` | server | `sl_admin_session` |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | server/build | admin Sentry project |
API additions: `PLATFORM_TOKEN_EXPIRY=8h`, `TOTP_ENCRYPTION_KEY` (32-byte base64), `ADMIN_IP_ALLOWLIST`, `IMPERSONATION_EXPIRY` (existing, max 4h).

### 16.10 Rules the agent must never violate (admin)
1. **The API token never reaches browser JavaScript.** Only server code (`*.server.ts`, route handlers, middleware) reads the session cookie; client code calls `/bff/*`.
2. **The admin session cookie is host-only** (no `Domain`), `httpOnly`, `Secure`, `SameSite=Strict`.
3. **Nothing in `apps/web`, `apps/mobile` or `apps/docs` links to or mentions the admin console** (except the web login notice text and the mobile A12 text).
4. **No platform code in `apps/web` after cutover** — no `SUPER_ADMIN` branches, no `/admin` routes, no `X-Association-Id` context switching.
5. **Impersonation only through the handoff** (no JWT in URLs, logs or the admin browser); every impersonation has a reason and an expiry ≤ 4 h.
6. **Every destructive action requires confirmation + reason**; permanent delete also requires typing the subdomain.
7. **The proxy forwards only allow-listed API prefixes.**
8. **Platform-role checks are enforced by the API**; the admin UI mirrors them for navigation only.
9. **No public indexing, no third-party analytics, no marketing scripts** on the admin host.
10. **Migration keeps behaviour:** when moving a page, keep its API calls and business rules; improvements are limited to layout/tokens unless the plan says otherwise. Note any bug found during migration in `progress-tracker.md` instead of silently changing behaviour.
11. **Backend changes are limited to §16.6; web changes to §16.8.**

---

## 17. Deployment — Dokploy (all apps)

### 17.1 Topology
**Everything deploys as one Dokploy "Compose" application**, defined in root `docker-compose.dokploy.yml` (one project, one git-triggered deploy for the whole stack) — not one Dokploy Application per app. This is already live for `api` and `web` (shipped in the "Migrate SocietyLedger from Vercel to Dokploy" commit, `b61d388`); `admin` and `docs` are added as **new services in the same compose file**, not as separate Dokploy Applications, when their respective build phases (A1.7, D1.7) are reached. `library-docs.md`'s "each app = one Dokploy Application" wording predates this and is reconciled at D1.7, not before.

| Compose service | Source | Build | Domain(s) | Notes |
|---|---|---|---|---|
| `postgres` (`societyledger-db`) | Dokploy **PostgreSQL 16** container in the same compose stack | — | internal only | Migrated from Neon. `DATABASE_URL` and `DIRECT_URL` both point here (no pooler); keep `directUrl` in `schema.prisma` so a pooler (PgBouncer) can be added later without code changes. Scheduled backups to S3-compatible storage (Dokploy backups), daily, 14-day retention; monthly restore test. |
| `redis` (`societyledger-redis`) | Redis container in the same compose stack | — | internal only | `REDIS_URL`; API runs without it. |
| `api` (`societyledger-api`) | `apps/api/Dockerfile` (exists; `context: .`, built by the `api` service in `docker-compose.dokploy.yml`) | `turbo prune @societyledger/api --docker` → pnpm install → `prisma generate` → `tsc`; pre-deploy/start runs `prisma migrate deploy` | `api.societyledger.com.ng` (confirmed) | Port 4000; `trust proxy` set for Traefik. Dokploy's own `dokploy.domain`/`dokploy.port` labels route it today (not a Traefik router rule) — see §17.3 before adding `admin`/`docs`, which do need explicit router priority. Persistent volume for `uploads/` (or move uploads to object storage later). |
| `web` (`societyledger-web`) | `apps/web/Dockerfile` (exists; same pattern) | `turbo prune @societyledger/web --docker`, Next standalone | `societyledger.com.ng`, `www.societyledger.com.ng`, **wildcard** `*.societyledger.com.ng` | Wildcard needs a **DNS-01** certificate (Traefik certresolver with the DNS provider's API token) — HTTP-01 can't issue wildcards. Traefik rule has **no explicit priority** set today — a latent bug once `admin`/`docs` are added (§17.3); fix when either lands. |
| `admin` (`societyledger-admin`) — **not yet added** | git `apps/admin` | Dockerfile (Next standalone), added as a new service in `docker-compose.dokploy.yml` at A1.7 | `admin.societyledger.com.ng` | Explicit Traefik priority above the wildcard (§17.3). |
| `docs` (`societyledger-docs`) — **not yet added** | git `apps/docs` | Dockerfile (pnpm build → `nginx:alpine`), added as a new service in `docker-compose.dokploy.yml` at D1.7 | `docs.societyledger.com.ng` | Explicit priority above the wildcard. |
| Staging | same compose file, `develop` branch | same | `*-staging` hosts or a separate staging server | Staging database separate from production; demo association seeded here (docs screenshots). |

### 17.2 Dockerfile pattern (pnpm + Turborepo monorepo)
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo prune @societyledger/admin --docker
FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@societyledger/admin
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/apps/admin/.next/standalone ./
COPY --from=builder /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /repo/apps/admin/public ./apps/admin/public
USER node
EXPOSE 3002
CMD ["node", "apps/admin/server.js"]
```
For docs the runner is `nginx:alpine` copying `apps/docs/out` and `apps/docs/nginx/*.conf`. Add the new service to root `docker-compose.dokploy.yml` with `build.context: .` and `build.dockerfile: apps/<app>/Dockerfile` (the **repo root as context**, matching the existing `api`/`web` service blocks — pruning needs the whole workspace), not a separate Dokploy "Dockerfile" Application.

### 17.3 Traefik routing gotcha (wildcard vs specific hosts)
The tenant wildcard (`*.societyledger.com.ng` → `web`, via a Traefik router rule) can capture `admin.` and `docs.` requests once those services exist. Traefik orders routers by rule length unless `priority` is set, so **set explicit priorities**: `admin` and `docs` routers `priority=100`, web wildcard `priority=1`. (`api` currently routes via Dokploy's own `dokploy.domain`/`dokploy.port` labels rather than a Traefik router rule, so it isn't affected by this ordering — confirm that still holds once `admin`/`docs` are added.) Add the `traefik.http.routers.<service>.priority` label under that service's `labels:` block in `docker-compose.dokploy.yml` — there is no per-app Dokploy config to edit separately, it's one compose file. Verify after every domain change: `curl -sI https://admin.societyledger.com.ng | grep -i x-robots-tag` should show the admin's `noindex` header, not the web app's response.

### 17.4 Releases & rollback
- All services deploy together as **one Dokploy Compose stack** triggered from a single branch (`main` for production, `develop` for staging) — there is no independent per-app git auto-deploy. Dokploy keeps the previous compose deploy for one-click rollback of the whole stack.
- Database migrations run only from the `api` service (`prisma migrate deploy`) and must be backward compatible with the previous API version (expand → migrate → contract) so a stack rollback doesn't break against newer data.
- Order for track A cutover (within the same compose deploy, or as sequential deploys if the owner prefers staging each step): API (B1–B8, backward compatible) → admin app live → web cutover (deletes Super Admin, adds redirect) → API removes the old platform-login branch last.

---

## 18. Thrift (Ajo) add-on

> Specification: `thrift-ajo-spec.md`. Build order: `build-plan.md` Track T. This section is the engineering contract. It extends `apps/api` and the three clients; it does **not** create a second billing, identity or notification system — it reuses the ones in §6–§9 and the dynamic billing system (versioned plans, add-ons, entitlements).

### 18.1 Positioning that the code must keep true
SocietyLedger is **record-keeping software**. The group's own bank account holds the money. **No code path collects, holds, moves or pays out contribution money**: nothing in `modules/ajo/` calls Paystack (or any payment provider) for contribution money, and there is no wallet, escrow or settlement table. Paystack is used only for the add-on **subscription**, through the existing billing code. A test fails if `modules/ajo/` imports a payment-provider client.

### 18.2 Placement and gating
- **API:** new module `apps/api/src/modules/ajo/` (routes, controllers, services, jobs) mounted at `/api/ajo`, behind `authMiddleware`, `tenantMiddleware` and `requireModule('ajo')`; feature gates with `requireFeature('ajo.<feature>')` (collector thrift, rotating pot, guarantors, reminders, advanced reports).
- **Entitlements:** `ajo` is an add-on-only module (in no default plan). The Ajo add-on has four published versions (tiers) with the limit `ajoContributors`, counted on **active** contributors (not invited). Entitlements come from `entitlements.service.ts` like any add-on. **Expiry is read-only, not a lockout:** when the add-on lapses, `requireModule('ajo')` still admits read and export routes and rejects writes with `ADDON_EXPIRED` and a clear message; financial records are never deleted or hidden.
- **Tenant kinds:** `Association.kind` = `ASSOCIATION` (default) or `THRIFT_GROUP` (outsiders using only Ajo). A `THRIFT_GROUP` tenant is entitled to core modules + `ajo` only; every non-Ajo route returns `MODULE_DISABLED`. Platform staff can switch standalone sign-up off with the setting `ajo.standalone_signup`.
- **Identity:** a contributor is a `Member` row in either kind of tenant (reuse; no parallel identity table). Existing `Member` rules (photo, status, login) apply. **There is no government-ID, NIN, BVN or KYC data in this add-on.**

### 18.3 Data model (all money in integer kobo; table names `ajo_*`)
| Model | Purpose / key fields |
|---|---|
| `AjoGroup` | `associationId`, `name`, `model` (`COLLECTOR_THRIFT` \| `ROTATING_POT`), `frequency` (`DAILY`/`WEEKLY`/`MONTHLY`), `contributionKobo`, `startDate`, `cycleLength` or `rounds`, `maxParticipants`, `collectorFee` (type + value), the group's own bank account details (bank, number — masked in output —, account name), `timezone`, `cutoffTime`, `requirePhoneConfirm`, `status` (`DRAFT`→`OPEN`→`ACTIVE`→`COMPLETED`/`CANCELLED`) |
| `AjoGroupRuleVersion` | versioned rules: late-fee policy (none/fixed/percent, amount, cap), `graceDays`, guarantor policy, default procedure, reminders; `effectiveFrom`; never edited, a new version is added |
| `AjoRuleAcceptance` | membership, rule version, acceptedAt, evidence (channel/device) |
| `AjoMembership` | `groupId`, `memberId`, `status` (`PENDING`/`ACTIVE`/`SUSPENDED`/`LEFT`/`DEFAULTED`), `approvedBy`/`approvedAt`, `payoutPosition`, `guarantorAgreementId?`, `phoneConfirmedAt?`, `acceptedRuleVersionId` |
| `AjoInstallment` | `membershipId`, `dueDate`, `amountKobo`, `status` (`DUE`/`PARTIAL`/`PAID`/`OVERDUE`/`WAIVED`), `paidKobo` |
| `AjoContribution` | `membershipId`, `installmentId?`, `amountKobo`, `method` (`CASH`/`TRANSFER`), `status` (`REPORTED`/`CASH_RECEIVED`/`CONFIRMED`/`REVERSED`), `collectorId?`, `reference`, `proofKey?`, `idempotencyKey` (unique), `receivedAt`, `confirmedAt`, `reversalOfId?` |
| `AjoCollectorAssignment` | collector (User) ↔ membership, daily target, active dates |
| `AjoCashHandover` | collector, date, expected, collected, handedOver, difference, reconciledBy/at |
| `AjoPayoutAccount` | `memberId`, bank name, account number (masked projection), account name, `changedAt`; recorded, not verified by a service |
| `AjoPayout` | `groupId`, `membershipId`/round, `grossKobo`, `collectorFeeKobo`, `shortfallKobo`, `netKobo`, `status` (`PREPARED`→`APPROVED`→`PAID`/`VOID`), `preparedBy`, `approvedBy`, payout-account **snapshot** (masked), `paidReference?`, `paidRecordedBy?` |
| `AjoLateFeeAssessment` | installment, basis, calculation (stored), cap applied, `status` (`PENDING`/`PAYABLE`/`WAIVED`), rule version |
| `AjoDefaultCase`, `AjoRepaymentPlan` | post-payout default workflow: outstanding balance, notices, member response, plan schedule, resolution |
| `AjoGuarantorAgreement` | guarantor name, phone, relationship, the exact wording accepted, acceptedAt — **a recorded consent only** |
| `AjoLedgerEntry` | **append-only** money record: group, membership, `type` (contribution, reversal, fee, payout, adjustment), `amountKobo`, `direction`, `refType/refId`, `idempotencyKey` (unique), `reversalOfId?`; balances are derived, never stored as the source of truth |
| `AjoTrustSnapshot` | periodic on-time percentage over the last 12 months with the counts used and the band (`EXCELLENT` 95%+, `GOOD` 85–94%, `FAIR` 70–84%, `AT_RISK` under 70%, `NO_HISTORY`); disputed payments not counted until resolved, waived payments not counted |
| `AjoVerification` | the second step: `memberId`, `submittedName/Phone/Address/PayoutAccountName` snapshot, `status` (`PENDING`/`VERIFIED`/`REJECTED`), checklist results (name matches payout account name, phone confirmed, address filled in), `reviewedBy` (platform user), `reviewedAt`, `rejectionReason`; no ID numbers or ID photos |
| `AjoPayoutOrderEvent` | rotating-pot order history: `DRAW` (seed + resulting positions), `SWAP` (two memberships, requested/approved by), `EXCEPTION` (membership, new position, written reason, approved by); append-only |
| `AjoDispute` | member claim ("I paid") with evidence, status, resolution reason |

### 18.4 State machines (guard every transition server-side)
- **Group:** `DRAFT → OPEN → ACTIVE → COMPLETED | CANCELLED`. Money fields (amount, frequency, participants, collector fee, bank account) are locked once `ACTIVE`.
- **Contribution:** `REPORTED → CASH_RECEIVED → CONFIRMED`, and any state → `REVERSED` (a new reversing entry; the original is never edited). Only `CONFIRMED` counts as money in the group's account; `CASH_RECEIVED` is cash in the collector's hands.
- **Payout:** `PREPARED → APPROVED → PAID | VOID`. Preparer ≠ approver (single-admin groups get an extra confirmation, logged). Changing the payout account after approval voids the approval and starts a cool-off. `PAID` means an officer **recorded** that the group paid from its own account; SocietyLedger never initiates the transfer.
- **Membership:** `PENDING` until officer approval, guarantor consent (if required), rule acceptance and (if the group requires it) phone confirmation are all satisfied, then `ACTIVE` (the person can now join and contribute).
- **Verification (`AjoVerification`):** created when the group approves; `PENDING → VERIFIED | REJECTED` by platform staff in the admin console. **A payout can only be prepared or approved for a `VERIFIED` person.** Changing the payout account resets the status to `PENDING`. A rejection carries a reason shown to the group admin.
- **Payout order (rotating pot, hybrid):** positions come from a recorded `DRAW` (seed saved; reproducible); `SWAP`s need admin approval and are allowed only before the first payout; after the first payout positions of paid members are immutable and only an admin-approved `EXCEPTION` with a written reason may change the remaining order. Optional group rule (default off): `AT_RISK` participants cannot take the first positions.

### 18.5 Money rules
1. Integer kobo everywhere; formatting only at the edge (`₦10,000.00`, never abbreviated).
2. Every money-recording write has a unique `idempotencyKey`; replays are no-ops.
3. Ledger entries and contributions are never updated or deleted; corrections are reversals with a reason.
4. **Subscription ≠ contribution.** Add-on subscription charges use the existing `PaymentHistory` (purpose `ADDON`); Ajo money uses `AjoContribution`/`AjoLedgerEntry`. A test fails if either path writes the other's table.
5. The platform levy is computed in one place (`ajo-levy.ts`), recorded as its own entry, and **billed on the add-on invoice**; it is never deducted from a contribution. Formula: cycle levy = 0.5% of the cycle's scheduled contributions (min ₦500, max ₦5,000) + participant levy = 0.25% of each participant's scheduled contributions (min ₦50, max ₦1,000); **Starter-tier groups are exempt**. The rates and caps live in platform settings, not in code.
6. Late fees are assessed only under an accepted rule version, shown with their calculation, and never retroactive. Default balance = remaining agreed contributions − payments − valid credits; other members' savings and guarantors' money are never auto-deducted.

### 18.6 API surface (`/api/ajo`, all behind module + permission gates)
`groups` (CRUD, lifecycle, rules, schedule preview) · `groups/:id/order` (draw, swap request/approve, emergency exception) · `groups/:id/members` (invite, join, approve, guarantor, verification status) · `payout-account` (own and officer-set) · `contributions` (record, confirm, reverse, receipts, proofs) · `collections` (today's list, record cash, handover, reconcile) · `payouts` (prepare, approve, record paid, void) · `defaults` (cases, plans, disputes, waive fee) · `reports/*` (eight reports + `export`) · `trust` (own score and inputs). Admin console: `/api/admin/ajo/*` (platform settings, levy, verification review queue, oversight, analytics) under the existing Super Admin guard.

### 18.7 Jobs (idempotent; added to `jobs/` beside the subscription jobs)
Overdue detection and grace expiry · reminders (before/after due date; one per installment per channel) · late-fee assessment (when enabled) · trust-score refresh · add-on expiry → read-only mode. Running a job twice must not duplicate a reminder, fee or notification.

### 18.8 Notifications
New `Notification.type` values (mapped in the push routing table, §8): `ajo.contribution_recorded`, `ajo.contribution_confirmed`, `ajo.contribution_reversed`, `ajo.installment_due`, `ajo.installment_overdue`, `ajo.membership_approved`, `ajo.verification_status`, `ajo.order_drawn`, `ajo.swap_requested`, `ajo.payout_prepared`, `ajo.payout_approved`, `ajo.payout_paid`, `ajo.guarantor_request`, `ajo.default_case_opened`, `ajo.rules_changed`. Receipt SMS/push/email for every contribution, respecting the member's preferences.

### 18.9 Security and audit
- **Bank account numbers** (the group's and members' payout accounts) are masked in every API response, log line and admin screen (`••••1234`) and never written to error reports; full values are returned only to the person entering them and to officers with `ajo.manage`.
- **Access:** contributors see only their own records; collectors only their assigned contributors; officers their association; cross-association access is impossible by query scoping and tested.
- **Payout controls:** separation of duties, cool-off on payout-account change, `useReauth` on mobile for approval.
- **Audit:** group, rule, role, assignment, approval, reversal, waiver and payout changes are audited (`AuditLog` for tenant actions, `PlatformActionLog` for platform overrides).

### 18.10 Client contracts
- **Mobile:** member screens under `app/(app)/(tabs)/money/thrift/*`; collector and officer screens under `app/(app)/(tabs)/manage/thrift/*` (Manage tab hub section, visible with `ajo.collect`/`ajo.manage`); collector screens require connectivity and show a "needs internet" state (no offline queue in the first release); payout approval uses `useReauth`; no purchase links (rule 16 still applies — the subscription is bought on the web).
- **Web:** `app/dashboard/thrift/*`; standalone sign-up at `/thrift/start`.
- **Admin:** `apps/admin` section "Thrift" (settings, oversight, analytics) through `/bff`.
- **Docs:** section `ajo-thrift` (`project-overview.md §12.3`).

### 18.11 Foundation as built (T1, 2026-10-27)
- **Tiers:** four add-ons `ajo-starter`, `ajo-growth`, `ajo-business`, `ajo-enterprise` share `Addon.family = 'ajo'`. A tenant holds at most one; `buildAddonQuote` credits the unused part of the tier it replaces and refuses a smaller tier mid-term (`ADDON_TIER_DOWNGRADE`); `buildPlanQuote` refuses two tiers together (`ADDON_FAMILY_CONFLICT`); applying a quote ends the replaced row.
- **Quota:** `ajoContributors` (`LIMIT_DEFINITIONS`, `source: 'addon'`). `mergeLimits` counts it from zero from add-ons only. Counting and the limit check are in `modules/ajo/ajo-capacity.ts`; error `AJO_CONTRIBUTOR_LIMIT`.
- **Access:** `requireAjoAccess()` (`modules/ajo/ajo-access.ts`) is the one gate for `/api/ajo`: `FULL`, `READ_ONLY` (add-on lapsed and the tenant has groups: reads pass, writes get `ADDON_EXPIRED`) or `DISABLED` (`MODULE_DISABLED`). A staff override that switches Ajo off is a stop, not an expiry. The check failing returns 503 rather than guessing. Exports sent as POST opt in with `allowWhenReadOnly`.
- **Standalone groups:** `Association.kind = THRIFT_GROUP`; `computeEntitlements` limits it to core modules and `ajo` and ignores overrides; `Plan.audience` decides which plans a tenant is offered; sign-up is `POST /api/associations/thrift-signup`, refused with `THRIFT_SIGNUP_CLOSED` unless `ajoStandaloneSignup` is on.
- **Money columns** in `ajo_*` are `BigInt` kobo. `AjoContribution` keeps amount and identity fixed and only moves its confirmation status forward; `AjoLedgerEntry` is never updated (`ajo-ledger.service.ts` exposes no update or delete).
- **Roles:** `ajo_collector`, `ajo_officer`; seven `ajo.*` permissions; members hold `ajo.view_own` and `ajo.contribute`.
- **Guard tests:** `__tests__/ajo/ajo-money-boundary.test.ts` fails if `modules/ajo` imports a payment client, touches subscription payment tables, or if billing code writes an Ajo money table.

### 18.12 Member approval, verification and payout accounts as built (T2, 2026-10-27)
- **Membership:** `unmetRequirements` is the one list of what a membership still needs (approval; phone confirmation if the group asks). T3 adds rule acceptance and guarantor consent to it. `tryActivate` runs in the caller's transaction and calls `assertContributorCapacity` (per-tenant advisory lock); running out of room is returned as `blockedByLimit`, not thrown, so the approval stands and approving again completes it. `assertCanContribute` is the guard T4 must call before scheduling or recording a contribution.
- **Phone code:** fields live on `AjoMembership`. The code is stored as an HMAC of `phone|code`, so it is bound to the number it was sent to. Sent through `dispatchMessages` (inline), charged to the association's SMS credits; no credits gives `NO_SMS_CREDITS` and leaves no state behind.
- **Payout account:** `AjoPayoutAccount` holds `accountNumberEnc` and `last4` (no plain number column). `ajo-secrets.ts` derives separate keys per purpose with HKDF from `TOTP_ENCRYPTION_KEY` and binds ciphertext to the member through AAD. Responses and snapshots carry the masked form only; `auditAjo` strips secret-looking keys and masks any ten-digit run.
- **Verification:** `AjoVerification` is per person; the latest row decides. A payout-account change refreshes a pending row or adds a new pending one after a decision. `assertPayoutEligible` checks, in order: payout account exists, latest row is `VERIFIED`, not inside the cool-off.
- **Routes:** tenant routes under `/api/ajo` (`memberships/:id/…`, `members/:memberId/…` where `:memberId` is an id or `me`); staff routes under `/api/admin/ajo/verifications`, mounted ahead of the SUPER_ADMIN-only router like support.
- **Tests:** the database suite needs `AJO_TEST_DATABASE_URL` (a database whose name contains "test", migrated with `prisma migrate deploy`). Run `prisma` from a directory without the app's `.env` and set both `DATABASE_URL` and `DIRECT_URL`, otherwise the CLI silently targets the development database.

### 18.13 Groups, rules, schedules and payout order as built (T3, 2026-10-28)
- **Lifecycle:** `AjoGroup.status` moves DRAFT → OPEN → ACTIVE → COMPLETED or CANCELLED. Every transition takes a row lock on the group (`SELECT … FOR UPDATE`) so two admins cannot start, edit or cancel it at the same moment. `MONEY_FIELDS` (model, frequency, amount, start date, cycle length, collector fee, cutoff, timezone, phone-confirmation and share limit) are locked once ACTIVE; name, places (raise only, never in a rotating pot), late-join switch and the bank account stay editable. Kobo is returned as strings in every response.
- **Group bank account:** `bankAccountEnc` (AES-256-GCM, HKDF purpose `group-account`, bound to `group:<id>`) plus `bankAccountLast4`. `getGroupBankAccount` is the only function that returns the full number, and only to a manager or a non-left member of that group. Audit rows and notices carry the masked form.
- **Requirements:** `unmetRequirements` = APPROVAL, PHONE_CONFIRMATION, RULE_ACCEPTANCE, GUARANTOR_CONSENT. `loadRequirementFacts` is the single loader used by `tryActivate` and `assertCanContribute`. A group with no rule versions asks for no acceptance (older rows); every group made through the API has version 1.
- **Rules:** `AjoGroupRuleVersion` rows are never edited. `currentRuleVersion` (newest with `effectiveFrom` ≤ now) is what a newcomer accepts; `ruleVersionInForce(membershipId)` (newest accepted) is what binds an existing member and is what late fees (T6) and defaults (T8) must read. A new version needs 7 days' notice and only one may be waiting at a time.
- **Consent evidence:** `AjoRuleAcceptance.evidence` = `{ channel: 'app' | 'officer', recordedBy?, note?, device? }`. `AjoGuarantorAgreement` stores the server-built wording as shown, `recordedBy` and `evidence`.
- **Schedule:** `ajo-schedule.ts` is pure (dates, amounts, `businessDay`, `diffSchedule`). `syncMembershipSchedule` applies the diff: it creates missing instalments (`createMany … skipDuplicates` on the unique membership + due date), removes only future ones with no money or contribution against them, and re-prices only untouched ones. A membership that became ACTIVE after `startedAt` is scheduled from the day it joined, which is derived from `joinedAt`, so a later regeneration never back-fills.
- **Payout order:** slots are created by the draw (one per share). `position` is unique per group, so swaps and exceptions park the moving slots on a negative position first. `AjoPayoutOrderEvent` is append-only (DRAW, SWAP, EXCEPTION); a swap waits in `AjoOrderChangeRequest` until the admin decides. A position is "paid" when a PAID `AjoPayout` has that `round`, so T5/T7 must write `round` = the slot's position. `atRiskMemberships()` returns an empty set until trust scores exist (T8): that is the one place to change.
- **Routes:** all under `/api/ajo` behind `requireAjoAccess()`. Reads need any Ajo permission (a non-manager sees only groups they belong to); writes need `ajo.manage`; swap decisions and exceptions need `ajo.approve_payout`; `GET /collector/contributors` needs `ajo.collect`. Creating, opening or starting a group also checks the plan includes the model's feature (`ajo.collector_thrift` or `ajo.rotating_pot`).
- **Not built here:** contributions and the use of `businessDay` (T4), payout preparation (T5/T7), late fees (T6), defaults and the trust score (T8), and every screen (T9 onwards).

### 18.14 Contributions, collections and receipts as built (T4, 2026-10-28)
- **Statuses:** `AjoContributionStatus` = REPORTED (a transfer claim), CASH_RECEIVED (a collector holds the cash), CONFIRMED, REVERSED (a correction row pointing at the original through `reversalOfId`) and REJECTED (a claim turned down; never counted). The original of a reversed payment stays CONFIRMED; "reversed" is the presence of its reversal row. Only CONFIRMED money counts. A payment awaiting confirmation is REPORTED or CASH_RECEIVED; T6 treats that as "being verified".
- **Where money becomes real:** `confirmContributionInTx` and `reverseContributionInTx` in `ajo-allocation.service.ts` run in the caller's transaction behind `lockMembershipMoney` (an advisory lock per membership). Confirming = status guard (`updateMany … WHERE status IN (REPORTED, CASH_RECEIVED)`, so exactly one caller wins) + allocation rows + instalment `paidKobo`/status + one CREDIT ledger entry with key `ajo:contribution:<id>:confirm`. Reversing = REVERSED row + undo of the stored allocations + a ledger REVERSAL (`…:reverse`). A payment's key and reversal key are derived from its id, so repeats are no-ops.
- **Idempotency keys:** the client's `Idempotency-Key` is stored as `a<associationId>:<key>` so tenants cannot collide or probe each other. A repeat returns the original; the same key with a different membership, amount or method is `IDEMPOTENCY_CONFLICT`. Two identical requests at once are resolved by the unique index.
- **Cash:** `businessDate` (T3's `businessDay`) decides which day a payment belongs to. `ajo_cash_handovers` is unique per (group, collector, date); its figures (expected, target, collected, handed over, difference) are frozen when created. `handoverId` ties each cash payment to its handover; `missingFromHandover` marks a line the officer did not find, which stays CASH_RECEIVED and is swept into the collector's next handover. Reconcile locks the handover row and applies every ticked line in one transaction.
- **Transfers:** `proofKey` (storage), `proofHash` (SHA-256 of the file) and `bankReference` (normalised: case, spaces and dashes ignored) feed `findDuplicates`. `duplicateOfId` is a display hint only; confirmation re-checks live, so the answer is always current. `assertMayConfirm` is the one separation-of-duties rule (cash handovers and transfers): the recorder or payer cannot confirm, except a sole holder of `ajo.reconcile` with `confirmOwn` and a note.
- **Receipts:** `createReceiptInTx` uses `createMany … skipDuplicates` on the (contribution, moment) key, so a retry neither duplicates nor aborts the surrounding transaction. `deliverReceipt` claims a send by moving `attempts` on from the value it read, so concurrent callers cannot double-send, and never throws. States: QUEUED, SENT, SKIPPED (no login, routine confirmation), FAILED (no phone, or 5 attempts). `alertOnce` tells `ajo.manage` holders once while any queued receipt has already raised an alert. `sms-engine.creditVerifiedPurchase` flushes an association's queue after a top-up (best effort, loaded on demand).
- **Routes:** under `/api/ajo`. Cash and handover need `ajo.collect`; confirm, reject, reverse and reconcile need `ajo.reconcile`; reporting a transfer needs `ajo.contribute` or `ajo.manage`; the queue and handover lists need reconcile or manage; a payment history is visible to the person, officers and the currently assigned collector. A transfer is a multipart upload (field `proof`, memory storage). The storage key and file hash are never in a response; the proof is a 5-minute signed link, never cached.
- **Not built here:** payouts (T5/T7), late fees and the pause while a payment is being verified (T6), defaults, reports, and every screen.

### 18.15 Payouts and the platform levy as built (T5, 2026-10-28)
- **Statuses:** `AjoPayoutStatus` = PREPARED → APPROVED → PAID → REVERSED, or VOID from PREPARED / APPROVED (with `failed` when the bank transfer failed). Only recording as paid writes the ledger: `ajo:payout:<id>:paid` (PAYOUT debit, the net) and `:fee` (FEE debit); a reversal writes `:reverse` and `:fee-reverse`. `round` is the slot's position for a rotating pot (null for collector thrift); `sequence` counts attempts and supplements for the same recipient and round, and is part of the idempotency key.
- **Calculation:** `calculatePayout` (pure) takes scheduled, confirmed, the fee, the recipient's own instalment and the earlier standing payouts of the same round. `confirmed` is read from the instalments' `paidKobo` (which already nets reversals), so it is always current; `scheduled` excludes waived instalments. A payout stores gross, confirmed, shortfall, fee and net, frozen when prepared.
- **Order and time:** `assertReady` (group ACTIVE; round date reached and the previous round PAID; or the cycle over for collector thrift). One preparation at a time per group (an advisory lock), and a repeat while one is open returns it.
- **Guards:** `assertPayoutEligible` (T2) at prepare, approve and record; the account snapshot (bank, name, last four) is compared at approve and record and a change voids the payout; `assertStillCovered` refuses a payout whose confirmed money has since been reversed (`PAYOUT_NOT_COVERED`). `assertMayApprove` and T4's `assertMayConfirm` hold the separation of duties, with the sole-holder exception (`permissionHolderIds` in `ajo-support.ts`).
- **Slots:** `lockedPositions` (prepared, approved or paid rounds) is what T3's order service uses to refuse a swap or an exception on a slot with an open payout. `anyPayoutPaid` still decides swap versus exception.
- **Levy:** `AjoLevyAssessment` (kinds CYCLE, PARTICIPANT, CREDIT; statuses ACCRUED, BILLED, PAID, WAIVED, VOID) has a unique `dedupeKey`, so assessing twice is a no-op, and keeps base, rate, limits, amount, tier and the calculation in words. It has no foreign keys to the group or ledger on purpose: it is SocietyLedger's record. `assessGroupLevy` runs inside `startGroup`; `assessParticipantLevy` inside a late joiner's activation; `voidUnbilledLevyForGroup` inside `cancelGroup`; `assertNoOverdueLevy` inside `startGroup` (60 days, `LEVY_OVERDUE`).
- **Billing seam (small, explicit):** `quote.service` adds `LEVY` lines and `quote.levy` in `quotePlanCheckout` / `quoteAddonCheckout` (so a preview and a charge always agree); `checkout.service` calls `markLevyBilled` once the payment row exists (both providers); `lifecycle.activateFromPayment` calls `settleLevyInTx` in the same transaction that applies the quote. `netShares` ignores LEVY lines, so the plan's and add-ons' recorded prices exclude it. A payment that does not equal the quote (levy included) is held for review as before.
- **Money boundary:** the Ajo module still never reads or writes the subscription tables; the tier lookup goes through `services/billing/held-addon.service.ts`. The levy is never in the group ledger and never deducted from a payout.
- **Routes:** payouts under `/api/ajo` (preview/list/get need manage, reconcile or approve; prepare needs manage; approve, reverse and complete need `ajo.approve_payout`; record and fail need `ajo.reconcile`; void needs manage or approve and an officer can cancel only their own preparation; `GET /levy` for the group admin). Staff levy routes under `/api/admin/ajo-levy` (view: SUPER_ADMIN, FINANCE_ADMIN, SUPPORT_AGENT; waive and void: SUPER_ADMIN, FINANCE_ADMIN), mounted ahead of the SUPER_ADMIN-only router. Recording takes a multipart proof (same limits as T4).
- **Not built here:** defaults, late fees, reminders and the grace pause (T6), reports, every screen, and any automatic charge of the levy outside a checkout.

### 18.16 Late fees, reminders, disputes, defaults and trust as built (T6, 2026-10-28)
- **Pure rules:** `ajo-risk.ts` holds the date and money rules with no database: `graceEndsOn`, `feeEligibleOn = max(graceEnds + 1, lastCheckEnded + 1)`, `versionInForceOn` (the version the member accepted that applied on the due date), `lateFeeFor` (FIXED or PERCENT with a cap, calculation in words), `planReminders` / `composeReminder` / `composeDigest`, `computeTrust` and `trustBand`, `draftPlan` and `trackPlan`. `ajo-collections.ts` gains `allocateSequential`.
- **Late fees:** `AjoLateFeeAssessment` (PENDING → PAYABLE → PAID, or WAIVED) is unique per instalment, so assessing twice is a no-op. `noticeLateFees` tells the member and stamps `notifiedAt`; `promotePayableFees` makes it PAYABLE once `notifiedAt` is 48 hours old and no dispute is open on the instalment. An officer can record that they told someone (`markFeeNotified`, with a note). `AjoContributionAllocation` now has `installmentId` or `lateFeeId` (exactly one, enforced by a DB check). Confirming a payment allocates installments first, then PAYABLE fees oldest first, and writes a CONTRIBUTION credit and a FEE credit (`refType late_fee`); reversing undoes both. `owedIncludingFees` caps what can be reported.
- **Pause:** `verificationState` (in `ajo-dispute.service`) reports pending payments (REPORTED / CASH_RECEIVED) and open disputes, and when the last check ended. Fees, overdue reminders and default detection all consult it. `planShield` (in `ajo-default.service`) lists the instalments a kept plan protects.
- **Reminders:** `runReminders` writes a unique `AjoReminder` row (`dedupeKey`) before sending, so a repeated or concurrent run sends once. `ajo-messenger.ts` picks the channel (login: in-app/push/email; otherwise SMS) and reports NO_PHONE / NO_SMS_CREDITS / SEND_FAILED. A reminder skipped for credits is recorded as SKIPPED and is not sent later.
- **Defaults and plans:** `AjoDefaultCase` (OPEN, PLAN_AGREED, RESOLVED, CLOSED_UNRESOLVED) with a frozen `snapshot` and append-only `AjoCaseEvent`s (unique `dedupeKey` for the job's records). `AjoRepaymentPlan` is PROPOSED → ACTIVE → COMPLETED / CANCELLED. `detectDefaults` opens cases for PAID-out members who are late past grace and not paused; `trackPlans` records each missed date once and resolves a case that is paid in full. Audit rows are written only when a signed-in person acts (`AuditLog.userId` is required); automatic actions are recorded as case events.
- **Disputes:** `AjoDispute` per instalment, one OPEN at a time, evidence stored privately and reached only through a short-lived link. `resolveDispute` needs a different person and a reason; a decided dispute is never changed.
- **Trust:** `personTrust` is worked out from instalments and the payments that completed them, per person across the association's Ajo groups; `AjoTrustSnapshot` rows are written by the daily job only when the band or counts change. `atRiskMembershipIds` backs the draw's At-risk rule and leaves the group being drawn out of the count.
- **Jobs:** `runAjoRiskCycle` (mark overdue, assess, tell, make payable, remind, detect defaults, track plans; each step isolated) and `runAjoDailyJobs` (trust), scheduled in `jobs/ajo-jobs.ts`. Only groups of tenants with Ajo fully on are included; `groupIds` limits a run.
- **Routes (all under `/api/ajo`):** late fees, disputes, cases, plans and trust, with officers (`ajo.manage`, or reconcile for fees, disputes and trust), the member for their own records, and `ajo.approve_payout` to close a case. Writes are refused with `ADDON_EXPIRED` after the add-on lapses; reads stay.
- **Not built here:** every screen, reports and exports (later phases), and any automatic chasing outside the app (calls, visits).

### 18.17 Ajo on the web (T7 step 1, 2026-10-28)
- **Two route trees:** member side `/dashboard/my-thrift/*` (`ajo.view_own`), staff side `/dashboard/ajo/*` (`ajo.manage`, `ajo.reconcile`, `ajo.approve_payout`) and `/dashboard/ajo/collect` (`ajo.collect`). Entries are added to the two sidebars people actually get, `MemberSidebar` and `AdminSidebar` (`Sidebar.tsx` is only a fallback), by `useAjoNav()`: by permission, marked "Locked" when `/ajo/status` says the add-on is off.
- **Access states:** `AjoGate` (in `my-thrift/layout.tsx`) calls `GET /api/ajo/status` with `validateStatus: () => true` so a locked or forbidden answer is drawn inline (`AjoLocked`, no purchase button) instead of the app-wide upgrade pop-up. When `readOnly`, it shows `AjoReadOnlyBanner` and `useAjoAccess().canWrite` is false; every write control checks it.
- **Data:** `lib/ajo/api.ts` (axios, `ajoErrorMessage/Code/Status`), `hooks.ts` (React Query v4, keys under `['ajo', …]`, any write refreshes them all). A group's full bank account number is fetched only when the person asks and is held in component state, never in the query cache. Uploads use the field name `proof`; reporting a transfer sends an `Idempotency-Key` created once per form and renewed after success.
- **Money:** `formatKobo` always gives ₦10,000.00; amounts stay strings (kobo) until formatting. The web compiles below ES2020, so bigint literals (`0n`) are not allowed: use `BigInt(0)` or `koboPositive()`.
- **API added for the web:** `GET /api/ajo/me` (`listMyMemberships`), and `password` in the body of payout approve, payout reverse and case close, checked by `ajo-reauth.ts` before anything else (400 `PASSWORD_REQUIRED`, 403 `REAUTH_FAILED`, 429 `REAUTH_LOCKED`).
- **Not built yet:** staff screens (T7.1–T7.4), the password dialog itself (needs the staff payout pages), standalone sign-up (T7.6).

### 18.18 The rest of the Ajo web phase (T7, 2026-10-28)
- **Staff client:** `lib/ajo/staffApi.ts`, `staffTypes.ts`, `staffHooks.ts` (React Query v4; every write refreshes all `['ajo', …]` queries), `useAjoCan()` (which tabs and buttons to draw; the server checks again), `useAjoNav()`.
- **One dialog for sensitive actions:** `ActionDialog` collects a written reason (minimum length shown) and/or the person's password, shows what is about to happen, keeps itself open and says why when the server refuses, and refreshes the Ajo data on success. Payout approval has its own dialog (password, recipient, amount, masked account, shortfall, and the sole-admin confirmation when the server asks for it). Confirming a payment and reconciling a handover ask the duplicate and own-payment follow-ups only when the server's code says so (`DUPLICATE_ACK_REQUIRED`, `SELF_CONFIRM_NEEDS_NOTE`, `SELF_APPROVAL_NEEDS_CONFIRMATION`).
- **Units on the wire:** money is kobo strings; a percentage (late fee, collector fee) is basis points (10% = 1000); a collector fee of days is a plain number; a rotating pot has no cycle length and 1–5 shares per person.
- **Names:** list endpoints return membership ids only, so the web maps names from the group roster (`GET /groups/:id/members`).
- **API added for the web:** `GET /ajo/me`, `GET /ajo/people?search=` and `GET /ajo/collector-candidates` (both `ajo.manage`), `tenantKind` on `GET /ajo/status`, and `password` on payout approve, payout reverse and case close (`ajo-reauth.ts`).
- **Standalone groups:** `/signup/thrift` posts to `/api/associations/thrift-signup` (closed with `THRIFT_SIGNUP_CLOSED` until the platform switch is on). The group's base plan is free, so it pays only an Ajo tier; the checkout is proven by `__tests__/billing/thrift-checkout.integration.test.ts`. An add-on alone needs an active subscription, so in the trial a group subscribes on the base plan plus a tier.
- **Tests:** every Ajo test file is now a module (`export {};`). Non-module test files shared top-level names and sometimes failed to compile together.

### 18.19 Thrift onboarding and bulk add (2026-10-29)
- **Flow by kind:** `packages/shared/src/onboarding.ts` has `THRIFT_ONBOARDING_STEPS`, `onboardingStepsFor(kind)`, `onboardingFlowFor(kind)`, `THRIFT_ONBOARDING_TEAM_ROLES` and `teamRolesAllowedFor(kind)`. `applyStep(progress, step, name, skipped, kind)` validates against the tenant's own list and ends the flow on its last step (`complete` or `review`). Login and `/auth/me` return `onboardingFlow`. **The API reads `@societyledger/shared` from its built `dist`, so rebuild it (`tsc` in `packages/shared`) after changing it.**
- **Bulk add:** `ajo-bulk.service.ts` (`checkRow` pure; `bulkAddContributors`). Per row: find the person by phone in the association or create them, add to the group (`allowDraft`), optionally record the rules on their behalf, optionally approve. Every row is answered on its own (`added`, `already_in_group`, `invalid`, `failed`); max 200 rows; audit `AJO_BULK_MEMBERS_ADDED`.
- **Drafts:** `tryActivate` returns `PENDING` with `waitingForGroupToOpen` for a draft, and `openGroup` activates every approved pending member in the same transaction.
- **Trial:** `TRIAL_ADDON_CODE = 'ajo-trial'` (hidden, Growth features, 30 contributors, always levy-exempt), granted by `grantThriftTrialAddon`.
- **Web:** `/onboarding/thrift` (orchestrator), `components/ajo/onboarding/Step*.tsx`, `GroupWizard`, `OnboardingResume`, `lib/ajo/contributorCsv.ts` (CSV and the client copy of the row rules), an `/onboarding` layout that redirects each kind to its own flow. Finishing or skipping clears `user.requiresOnboarding` in the auth store, otherwise the layout sends the admin straight back.
- **Platform settings (fixed alongside):** `settings.association_id` is now nullable (platform rows have no association) with a unique index on the key for those rows.

### 18.21 The Circle board (T13 phase A, 2026-10-29)
- **Rule versions** carry `memberVisibility` (`FULL` or `OFF`, text) and `nameDisplay` (`FIRST_INITIAL` or `FULL`); existing versions are `OFF`. A rotating pot is created with `FULL`; a collector-thrift scheme is refused anything but `OFF` (`VISIBILITY_NOT_ALLOWED`). Changing either is a new rule version with notice, accepted by each member. The accept text (`describeRules`) says what other members can and cannot see.
- **`ajo-status.ts`** (pure) is the one place a payment becomes a status (paid on time, paid late, reported, due, overdue, missed, under review, waived, upcoming) and a round becomes totals. Only `CONFIRMED` money counts as paid; `REPORTED` and `CASH_RECEIVED` are spread over a member's unpaid rounds oldest first and shown as Reported; an open dispute is Under review, never Missed.
- **`ajo-board.service.ts`** loads one circle and builds eight views (overview, round, matrix, payouts, members, arrears, metrics, activity) from explicit field lists. It never returns a database row. `GET /api/ajo/groups/:id/board[/rounds/:round|/matrix|/payouts|/members|/arrears|/metrics|/activity]`. Answers: `404 GROUP_NOT_FOUND` for anyone not in the circle (and not an officer), `403 BOARD_NOT_AVAILABLE` for collector thrift, `403 BOARD_OFF` for members when the latest rule version has it off (officers may always read). A person shows by name only after accepting a rule version with the board on; before that, other members see "Member n".
- **Leak test:** `__tests__/ajo/ajo-board.integration.test.ts` fails if a phone, email, address, group account number, payout-account name or proof key appears in any view, or if any response key names one of those things. Add any new board field with that test in mind.
- **Clients:** web `components/ajo/board/*` (Circle board tab for members at `my-thrift/[membershipId]/board` and for officers at `ajo/[groupId]/board`); mobile `features/ajo/components/board/*`, the `circle` tab (standalone rotating pot, shown by `useAjoNav().circles`) and `money/thrift/[membershipId]/board` (association members).
### 18.20 Contribution frequency (2026-10-29)
- **Model:** `AjoFrequency` = DAILY, WEEKLY, MONTHLY, QUARTERLY, ANNUALLY, CUSTOM. `AjoGroup.intervalCount` and `intervalUnit` (`AjoIntervalUnit` = DAYS, WEEKS, MONTHS) are set only for CUSTOM; a database check makes them both present (count 1 to 60) or both empty.
- **One source for the step:** `ajo-schedule.ts` — `stepOf(frequency, custom)` turns any frequency into a count of days or months; `addPeriods`, `dueDates` and `groupDates` use it, so a group's whole schedule, a rotating pot's rounds and a repayment plan all follow the same step. `describeCadence` writes it in words ("every 2 weeks"), returned to the web as `cadence` on every group. `periodDays` judges how often a group asks for money.
- **Rules:** `resolveGroupFields` clears the step for any non-custom frequency and demands it for custom. Frequency and step are in `MONEY_FIELDS`, so they lock when the group starts. Reminders: a group collecting more often than weekly (`periodDays < 7`) gets one overdue message a week; anything slower is reminded per instalment.
- **Web:** `frequencyText(group)` and `cadenceWords()` in `lib/ajo/format.ts`; the wizard's "How often" control (Daily to Custom, with a live sentence and the twice-a-month hint). A rotating pot cannot be daily.


### 18.9 Mobile (T8, 2026-10-29)
- **Where:** `apps/mobile/src/features/ajo` (queries, mutations, forms, components), `src/api/endpoints/ajo.ts`, `src/types/api/ajo.ts`, routes under `app/(app)/(tabs)/money/thrift` (contributor), `app/(app)/(tabs)/manage/thrift` (collector and staff), `app/(app)/onboarding/thrift.tsx` and `app/(auth)/create-thrift-group.tsx`.
- **Same API as the web.** Query keys start with the tenant and share an `ajo` root, so any write refreshes every Ajo screen. `ajo` is not in the persisted-cache allow-list, so a bank account number or a proof is never written to the phone's cache.
- **Offline:** Ajo writes never queue (`networkMode: 'always'`); collector screens say "needs internet".
- **Sheets:** one confirmation sheet (`AjoActionSheet`) for every reason-and-password action; a sheet never opens on top of another sheet.
- **Notifications and links:** `src/lib/ajoPush.ts` maps each `ajo.*` push type to a screen by what the person may do; `societyledger://thrift/…` links are mapped by `thriftDeepLinkPath`. The guarantor's consent link is a web link and is never routed in the app.
- **Standalone thrift groups** (`tenantKind: THRIFT_GROUP`): Home and Community tabs are hidden, Money is labelled Thrift and shows My thrift directly (an officer or collector who is not a contributor is sent to the circles or Today), and Manage keeps only Members, Thrift and Settings, the same allow-list as the web sidebar (`THRIFT_ONLY_*_LABELS`). Screens wait on `useAjoNav().resolving` so association content never flashes first, and no association query runs.
- **Open items from the web pass, now recorded:** the guarantor link and public `/api/public/ajo/guarantor/:token`; the names-only `/groups/:id/people` read; the roster's `verification`; `pastDue` on instalments; paged queue and handovers; semantic colour tokens (web only).
