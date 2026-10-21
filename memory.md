# Memory — Mobile Phase 1: Foundation (F1.3–F1.8, all complete) + Phase 1 retro review

Last updated: 2026-10-20

## What was built

**F1.3 — API types & enums**: `src/types/api/*.ts` (11 hand-written DTO files, verified against real controllers, not `packages/shared`'s stale types) + generated `src/types/api/enums.ts` (59 real Prisma enums via new `scripts/gen-enums.ts`, idempotent, `--check` mode). Closes gap G2.

**F1.4/F1.5 — Core UI kit**: `src/components/ui/*` (Text, Button, IconButton, Card, Badge, StatusChip, Avatar, Divider, Skeleton, Money, Spinner, BottomSheet), `layout/*` (Screen, ScreenHeader, Section, ListItem/ListGroup, StickyFooter), `forms/*` (FieldShell, TextField, PasswordField, OtpInput, AmountField, DateField, SelectSheet, SearchField, Checkbox, Switch, SegmentedControl, FileAttachField), `feedback/*` (EmptyState, ErrorState, OfflineBanner, ModuleLocked, SubscriptionInactive, NoPermission, ConfirmSheet) — ~28 components total, all registered in `ui-registry.md`. Dev-only gallery at `app/(dev)/gallery.tsx`. `@react-native-community/datetimepicker` was the one owner-approved new dependency outside the pre-documented list.

**F1.6 — Storage, permissions & utilities**: `src/lib/{cn,docs,storage,secure,money,dates,i18n,permissions}.ts` + `en.json`, `src/hooks/{useCan,useOnline,useAppState}.ts`. 100% test coverage on money/dates/permissions (real `--coverage` run). Found a live, unfixed drift in `apps/web`'s own permissions copy (logged as gap G94, out of mobile's scope).

**F1.7 — API client & error handling**: `src/api/{client,errors,envelope}.ts` (axios, single-flight token refresh, 401/403/429 handling), `src/providers/QueryProvider.tsx` (TanStack Query v5 + MMKV persister), `src/stores/{tenant,modules}.ts` (new) + `stores/session.ts` expanded to its real shape (`user`, `status`, `requiresOnboarding`). **Major finding**: `msw` (originally documented as the mocking tool for all future tests) doesn't actually work in this project — no `msw/native` export, ESM-only deps, and axios resolves to its browser build under `jest-expo` so none of msw's interception points apply. Replaced with `axios-mock-adapter` project-wide; `library-docs.md`/`code-standards.md §13` corrected.

