# Library Docs — SocietyLedger Mobile & Docs

> Not generic documentation — **our** patterns for each library. If you need a library not listed here, stop and ask; once approved, add a section here before using it. Version pins are set at scaffold (F1.1) and recorded in the table; bump only via a dedicated `chore(mobile): upgrade` change.

| Library | Purpose | Pinned version |
|---|---|---|
| expo (SDK 56) | runtime | _set in F1.1_ |
| expo-router | navigation | _SDK-matched_ |
| nativewind + tailwindcss | styling | _set in F1.2_ |
| @tanstack/react-query (+ persist client, async-storage persister) | server state | v5.x |
| zustand | client state | v5.x |
| react-hook-form, @hookform/resolvers, zod | forms | rhf 7.x, zod 3.x (match API) |
| axios | HTTP | 1.x |
| expo-secure-store, react-native-mmkv | storage | _SDK-matched / latest_ |
| expo-notifications, expo-device | push | _SDK-matched_ |
| expo-web-browser, expo-linking | Paystack, deep links | _SDK-matched_ |
| expo-local-authentication | biometrics | _SDK-matched_ |
| expo-image-picker, expo-document-picker, expo-file-system, expo-sharing, expo-print | files | _SDK-matched_ |
| expo-image | images | _SDK-matched_ |
| expo-calendar | add to calendar | _SDK-matched (new API)_ |
| expo-clipboard, expo-haptics | UX | _SDK-matched_ |
| @react-native-community/netinfo | connectivity | _SDK-matched_ |
| @shopify/flash-list | lists | _SDK-matched_ |
| react-native-reanimated, react-native-gesture-handler | animation/gesture | _SDK-matched_ |
| @gorhom/bottom-sheet | sheets | 5.x |
| victory-native, @shopify/react-native-skia | charts | _latest compatible_ |
| lucide-react-native, react-native-svg | icons | latest |
| sonner-native | toasts | latest |
| date-fns | dates | 4.x (same as web) |
| decimal.js-light | money | 2.x |
| @sentry/react-native | crash reporting | latest (Expo plugin) |
| expo-updates | OTA | _SDK-matched_ |
| jest-expo, @testing-library/react-native, msw | tests | latest |
| expo-server-sdk (**api only**) | push sending | latest |
| **Docs site (`apps/docs`)** | | |
| fumadocs-core, fumadocs-ui, fumadocs-mdx | docs framework, UI, MDX content source | _latest at D1.1, pinned_ |
| next, react, react-dom (docs workspace only) | framework | _as required by Fumadocs_ |
| tailwindcss (+ postcss) (docs workspace only) | styling | _as required by Fumadocs UI_ |
| lucide-react | icons | latest |
| @next/third-parties | GA4 | latest |
| zod | frontmatter schema | 3.x |
| @playwright/test | screenshots | latest |
| sharp | WebP conversion in screenshot script | latest |
| tsx | run scripts | latest |
| lychee (GitHub Action) | external/internal link check | latest |

Install Expo-managed packages with `npx expo install <pkg>` (picks SDK-compatible versions). Never `npm install` an `expo-*` or React Native native module directly.

---

## Expo Router
- File-based routes in `app/`. Groups: `(auth)`, `(lock)`, `(app)`, `(app)/(tabs)`. `(dev)` gallery only when `__DEV__`.
- **SDK 56: Router no longer builds on React Navigation.** Import `Stack`, `Tabs`, `Link`, `router`, `useLocalSearchParams`, `useFocusEffect`, `useNavigation` from `expo-router` only. Do not add `@react-navigation/*` packages. Run the SDK-56 codemod only if migrating code written for older SDKs.
- Guards: `(app)/_layout.tsx` reads session status and returns `<Redirect href="/(auth)/association" />` when signed out. No guards in individual screens.
- Modals: forms open with `router.push('/manage/members/form')` where the segment's `_layout` declares `presentation: 'modal'` (iOS) / `'fullScreenModal'` (Android) for form routes.
- Typed routes enabled (`experiments.typedRoutes: true`). Always navigate with `{ pathname, params }`.
- Tab bar: custom `TabBar` component (see `ui-rules.md`) passed to `Tabs tabBar={…}`. Manage tab rendered conditionally via `href: canManage ? undefined : null`.
- Deep links: scheme `societyledger`; `lib/linking.ts` maps incoming URLs (validated with zod) to routes in `+native-intent.tsx`.

