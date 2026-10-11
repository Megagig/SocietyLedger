# Code Standards — SocietyLedger Mobile & Docs

> How code is written in `apps/mobile` (§1–§16) and how code **and content** are written in `apps/docs` (§17–§19). Consistency beats cleverness. When this file and an existing pattern disagree, this file wins — fix the pattern.

---

## 1. Language & TypeScript
- TypeScript everywhere (`.ts` / `.tsx`). `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes: false`.
- No `any`. Use `unknown` + narrowing. If unavoidable: `// TODO(type): reason` on the same line.
- Prefer `type` aliases for props, unions and DTOs; `interface` only when declaration merging is needed (never, in practice).
- No enums (`enum`). Use string-literal unions and `as const` objects (`src/types/api/enums.ts`).
- No non-null assertions (`!`) except in tests.
- Exhaustive `switch` on unions with a `never` check helper `assertNever(x)`.
- Path alias `@/` → `src/`. No deep relative imports (`../../..`) across folders; relative imports only within the same feature/component folder.

## 2. Naming
| Thing | Convention | Example |
|---|---|---|
| Route files (Expo Router) | kebab-case, dynamic in brackets | `forgot-password.tsx`, `[id].tsx` |
| Components | PascalCase file = component name | `BalanceCard.tsx` exports `BalanceCard` |
| Hooks | `use` + camelCase, file same name | `useMemberOutstanding` in `queries.ts` or `useCan.ts` |
| Utilities | camelCase files, named exports | `money.ts` → `formatMoney`, `toDecimal` |
| Stores | camelCase file, `use<Name>Store` | `session.ts` → `useSessionStore` |
| API endpoint modules | camelCase domain + `Api` object | `memberFinance.ts` → `export const memberFinanceApi = { getSummary, getOutstanding }` |
| Query keys | `<domain>Keys` factory | `memberFinanceKeys.outstanding(tenant)` |
| Types | PascalCase; DTO suffix for raw API shapes | `OutstandingItemDTO` (raw) → `OutstandingItem` (normalised) |
| Zod schemas | camelCase + `Schema` | `paymentProofSchema` |
| Form value types | `<Name>FormValues` | `PaymentProofFormValues` |
| Booleans | `is/has/can/should` prefix | `isOverdue`, `canVerify` |
| Event handlers (props) | `on<Event>`; implementations `handle<Event>` | `onPress={handlePay}` |
| Constants | `SCREAMING_SNAKE_CASE` for true constants | `MAX_RECENT_ASSOCIATIONS = 5` |
| Test files | co-located `*.test.ts(x)` | `money.test.ts` |
| i18n keys | `domain.screen.element` | `money.pay.submitButton` |

## 3. File & folder rules
- One component per file (small private sub-components in the same file are fine if < 30 lines and not reused).
- Feature folder layout is fixed (architecture.md §4): `queries.ts`, `mutations.ts`, `schemas.ts`, `types.ts`, `components/`. Create only the files you need.
- Feature names (folder under `src/features/`): `auth`, `tenant`, `session`, `home`, `memberFinance`, `memberLedger`, `payments` (Paystack + proofs), `notifications`, `profile`, `meetings`, `voting`, `polls`, `welfare`, `cooperatives`, `help`, `support`, `members`, `finance`, `financeAdvanced`, `nigerianPayments`, `accounting`, `reports`, `exports`, `communication`, `ai`, `settings`, `rbac`, `onboarding`, `dashboard`.
- A route file should rarely exceed ~120 lines. If it does, extract feature components.
- No barrel `index.ts` files inside features (they hurt Metro tree-shaking and create cycles). `src/components/ui/index.ts` is the single allowed barrel.

