# Library Docs — SocietyLedger Mobile, Docs & Admin

> Not generic documentation — **our** patterns for each library. If you need a library not listed here, stop and ask; once approved, add a section here before using it. Version pins are set at scaffold (F1.1) and recorded in the table; bump only via a dedicated `chore(mobile): upgrade` change.

| Library | Purpose | Pinned version |
|---|---|---|
| expo (SDK 58) | runtime | **58.0.16** — pinned at F1.1 (2026-10-19). Owner explicitly asked for "SDK 55+"; 58 was latest stable at scaffold time (56/57 also exist but 58 has no open issues blocking us). React 19.3.0, React Native 0.88.0, New Architecture only (no `newArchEnabled` config key in this SDK — it's the only architecture, not a toggle). |
| expo-router | navigation | 58.0.24 (SDK-matched) |
| nativewind + tailwindcss | styling | **nativewind 4.2.7, tailwindcss 3.4.19** — pinned at F1.2. NativeWind v5 exists only as a preview/rc; v4.2.x is what `ui-tokens.md §10-12`'s CSS-variable/`tailwind.config.js` shapes are written for. |
| @tanstack/react-query (+ persist client, async-storage persister) | server state | v5.x |
| zustand | client state | v5.x |
| react-hook-form, @hookform/resolvers, zod | forms | rhf 7.x, zod 3.x (match API) |
| axios | HTTP | 1.x |
| expo-secure-store, react-native-mmkv | storage | react-native-mmkv **4.3.2** (Nitro-modules based). **API changed from v2/v3**: there is no `new MMKV({...})` constructor anymore — `MMKV` is a type-only export; create instances with `createMMKV({ id, ... })` from `react-native-mmkv`. Get/set method names (`getString`, `getBoolean`, `getNumber`, `set`, `remove`, `contains`, `getAllKeys`) are unchanged. Reactive hooks (`useMMKVString` etc.) exist but call their getter unconditionally in both `getSnapshot` and `getServerSnapshot` inside `useSyncExternalStore` — **not safe under Expo Router static-export SSR**, since the web shim throws ("Tried to access storage on the server") when read outside a browser. For any value read during initial render that must survive static export, write your own `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` with a `getServerSnapshot` that returns a static default and never touches the MMKV instance — see `src/providers/ThemeProvider.tsx` (F1.2). |
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
| jest-expo, @testing-library/react-native, msw | tests | jest-expo **58.0.11**, jest **30.5.2** (jest-expo 58 accepts `^29 \|\| ^30`, but its own `jest-watch-typeahead` transitive dep wants `^30` — pin 30 to avoid a peer warning), @testing-library/react-native **14.1.0** (wants `test-renderer@^1.0.0`, **not** `react-test-renderer` — that package is deprecated under React 19; use the `test-renderer` npm package instead, see its own section below), msw latest. |
| typescript (mobile workspace only) | language | **5.9.3, not the real npm `latest` (7.0.2)** — `eslint-config-expo@58.0.4`'s `@typescript-eslint/eslint-plugin@^8.59.0` caps at `typescript: >=4.8.4 <6.1.0` (same ceiling pattern as the docs workspace's own TS pin below). Re-check this ceiling before ever bumping. |
| expo-server-sdk (**api only**) | push sending | latest |
| **Docs site (`apps/docs`)** | | |
| fumadocs-core, fumadocs-mdx | docs framework, MDX content source | 16.17.1 / 15.4.7 (pinned D1.1) |
| fumadocs-ui | UI (resolves to the renamed `@fumadocs/base-ui` package at this version — keep the `npm:` alias in `package.json`, don't "fix" the name) | `npm:@fumadocs/base-ui@16.17.1` (pinned D1.1) |
| next, react, react-dom (docs workspace only) | framework | 16.3.8 / 19.3.0 / 19.3.0 (pinned D1.1, per Fumadocs' current peer requirement `react: ^19.2.0`) |
| typescript (docs workspace only) | language | **5.9.3, not the newest 5.x+ line** — `create-fumadocs-app`'s template defaults to the latest major regardless of ecosystem support; `typescript-eslint@8.71.1` (pulled in by `eslint-config-next`) caps at `typescript: >=4.8.4 <6.1.0`, so anything past 5.x breaks `pnpm lint`. Re-check this ceiling before ever bumping. |
| zod (docs workspace only) | frontmatter schema, fumadocs-core peer | **^4.6.6, not 3.x** — fumadocs-core 16.17.1 requires `zod: 4.x.x` as a peer. The API/web use zod 3.x; pnpm's isolated layout keeps these apart, but zod **must** be declared explicitly in `apps/docs/package.json` — leaving it undeclared lets pnpm silently hoist the repo's zod 3.x instead, which satisfies nothing and warns on install. |
| tailwindcss (+ postcss) (docs workspace only) | styling | 4.3.3 (Tailwind v4 — CSS-first `@theme`, no `tailwind.config.js`; ui-tokens.md §14 mapping must target that model, not the v3 `theme.extend` shape) |
| lucide-react | icons | ^1.50.0 |
| @next/third-parties | GA4 | _pin at D1.5_ |
| @playwright/test | screenshots | _pin at D1.6_ |
| sharp | WebP conversion in screenshot script | _pin at D1.6_ |
| tsx | run scripts | _pin at D1.3/D1.6_ |
| lychee (GitHub Action) | external/internal link check | _pin at D1.7_ |
| nginx:alpine (docker image) | serve docs static export on Dokploy | stable alpine |
| **Admin console (`apps/admin`)** | | |
| next, react, react-dom (admin workspace only) | framework | same versions as `apps/web` at migration |
| @mantine/core, @mantine/dates, @mantine/form, @mantine/hooks, @mantine/modals, @mantine/notifications | UI kit | 7.x (same as web) |
| tailwindcss | utility classes (preflight off) | same as web |
| @tabler/icons-react | icons | same as web |
| recharts | charts (analytics) | same as web |
| quill | blog editor (moved from web) | same as web |
| @tanstack/react-query | server state via /bff | v5.x |
| zustand | UI prefs | v4/v5 (match web, upgrade later) |
| axios | HTTP to /bff | 1.x |
| react-hook-form, @hookform/resolvers, zod | new forms | as web |
| server-only | guard server modules | latest |
| @sentry/nextjs | errors | latest |
| @playwright/test | admin E2E | latest |
| **API additions for admin (`apps/api`)** | | |
| otplib | TOTP 2FA | latest 12.x |
| qrcode | 2FA enrolment QR (data URL) | latest |

Install Expo-managed packages with `pnpm -F @societyledger/mobile exec expo install <pkg>` (picks SDK-compatible versions). Never `pnpm add` an `expo-*` or React Native native module directly. Other packages: `pnpm add -F <app> <pkg>`.

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
- `src/theme/global.css` holds **all** CSS variables (`ui-tokens.md`) for `:root` (light) and the dark scheme (plain `@media (prefers-color-scheme: dark)`, not a `.dark` class selector). Imported once in `app/_layout.tsx`.
- `tailwind.config.js` maps every token to a utility using `rgb(var(--color-x) / <alpha-value>)` so opacity modifiers work (`bg-primary/10`). Custom scales replace Tailwind defaults (no stock `gray-500`, `teal-600` usage in code).
- **Dark mode mechanism — confirmed at F1.2** (the exact confirmation `ui-tokens.md §10`'s footnote asked for): NativeWind v4's own `useColorScheme()`/`colorScheme.set('light'|'dark'|'system')` (from `nativewind`, not React Native's `useColorScheme`) patches what the app's effective appearance resolves to, and NativeWind's CSS-interop evaluates the raw `@media (prefers-color-scheme: dark)` block against that overridden appearance — so the plain media-query block in `global.css` (no `darkMode: 'class'`, no `.dark:root` selector) is the correct, sufficient approach; nothing else needed.
- Use `className` only; the `cn()` helper (`lib/cn.ts`, clsx-based, added at F1.6) merges conditional classes. Avoid `cssInterop` except for third-party components that need `className` (register once in `src/theme/interop.ts` — e.g. `expo-router`'s `Link`, registered at F1.2).
- If a value must be read in JS (charts, navigation, status bar), use `src/theme/tokens.ts` → `useThemeTokens()`; never parse CSS at runtime.
- **pnpm phantom-dependency gotcha (found at F1.2):** NativeWind's babel preset (`jsxImportSource: 'nativewind'`) makes every `.tsx` file import `react-native-css-interop/jsx-runtime` automatically. `react-native-css-interop` is a real dependency of `nativewind` itself, but **not** a declared dependency of `apps/mobile` — under pnpm's isolated (non-hoisted) node_modules, that makes it an inaccessible "phantom" dependency from the app's own files, and Metro fails with `Unable to resolve "react-native-css-interop/jsx-runtime"`. Do **not** reach for `node-linker=hoisted` in the root `.npmrc` for this specific error (that's a monorepo-wide change that risks exactly the React-version-collision problem `architecture.md §2` warns `public-hoist-pattern` against, since web pins React 18 and mobile pins React 19) — instead add `react-native-css-interop` as an explicit direct dependency of `apps/mobile` pinned to the same version `nativewind` itself resolves (checked via `node -e "console.log(require('nativewind/package.json').dependencies)"` from inside `apps/mobile`). The general `node-linker=hoisted` fallback `architecture.md §2` describes remains the right tool for a *different* kind of resolution failure (e.g. a native module that truly can't be found via any reasonable direct-dependency fix); it is not the default first move.
- **Static-export SSR gotcha (found at F1.2):** `expo export -p web` (and `app.config.ts`'s `web.output: 'static'`) renders every route once on Node via Expo Router's static server renderer, not just in-browser. Any code that runs during initial render (an unguarded `useState(() => ...)` initializer, a `useSyncExternalStore` `getSnapshot` used as `getServerSnapshot`, a module-scope side effect) and touches a browser-only API — MMKV's web shim backed by `localStorage`, for instance — throws during that server pass even though the exact same code works fine in the actual browser/device runtime. Any value read from such a source for initial state must go through `useSyncExternalStore` with a distinct `getServerSnapshot` that returns a static default and never touches the browser-only API — see `src/providers/ThemeProvider.tsx`.

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
- Scaffold with the official CLI (`pnpm create fumadocs-app`) choosing **Next.js** + **Fumadocs MDX**; then move into `apps/docs`. Read fumadocs.dev for the current release before writing config — APIs (search, loaders, plugin registration) change between majors.
- **Corrected at D1.3:** there is no `source.config.ts` in this scaffold — `fumadocs-mdx@15.4.7`'s `defineDocs` is imported from `fumadocs-mdx/macro` (a compile-time macro, not the file-path-based config loader `fumadocs-mdx`'s core resolves by default), so it has no fixed-filename convention and is called directly in `lib/source.ts`. The frontmatter zod schema lives in its own loader-free module, `lib/docs-schema.ts` (extending `pageSchema` from `fumadocs-core/source/schema`), so `scripts/check-frontmatter.ts` can import it under plain `tsx` without pulling in the macro/loader chain; `lib/source.ts` re-exports it. Build fails on invalid frontmatter — keep it that way.
- `lib/source.ts`: `loader({ baseUrl: '/docs', source: docs.toFumadocsSource(), plugins: [lucideIconsPlugin()] })` exporting `source` (page tree + `getPage`/`getPageByHref`). All components read pages through it.
- Layouts: `DocsLayout` (sidebar tree, nav links, theme switch) in `app/docs/layout.tsx`; `DocsPage`, `DocsBody`, `DocsTitle`, `DocsDescription` in the page route; pass `toc`, `full={false}`, footer prev/next.
- Hide drafts from the sidebar: `lib/source.ts` exports `getVisiblePageTree()`, a plain recursive filter over `source.getPageTree()` (checking each `Item`'s `source.getPageByHref(url)?.page.data.status` against `NEXT_PUBLIC_SHOW_DRAFTS`), used in `app/docs/layout.tsx` instead of `source.getPageTree()` directly (D1.3). Draft exclusion from search, the sitemap and `generateStaticParams` is separate and lands at D1.5 — D1.3 only scopes the sidebar.
- `meta.json` per folder controls order/title/icon; use `"---Separator---"` entries in the root `meta.json` for sidebar group labels.
- Icons in `meta.json` / frontmatter resolve automatically via `lucideIconsPlugin()` (`fumadocs-core/source/plugins/lucide-icons`), added to the loader's `plugins` array — **not** a hand-written icon map (there is no `lib/icons.ts`; corrected at D1.3). Icon values must be exact `lucide-react` export names (PascalCase) — some names assumed from older Lucide releases don't exist in the installed `lucide-react@1.50` (e.g. no `BarChart3`, `BookMarked` or `HelpCircle` — use `ChartColumn`, `Bookmark`, `CircleQuestionMark` instead); check with `node -e "console.log(!!require('lucide-react').icons.<Name>)"` before using a new one.
- Theme: import Fumadocs UI CSS, then our `app/theme.css` that overrides Fumadocs colour variables with docs tokens (`ui-tokens.md §14`). Never edit Fumadocs package CSS.
- **Gotcha (found at D1.2):** `@fumadocs/base-ui`'s `neutral.css` ships `.dark #nd-sidebar { --color-fd-muted: …; --color-fd-secondary: …; --color-fd-muted-foreground: …; }` — an ID selector. A plain `.dark { … }` override in `theme.css` has equal specificity to the package's own `.dark { … }` block (so it wins on source order, fine), but **not** to that higher-specificity `#nd-sidebar` rule — it will lose for those 3 properties on the sidebar specifically unless `theme.css` repeats the same `.dark #nd-sidebar { … }` selector. Dark mode is `next-themes` with `attribute: "class"` (confirmed by reading `dist/provider/base.js`), not a `prefers-color-scheme` media query. Tailwind v4's own `--radius-sm/-md/-lg` theme vars (not a Fumadocs-specific var) can be overridden in a plain `@theme {}` block to retune Fumadocs' own `rounded-*` utility classes sitewide — there is no separate `--fd-radius`.
- Built-in components we re-export rather than rebuild: Tabs, Accordion (for `Faq`), Cards (wrapped as `CardGrid`), Steps (if present in the current version; else our own), Callout (wrapped to enforce our four types).

## Next.js (docs) — static export
- `next.config.mjs`: `output: 'export'`, `images: { unoptimized: true }`, `trailingSlash: false`; MDX via the Fumadocs plugin wrapper.
- Every dynamic route implements `generateStaticParams`; route handlers used for search index, OG images, `llms.txt`, sitemap must be static (`export const dynamic = 'force-static'` / `revalidate = false`).
- No middleware, no server actions, no cookies — the output must be pure files.
- `next/font/google` for Manrope (`variable: '--font-sans'`, `display: 'swap'`).

## Search (Fumadocs built-in)
- Static mode (`createFromSource(source, {...}).staticGET` in `app/api/search/route.ts`) — the index is exported as a file in `out/api/search`, search runs client-side via `useStaticSearch` (`fumadocs-core/search/client`). Confirmed at D1.5 by reading the installed `fumadocs-core@16.17.1` types: this engine (`Options<C> extends AdvancedOptions`) has no literal `keywords` field on its index — only `content`/`tags`/`breadcrumbs`/`url`/etc. (`SharedIndex`). Synonyms are instead folded into `structuredData.contents` as extra, hidden, matchable entries (`lib/search-synonyms.ts` + `buildIndex` in the route) — same outcome, different mechanism than what was assumed pre-installation.
- Section grouping: each index entry gets `tag: page.slugs[0]` (its section) via `buildIndex`; the client renders Fumadocs' built-in `<TagsList>`/`<TagsListItem>` (`fumadocs-ui/components/dialog/search`) to filter by it, driven by `useStaticSearch({ tag })`.

## Playwright (screenshot pipeline)
- Built at D1.6, from scratch (the package wasn't in the repo before). `@playwright/test` + `sharp`, both docs-only devDependencies.
- `scripts/screenshots/capture.config.ts` defines projects: `desktop-light`, `desktop-dark`, `phone-light`, `phone-dark` (viewports 1280×800 / 390×844, `colorScheme`), each depending on a `setup` project (`auth.setup.ts`) that logs in as all three demo roles once and writes one `storageState` file per role to `.auth/` (gitignored, never committed).
- `scripts/screenshots/flows/*.ts` each export `{ section, shots: [{ name, role, url, prepare?(page), clip? }] }` exactly as originally specified here; `flows/index.ts` aggregates them. The actual capture runs through one generic `capture.spec.ts` (not one spec per flow) that reads every flow, opens a role-scoped context per shot, and does the "before capture" steps: `context.clock.install({ time: <fixed instant> })` (frozen clock — the seed data's fixed dates alone don't stop the app's own relative-time text drifting with the *real* clock), network-idle wait, `reducedMotion: 'reduce'`, hide/mask elements marked `data-volatile="hide"`/`"mask"` (a convention `apps/web` doesn't use yet — inert until something there is actually marked).
- `pnpm -F @societyledger/docs screenshots [--section=<name>]` (`scripts/screenshots/capture.ts`) is a thin wrapper that spawns `playwright test` with `SCREENSHOT_SECTION` set — authors never invoke `playwright test` directly.
- Convert PNG → WebP with `sharp` (quality 80, max width 1600) inside the same test, right after `page.screenshot()`. Filenames per `code-standards.md §17.2`, **including the `-phone` marker added there at D1.6** for when a phone-web capture of the same shot coexists with the desktop one — the original wording only reserved room for a light/dark suffix.
- **Status: unverified.** Written and type-checked (`tsc --strict` against the real `@playwright/test`/`sharp` types — zero errors) but never run against a live target: no staging environment or demo association exists yet (`demo-association.seed.ts`, `apps/api`, is new too — see `seed-demo.md`). The login selectors in `auth.setup.ts` target the form by `input[name]`/`button[type=submit]`, not confirmed against the actual rendered DOM — check those first if a real run fails immediately.

## GA4 (custom, not @next/third-parties)
- `components/analytics.tsx` (D1.5), mounted once in the root layout. **Not** `@next/third-parties`'s `<GoogleAnalytics>` as originally assumed here — that component has no hook for GA4 consent-mode defaults (`analytics_storage`/`ad_storage` denied until changed, the owner's D1.5 decision), so a custom pair of `next/script` tags doing the consent-mode dance by hand was simpler than fighting the wrapper. Renders nothing without `NEXT_PUBLIC_GA_ID` set (not in previews, same as the original note's intent).
- Events via `lib/analytics.ts`'s `trackEvent()`: `docs_feedback` (`components/mdx/feedback.tsx`), `docs_search` (`components/search.tsx`), `docs_outbound` (`components/analytics.tsx`, one delegated click listener). No personal data in event params.

## lychee / link checks
- CI runs the internal checker (`scripts/check-links.ts`) on every PR (fast, offline) and lychee for external links weekly (external sites flake — warnings, not failures).

---

# Admin console libraries (`apps/admin`)

## Next.js (admin) — standalone server
- `next.config.js`: `output: 'standalone'`, `poweredByHeader: false`, `headers()` adding `X-Robots-Tag: noindex, nofollow`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, a CSP that allows only `'self'`, the API uploads origin for images, and Sentry.
- Route handlers in `src/app/bff/**` run on the Node runtime (`export const runtime = 'nodejs'`), never cached (`export const dynamic = 'force-dynamic'`).
- `cookies()` from `next/headers` to read/set `sl_admin_session` (`httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 28800` — and **no `domain`**).
- `middleware.ts` matcher excludes `/_next/*`, `/login*`, `/bff/session`, `robots.txt`; checks cookie presence (not validity — the API validates) and IP allowlist.

## Mantine 7 (admin)
- One `createTheme()` in `src/theme/index.ts` built from admin tokens (`ui-tokens.md §15`): custom 10-shade `ledger` and `brass` colours, `primaryColor: 'ledger'`, `defaultRadius: 'md'`, `fontFamily: 'Manrope, …'`, headings sizes, component default props (`Button: { radius: 'md' }`, `Table: { striped: false, highlightOnHover: true, verticalSpacing: 'sm' }`).
- Colour scheme via `MantineProvider defaultColorScheme="auto"` + `ColorSchemeScript`; Tailwind `darkMode: ['class', '[data-mantine-color-scheme="dark"]']` so both agree.
- Use `@mantine/modals` `openConfirmModal` only inside `ConfirmDestructive` (single implementation).
- Notifications at `top-right`, autoClose 4 s (errors 8 s).

## TanStack Query v5 (admin)
- `QueryClient` defaults: `staleTime: 30_000`, `retry: 1` (never retry 4xx), `refetchOnWindowFocus: true` (staff keep tabs open — fresh data matters).
- 401 from `/bff` → global `QueryCache` `onError` redirects to `/login?expired=1`.
- Mutations invalidate by key factories; destructive mutations also invalidate the action-log query.

## recharts (admin analytics)
- Wrap in `components/charts/*` (`TrendChart`, `BarBreakdown`, `DonutBreakdown`) taking token colours from the Mantine theme; never hard-code the API's per-method hex colours.

## otplib + qrcode (apps/api, 2FA)
- `authenticator.options = { window: 1, step: 30 }`; secret generated with `authenticator.generateSecret()`, stored encrypted (AES-256-GCM, key `TOTP_ENCRYPTION_KEY`), never returned after enrolment.
- `otpauth://` label: `SocietyLedger Admin:<email>`, issuer `SocietyLedger`.
- Recovery codes: 10 × 10-char base32, stored as bcrypt hashes, single use.

## Dokploy (deployment)
- **Corrected at D1.7** (deliberately deferred since D1.2, per the decisions log — now that `docs` is actually added as a compose service): **not** one Dokploy Application per app. Everything deploys as **one Dokploy "Compose" application**, `docker-compose.dokploy.yml` at the repo root — `api`/`web` already live this way; `docs` was added as a new service in that same file at D1.7, not a separate Dokploy Application. Full topology in `architecture.md §17.1`.
- Internal service-to-service calls (admin → API) use the Dokploy network hostname instead of the public URL.
- Database: Dokploy PostgreSQL service in the same compose stack; backups configured in Dokploy (S3 destination); connection string stored only in API env.
- Preview/staging: the **same** compose file, deployed as a separate Dokploy Compose project tracking `develop` (own env var values, e.g. `DOCS_ROBOTS_TAG=noindex, nofollow` for docs' staging deployment only) — not a different file.
- Always set Traefik router priority for specific hosts above the wildcard (`architecture.md §17.3`) — `docs` and (later) `admin` need `priority=100`; `web`'s wildcard needs `priority=1` (this was a latent gap since `web` shipped alone with no explicit priority at all — fixed at D1.7 when `docs` actually needed it).
- **`apps/docs`'s Dockerfile gotchas (found at D1.7 by actually running `docker build`/`docker run`, not assumed):**
  - `turbo prune --docker`'s pruned output only includes files it can trace through the **workspace dependency graph** — a plain relative-path `"extends": "../../tsconfig.base.json"` in a package's `tsconfig.json` isn't a dependency edge turbo tracks, so the file is silently missing from `out/full/` and the build fails with "doesn't resolve correctly". Fix: an explicit `COPY tsconfig.base.json ./tsconfig.base.json` in the builder stage, after both pruner/installer copies (same category of issue `apps/web/Dockerfile` already has a comment about, for its own cross-package `prisma/schema.prisma` reference — check every package whose config reaches outside its own directory via a relative path before assuming `turbo prune` carried it along).
  - `nginx:1.27-alpine`'s templating entrypoint (`envsubst` over `/etc/nginx/templates/*.template`) only replaces a `${VAR}` token if `VAR` is **set** in the container's environment — merely absent (not even empty-string) leaves the token in the generated config verbatim, and nginx then fails to start trying to parse it as its own variable syntax. Always `ENV VAR=""` in the Dockerfile for any templated var, so the image is safe to run standalone (`docker run` with no `-e`), not just via the compose file that happens to always set it (even to `""`).
  - `add_header X-Robots-Tag "${ROBOTS_TAG}" always;` with an empty value correctly **omits** the header entirely (documented nginx `add_header` behaviour) — don't build separate "has value" / "no value" config branches for this.

## pnpm
- `packageManager` pinned in root `package.json`; enable via `corepack enable`.
- Filtering: `pnpm -F @societyledger/admin dev`; recursive: `pnpm -r type-check` or `pnpm turbo run type-check`.
- Inspect duplicate/conflicting versions: `pnpm why <pkg> -r`.
- `pnpm dlx turbo prune <pkg> --docker` for Docker builds.

---

## MCP servers / agent tooling (optional, verify availability before relying on them)
| Tool | Our use |
|---|---|
| Expo MCP server | Look up current Expo SDK docs/APIs instead of relying on memory; check package compatibility. |
| Context7 (docs MCP) | Current docs for NativeWind, TanStack Query, victory-native, gorhom bottom sheet, Fumadocs, Next.js, Playwright, **Mantine, otplib, Dokploy**. |
| Playwright MCP / browser tool | Click through staging flows while writing docs pages; verify steps before publishing. |
| GitHub | Branches/PRs per feature. |
| Postgres/Prisma tooling (api only) | Inspect staging data shapes during F0.x — read-only. |
If a tool is unavailable, proceed from official docs and record any version uncertainty in `progress-tracker.md` notes.