## NativeWind
- `src/theme/global.css` holds **all** CSS variables (`ui-tokens.md`) for `:root` (light) and the dark scheme. Imported once in `app/_layout.tsx`.
- `tailwind.config.js` maps every token to a utility using `rgb(var(--color-x) / <alpha-value>)` so opacity modifiers work (`bg-primary/10`). Custom scales replace Tailwind defaults (no stock `gray-500`, `teal-600` usage in code).
- Dark mode: driven by `useColorScheme` from `nativewind` + `colorScheme.set('light'|'dark'|'system')` from the prefs store.
- Use `className` only; the `cn()` helper (`lib/cn.ts`, clsx-based) merges conditional classes. Avoid `cssInterop` except for third-party components that need `className` (register once in `src/theme/interop.ts`).
- If a value must be read in JS (charts, navigation, status bar), use `src/theme/tokens.ts` → `useThemeTokens()`; never parse CSS at runtime.

## TanStack Query
- Single `QueryClient` in `providers/QueryProvider.tsx` with defaults from architecture.md §11.
- `PersistQueryClientProvider` with an MMKV-backed persister; `dehydrateOptions.shouldDehydrateQuery` allow-lists keys whose 2nd element is in `PERSISTED_DOMAINS = ['session','memberFinance','memberLedger','meetings','voting','notifications','profile']` and only first pages.
- `focusManager.setEventListener` with `AppState`; `onlineManager.setEventListener` with NetInfo.
- `useRefreshOnFocus(refetch)` hook for tab roots (refetch when a tab regains focus if stale).
- Pull-to-refresh uses `refetch()` and shows `isRefetching` (not `isLoading`).
- After logout/tenant switch: `queryClient.clear()` and `persister.removeClient()`.

## Zustand
- `create<State>()(persist(...))` only for `tenant` and `prefs`; storage adapter `createJSONStorage(() => mmkvStorage)`.
- Session store is non-persisted; populated from SecureStore (token presence) + `/auth/me` on boot.
- Export selector hooks for common reads: `useCurrentUser()`, `usePermissions()`, `useCurrentTenant()`.

## react-hook-form + zod
- `useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues })`.
- Field components accept `control` and `name` and render label, helper, error.
- `applyApiErrors(form.setError, apiError)` maps Zod `errors[].path[0]` to fields.
- Amount fields hold strings in form state; convert with `toDecimal` in `onSubmit`.

## axios (src/api/client.ts)
- `baseURL: ${EXPO_PUBLIC_API_URL}/api`, `timeout: 15000`.
- Request interceptor: tenant header from `useTenantStore.getState().current?.subdomain`, bearer from in-memory token cache (loaded from SecureStore at boot), `X-Client: mobile`, `X-App-Version`.
- Response interceptor: 401 → single-flight `refreshSession()` (shared promise) → retry original once (flag `_retry`); refresh failure → `signOut({ reason: 'expired' })`. 403 with `error: 'MODULE_DISABLED'` → `useModulesStore.getState().markDisabled(module)`. Always rethrow as `ApiError`.
- Never log request/response bodies for `/auth/*`.

## expo-secure-store
- Keys: `sl.accessToken`, `sl.refreshToken`, `sl.accessExpiresAt`. Options: `{ keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }`.
- Read once at boot into memory (`lib/secure.ts → tokenCache`); writes update both.
- Values > 2 KB are rejected on some Android devices — JWTs fit, but never store user objects here.