## 4. Route screen structure
```tsx
// app/(app)/(tabs)/money/pay/index.tsx
import { Stack, router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { OutstandingList } from '@/features/memberFinance/components/OutstandingList';
import { useMemberOutstanding } from '@/features/memberFinance/queries';
import { t } from '@/lib/i18n';

export default function PayScreen() {
  const query = useMemberOutstanding();

  return (
    <Screen scroll={false} refreshing={query.isRefetching} onRefresh={query.refetch}>
      <Stack.Screen options={{ title: t('money.pay.title') }} />
      <QueryBoundary query={query} empty={{ title: t('money.pay.emptyTitle'), icon: 'check-circle' }}>
        {(items) => <OutstandingList items={items} onContinue={(ids) => router.push({ pathname: '/money/pay/online', params: { ids: ids.join(',') } })} />}
      </QueryBoundary>
    </Screen>
  );
}
```
Rules:
- Default export only for route files (Expo Router requirement); **named exports everywhere else**.
- Screen title set via `<Stack.Screen options>` inside the screen.
- Route params read with `useLocalSearchParams<{ id: string }>()` and validated with zod before use (`parseParams(schema, params)`).
- Navigation with typed routes (`expo-router` typed routes enabled). No string concatenation for paths; use `{ pathname, params }`.

## 5. Component structure
```tsx
// src/features/memberFinance/components/BalanceCard.tsx
import { View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Money } from '@/components/ui/Money';
import { Button } from '@/components/ui/Button';
import type { FinanceSummary } from '../types';
import { t } from '@/lib/i18n';

type BalanceCardProps = {
  summary: FinanceSummary;
  onPay: () => void;
  canPay: boolean;
};

export function BalanceCard({ summary, onPay, canPay }: BalanceCardProps) {
  const isClear = summary.outstanding.isZero();

  return (
    <Card variant="hero">
      <Text variant="label" tone="onHeroMuted">{t('home.balance.label')}</Text>
      <Money value={summary.outstanding} size="display" tone="onHero" />
      {summary.nextDueDate ? (
        <Text variant="caption" tone="onHeroMuted">{t('home.balance.nextDue', { date: summary.nextDueDate })}</Text>
      ) : null}
      {canPay && !isClear ? (
        <View className="mt-4">
          <Button variant="onHero" onPress={onPay}>{t('home.balance.pay')}</Button>
        </View>
      ) : null}
    </Card>
  );
}
```
Order inside a component file: imports → types → constants → component → private helpers. Inside the component: hooks → derived values → handlers → early returns → JSX.

- Function components only, `function` declarations (not arrow consts) for components.
- Props typed with a `<Name>Props` type; destructure in the signature. No `React.FC`.
- Conditional rendering with ternary `? … : null` (never `&&` with numbers).
- No inline anonymous components; memoise only when profiling shows a need (FlashList `renderItem` should be a stable callback).
- Styling via NativeWind `className` using token-backed classes only (see `ui-rules.md`). `style` prop allowed only for dynamic numeric values (animation, measured layout) and must use tokens from `@/theme/tokens`.
- Icons: `lucide-react-native`, imported individually; size from `iconSize` token, colour via `useThemeColor('iconSecondary')` or `className` with `color-` utilities.

## 6. Data fetching (TanStack Query)
```ts
// src/features/memberFinance/queries.ts
import { useQuery } from '@tanstack/react-query';
import { memberFinanceApi } from '@/api/endpoints/memberFinance';
import { useTenantKey } from '@/hooks/useTenantKey';

export const memberFinanceKeys = {
  all: (tenant: string) => [tenant, 'memberFinance'] as const,
  summary: (tenant: string) => [...memberFinanceKeys.all(tenant), 'summary'] as const,
  outstanding: (tenant: string) => [...memberFinanceKeys.all(tenant), 'outstanding'] as const,
};

export function useMemberOutstanding() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberFinanceKeys.outstanding(tenant),
    queryFn: memberFinanceApi.getOutstanding,
  });
}
```
- Every query key starts with the tenant subdomain via a `<domain>Keys` factory. No inline array keys in components.
- Endpoint functions return **normalised** types (money → Decimal, lists → `{ items, pagination }`).
- Mutations live in `mutations.ts`, invalidate precisely (use key factories), show success toast via `onSuccess`, and map field errors via `onError` → `applyApiErrors(form, error)`.
- Optimistic updates only where specified (attendance marking, mark-as-read); always implement rollback.
- `select` for derived data; never copy query data into Zustand.
- Lists: `useInfiniteQuery` + `FlashList` + `onEndReached` with `hasNextPage && !isFetchingNextPage` guard.

