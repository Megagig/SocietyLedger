# Phase 9 review findings (security, accessibility, performance)

Written 2026-10-25. Everything below was found by reading the code and running `pnpm audit`.
**Nothing here has been changed yet.** Each item needs your yes before I touch code
(your standing rule: list the fixes, get approval, then change).

Severity: **Blocker** = fix before the first production deploy or store submission.
**Should** = fix in Phase 9. **Later** = note it, fix when convenient.

---

## A. Blockers (fix before deploy / submission)

### A1. Rate limiter treats every user as one person behind the proxy (API)
`apps/api/src/server.ts` never sets Express `trust proxy`. Behind Traefik, `req.ip` is the proxy's
address, so the limiter in `middleware/rate-limit.middleware.ts` (key = `req.ip`) counts **all users
together**: sign-in, register and password reset allow 10 requests a minute **in total**, and normal
API traffic 100 a minute in total. A handful of users, or one person mistyping a password, would lock
everyone out of sign-in.
- **Fix:** `app.set('trust proxy', 1)` (one hop: Traefik) near the top of `server.ts`, plus a test.
- **Check after deploy:** two phones on different networks both sign in within the same minute.

### A2. Paystack webhook can be forged when the webhook secret is empty (API)
`lib/paystack.ts` signs with `PAYSTACK_WEBHOOK_SECRET`, which defaults to an empty string and was not
passed to the container at all. Paystack signs webhooks with the **secret key**. With an empty secret,
real webhooks fail, **and anyone can compute a valid signature with an empty key** and fake a
"payment successful" event.
- **Env fix (done):** `PAYSTACK_WEBHOOK_SECRET` is now passed in the compose file; set it to the same
  value as `PAYSTACK_SECRET_KEY`.
- **Code fix (needs yes):** fall back to `PAYSTACK_SECRET_KEY`, and **reject** all webhooks (500, log) when
  both are empty, instead of hashing with an empty key.

### A3. Hard-coded fallback signing secret (API and web)
`apps/api/src/lib/auth.ts` and `apps/web/src/lib/auth.ts` use `process.env.JWT_SECRET || 'your-secret-key'`.
If the variable is ever missing, tokens are signed with a public string and anyone can mint a valid one.
- **Fix:** in production, refuse to start when `JWT_SECRET` is missing or shorter than 32 characters.
  Keep a dev default only when `NODE_ENV !== 'production'`.
- Web's copy is only used by `web/src/lib/auth.ts`; the compose file does not pass `JWT_SECRET` to the web
  container, so if anything there still calls it, it is already running on the fallback. I will check
  whether that file is dead code and delete it if so.

### A4. Crash reporting is installed but never started (mobile)
`@sentry/react-native` is a dependency and a build plugin (only when a DSN is set), but **no code calls
`Sentry.init`**, so there are no crash reports, no scrubbing and no release health. F9.4 (scrubbing) and
F9.6 (release-health dashboard) cannot work without it.
- **Fix:** initialise Sentry once at the app root, only when `EXPO_PUBLIC_SENTRY_DSN` is set, with
  `sendDefaultPii: false`, a `beforeSend` / `beforeBreadcrumb` that strips tokens, emails, phone numbers,
  `Authorization` headers and request bodies, a `release`/`dist` from the app version, and the app variant
  as `environment`. Add a unit test for the scrubber.

### A5. Calendar permission text is missing (mobile, iOS and Android)
`community/meetings/[id].tsx` calls `Calendar.requestCalendarPermissionsAsync()`, but `app.config.ts` has
no `expo-calendar` plugin entry and no calendar usage string. iOS requires `NSCalendarsUsageDescription`
(App Review rejects, or the app crashes when it asks).
- **Fix:** add `['expo-calendar', { calendarPermission: 'Allow SocietyLedger to add meetings to your calendar.' }]`.

### A6. About screen links point at the wrong domain (mobile)
`profile/about.tsx` opens `https://societyledger.com/privacy` (and the terms link); the product is on
`societyledger.com.ng`. Both stores require a working privacy-policy URL.
- **Fix:** use `https://societyledger.com.ng/privacy` and `/terms` (both pages exist on the web app).

### A7. Dependencies with known critical / high advisories (web, admin, API)
`pnpm audit --prod`: 14 critical, 48 high. The ones that matter, by app:
- **Web:** `jspdf@2.5.2` (critical + several high: path traversal, HTML injection, ReDoS; needs 4.2+),
  and `next@14.0.0` pulled in by `@next/third-parties` (critical: middleware authorization bypass and more,
  fixed from 14.2.25). Also `dompurify` (critical bypass) through jsPDF.
- **Admin:** `next@14.2.29` (high: cache poisoning, SSRF in server actions; fixed in 14.2.35 or 15.x).
- **API:** `multer`, `body-parser`, `compression` (high, denial of service), `node-forge`, `zod` (memory),
  `postcss`.