## react-native-mmkv
- One instance `storage = new MMKV({ id: 'societyledger' })` in `lib/storage.ts`. Keys namespaced: `tenant.*`, `prefs.*`, `rq.cache`.
- Not encrypted by default; therefore **no tokens or PII beyond cached own-data** go here. (Optional later: `encryptionKey` from SecureStore.)

## expo-notifications
- `Notifications.setNotificationHandler` in root layout: show alert + sound in foreground for `payments` and `governance` channels; banner-only for others.
- Android channels created on boot: `default`, `payments`, `governance`, `announcements`.
- Permission requested via an in-app explainer sheet **after** first successful login + first Home render (not at launch). If denied, Notification Preferences shows "Open settings" (`Linking.openSettings()`).
- Token: `getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra.eas.projectId })`; register with API; re-register when token changes (`addPushTokenListener`).
- Tap handling: `useLastNotificationResponse()` + `addNotificationResponseReceivedListener` → `routeFromPush(data)` (`lib/push.ts`), zod-validated.
- Badge: `setBadgeCountAsync(unreadCount)` after unread-count query resolves.
- Push only works on physical devices with dev/prod builds — not simulators (iOS) / Expo Go.

## expo-server-sdk (apps/api)
- `push.service.ts` keeps one `Expo` client; `chunkPushNotifications` → `sendPushNotificationsAsync`; store ticket ids; receipts job every 15 min (`node-cron`) disables tokens on `DeviceNotRegistered`.
- Always `Expo.isExpoPushToken(token)` before saving/sending.

## expo-web-browser + expo-linking (Paystack)
```ts
const returnUrl = Linking.createURL('payments/return'); // societyledger://payments/return
const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, returnUrl);
const reference = result.type === 'success' ? new URL(result.url).searchParams.get('reference') : pendingReference;
await paymentsApi.verifyPaystack(reference); // ALWAYS verify
```
- Call `WebBrowser.maybeCompleteAuthSession()` in root layout.
- Store `pendingReference` in memory before opening, so a dismissed browser can still verify.
- Android: `openAuthSessionAsync` uses Custom Tabs; returning via the scheme closes it.

## expo-local-authentication
- `hasHardwareAsync` + `isEnrolledAsync` before offering biometrics.
- `authenticateAsync({ promptMessage, disableDeviceFallback: false, cancelLabel })`.
- iOS `NSFaceIDUsageDescription` in `app.config.ts`.
- `useReauth()` returns `reauth(reasonKey): Promise<boolean>`; if biometrics not enrolled, falls back to device passcode; if none set, shows password confirm sheet (`POST /auth/login` re-check is **not** used; use device auth only, else skip with a confirm sheet).

## Files: image-picker, document-picker, file-system, sharing, print
- `FileAttachField` offers Camera / Photos / Files. Images compressed: `quality: 0.7`, max 2000 px long edge (`expo-image-manipulator` if needed — add to table when introduced).
- Allowed proof types: `image/jpeg`, `image/png`, `application/pdf`; max 5 MB (check API multer limits in F0.1).
- Upload: `buildFormData({ file: { uri, name, type }, ...fields })`.
- Downloads (exports/statements): `FileSystem.downloadAsync(url, cacheDir + name, { headers: authHeaders })` → `Sharing.shareAsync(uri, { mimeType, UTI })` → delete after.
- Receipts generated client-side: HTML template → `Print.printToFileAsync` → share.

## expo-image
- `<Image source={{ uri }} contentFit="cover" transition={150} placeholder={blurhash?} />`; association logos `contentFit="contain"`.
- Relative upload paths resolved with `resolveAssetUrl(path)` (prefix API origin).

## @shopify/flash-list
- Always set `estimatedItemSize`; use `ItemSeparatorComponent` from `components/layout/ListSeparator`; `ListEmptyComponent` = `EmptyState`; footer spinner when `isFetchingNextPage`.