## 7. API layer
```ts
// src/api/endpoints/memberFinance.ts
import { client } from '../client';
import { unwrap } from '../envelope';
import type { OutstandingItemDTO } from '@/types/api/memberFinance';
import { toDecimal } from '@/lib/money';

export const memberFinanceApi = {
  async getOutstanding() {
    const data = await unwrap<{ items: OutstandingItemDTO[] }>(client.get('/members/me/outstanding'));
    return data.items.map((i) => ({ ...i, amount: toDecimal(i.amount), balance: toDecimal(i.balance) }));
  },
};
```
- One object per API module, methods named `get…`, `list…`, `create…`, `update…`, `delete…`, or the domain verb (`verify`, `approve`, `disburse`, `vote`).
- Paths are relative to `/api` (client baseURL includes `/api`).
- Each endpoint has a JSDoc line with the HTTP method + path + controller file it was verified against:
  `/** GET /members/me/outstanding — verified against member-finance.controller.ts getOutstanding (2026-10-12) */`
- Multipart uploads via `lib/files.ts → buildFormData()`; never set `Content-Type` manually for FormData.

## 8. Forms
- `react-hook-form` + `zodResolver`. Schema in feature `schemas.ts`; reuse `packages/shared` validators where the API uses the same schema.
- Use `components/forms/*` field components with `control` + `name`; never wire `TextInput` directly in screens.
- Submit button: `loading={mutation.isPending}`, disabled when offline or `!formState.isValid` only after first submit attempt (`mode: 'onTouched'`).
- Server validation errors (`errors[]` Zod issues) mapped to fields by `path`; others → toast/ErrorState.
- Keyboard: `KeyboardAvoidingView` handled by `Screen keyboard` prop; `returnKeyType` chains fields; amount fields use `keyboardType="decimal-pad"`.

## 9. State (Zustand)
- Stores hold **client state only**: session (user, permissions, auth status), tenant (current + recent), modules (disabled set), prefs (theme, biometrics, autoLock).
- Shape: state + actions in one `create()`; selectors used at call sites (`useSessionStore((s) => s.user)`), never the whole store.
- Persist with MMKV via `persist` middleware **only** for tenant and prefs. Session user can be rehydrated from the persisted query cache, not from Zustand.
- No async API calls inside stores.