- **Mobile:** no critical in the app's own code path; `zod` and `node-forge` appear through tooling.
- **Fix:** a separate, tested upgrade pass per app (jsPDF 4.x first, Next patch on admin, `@next/third-parties`
  aligned with web's Next). Do **not** bundle it with a release; each needs its own regression run.

---

## B. Should fix in Phase 9

### B1. Screenshot / app-switcher privacy is partial (mobile)
`PrivacyOverlay` only covers the app when **biometrics are on**, and only after the OS reports the app is
not active (the Android recents thumbnail can be taken before the cover renders). Balances and member
names are visible in the recents screen and can be screenshotted on Android.
- **Fix:** set the secure flag on signed-in screens (`expo-screen-capture`, `preventScreenCaptureAsync`) so
  Android blanks the recents thumbnail and blocks screenshots there, and show the overlay for **all**
  signed-in users on iOS. Needs a new native build (new dependency). Confirm you want screenshots blocked:
  support staff may ask members for screenshots.

### B2. Root / jailbreak detection is only a plan item (mobile)
Nothing checks it. The plan says "do not block, log". Needs Sentry (A4) to log to.
- **Fix:** after A4, on sign-in call `Device.isRootedExperimentalAsync()` and add a Sentry breadcrumb/tag
  `device.rooted=true`. Never block.

### B3. Unsafe pass-through of unknown deep links (mobile)
`app/+native-intent.tsx` returns the raw `path` for unknown links and for the `notifications` type, so any
`societyledger://some/route` opens that screen. The sign-in guard still protects signed-out use, but the
route list is wider than the three links the app really supports.
- **Fix:** for anything not `invite`, `reset-password`, `payments/return` or a known notification route,
  return `/` instead of the raw path; allow-list notification routes. Add tests.

### B4. Unencrypted local cache holds personal data (mobile)
`rq.cache` in MMKV (unencrypted) persists session, finance, ledger, meetings, voting, notifications and
profile queries. Tokens are correctly in SecureStore, but names, balances and ledger lines sit in plain
storage on the device.
- **Fix:** give MMKV an `encryptionKey` kept in SecureStore (generated on first launch), and clear the
  cache on sign-out (confirm it is). Migration: drop the old unencrypted cache once.

### B5. Low-contrast tertiary text fails WCAG AA (mobile)
Measured against the app backgrounds:

| Token | Light | Dark | Needed |
|---|---|---|---|
| text-secondary | 7.05 | 8.20 | 4.5 (passes) |
| **text-tertiary** | **3.46** | **4.13** | 4.5 (fails) |

- **Fix:** light `--color-text-tertiary: 84 114 90` (4.7 on the sunken surface, 5.0 on the page);
  dark `121 152 128` (4.65 on the raised surface). Edit `src/theme/global.css`, `tokens.ts` and
  `context/ui-tokens.md` together. Visual change is small (slightly stronger grey-green).

### B6. Text scaling is not capped anywhere (mobile)
`Text` supports `maxFontSizeMultiplier` but no screen sets it, so at the largest system font sizes fixed-height
elements (tab bar, chips, buttons `h-11`) can clip. The plan's bar is 1.3x.
- **Fix:** test at 1.3x on the phone (checklist below); where a fixed height clips, switch to `min-h` and set
  a cap of 1.5 on dense rows. I will not guess; this needs the device pass first.

### B7. Reduced-motion is respected in three components only (mobile)
`Passbook`, `Skeleton` and `ImageViewerModal` use `useReducedMotion`. Other animations (sheet transitions,
`sonner-native` toasts, carousel) do not check it.
- **Fix:** audit `withTiming`/`withSpring`/layout animations; gate non-essential ones on `useReducedMotion`.

### B8. 429 handling is user-visible but not guided (mobile)
`client.ts` deliberately never retries a 429 (per architecture). Login shows "Too many attempts. Try again in
a minute." Other screens show the generic error. Acceptable; with A1 fixed, real 429s become rare.
- **Optional:** read `Retry-After` and show "Try again in N seconds" on the generic error.

---

## C. Passed, nothing to do

- **Token storage:** access/refresh tokens live in `expo-secure-store` (`AFTER_FIRST_UNLOCK`), cached in memory,
  cleared on sign-out. Not in MMKV.
- **Deep-link parsing:** invite, reset-password and payment-return links are validated with zod before use and
  the values are URL-encoded when forwarded.
- **Lists:** every large list is virtualised (FlashList), including the officer attendance screen.
- **Bundle:** Android Hermes bundle 8.8 MB; no heavy utility libraries.
- **IconButton** requires an `accessibilityLabel` at the type level; about 90% of the 109 pressables set an accessibility role (rough count; the full pass is the TalkBack walkthrough).

---

## D. Needs your phone (not possible from code)

1. **Cold start** on the Redmi, release/preview build: target 2.5 s or less (steps in `RELEASE_CHECKLIST.md`).
2. **Memory** after 10 minutes of normal use (reanimated/Hermes regression check).
3. **TalkBack walkthrough** of the 10 flows (checklist in `RELEASE_CHECKLIST.md`).
4. **Text scale 1.3x** and **reduce-motion** spot check.
5. **E2E flows** (`apps/mobile/e2e/`) first run.

---

## Proposed order if you approve

1. A1, A2 (code), A3, A6, A5: small and independent. Then API tests.
2. A4 Sentry init + scrubber, then B2 and B3.
3. B5 token change (one visual review), B4 cache encryption.
4. B1 screen-capture (needs your call and a native build).
5. A7 dependency upgrades, one app at a time, as a separate PR.