## @gorhom/bottom-sheet
- `BottomSheetModalProvider` at root. Wrapper `components/ui/BottomSheet.tsx` with snap points `['50%','90%']` default, backdrop, dynamic sizing for short content, keyboard handling `keyboardBehavior="interactive"`.
- Use for: filters, pickers (`SelectSheet`), confirmations (`ConfirmSheet`), quick actions.

## victory-native (Skia)
- Only through wrappers in `components/charts/` (`LineChart`, `BarChart`, `DonutChart`, `StackedBarChart`, `ProgressRing`) which take plain data + token-derived colours from `useThemeTokens().chart`.
- Data arrays converted from Decimal to number **only** inside chart wrappers (display precision acceptable).
- Charts have an accessible text summary (`accessibilityLabel`) and a "View as list" fallback for screen readers.

## lucide-react-native
- Named imports (`import { Wallet } from 'lucide-react-native'`). Default `size={20}` (`iconSize.md`), `strokeWidth={1.75}`. Colour from tokens.
- Icon map for domains lives in `components/ui/icons.ts` (e.g. `dues → Receipt`, `levy → Megaphone`, `donation → HandHeart`, `penalty → AlertTriangle`, `savings → PiggyBank`, `loan → Landmark`, `meeting → CalendarDays`, `vote → Vote`, `welfare → HeartHandshake`).

## sonner-native
- `<Toaster />` in root layout under safe area. Use `toast.success(t(...))`, `toast.error(message)`. Max 1 visible; duration 3 s (errors 5 s). Undo actions (delete transaction) use `toast(…, { action: { label: t('common.undo'), onClick } })`.

## date-fns
- Import functions individually. All formatting through `lib/dates.ts`. Relative times (`formatDistanceToNowStrict`) for notifications; absolute for money records.

## decimal.js-light
- `lib/money.ts` re-exports a configured `Decimal` (precision 20, ROUND_HALF_UP). Comparisons with `.gt/.lt/.isZero`; sums with `Decimal.sum` helper `sumMoney(values)`.

## @sentry/react-native
- Init in `app/_layout.tsx` when DSN present; `enableAutoSessionTracking`, `tracesSampleRate: 0.2` (prod), environment = APP_VARIANT, release = app version + build.
- `beforeSend` / `beforeBreadcrumb` scrub `authorization`, `refreshToken`, `token`, `password`, `email`, `phone`.
- Set user context to `{ id: user.id, association: tenant.subdomain }` only.

## expo-updates / EAS
- Channels: `development`, `preview`, `production`. `runtimeVersion: { policy: 'fingerprint' }`.
- Check for updates on app foreground (max once per hour), download silently, apply on next cold start; About screen has manual "Check for updates".
- Native dependency changes require a new build (fingerprint changes) — never ship them via OTA.

## Testing stack
- `jest-expo` preset; `@testing-library/react-native` with a `renderWithProviders()` helper (QueryClient, theme, safe area, bottom sheet provider).
- `msw` (`msw/native`) handlers per API module in `__mocks__/handlers/`.
- Maestro flows in `e2e/*.yaml` run against preview builds with a seeded staging association.

---

# Docs site libraries (`apps/docs`)