**F1.8 — App shell & navigation skeleton**: `app/index.tsx` is now the real splash/redirect (`<Redirect href="/(app)/(tabs)/home" />` — the F1.2 design-tokens proof screen moved to `app/(dev)/tokens.tsx`). `app/(app)/_layout.tsx` is the one auth guard. `app/(app)/(tabs)/_layout.tsx` — 5 tabs via `Tabs` from `expo-router/tabs` (the root `expo-router` export is deprecated in SDK 58), custom `TabBar` component, Manage tab gated by new `lib/permissions.ts` export `MANAGE_TAB_PERMISSIONS`. 5 tab-root placeholder screens + a notifications placeholder (the header bell's target). New `src/lib/linking.ts` (zod-validated `societyledger://` deep-link parser, via newly-pinned `expo-linking`) — not wired into `+native-intent.tsx` yet (deferred to F2.3). Deliberately **not** built: 11 of 12 `(auth)` screens (only `welcome.tsx` exists), the `(lock)`/`onboarding` groups, any modal-presented route — none are referenced by anything built yet.

**Phase 1 retro review** (`/review`, full three-layer audit of F1.1–F1.8 before starting Phase 2): zero layer-boundary violations, zero hardcoded-hex/raw-Tailwind violations, zero doc-vs-code drift anywhere. Found and fixed 6 issues same-session (see Problems solved).

## Decisions made

- **`axios-mock-adapter`, not `msw`, is the project's testing-mock convention** for all future API-mocking tests — a hard requirement discovered by direct evidence, not a preference.
- **`Tabs` must be imported from `expo-router/tabs`**, not the root `expo-router` export (deprecated in SDK 58).
- **Typed-routes (`.expo/types/router.d.ts`) only regenerate via the live `expo start` dev server**, never `expo export` — adding a new route and immediately running `tsc` will show a phantom error until `expo start` has run at least once.
- **Test files must never be placed inside `app/`** — Expo Router treats every file there as a route, and Metro will bundle it for real on a device, crashing if it imports a Jest-only package. Fixed project-wide via `metro.config.js`'s `resolver.blockList` (excludes `*.test.ts(x)`/`*.spec.ts(x)` everywhere, not just `__tests__/`), so colocated tests next to `app/`-level files (e.g. `_layout.test.tsx`) are now safe.
- **`(app)/_layout.tsx`'s guard treats `'idle'` and `'unauthenticated'` the same** (both redirect to `/(auth)/welcome`) — there's no code path yet that tells a "still booting" session apart from "confirmed signed out"; that's F2.4's job.
- **BottomSheet's `onDismiss` prop means "notify after the sheet closed by any means"**, never "close the sheet" — the close button must call the ref's `.dismiss()` directly (this was the bug, now fixed).

## Problems solved

- **`expo-linking`'s `Linking.parse()` crashes under Jest's default `expo-constants` auto-mock** (`Cannot read properties of undefined (reading 'replace')`) even for a bare parse call — fixed with a targeted `jest.mock('expo-constants', ...)` setting `executionEnvironment: 'bare'`.
- **`@testing-library/react-native@14.1.0`'s `renderHook()` is `async`**, same breaking change as `render()` — an un-awaited call silently destructures `{ result: undefined }`.
- **A real dev-server crash on a physical Android device**: `app/(app)/_layout.test.tsx` got bundled by Metro for real (every file in `app/` is a route) and crashed importing `@testing-library/react-native` (needs Node's `console`, unavailable to Metro's RN resolver). Fixed via the `metro.config.js` blockList change above — confirmed fixed by re-requesting the exact failing bundle URL and getting HTTP 200.
- **BottomSheet's close (X) button was non-functional** in all 3 real usages (`SelectSheet`, `FileAttachField`, `ConfirmSheet`) — only fired an optional callback, never called `.dismiss()`. Fixed with an internal ref + `useImperativeHandle`.
- **`FileAttachField`'s camera/photos/files pickers silently no-op'd on a denied permission** — now show feedback through the field's existing helper-text slot.
- **Checkbox/Switch tap targets were under the 44dp minimum** — `Checkbox` got `hitSlop={8}`; `Switch`'s whole row is now pressable (confirmed RN's touch responder gives the inner native `Switch` exclusive capture of direct taps, so this doesn't double-toggle).
- **Tried sharing `app.config.ts`'s splash-color hex with `tokens.ts` via a direct import** — reverted after confirming (via a real `expo export` run) that Expo's config loader only transpiles `app.config.ts` itself, not its transitive local TS imports. Kept the literal with a comment instead.

## Current state

- **Mobile Phase 1 (Foundation, F1.1–F1.8) is 100% complete and reviewed clean.** `type-check`, `lint`, full test suite (17 suites / 107 tests), and `expo export -p web` (31 routes) all pass.
- The user is currently running `eas build --platform android --profile development` themselves to rebuild their physical device's dev client — it was stale (missing `expo-secure-store`/`@react-native-community/datetimepicker` native modules added at F1.5/F1.6). Once that finishes and is installed, their device should run cleanly; this isn't something that can be verified from this environment (no adb/device access here).
- Everything in `context/{progress-tracker,ui-registry,library-docs,code-standards}.md` is up to date with this session's work, including all the findings above.

## Next session starts with

1. **Confirm the user's new dev-client build installed successfully** and the app now runs on their physical Android device without the native-module errors, if not already confirmed by the time this session resumes.
2. **F2.1 — Welcome & association selection** (screens A1–A3): splash redirect logic refinement, Welcome carousel, Association Code screen with debounced lookup + recent associations, logo URL resolution. This is the actual start of Mobile Phase 2.
3. Low-priority/deferred, not blocking: wiring `lib/linking.ts` into `+native-intent.tsx` (waits for F2.3's Accept Invite/Reset Password screens to exist); building the remaining 11 `(auth)` screens as their real features land in F2.1–F2.3.

## Open questions

- None blocking. The one external dependency (the user's own EAS build + device install) is outside this session's control but doesn't block starting F2.1's code — only blocks the user's own on-device manual testing.
