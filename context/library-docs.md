# Library Docs — SocietyLedger Mobile, Docs & Admin

> Not generic documentation — **our** patterns for each library. If you need a library not listed here, stop and ask; once approved, add a section here before using it. Version pins are set at scaffold (F1.1) and recorded in the table; bump only via a dedicated `chore(mobile): upgrade` change.

| Library | Purpose | Pinned version |
|---|---|---|
| expo (SDK 58) | runtime | **58.0.16** — pinned at F1.1 (2026-10-19). Owner explicitly asked for "SDK 55+"; 58 was latest stable at scaffold time (56/57 also exist but 58 has no open issues blocking us). React 19.3.0, React Native 0.88.0, New Architecture only (no `newArchEnabled` config key in this SDK — it's the only architecture, not a toggle). |
| expo-router | navigation | 58.0.24 (SDK-matched) |
| nativewind + tailwindcss | styling | **nativewind 4.2.7, tailwindcss 3.4.19** — pinned at F1.2. NativeWind v5 exists only as a preview/rc; v4.2.x is what `ui-tokens.md §10-12`'s CSS-variable/`tailwind.config.js` shapes are written for. |
| @tanstack/react-query (+ persist client, async-storage persister) | server state | v5.x |
| zustand | client state | **^5.0.15** — pinned at F1.6. `expo install` auto-resolved it to `^4.4.0` by default (an odd choice — zustand isn't a native module, so this is just Expo's bundled JS-package metadata, not an SDK-compatibility constraint); upgraded to the documented 5.x explicitly, no issues found. First real store: `stores/session.ts` (a deliberate minimal pull-forward — see its own note). |
| react-hook-form, @hookform/resolvers, zod | forms | **react-hook-form ^7.45.0, @hookform/resolvers ^3.3.0, zod ^3.25.76** — pinned at F1.5. `expo install` resolved zod to the real npm `latest` (4.x) by default; **downgraded to 3.x explicitly** to match `apps/api`'s own `zod@^3.22.0` (this table's own "match API" rule) — zod 4 has breaking changes from 3, so the two must not silently drift. |
| @react-native-community/datetimepicker | native date/time picker | **9.2.1** — pinned at F1.5, **owner-approved**. No date-picker package was documented anywhere in context before this feature (`ui-rules.md §5.6` only says "Dates open the native date picker," no implementation detail) — asked per this table's own "stop and ask" rule rather than assumed. Config plugin added to `app.config.ts` (`expo install` couldn't auto-write it into the dynamic config). |
| axios | HTTP | 1.x |
| expo-secure-store, react-native-mmkv | storage | **expo-secure-store ~58.0.2** — pinned at F1.6 for `lib/secure.ts`. react-native-mmkv **4.3.2** (Nitro-modules based). **API changed from v2/v3**: there is no `new MMKV({...})` constructor anymore — `MMKV` is a type-only export; create instances with `createMMKV({ id, ... })` from `react-native-mmkv`. Get/set method names (`getString`, `getBoolean`, `getNumber`, `set`, `remove`, `contains`, `getAllKeys`) are unchanged. Reactive hooks (`useMMKVString` etc.) exist but call their getter unconditionally in both `getSnapshot` and `getServerSnapshot` inside `useSyncExternalStore` — **not safe under Expo Router static-export SSR**, since the web shim throws ("Tried to access storage on the server") when read outside a browser. For any value read during initial render that must survive static export, write your own `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` with a `getServerSnapshot` that returns a static default and never touches the MMKV instance — see `src/providers/ThemeProvider.tsx` (F1.2). **Confirmed at F1.6:** the one shared instance now lives in `lib/storage.ts` (`createMMKV({ id: 'societyledger' })`) — `ThemeProvider.tsx` imports it instead of owning its own, same `id` so existing persisted values survive. |
| expo-notifications, expo-device | push | _SDK-matched_ |
| expo-web-browser, expo-linking | Paystack, deep links | **expo-web-browser ~58.0.6** — pinned at F1.6, pulled forward for `lib/docs.ts`'s `openDocs()` (ui-rules.md §12's in-app browser), ahead of the Paystack flow that originally motivated listing it (F2.8). **expo-linking ~58.0.13** — pinned at F1.8 for `lib/linking.ts`'s deep-link parsing (`Linking.parse()`). |
| expo-local-authentication | biometrics | _SDK-matched_ |
| expo-image-picker, expo-document-picker, expo-file-system, expo-sharing, expo-print | files | **expo-image-picker ~58.0.10, expo-document-picker ~58.0.4** — pinned at F1.5 for `FileAttachField` (Camera/Photos/Files). `expo-file-system`/`expo-sharing`/`expo-print` still not installed — F1.5 only needed picking, not uploading/downloading (that's F1.7+/F2.6+). Permission strings added to `app.config.ts`'s `expo-image-picker` plugin config. Compression uses the picker's own `quality: 0.7` option only — the max-2000px-long-edge resize from library-docs.md's own spec is deferred (no `expo-image-manipulator` pinned yet; this table's header explicitly allows that: "add to table when introduced"). |
| expo-image | images | _SDK-matched_ |
| expo-calendar | add to calendar | _SDK-matched (new API)_ |
| expo-clipboard, expo-haptics | UX | **expo-clipboard ~58.0.3** — pinned at F2.2 (first real use: A12's admin-domain copy). `expo-haptics` still not installed — nothing has needed it yet. |
| @react-native-community/netinfo | connectivity | **12.0.1** — pinned at F1.6 for `hooks/useOnline.ts`. `NetInfo.fetch()` on mount (resolves almost immediately on a real device) + `NetInfo.addEventListener` for subsequent changes; `isOnline` starts optimistic (`true`) rather than `undefined`, to avoid a flash of `OfflineBanner` on every cold start. |
| @shopify/flash-list | lists | _SDK-matched_ |
| react-native-reanimated, react-native-gesture-handler | animation/gesture | _SDK-matched_ |
| @gorhom/bottom-sheet | sheets | **^5.2.14** — pinned at F1.5. `BottomSheetModalProvider` mounted once at the app root (`app/_layout.tsx`), inside `GestureHandlerRootView` (also newly wired at the root — `react-native-gesture-handler` was already a dependency since F1.1 but nothing had required the root wrapper until a real bottom sheet existed). |
| react-native-gifted-charts | charts (replaces the planned victory-native) | ^1.4.81 |
| lucide-react-native, react-native-svg | icons | **lucide-react-native ^1.60.0, react-native-svg 15.16.0** — pinned at F1.4 (`expo install`-resolved, SDK-56-compatible). Ships ESM-only for the `"react-native"`/`"import"` export conditions (no CJS alternative on that condition) — needed a Jest config fix, see "Testing stack" below and `ui-registry.md`'s "Dev tooling & known gaps (F1.4)". |
| sonner-native | toasts | **^0.27.0** — pinned at F1.5. Named exports only: `import { Toaster, toast } from 'sonner-native'` (no default export). `<Toaster />` mounted once in `app/_layout.tsx`. |
| date-fns | dates | **^4.1.0** — pinned at F1.6, confirmed same major as web. `lib/dates.ts`'s `formatDate(iso, variant)` covers the 5 variants code-standards.md §11 names (`short`/`long`/`relative`/`time`/`monthYear`); no `date-fns-tz` (deferred — see that module's own note). |
| decimal.js-light | money | **^2.5.1** — pinned at F1.4, pulled forward from F1.6's `lib/money.ts` (not built yet at the time) because `Money` (F1.4) needs real decimal-safe arithmetic immediately. **Confirmed at F1.6:** `toDecimal`/`formatMoney` now live in the real `lib/money.ts`; `Money.tsx` imports them (props unchanged). Import the named export (`import { Decimal } from 'decimal.js-light'`), not the default — ESLint's `import/no-named-as-default` flags the default import since the class is also a named export. **No static `Decimal.sum(...)`** (that's full `decimal.js`, not the "light" build) — `sumMoney()` reduces with `.plus()` manually instead. |
| @sentry/react-native | crash reporting | latest (Expo plugin) |
| expo-updates | OTA | _SDK-matched_ |
| jest-expo, @testing-library/react-native, axios-mock-adapter | tests | jest-expo **58.0.11**, jest **30.5.2** (jest-expo 58 accepts `^29 \|\| ^30`, but its own `jest-watch-typeahead` transitive dep wants `^30` — pin 30 to avoid a peer warning), @testing-library/react-native **14.1.0** (wants `test-renderer@^1.0.0`, **not** `react-test-renderer` — that package is deprecated under React 19; use the `test-renderer` npm package instead, see its own section below), axios-mock-adapter **^2.x** (devDependency, pinned at F1.7 — see "Testing stack" below for why it replaced `msw`, which this table previously listed and is **not actually installable in this project**). |
| typescript (mobile workspace only) | language | **5.9.3, not the real npm `latest` (7.0.2)** — `eslint-config-expo@58.0.4`'s `@typescript-eslint/eslint-plugin@^8.59.0` caps at `typescript: >=4.8.4 <6.1.0` (same ceiling pattern as the docs workspace's own TS pin below). Re-check this ceiling before ever bumping. |
| tsx (mobile workspace, devDependency) | run `scripts/gen-enums.ts` | **^4.20.6** — pinned at F1.3, same major as `apps/docs`'s own `tsx` devDependency; not hoisted (pnpm isolated layout), each workspace declares it separately. |
| @societyledger/shared (workspace) | `DOCS_LINKS`, `isPlanBillingDocsPath` for `lib/docs.ts` | **workspace:\*** — added at F1.6. architecture.md §2 restricts mobile from importing the package's stale `User`/`Member`/`PaginatedResponse` types (closed instead by F1.3's own `src/types/api/*`), but explicitly allows reusing other non-type exports (`validators.ts`, and this package's `docs-links.ts`) where they match. `packages/shared` must already be built (`pnpm -F @societyledger/shared build`) for its `main` (`dist/index.js`) to resolve — confirmed already built from F0.2's session. |
| expo-server-sdk (**api only**) | push sending | **5.0.0, not npm `latest` (7.2.0)** — 6.x/7.x are ESM-only (`"type": "module"`, no CJS build at all) and require Node ≥20/≥22.12; production's Dockerfile runs `node:20-alpine`, and ESM-only also crashes Jest's default CJS transform. `5.0.0` is the newest version that's still CJS, requires Node ≥20 (matches production), and has an identical `Expo`/`chunkPushNotifications`/`sendPushNotificationsAsync`/receipts API (confirmed via its `.d.ts` — pinned F0.2). |
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
- File-based routes in `app/`. Groups: `(auth)`, `(lock)`, `(app)`, `(app)/(tabs)`. `(dev)` gallery/tokens only when `__DEV__`.
- **SDK 56: Router no longer builds on React Navigation.** Import `Stack`, `Link`, `router`, `useLocalSearchParams`, `useFocusEffect`, `useNavigation` from `expo-router` only. Do not add `@react-navigation/*` packages. Run the SDK-56 codemod only if migrating code written for older SDKs.
- **Corrected at F1.8: `Tabs` from the root `expo-router` export is deprecated in this SDK.** Confirmed by reading `expo-router`'s own `build/exports.d.ts`: `@deprecated Use import { Tabs } from 'expo-router/js-tabs' instead`. Import it from **`expo-router/tabs`** (the shorter, non-deprecated alias — both resolve to the same `src/layouts/Tabs.tsx`), not the root package. This is the newer "headless"-capable Tabs (same file also re-exports `TabList`/`TabTrigger`/`TabSlot` from `expo-router/ui` for a fully custom tab layout, not used here — a plain `tabBar` prop on `Tabs` is enough, see below).
- Guards: `(app)/_layout.tsx` reads session status and returns `<Redirect href="/(auth)/welcome" />` when not `'authenticated'` (both the boot-time `'idle'` and signed-out `'unauthenticated'` statuses bounce the same way — F1.8 builds no code path that tells them apart yet, that's F2.4's `/auth/me` bootstrap). No guards in individual screens. **Confirmed at F1.8 via `expo export -p web`'s own static prerender**, incidentally: every `(app)/*` route's static HTML came back as an empty Suspense shell, because the guard fires during the build-time prerender too (no session exists at build time) and redirects to `/(auth)/welcome` before any screen content renders — not a bug, independent confirmation the guard fires outside of Jest too.
- Modals: forms open with `router.push('/manage/members/form')` where the segment's `_layout` declares `presentation: 'modal'` (iOS) / `'fullScreenModal'` (Android) for form routes. **Not built at F1.8** — no modal-presented route exists anywhere in the app yet (the first one lands with whichever feature builds the first create/edit form); nothing to configure prematurely.
- **A `*.test.ts(x)` file placed inside `app/` is a real route to Metro, and crashes the real dev server, not just a theoretical risk** (found at F1.8 by actually hitting it on a physical device: `app/(app)/_layout.test.tsx` made `expo start`'s Android bundle 500 with `UnableToResolveError: ... could not be found ... console`, because Metro bundled `@testing-library/react-native` for real and it needs Node's `console` module, which Metro's RN resolver can't provide). Metro's own default `resolver.blockList` only excludes `__tests__/` directories, not this project's colocated `*.test.ts(x)` convention (code-standards.md). Fixed in `metro.config.js`: `config.resolver.blockList = [...config.resolver.blockList, /\.(test|spec)\.[jt]sx?$/]` — project-wide, not just inside `app/`, since the same crash would hit any `src/**` test file some route file ends up importing by accident. Jest is unaffected (it never reads `metro.config.js`). Any future route-level test (the pattern `_layout.test.tsx` next to `_layout.tsx` is a good one, see F1.8's own guard test) is safe now; this is only a problem for projects that haven't added the blockList entry.
- Typed routes enabled (`experiments.typedRoutes: true`). Always navigate with `{ pathname, params }`. **Gotcha found at F1.8:** the generated declaration (`.expo/types/router.d.ts`) is only (re)written by the **live `expo start` dev server's file watcher** (`@expo/cli`'s `start/server/type-generation/*`) — `expo export` (any platform) never touches it, confirmed by reading `@expo/cli`'s export command source (no reference to the type-generation module at all). Adding a brand-new route and immediately running `tsc --noEmit` shows a phantom "not assignable" error on every `href`/`Redirect` pointing at it, even though the route itself bundles and resolves fine. Fix: run `expo start` (even briefly, killed once `.expo/types/router.d.ts` picks up the new path — `grep` for it) before trusting a type-check result that touches a just-added route's href.
- Tab bar: custom `TabBar` component (`src/components/layout/TabBar.tsx`, F1.8) passed to `Tabs tabBar={(props) => <TabBar {...props} />}`. Manage tab rendered conditionally via `href: canManage ? undefined : null` on its `Tabs.Screen` — internally normalised to `options.hidden = true` (confirmed by reading `expo-router`'s `TabsClient.js`), which `useVisibleTabsWithRedirect` then excludes from `state.routes`/`descriptors` before they ever reach the custom `tabBar` prop (and redirects away if a now-hidden tab was focused) — `TabBar` itself needs no hidden-tab filtering of its own.
- Deep links: scheme `societyledger`; `lib/linking.ts` (F1.8) parses incoming URLs (validated with zod) into a typed `DeepLink`. Wiring into `+native-intent.tsx` is deferred — the two screens it would route to (Accept Invite, Reset Password) are still unbuilt placeholders, built for real at F2.3.

## NativeWind
- `src/theme/global.css` holds **all** CSS variables (`ui-tokens.md`) for `:root` (light) and the dark scheme (plain `@media (prefers-color-scheme: dark)`, not a `.dark` class selector). Imported once in `app/_layout.tsx`.
- `tailwind.config.js` maps every token to a utility using `rgb(var(--color-x) / <alpha-value>)` so opacity modifiers work (`bg-primary/10`). Custom scales replace Tailwind defaults (no stock `gray-500`, `teal-600` usage in code).
- **Dark mode mechanism — confirmed at F1.2** (the exact confirmation `ui-tokens.md §10`'s footnote asked for): NativeWind v4's own `useColorScheme()`/`colorScheme.set('light'|'dark'|'system')` (from `nativewind`, not React Native's `useColorScheme`) patches what the app's effective appearance resolves to, and NativeWind's CSS-interop evaluates the raw `@media (prefers-color-scheme: dark)` block against that overridden appearance — so the plain media-query block in `global.css` (no `darkMode: 'class'`, no `.dark:root` selector) is the correct, sufficient approach; nothing else needed.
- Use `className` only; the `cn()` helper (`lib/cn.ts`, added at F1.6) merges conditional classes. **Not `clsx`-based** (no new dependency) — a plain `(...values) => values.filter(v => typeof v === 'string' && v.length > 0).join(' ')`; no dedupe/conflict resolution (that's `tailwind-merge`'s job, not needed here since conflicting classes don't arise in this codebase's usage). Replaced the duplicated local `joinClasses`/`.filter(Boolean).join(' ')` idiom across 11 F1.4/F1.5 component files. Avoid `cssInterop` except for third-party components that need `className` (register once in `src/theme/interop.ts` — e.g. `expo-router`'s `Link`, registered at F1.2).
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
- **First real store at F1.6:** `stores/session.ts` — deliberately minimal (`{ permissions: string[]; setPermissions }`), non-persisted, no `persist` middleware. Exists solely so `hooks/useCan.ts` has something to read from now (architecture.md §5's data-flow diagram: "stores/ ◄── read by hooks"). F1.7 expands it to the full shape described above (user, tokens, `requiresOnboarding`, populated from `/auth/me`) without changing `useCan`'s public API (`useCan(alias)` — no change needed at any of its call sites).

## react-hook-form + zod
- `useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues })`.
- Field components accept `control` and `name` and render label, helper, error.
- `applyApiErrors(form.setError, apiError)` maps Zod `errors[].path[0]` to fields.
- Amount fields hold strings in form state; convert with `toDecimal` in `onSubmit`.
- **Confirmed at F1.5:** every field component in `src/components/forms/` is generic over `TFieldValues extends FieldValues` and shares one base prop type, `RHFControlProps<TFieldValues>` (`{ control: Control<TFieldValues>; name: Path<TFieldValues> }`), exported from `FieldShell.tsx` alongside the `FieldShell` component itself (label/helper/error chrome every field composes internally — not used directly by screens). Each field calls `useController({ control, name })` itself (not `<Controller render={...}>`) for cleaner composition. Two fields deliberately deviate from "RHF-bound" (build-plan.md's F1.5 bullet is a loose generalisation): `SearchField` (plain `value`/`onChangeText` — every real use is a live list filter, never a submitted form value) and `SegmentedControl` (plain `value`/`onChange` — used for both local view toggles and GV4's per-row attendance state, neither a single form field).

## axios (src/api/client.ts)
- `baseURL: ${EXPO_PUBLIC_API_URL}/api`, `timeout: 15000`.
- Request interceptor: tenant header from `useTenantStore.getState().current?.subdomain`, bearer from in-memory token cache (loaded from SecureStore at boot), `X-Client: mobile`, `X-App-Version`.
- Response interceptor: 401 → single-flight `refreshSession()` (shared promise) → retry original once (flag `_retry`); refresh failure → `forceSignOut()` (clears tokens, resets `stores/session`+`stores/modules`, toasts). 403 with `error: 'MODULE_DISABLED' | 'FEATURE_DISABLED'` → `useModulesStore.getState().markDisabled(module)`. Always rethrow as `ApiError` (`api/errors.ts`), via `ApiError.fromAxiosError()` for both branches.
- `ApiError` carries `status`, optional `code`/`fieldErrors` (zod issue shape from the API envelope), `isNetwork`/`isTimeout` (no `error.response` at all — distinguishes offline from a slow request via `error.code === 'ECONNABORTED'`).
- `api/envelope.ts`'s `unwrap(responsePromise)` is the one place that reads `{ success, data }`/`{ success: false, message, code }` — callers never touch the envelope shape directly, including the rare 2xx-with-`success:false` edge case.
- **Built at F1.7**, together with `stores/session.ts` (expanded from F1.6's minimal shape to the real session: `user`, `status`, `setUser`/`setStatus`/`reset`) and `stores/tenant.ts`/`stores/modules.ts` (new, MMKV-persisted and in-memory respectively).
- **architecture.md §5's layer-import table doesn't list `stores/modules` as an allowed import for `api/client.ts`** (only `stores/session`+`stores/tenant` are listed), but the same document's own data-flow diagram and this build-plan feature's own bullet (403 MODULE_DISABLED → mark the store) both require it. Treated the table as an incomplete enumeration rather than a hard boundary — `client.ts` imports `stores/modules` directly. Worth tightening the table itself in a future pass, not blocking here.
- Never log request/response bodies for `/auth/*`.

## expo-secure-store
- Keys: `sl.accessToken`, `sl.refreshToken`, `sl.accessExpiresAt`. Options: `{ keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }`.
- Read once at boot into memory (`lib/secure.ts → tokenCache`); writes update both.
- Values > 2 KB are rejected on some Android devices — JWTs fit, but never store user objects here.
- **Built at F1.6** exactly as described: `loadTokenCache()` (call once at boot — not yet wired into `app/_layout.tsx`, that's F1.7's job once there's an actual boot sequence to call it from), `getTokenCache()` (sync, memory-only), `setTokens(partial)`/`clearTokens()` (update both memory and SecureStore). No dedicated test — `expo-secure-store`'s native module isn't mocked under Jest yet (same unmocked-native-module category as `react-native-mmkv`/`react-native-reanimated`'s F1.4/F1.5 gaps); not in F1.6's DoD (only money/dates/permissions needed 100% coverage).

## react-native-mmkv
- One instance `storage = new MMKV({ id: 'societyledger' })` in `lib/storage.ts`. Keys namespaced: `tenant.*`, `prefs.*`, `rq.cache`.
- Not encrypted by default; therefore **no tokens or PII beyond cached own-data** go here. (Optional later: `encryptionKey` from SecureStore.)
- **Built at F1.6:** the instance itself uses `createMMKV({ id: 'societyledger' })` (not `new MMKV(...)` — see this table's main entry on the v4 API change), plus typed helpers (`getString`/`setString`/`getBoolean`/`setBoolean`/`getNumber`/`setNumber`/`getObject`/`setObject` — JSON-serialised — /`remove`). The real method is `remove(key)`, not `delete(key)` (confirmed from the installed `.d.ts` — easy to assume wrong from memory). `ThemeProvider.tsx` (F1.2) now imports this shared instance instead of owning its own.

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
- **First real use at F1.6 is docs links, not Paystack:** `lib/docs.ts`'s `openDocs()` uses the simpler `WebBrowser.openBrowserAsync(url)` (not `openAuthSessionAsync`, which is specifically for auth redirects back into the app) — just opens a page and lets the user close it manually. The Paystack flow above (`openAuthSessionAsync` + `maybeCompleteAuthSession`) is still unbuilt, lands at F2.8.

## @react-native-community/netinfo
- `hooks/useOnline.ts` (F1.6): `NetInfo.fetch()` once on mount (resolves almost immediately) + `NetInfo.addEventListener` for subsequent changes, both setting the same boolean state. Treats `state.isConnected !== false` as online (so a `null`/initial state before the first real reading defaults to online, not offline) — starts the hook's own state at `true` for the same reason, avoiding an offline-banner flash on cold start.

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
- **Confirmed at F1.5 (`FileAttachField` built — image-picker/document-picker only; file-system/sharing/print not installed yet, no upload/download exists before F1.7/F2.6):** `ImagePicker.requestCameraPermissionsAsync()`/`requestMediaLibraryPermissionsAsync()` before `launchCameraAsync`/`launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })` (SDK 58's `mediaTypes` takes an array of strings, not the old `MediaTypeOptions` enum). `DocumentPicker.getDocumentAsync({ type: allowedTypes, copyToCacheDirectory: true })` for Files. The max-2000px resize is **not implemented** — `expo-image-manipulator` is still not pinned (this row's own "if needed" already allowed deferring it); `quality: 0.7` alone is the only compression applied so far.

**F6.7 (owner-approved, 2026-10-29): `expo-file-system ~58.0.11` and `expo-sharing ~58.0.20` are installed. `expo-print` is still not** — the server already makes the PDFs and Excel files, so the phone only downloads and shares them.
- Download with the existing axios `client` (`responseType: 'arraybuffer'`), so the access token, tenant header and refresh all apply, then write the bytes with the new File API: `new File(Paths.cache, safeFilename(name))`, `file.create()`, `await file.write(new Uint8Array(bytes))`, then `Sharing.shareAsync(file.uri, { mimeType, dialogTitle })`. Check `Sharing.isAvailableAsync()` first. Code: `src/features/reports/share.ts`.
- Files go in the **cache** directory, which the system clears when it needs space; nothing is kept for ever, and a file is downloaded again the next time it is shared. File names pass through `safeFilename` (letters, numbers, dots, dashes; no leading dots).
- `expo-sharing` is added to `plugins` in `app.config.ts`. An expired export answers `410 EXPORT_EXPIRED` and is shown as Expired.
- Not covered by Jest (native modules); the helper is tiny and the pure parts (`safeFilename`, `isExpired`, `fileSizeLabel`) are tested.

## expo-image
- `<Image source={{ uri }} contentFit="cover" transition={150} placeholder={blurhash?} />`; association logos `contentFit="contain"`.
- Relative upload paths resolved with `resolveAssetUrl(path)` (prefix API origin).

## expo-clipboard
- `Clipboard.setStringAsync(value)` (async — `await` it). **Confirmed at F2.2:** A12's only real use so far (copying `admin.societyledger.com.ng` for platform staff) — a plain string copy, no `Clipboard.getStringAsync()` read anywhere yet.

## @shopify/flash-list
- **Installed at F5.2 (2026-10-24): `@shopify/flash-list` 2.3.2** (owner-approved; `expo install`). **v2 sizes rows itself — do not pass `estimatedItemSize`** (v1 only). `components/layout/ListSeparator` was never built: rows that need to read as one group draw their own edges and hairline (see `MemberRow`'s `position` prop). Use `ListEmptyComponent` = `EmptyState`; footer spinner when `isFetchingNextPage`; `onEndReached` guarded by `hasNextPage && !isFetchingNextPage`.
- Put anything that holds focus (a `SearchField`) **outside** the list, not in `ListHeaderComponent` as an inline function — it would remount and drop focus on every render. A header *element* (stats tiles) is fine.
- Under Jest, a file that imports `@gorhom/bottom-sheet` (even transitively) can't load — keep pure helpers out of sheet files so they stay testable (`countActiveFilters` lives in `features/members/labels.ts` for that reason).

## @gorhom/bottom-sheet
- `BottomSheetModalProvider` at root. Wrapper `components/ui/BottomSheet.tsx` with snap points `['50%','90%']` default, backdrop, dynamic sizing for short content, keyboard handling `keyboardBehavior="interactive"`.
- Use for: filters, pickers (`SelectSheet`), confirmations (`ConfirmSheet`), quick actions.
- **Confirmed/built at F1.5:** `BottomSheet` is a `forwardRef<BottomSheetModal, BottomSheetProps>` — callers own a `useRef<BottomSheetModal>` and call `.present()`/`.dismiss()` themselves (no imperative wrapper hook built). `ConfirmSheet` forwards its own ref to an internal one via `useImperativeHandle` so it can both expose `.present()`/`.dismiss()` to the caller **and** use the same ref internally for its "Keep it" button. `BottomSheetModalProvider` needs `GestureHandlerRootView` as an ancestor (also newly wired at the app root this feature — `react-native-gesture-handler` was a dependency since F1.1 but nothing had required the root wrapper before). `enableDynamicSizing` is passed alongside fixed `snapPoints` (gorhom v5 supports both together) — not independently verified against a real long-content sheet yet, since nothing has used `SelectSheet`/`FileAttachField` on a real screen through F1.5.

## react-native-gifted-charts
(Replaces the originally planned victory-native, which was never installed.)
- Used by the Home and Finance chart components in `features/home/components` and `features/finance/components`; keep any new chart behind a small component that takes plain data. (`LineChart`, `BarChart`, `DonutChart`, `StackedBarChart`, `ProgressRing`) which take plain data + token-derived colours from `useThemeTokens().chart`.
- Data arrays converted from Decimal to number **only** inside chart wrappers (display precision acceptable).
- Charts have an accessible text summary (`accessibilityLabel`) and a "View as list" fallback for screen readers.

## lucide-react-native
- Named imports (`import { Wallet } from 'lucide-react-native'`). Default `size={20}` (`iconSize.md`), `strokeWidth={1.75}`. Colour from tokens.
- Icon map for domains lives in `components/ui/icons.ts` (e.g. `dues → Receipt`, `levy → Megaphone`, `donation → HandHeart`, `penalty → AlertTriangle`, `savings → PiggyBank`, `loan → Landmark`, `meeting → CalendarDays`, `vote → Vote`, `welfare → HeartHandshake`).

## sonner-native
- `<Toaster />` in root layout under safe area. Use `toast.success(t(...))`, `toast.error(message)`. Max 1 visible; duration 3 s (errors 5 s). Undo actions (delete transaction) use `toast(…, { action: { label: t('common.undo'), onClick } })`.
- **Confirmed at F1.5:** named exports only — `import { Toaster, toast } from 'sonner-native'` (no default export). `<Toaster />` mounted in `app/_layout.tsx` inside `RootNavigator`, alongside the `Stack`. `t()` doesn't exist yet (`lib/i18n.ts` is F1.6) — the gallery's demo call is a plain string (`toast.success('Form validated')`); swap to `t(...)` once i18n lands.

## @react-native-community/datetimepicker
- Pinned at F1.5 (owner-approved, §"Library | Purpose | Pinned version" table above — no picker was documented anywhere before this feature).
- `DateField` (`src/components/forms/DateField.tsx`) branches by platform: **Android** renders `<DateTimePicker>` only while `open` is true, and dismisses on `event.type === 'set' | 'dismissed'` (the library's own imperative-dialog behaviour — it shows a system dialog and fires `onChange` once, no wrapping `Modal` needed). **iOS** wraps it in a plain `Modal` (`transparent`, `animationType="slide"`) with a "Done" button and `display="spinner"`, since the native iOS picker is inline, not its own dismissible dialog.
- Form value is an ISO string (`date.toISOString()`). **Updated at F1.6:** display formatting now goes through the real `lib/dates.ts → formatDate(iso, 'long')` instead of the temporary module-level `Intl.DateTimeFormat` F1.5 used while `date-fns` wasn't installed yet — absorbed the same way `Money`'s temporary decimal helpers were.

## date-fns
- Import functions individually. All formatting through `lib/dates.ts`. Relative times (`formatDistanceToNowStrict`) for notifications; absolute for money records.
- **Built at F1.6:** `formatDate(iso, variant)` covers the 5 variants code-standards.md §11 names — `short` ("Tue 14 Oct"), `long` ("14 Oct 2026"), `time` ("3:30 PM"), `monthYear` ("October 2026"), `relative` (`formatDistanceToNowStrict({ addSuffix: true })` — e.g. "5 minutes ago"/"in 5 minutes"; ui-rules.md §7's own "5 min ago" example is informal prose, not a literal abbreviation to reproduce). No built-in "Today, 3:30 PM" variant — that's `isToday(iso) ? \`Today, ${formatDate(iso, 'time')}\` : formatDate(iso, 'short')`, composed by the caller; `lib/dates.ts` exports `isToday()` for exactly this. No `date-fns-tz` — this machine's (and real users') local timezone is already `Africa/Lagos` (confirmed via `Intl.DateTimeFormat().resolvedOptions().timeZone`; Nigeria has no DST), so plain local-time formatting already matches; revisit only if a real cross-timezone case surfaces.

## decimal.js-light
- `lib/money.ts` re-exports a configured `Decimal` (precision 20, ROUND_HALF_UP). Comparisons with `.gt/.lt/.isZero`; sums with `Decimal.sum` helper `sumMoney(values)`.
- **Correction at F1.6:** there is no static `Decimal.sum(...)` on `decimal.js-light` (confirmed from its `.d.ts` — that's a full `decimal.js` method, not present on the "light" build). `sumMoney()` instead reduces manually: `values.reduce((total, v) => total.plus(toDecimal(v)), new Decimal(0))` — same result, no new API surface needed.

## @sentry/react-native
- Init in `app/_layout.tsx` when DSN present; `enableAutoSessionTracking`, `tracesSampleRate: 0.2` (prod), environment = APP_VARIANT, release = app version + build.
- `beforeSend` / `beforeBreadcrumb` scrub `authorization`, `refreshToken`, `token`, `password`, `email`, `phone`.
- Set user context to `{ id: user.id, association: tenant.subdomain }` only.

## expo-updates / EAS
- Channels: `development`, `preview`, `production`. `runtimeVersion: { policy: 'fingerprint' }`.
- Check for updates on app foreground (max once per hour), download silently, apply on next cold start; About screen has manual "Check for updates".
- Native dependency changes require a new build (fingerprint changes) — never ship them via OTA.

## Testing stack
- `jest-expo` preset; `@testing-library/react-native`. **Corrected at F2.2** — this line previously claimed a `renderWithProviders()` helper wrapping QueryClient + theme + safe area + bottom sheet; no such helper was ever actually built. What exists (built at F2.2, first real `@tanstack/react-query` hook tests): `src/test-utils/renderWithProviders.tsx`'s `renderHookWithQueryClient()` — **QueryClient only**. A fresh `QueryClient` per test is required, not a shared one (a reused client leaves its own retry/gc timers running past the test that created it — Jest's "did not exit one second after the test run has completed" warning). Deliberately **not** theme/safe-area/bottom-sheet-wrapped: `ThemeProvider` goes through NativeWind's `useColorScheme`, which hits the exact same `react-native-css-interop` web-runtime crash already blocking icon-rendering components under Jest (see this section's `lucide-react-native` entry) — adding it untested would extend that crash to every caller. Build that version when a feature actually needs to RTL-render a themed component, not speculatively.
- **`axios-mock-adapter`, not `msw`, for mocking HTTP in tests — corrected at F1.7.** `msw` was the originally documented tool; confirmed unusable in this project after real debugging, not assumption: `msw@3.x` has no `msw/native` export at all (checked `package.json#exports`), and its entire dependency tree (`@mswjs/*`, `rettime`, `outvariant`, `until-async`, `is-node-process`, `headers-polyfill`, `@open-draft`, `cookie`, `type-fest`) is ESM-only, requiring the same `transformIgnorePatterns` treatment as `lucide-react-native` just to import. Even after fixing imports, `msw/node`'s `setupServer` never actually intercepted axios requests under `jest-expo`: a spike test showed `typeof XMLHttpRequest === 'undefined'` and `typeof window === 'object'` (truthy, no `document`) in this environment, so axios auto-selects its `fetch` adapter — but axios itself resolves to its **browser build** (`axios/dist/browser/axios.cjs`) under `jest-expo`, which has no `'http'` adapter to force either (`{ adapter: 'http' }` fails with "adapter http is not available in the build"). `msw` intercepts at the `XMLHttpRequest`/`fetch`/Node-`http` layer, none of which line up with what's actually available here. **Resolution:** `axios-mock-adapter` instead — it wraps the `axios` *instance* directly (`new MockAdapter(client)`), so it works regardless of which underlying transport axios would have picked. Verified working via `src/api/client.test.ts`'s 6 tests (single-flight refresh, sign-out on refresh failure, `MODULE_DISABLED`/`FEATURE_DISABLED` → store, no-retry-on-429, tokens never logged). `msw` has been uninstalled; `jest.config.js` has no msw-specific entries (reverted back to just the F1.4 `lucide-react-native` fix). Handlers per API module still live in `__mocks__/handlers/`, just built with `MockAdapter` instead of `msw`'s `http.get(...)` style.
- Maestro flows in `e2e/*.yaml` run against preview builds with a seeded staging association.
- **`render()` (and `renderHook()`) are `async` in `@testing-library/react-native@14.1.0`** (confirmed at F1.4/F1.7 by reading `dist/render.js`/`dist/render-hook.js` — a breaking change from the v12/v13 generation most tutorials/muscle-memory still assume). Every `render(...)`/`renderHook(...)` call must be `await`ed (and its test `async`) — otherwise `screen.getByX(...)` immediately after throws `` `render` function has not been called `` (testing-library's own screen-not-yet-set guard), and destructuring `{ result }` from an un-awaited `renderHook(...)` returns `result: undefined` (so `result.current` throws `Cannot read properties of undefined`) — both read like setup/wiring bugs rather than a missing `await`. First hit (and fixed) in F1.4's `Button.test.tsx`/`Money.test.tsx`/`StatusChip.test.tsx`; `renderHook`'s own version hit again and fixed at F1.7's `useCan.test.tsx`.
- **Jest config lives in `jest.config.js`, not `package.json`'s `"jest"` key** (migrated at F1.4) — it needs to run real JS (`require('jest-expo/jest-preset')`) to extend the preset's computed `transform`/`transformIgnorePatterns` rather than hand-copy a regex that would silently drift from jest-expo's own. Two things it fixes, both found by F1.4's first use of `lucide-react-native`: (1) `transformIgnorePatterns`' base entry didn't allow `lucide-react-native` through (its `.mjs` build was left as raw ESM for Node's own `require`, which throws); (2) the babel-jest transform key was `\.[jt]sx?$`, which doesn't match `.mjs` at all — renamed to `\.m?[jt]sx?$`, reusing jest-expo's own computed babel-jest path/options. **Still broken, not fixed:** actually *rendering* a component that uses any `lucide-react-native` icon throws from inside `react-native-css-interop`'s web runtime (`Cannot read properties of undefined (reading 'documentElement')`) — jest-expo's test environment defines a truthy `window` with no `document`, so css-interop's web-vs-native detection (a `typeof window` check) picks the wrong runtime. `react-native-reanimated/jest/resolver` "fixes" reanimated's own equivalent native-module gap but is too broad to use as a blanket fix (it replaces Jest's resolver project-wide); reverted. Full detail in `ui-registry.md`'s "Dev tooling & known gaps (F1.4)" — root-cause before any future feature needs to RTL-test an icon-rendering component.
- **This machine's (and Jest's) local timezone is `Africa/Lagos` (UTC+1, confirmed at F1.6 via `Intl.DateTimeFormat().resolvedOptions().timeZone`)** — convenient for matching real users, but a trap for date-boundary test fixtures: a UTC timestamp like `23:00` the "day before" is already local midnight of the *next* day. `lib/dates.test.ts` hit this directly (an `isToday()` "yesterday" fixture at `23:00 UTC` was actually local-today) — keep boundary-test fixtures several hours clear of midnight in either direction, not just technically on the correct calendar day in UTC.
- **RN's own generated `.d.ts` types are sometimes looser than the real runtime values** — `AppState.currentState` is typed `string | null | undefined`, not narrowed to the exported `AppStateStatus` union, so `hooks/useAppState.ts`'s initial-state line needs an explicit `as AppStateStatus` cast. Found at F1.6; worth checking any other RN core API's type before trusting it matches its own documented union.
- **`expo-linking`'s `Linking.parse()` reads `expo-constants` even for a plain parse call, and crashes under Jest's default auto-mock** (found at F1.8, `lib/linking.test.ts`): `parse()` → `getHostUri()` → `hasCustomScheme()` checks `Constants.executionEnvironment`; jest-expo's auto-mock leaves that `undefined`, which falls through to a branch that calls `.replace()` on `Constants.linkingUri` (also `undefined`) and throws `Cannot read properties of undefined (reading 'replace')`. Fix: `jest.mock('expo-constants', () => ({ default: { executionEnvironment: 'bare', expoConfig: { scheme: '...' } }, ExecutionEnvironment: { Bare: 'bare', ... } }))` in the test file — `'bare'` matches how this app always ships (a custom scheme, never the Expo Go store client), short-circuiting the branch that would otherwise reach the crashing code path.

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

---

## Thrift (Ajo) add-on — services it uses

- **Paystack:** used only for the Ajo add-on **subscription**, through the existing billing code. The Ajo module does not call Paystack for contribution money (contributions go to the group's own bank account and are recorded here).
- **SMS:** reuse the existing SMS integration and credit system for receipts, reminders and the optional phone confirmation. Contribution receipts must not fail silently when credits run out: queue them and alert the group admin.
- **Storage:** transfer proofs use the existing private storage and signed links (same pattern as member photos and payment proofs).
- **No identity-verification, KYC, escrow or payout provider is used or planned** (owner decision, 2026-10-27).