## Fumadocs (core / ui / mdx)
- Scaffold with the official CLI (`npm create fumadocs-app`) choosing **Next.js** + **Fumadocs MDX**; then move into `apps/docs`. Read fumadocs.dev for the current release before writing config — APIs (search, loaders, plugin registration) change between majors.
- `source.config.ts`: one `defineDocs({ dir: 'content/docs' })` collection; extend the frontmatter schema with our fields (`architecture.md §14.3`) using zod. Build fails on invalid frontmatter — keep it that way.
- `lib/source.ts`: `loader({ baseUrl: '/docs', source })` exporting `source` (page tree + `getPage`). All components read pages through it.
- Layouts: `DocsLayout` (sidebar tree, nav links, theme switch) in `app/docs/layout.tsx`; `DocsPage`, `DocsBody`, `DocsTitle`, `DocsDescription` in the page route; pass `toc`, `full={false}`, footer prev/next.
- Hide drafts: filter the page tree and `generateStaticParams` with `status !== 'draft' || process.env.NEXT_PUBLIC_SHOW_DRAFTS === 'true'`.
- `meta.json` per folder controls order/title/icon; use `"---Separator---"` entries in the root `meta.json` for sidebar group labels.
- Icons in `meta.json` / frontmatter resolved through an icon map (`lib/icons.ts`) to `lucide-react` components.
- Theme: import Fumadocs UI CSS, then our `app/theme.css` that overrides Fumadocs colour variables with docs tokens (`ui-tokens.md §14`). Never edit Fumadocs package CSS.
- Built-in components we re-export rather than rebuild: Tabs, Accordion (for `Faq`), Cards (wrapped as `CardGrid`), Steps (if present in the current version; else our own), Callout (wrapped to enforce our four types).

## Next.js (docs) — static export
- `next.config.mjs`: `output: 'export'`, `images: { unoptimized: true }`, `trailingSlash: false`; MDX via the Fumadocs plugin wrapper.
- Every dynamic route implements `generateStaticParams`; route handlers used for search index, OG images, `llms.txt`, sitemap must be static (`export const dynamic = 'force-static'` / `revalidate = false`).
- No middleware, no server actions, no cookies — the output must be pure files.
- `next/font/google` for Manrope (`variable: '--font-sans'`, `display: 'swap'`).

## Search (Fumadocs built-in)
- Use the static mode so the index is a file in `out/` and search runs in the browser. Follow the current Fumadocs search docs at D1.5 (the static implementation changed in mid-2026; don't copy older Orama snippets).
- Index fields: title, description, headings, content, plus `keywords` (synonyms). Tag by section for grouped results.

## Playwright (screenshot pipeline)
- `scripts/screenshots/capture.config.ts` defines projects: `desktop-light`, `desktop-dark`, `phone-light`, `phone-dark` (viewports 1280×800 / 390×844, `colorScheme`). Auth per role via `storageState` files created in a setup project (never committed).
- Each flow file exports `{ section, shots: [{ name, role, url, prepare?(page), clip? }] }`. Before capture: wait for network idle, hide toasts, freeze animations (`page.emulateMedia({ reducedMotion: 'reduce' })`), mask volatile elements (`mask: [page.locator('[data-volatile]')]`).
- Convert PNG → WebP with `sharp` (quality 80, max width 1600); filenames per `code-standards.md §17.2`.

## GA4 via @next/third-parties
- `<GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />` in root layout only when the env var is set (not in previews).
- Events via `lib/analytics.ts`: `docs_feedback`, `docs_search`, `docs_outbound`. No personal data in event params.

## lychee / link checks
- CI runs the internal checker (`scripts/check-links.ts`) on every PR (fast, offline) and lychee for external links weekly (external sites flake — warnings, not failures).

---

## MCP servers / agent tooling (optional, verify availability before relying on them)
| Tool | Our use |
|---|---|
| Expo MCP server | Look up current Expo SDK docs/APIs instead of relying on memory; check package compatibility. |
| Context7 (docs MCP) | Current docs for NativeWind, TanStack Query, victory-native, gorhom bottom sheet, **Fumadocs, Next.js, Playwright**. |
| Playwright MCP / browser tool | Click through staging flows while writing docs pages; verify steps before publishing. |
| GitHub | Branches/PRs per feature. |
| Postgres/Prisma tooling (api only) | Inspect staging data shapes during F0.x — read-only. |
If a tool is unavailable, proceed from official docs and record any version uncertainty in `progress-tracker.md` notes.