## 10. Error handling
- `ApiError` (src/api/errors.ts): `{ status, code?, message, fieldErrors?, isNetwork, isTimeout }`. All thrown API errors are `ApiError`.
- Screens: `QueryBoundary` decides between `ErrorState`, `ModuleLocked`, `SubscriptionInactive`, `NoPermission`, `OfflineBanner` based on `ApiError`.
- Mutations: user-facing toast with `error.message` from API when safe (it's written for users), otherwise generic `t('errors.generic')`.
- Never swallow errors silently. `catch` blocks either handle (with UI feedback) or rethrow. Background failures (push registration, analytics) log to Sentry with `level: 'warning'`.
- Global: `ErrorBoundary` at root (`app/_layout.tsx`, Expo Router `ErrorBoundary` export) with "Restart app" (`Updates.reloadAsync`).
- `console.log` forbidden in committed code (ESLint `no-console` error); use `lib/logger.ts` (dev console, prod Sentry breadcrumbs, PII-scrubbed).

## 11. Money, dates, numbers
- `toDecimal(v: string | number | null | undefined): Decimal` at the API boundary; `formatMoney(d, { currency = 'NGN', compact? })` for display → `₦25,000.00` (compact: `₦25k`, `₦1.2m`).
- Sending amounts: `decimal.toNumber()` only when the API schema is `z.number()` (verify), else string.
- Dates: store/pass ISO strings; format via `formatDate(iso, 'short' | 'long' | 'relative' | 'time' | 'monthYear')`. Default zone `Africa/Lagos` for display of server dates without a time component.
- Percentages: `formatPercent(0.873) → "87.3%"` (1 decimal).

## 12. Accessibility
- Every `Pressable`/`IconButton` without visible text has `accessibilityLabel` (via `t()`) and `accessibilityRole`.
- Respect `allowFontScaling` (default true); layouts must survive 1.3× scale; cap at `maxFontSizeMultiplier={1.6}` for dense data rows only.
- Status is never conveyed by colour alone — chips include text, charts include labels.
- `useReducedMotion()` disables non-essential animations.

## 13. Testing
- Unit: all `lib/*` pure functions (money, dates, permissions, linking, push routing map).
- Component: RTL for UI kit primitives with variants, and for key feature components (BalanceCard, OutstandingList, Ballot).
- Integration: msw-mocked screen tests for the critical flows (login error routing, pay flow, proof submit, vote).
- E2E: Maestro YAML under `e2e/` (Phase 9).
- Test names: `it('shows ModuleLocked when API returns MODULE_DISABLED')`.
- No snapshot tests of whole screens (brittle); targeted snapshots of primitives only.

## 14. Git & commits
- Conventional commits scoped by app: `feat(mobile):`, `fix(mobile):`, `feat(api):`, `chore(mobile):`, `test(mobile):`, `docs(context):`.
- One feature (F-number) per branch: `feature/mobile-F2.8-paystack`.
- Context file updates committed together with the feature that caused them.

## 15. Performance rules
- FlashList for any list that can exceed 20 rows; `keyExtractor` stable ids.
- Images: `expo-image` with explicit size and `contentFit`; logos requested at needed size if the API supports it.
- Avoid re-renders: select narrow store slices; stable callbacks for list items.
- No heavy work on mount of tab roots; defer non-critical queries with `enabled` after first paint.

## 16. Security rules (code level)
- Never put secrets in `EXPO_PUBLIC_*` (they ship in the bundle). Paystack **public** key only if ever needed; secret keys never.
- Validate all deep-link and push `data` payloads with zod before routing.
- Open external URLs only via `Linking.openURL` after allow-listing schemes (`https`, `tel`, `mailto`, `whatsapp`, `geo`/maps).
- Files downloaded to `FileSystem.cacheDirectory`, deleted after sharing.

---

## 17. Docs content standards (`apps/docs/content/docs/**`)

### 17.1 Voice & style
- Address the reader as **you**; plain, friendly, direct; short sentences (aim ≤ 20 words); active voice.
- Organise by **goal**, not by screen: "Recording a payment a member made", not "Payment form".
- Titles: sentence case, task pages start with a gerund ("Adding a member"), concept pages are nouns or questions ("How money is tracked").
- UI labels in **bold**, exactly as they appear in the app (copy from source, including capitalisation): click **Save member**.
- Menu paths with the `MenuPath` component (renders arrows): `<MenuPath items={["Finance", "Levies", "New campaign"]} />` → **Finance → Levies → New campaign**. Web and mobile paths differ — use `PlatformTabs` when both exist.
- Use "select" for web and mobile alike (not "click"/"tap") unless the gesture matters ("swipe left on a notification").
- Money in examples: `₦25,000` (no decimals in prose unless relevant); dates `14 October 2026`; Nigerian-style fictional names (Adaeze Okafor, Tunde Bakare, Ngozi Eze, Musa Ibrahim) — never real people.
- Say what happens, not what the system "does internally": "The member's balance drops to ₦10,000", not "a ledger entry is created".
- One idea per paragraph; paragraphs ≤ 4 lines; no walls of text.
- No marketing language ("powerful", "seamless", "simply"); no "please"; no exclamation marks.
- Don't promise future features. Don't mention internal names (Prisma, controllers, endpoints, env vars).
- Accessibility: every image has `alt` describing what the screenshot shows; link text says where it goes (never "click here").

### 17.2 File & naming rules
- One page = one `.mdx` file; file name = slug in kebab-case, ≤ 5 words, no dates or IDs (`verifying-payment-proofs.mdx`).
- Section folders match `project-overview.md §9.6` slugs exactly. Never rename a published file without adding a redirect (`public/_redirects`).
- Images: `public/images/<section>/<page-slug>-<n>.webp` and `-<n>-dark.webp`; diagrams `public/diagrams/<name>.svg`.
- Frontmatter fields and order exactly as `architecture.md §14.3`.

### 17.3 Page templates
**Task page**
```mdx
---
(frontmatter)
---

One sentence on what this page helps you do and why.

## Before you start
- You need the **<plain-language permission>** permission. <PermissionNote> renders automatically from frontmatter; add prerequisites here (e.g. "Add at least one bank account first — see [Adding your association's bank accounts](/docs/payments/association-bank-accounts).")

## <Goal-phrased heading, e.g. "Verify a payment proof">
<Steps>
<Step>Go to <MenuPath items={["Payments", "Verification"]} />.</Step>
<Step>Select the proof you want to check. The receipt opens on the right.</Step>
<Step>Compare the amount and date with your bank statement, then select **Verify payment**.</Step>
</Steps>

<Screenshot src="/images/payments/verifying-payment-proofs-1.webp" alt="Payment proof detail showing the receipt image and the Verify payment and Reject buttons" markers={[{ n: 1, x: 72, y: 88 }]} />

## What happens next
The member gets a notification, the payment is applied to their oldest unpaid charge, and their balance updates.

## If something looks wrong
(Common problems with fixes — optional)

## Related
(rendered from frontmatter `related`)
```

**Concept page:** intro (what it is in one sentence) → "How it works" with a worked example (table of amounts) and/or `Diagram` → "Why it matters" → "What you can do" (links to task pages).

**Reference page:** one-line purpose → table(s) → notes. Generated pages start with `{/* GENERATED by scripts/gen-reference.ts — do not edit */}`.

**FAQ page:** each question is an H2 phrased as the reader asks it ("Why can't I see the Finance menu?"), answer ≤ 4 sentences, ending with a link to the task/concept page.

**Overview (section index):** 2–3 sentences on what the section covers and who it's for → "Start here" (2–3 `CardGrid` cards) → all pages (auto `CardGrid`) → link to the section FAQ.

### 17.4 Components in MDX
- Only components registered in `mdx-components.tsx` and listed in `ui-registry.md` (Docs section). No raw HTML, inline styles, or `<img>`.
- `Callout` types: `note` (extra context), `tip` (shortcut/good practice), `warning` (can cause confusion or extra work), `danger` (irreversible/money-affecting). Max 2 callouts per page; never stack two.
- `RoleTabs` only when the same page genuinely differs by role (e.g. member vs treasurer view of a payment); `PlatformTabs` only when web and mobile steps differ.
- Headings: H2 for main parts, H3 sparingly; never skip levels; no H1 in body (title comes from frontmatter).
- Tables for comparisons and reference; ≤ 5 columns in task/concept pages.
- Code blocks are almost never needed (this is a user manual); when used (e.g. a CSV import template), use fenced blocks with a language.

### 17.5 Accuracy workflow (per page)
1. Read the `covers` sources (route page component, its child components, the API controller for limits/validation rules).
2. Perform the task on staging as the right demo role.
3. Write, capture screenshots, set `lastVerified`.
4. Self-review against the template and §17.1; run `check:frontmatter` and `check:links`.
5. Questions you couldn't resolve: `{/* QUESTION: … */}` in MDX + `status: review` + row in `progress-tracker.md` → Docs questions.

## 18. Docs code standards (`apps/docs` components & scripts)
- Same TypeScript rules as §1 (strict, no `any`, named exports except Next.js route files).
- Components in `components/mdx/` are presentational, typed props, server components by default; add `'use client'` only for interactive ones (Tabs, Screenshot zoom, Feedback, search).
- Styling: Tailwind classes mapped to docs tokens (`ui-tokens.md §14`); `cn()` helper; no hex values.
- Content-derived data (page tree, frontmatter) only through `lib/source.ts`; never read the filesystem from components.
- Scripts (`scripts/*.ts`) run with `tsx`, are idempotent, print a summary, and exit non-zero on failure (used in CI).
- Generated files are committed and carry the "GENERATED" header.
- Commit scopes: `docs(site): …` for content, `feat(docs): …` for site features/components, `chore(docs): …` for tooling. Branch per feature: `feature/docs-D3.3-finance`.

## 19. Web changes for docs links (`apps/web`, D6.3)
- Follow the existing web conventions (Mantine + Tailwind, `@/` paths, Next 14 App Router); no refactors outside the files listed in `architecture.md §15.3`.
- External docs links open in a new tab with `rel="noopener"` and an external-link icon; label "User manual" / "Help for this page".
- `HelpLink` reads its target from `DOCS_LINKS` (`packages/shared`), renders nothing if the route has no mapping.
