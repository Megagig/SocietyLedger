# UI Registry — SocietyLedger Mobile, Docs & Admin

> **Living document. Starts empty.** Covers four surfaces: the **mobile app** (`apps/mobile`), the **docs site** (`apps/docs`), the **admin console** (`apps/admin`), and the few **web** components added for docs links and the impersonation exchange (`apps/web`). Every reusable component, once built, gets an entry here (by the imprint step at the end of each feature). Before creating any component, search this file — if something close exists, extend it with a variant instead of building a new one.

## How to add an entry
Add the component under its category, in this exact format:

```md
### ComponentName
- **Surface:** mobile | docs | admin | web
- **Path:** `src/components/ui/ComponentName.tsx`
- **Added / changed:** F1.4 (2026-10-14) · F2.5 (2026-10-20: added `size="display"`)
- **Purpose:** one sentence.
- **Props:** `variant: 'primary' | 'secondary' | …` · `size?: 'sm' | 'md' | 'lg'` (default `md`) · `loading?: boolean` · `onPress: () => void`
- **Tokens used:** `bg-primary`, `text-inverse`, `rounded-md`, `text-body-strong`
- **Used in:** H1, M2, M3 (mobile screen IDs from project-overview.md §6) or docs page slugs / "all task pages" (§9.6) or admin screen IDs X1–X22 (§10.6)
- **Example:**
  ```tsx
  <Button variant="primary" onPress={handlePay}>{t('money.pay.cta', { amount })}</Button>
  ```
- **Notes:** rules or gotchas (e.g. "never use two primary buttons side by side").
```

Rules:
- Only **reusable** components (`src/components/**` and feature components used by 2+ screens in mobile; every MDX component registered in `apps/docs/mdx-components.tsx`; every component in `apps/admin/src/components` and admin feature components used by 2+ screens; web docs-link/impersonation components). One-off screen pieces are not registered.
- Docs MDX components also record their **MDX usage** (the exact JSX authors write) in the Example field — this is what content writers copy.
- When props change, update the entry and append to "Added / changed".
- When a component is removed or replaced, move its entry to **Retired** with the replacement's name.
- Keep the **Index** table in sync.

---

## Index
| Component | Surface | Category | Path | Since |
|---|---|---|---|---|
| Logo | docs | Docs layout | `components/layout/logo.tsx` | D1.2 (2026-10-12) |
| Footer | docs | Docs layout | `components/layout/footer.tsx` | D1.2 (2026-10-12) |
| NotFound | docs | Docs layout | `app/not-found.tsx` | D1.2 (2026-10-12) |
| AppliesTo | docs | MDX | `components/mdx/applies-to.tsx` | D1.4 (2026-10-12) |
| Callout | docs | MDX | `components/mdx/callout.tsx` | D1.4 (2026-10-12) |
| Steps / Step | docs | MDX | `fumadocs-ui/components/steps` (re-exported) | D1.4 (2026-10-12) |
| Screenshot | docs | MDX | `components/mdx/screenshot.tsx` | D1.4 (2026-10-12) |
| MenuPath | docs | MDX | `components/mdx/menu-path.tsx` | D1.4 (2026-10-12) |
| UiLabel | docs | MDX | `components/mdx/ui-label.tsx` | D1.4 (2026-10-12) |
| PlatformBadge | docs | MDX | `components/mdx/platform-badge.tsx` | D1.4 (2026-10-12) |
| PermissionNote | docs | MDX | `components/mdx/permission-note.tsx` | D1.4 (2026-10-12) |
| PlanNote | docs | MDX | `components/mdx/plan-note.tsx` | D1.4 (2026-10-12) |
| RoleTabs / RoleTab | docs | MDX | `components/mdx/role-tabs.tsx` | D1.4 (2026-10-12) |
| PlatformTabs / PlatformTab | docs | MDX | `components/mdx/platform-tabs.tsx` | D1.4 (2026-10-12) |
| StatusChip | docs | MDX | `components/mdx/status-chip.tsx` | D1.4 (2026-10-12) |
| CardGrid / Card | docs | MDX | `components/mdx/card-grid.tsx` | D1.4 (2026-10-12) |
| Faq / FaqItem | docs | MDX | `components/mdx/faq.tsx` | D1.4 (2026-10-12) |
| Glossary | docs | MDX | `components/mdx/glossary.tsx` | D1.4 (2026-10-12) |
| Diagram | docs | MDX | `components/mdx/diagram.tsx` | D1.4 (2026-10-12) |
| VideoEmbed | docs | MDX | `components/mdx/video-embed.tsx` | D1.4 (2026-10-12) |
| Related | docs | MDX | `components/mdx/related.tsx` | D1.4 (2026-10-12) |
| Feedback | docs | MDX | `components/mdx/feedback.tsx` | D1.4 (2026-10-12) |
| LastUpdated | docs | MDX | `components/mdx/last-updated.tsx` | D1.4 (2026-10-12) |
| AdminAppShell | admin | Shell | `src/components/AppShell.tsx` | A1.6 (2026-10-18) |
| PageHeader | admin | Shell | `src/components/PageHeader.tsx` | A1.6 (2026-10-18) |
| EnvBadge | admin | Shell | `src/components/EnvBadge.tsx` | A1.6 (2026-10-18) |
| DataTable | admin | Data | `src/components/DataTable.tsx` | A1.6 (2026-10-18) |
| FilterBar | admin | Data | `src/components/FilterBar.tsx` | A1.6 (2026-10-18) |
| StatCard | admin | Data | `src/components/StatCard.tsx` | A1.6 (2026-10-18) |
| StatusBadge | admin | Data | `src/components/StatusBadge.tsx` | A1.6 (2026-10-18) |
| EmptyState | admin | State | `src/components/EmptyState.tsx` | A1.6 (2026-10-18) |
| ErrorState | admin | State | `src/components/ErrorState.tsx` | A1.6 (2026-10-18) |
| Forbidden | admin | State | `src/components/Forbidden.tsx` | A1.6 (2026-10-18) |
| ReasonField | admin | Action | `src/components/ReasonField.tsx` | A1.6 (2026-10-18) |
| ConfirmDestructive | admin | Action | `src/components/ConfirmDestructive.tsx` | A1.6 (2026-10-18) |
| BlogPostForm | admin | Form | `src/components/forms/BlogPostForm.tsx` | A2.10 (2026-10-19) |
| DocPageForm | admin | Form | `src/components/forms/DocPageForm.tsx` | A2.11 (2026-10-19) |
| Text | mobile | UI primitive | `src/components/ui/Text.tsx` | F1.4 (2026-10-20) |
| Button | mobile | UI primitive | `src/components/ui/Button.tsx` | F1.4 (2026-10-20) |
| IconButton | mobile | UI primitive | `src/components/ui/IconButton.tsx` | F1.4 (2026-10-20) |
| Card | mobile | UI primitive | `src/components/ui/Card.tsx` | F1.4 (2026-10-20) |
| Badge | mobile | UI primitive | `src/components/ui/Badge.tsx` | F1.4 (2026-10-20) |
| StatusChip | mobile | UI primitive | `src/components/ui/StatusChip.tsx` | F1.4 (2026-10-20) |
| Avatar | mobile | UI primitive | `src/components/ui/Avatar.tsx` | F1.4 (2026-10-20) |
| Divider | mobile | UI primitive | `src/components/ui/Divider.tsx` | F1.4 (2026-10-20) |
| Skeleton | mobile | UI primitive | `src/components/ui/Skeleton.tsx` | F1.4 (2026-10-20) |
| Money | mobile | UI primitive | `src/components/ui/Money.tsx` | F1.4 (2026-10-20) |
| Spinner | mobile | UI primitive | `src/components/ui/Spinner.tsx` | F1.4 (2026-10-20) |
| Screen | mobile | Layout | `src/components/layout/Screen.tsx` | F1.4 (2026-10-20) |
| ScreenHeader | mobile | Layout | `src/components/layout/ScreenHeader.tsx` | F1.4 (2026-10-20) |
| Section | mobile | Layout | `src/components/layout/Section.tsx` | F1.4 (2026-10-20) |
| ListItem / ListGroup | mobile | Layout | `src/components/layout/ListItem.tsx` | F1.4 (2026-10-20) |
| StickyFooter | mobile | Layout | `src/components/layout/StickyFooter.tsx` | F1.4 (2026-10-20) |
| BottomSheet | mobile | UI primitive | `src/components/ui/BottomSheet.tsx` | F1.5 (2026-10-20) |
| FieldShell | mobile | Form (internal) | `src/components/forms/FieldShell.tsx` | F1.5 (2026-10-20) |
| TextField | mobile | Form | `src/components/forms/TextField.tsx` | F1.5 (2026-10-20) |
| PasswordField | mobile | Form | `src/components/forms/PasswordField.tsx` | F1.5 (2026-10-20) |
| OtpInput | mobile | Form | `src/components/forms/OtpInput.tsx` | F1.5 (2026-10-20) |
| AmountField | mobile | Form | `src/components/forms/AmountField.tsx` | F1.5 (2026-10-20) |
| DateField | mobile | Form | `src/components/forms/DateField.tsx` | F1.5 (2026-10-20) |
| SelectSheet | mobile | Form | `src/components/forms/SelectSheet.tsx` | F1.5 (2026-10-20) |
| SearchField | mobile | Form | `src/components/forms/SearchField.tsx` | F1.5 (2026-10-20) |
| Checkbox | mobile | Form | `src/components/forms/Checkbox.tsx` | F1.5 (2026-10-20) |
| Switch | mobile | Form | `src/components/forms/Switch.tsx` | F1.5 (2026-10-20) |
| SegmentedControl | mobile | Form | `src/components/forms/SegmentedControl.tsx` | F1.5 (2026-10-20) |
| FileAttachField | mobile | Form | `src/components/forms/FileAttachField.tsx` | F1.5 (2026-10-20) |
| EmptyState | mobile | Feedback | `src/components/feedback/EmptyState.tsx` | F1.5 (2026-10-20) |
| ErrorState | mobile | Feedback | `src/components/feedback/ErrorState.tsx` | F1.5 (2026-10-20) |
| OfflineBanner | mobile | Feedback | `src/components/feedback/OfflineBanner.tsx` | F1.5 (2026-10-20) |
| ModuleLocked | mobile | Feedback | `src/components/feedback/ModuleLocked.tsx` | F1.5 (2026-10-20) |
| SubscriptionInactive | mobile | Feedback | `src/components/feedback/SubscriptionInactive.tsx` | F1.5 (2026-10-20) |
| NoPermission | mobile | Feedback | `src/components/feedback/NoPermission.tsx` | F1.5 (2026-10-20) |
| ConfirmSheet | mobile | Feedback | `src/components/feedback/ConfirmSheet.tsx` | F1.5 (2026-10-20) |
| TabBar | mobile | Layout (navigation) | `src/components/layout/TabBar.tsx` | F1.8 (2026-10-20) |

---

# Mobile app (`apps/mobile`)

## Mobile theme & design tokens (F1.2)
Not reusable UI components, but conventions every future mobile component/screen relies on from F1.2 onward (same pattern as the docs site's own non-component "tooling" sections below).
- **Tokens:** `src/theme/global.css` (CSS variables, copied verbatim from `ui-tokens.md §10`) + `src/theme/tokens.ts` (JS mirror, `ui-tokens.md §12` shape). A unit test (`src/theme/tokens.test.ts`) asserts every hex in `tokens.ts` equals the RGB channels in `global.css` for both themes — keep both in sync in the same commit.
- **Tailwind config:** `tailwind.config.js` (`ui-tokens.md §11` shape, verbatim) — stock Tailwind colours/spacing/font sizes are replaced, not extended.
- **Theme provider:** `src/providers/ThemeProvider.tsx` exports `ThemeProvider` (wraps the app in `app/_layout.tsx`, also owns Manrope font loading and splash-screen hide-on-ready), `useThemeMode()` (`{ preference: 'light'|'dark'|'system', scheme: 'light'|'dark', setPreference }`), and `useThemeTokens()` (returns `tokens.light` or `tokens.dark` from `src/theme/tokens.ts` for the active scheme — use this, never parse CSS at runtime, for any JS-side value like chart colours or the status bar).
- **Persisted preference:** one MMKV key (`prefs.themeMode`), read via `useSyncExternalStore` with a server-safe snapshot (see `library-docs.md`'s NativeWind section for why this matters under static export). The dedicated MMKV instance inside `ThemeProvider.tsx` is temporary — F1.6's `lib/storage.ts` will absorb it without changing `useThemeMode`'s public API.
- **Third-party `className` interop:** `src/theme/interop.ts` registers NativeWind's `cssInterop` for third-party components that need `className` support (currently: `expo-router`'s `Link`). Import it once, for its side effects, in `app/_layout.tsx`. Add new registrations here, not inline in screens.
- **Design-token proof screen:** `app/index.tsx` (temporary — F1.8 replaces it with real splash/redirect logic) renders every color token, the full type scale, the spacing scale and the radius scale in both themes with a manual theme toggle. Not a registered component (one-off, screen-specific); consult it directly for a literal example of every token-backed class name.

## API types & enums (F1.3)
Not reusable UI components, but the typing foundation every future `api/endpoints/*` file (F1.7+) and feature module builds on.
- **Response DTOs:** `src/types/api/{associations,auth,members,memberFinance,memberLedger,payments,nigerianPayments,notifications,devices,meetings,voting}.ts` — hand-written, one file per API domain, typed directly from `docs/mobile/api-contract.md` (F0.1's real, controller-verified contract) rather than `packages/shared`'s stale `User`/`Member`/`PaginatedResponse` (confirmed stale — gap **G2**, closed by this feature: mobile deliberately never imports those types; `packages/shared` itself is left untouched, matching the contract doc's own "nothing in Phase 0 touches `packages/shared`" conclusion, which overrides architecture.md §2's "or fix the existing ones" alternative). `src/types/api/common.ts` holds only true cross-endpoint primitives (`MoneyValue`, `IsoDateString`, `ApiErrorResponse`) — deliberately **no** shared pagination/envelope generic, since api-contract.md §10 found 4 incompatible real pagination shapes; each endpoint file types its own list response exactly. Covers every endpoint api-contract.md verified for Phase 2–3 (auth, associations, members self-service, member finance/ledger, Paystack, Nigerian-payments proofs, notifications, devices, meetings, voting-dashboard/active/election-detail). Endpoints the contract doc explicitly didn't re-verify (e.g. the plain `GET /voting/elections` list) are deliberately left untyped with a comment pointing at this, rather than guessed.
- **Enums:** `src/types/api/enums.ts` is **generated**, not hand-written — `scripts/gen-enums.ts` (`pnpm -F @societyledger/mobile gen:enums`, run with `tsx`) parses every real `enum` block out of `apps/api/prisma/schema.prisma` (currently 59) and emits a `export const Name = [...] as const; export type Name = (typeof Name)[number];` pair per enum (code-standards.md §1 — no TS `enum`), matching architecture.md §10's "do not hand-type enum values from memory" rule literally. Free-form `String` columns that happen to hold enum-like values (`Member.status`, `approvalStatus`, `paymentMethod`, etc.) are **not** Prisma enums and are deliberately not in this file — DTOs type those as `string` (or a verified literal union sourced from the real zod schema/controller, e.g. `auth.ts`'s `ApprovalStatus`), never guessed. The script is idempotent (`gen:enums --check` exits 1 without writing if the schema has drifted) and prints a count; re-run after any `schema.prisma` change and commit the regenerated file. `apps/mobile` gained its own pinned `tsx` devDependency for this (`library-docs.md` updated), same pattern as `apps/docs`'s codegen scripts.
- **Lint:** `scripts/**/*.ts` is exempted from the app-wide `no-console` ESLint rule (`eslint.config.js`) — these are standalone Node CLI tools, not app code, so `lib/logger.ts` doesn't apply.

## UI primitives (`src/components/ui`)

### Text
- **Surface:** mobile
- **Path:** `src/components/ui/Text.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** The only way to render text — pairs every `ui-tokens.md §2` size with its correct Manrope weight class automatically.
- **Props:** `variant?: 'display'|'h1'|'h2'|'h3'|'body-lg'|'body'|'body-strong'|'label'|'caption'|'micro'|'num-lg'|'num'` (default `body`) · `tone?: 'default'|'secondary'|'tertiary'|'inverse'|'primary'|'onPrimarySoft'|'accent'|'accentText'|'success'|'warning'|'danger'|'info'|'onPassbook'|'onPassbookMuted'` (default `default`) · `align?` · `numberOfLines?` · `maxFontSizeMultiplier?` · `className?` · `style?: TextStyle` (escape hatch for genuinely dynamic values only — see Notes) · `testID?`
- **Tokens used:** every `text-*`/`font-*` class pair from `ui-tokens.md §2`, every `text-*` colour class from `§1.2`
- **Used in:** every other UI primitive in this section; will be used by every screen
- **Example:**
  ```tsx
  <Text variant="h2" tone="secondary">Payments</Text>
  ```
- **Notes:** `variant="num"`/`"num-lg"` force `fontVariant: ['tabular-nums']` automatically (ui-tokens.md §2's own rule) — `style` is a real escape hatch (code-standards.md §5), used by `Money` to force tabular figures on non-`num` variants and by `Avatar` for its data-derived initials colour; never pass a static design colour through it, use `tone`.

### Button
- **Surface:** mobile
- **Path:** `src/components/ui/Button.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** The only tappable primary/secondary/destructive action control (ui-rules.md §5.2).
- **Props:** `variant?: 'primary'|'secondary'|'soft'|'ghost'|'danger'|'danger-ghost'|'onPassbook'` (default `primary`) · `size?: 'lg'|'md'|'sm'` (default `md`) · `loading?` · `disabled?` · `fullWidth?` · `onPress` · `children: string` · `accessibilityLabel?` (defaults to the label text) · `testID?`
- **Tokens used:** `bg-primary`/`-pressed`, `bg-surface`, `border-border-strong`, `bg-primary-soft`, `bg-danger`, `bg-on-passbook`, `text-passbook`, `rounded-md`
- **Used in:** `StickyFooter`, gallery; will be used by nearly every screen
- **Example:**
  ```tsx
  <Button variant="primary" loading={mutation.isPending} onPress={handlePay}>Pay ₦25,000</Button>
  ```
- **Notes:** `onPassbook` only looks right on the passbook's dark-green fill (it uses `bg-on-passbook`/`text-passbook`, the literal-white/passbook-green token pair ui-tokens.md §1.3 defines specifically for this). Loading replaces the label with an absolutely-positioned `Spinner`, keeping the button's width (ui-rules.md §5.2); disabled is 40% opacity. Press feedback is a 0.97 scale transform — no `android_ripple` (ui-rules.md §5.2 reserves ripple for rows). Tested in `Button.test.tsx` (mocks `@/providers/ThemeProvider` since only the loading-state `Spinner` needs it).

### IconButton
- **Surface:** mobile
- **Path:** `src/components/ui/IconButton.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** 44×44dp icon-only tap target for headers (ui-rules.md §5.9).
- **Props:** `icon: LucideIcon` (a component, not a pre-rendered node — IconButton owns size/colour/strokeWidth) · `onPress?` · `accessibilityLabel: string` (required — no visible text) · `variant?: 'default'|'soft'` (default `default`) · `tone?: 'default'|'secondary'|'primary'|'inverse'|'danger'` (default `default`) · `disabled?` · `testID?`
- **Tokens used:** `bg-surface-sunken` (soft variant), resolved theme colour via `useThemeTokens()` (icon fill — `lucide-react-native` needs a real colour value, not a className)
- **Used in:** `ScreenHeader` (back button, right actions), gallery
- **Example:**
  ```tsx
  <IconButton icon={Bell} accessibilityLabel="Notifications" onPress={openInbox} />
  ```
- **Notes:** Not RTL-tested — see "Dev tooling & known gaps (F1.4)" below for why rendering any `lucide-react-native` icon currently crashes under Jest (a third-party/test-environment interaction, not a bug in this component). Verified by type-check + lint only.

### StatusChip
- **Surface:** mobile
- **Path:** `src/components/ui/StatusChip.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** The single status→colour chip every list/detail screen uses (ui-rules.md §5.5, ui-tokens.md §1.4).
- **Props:** `status: string` (looked up case-insensitively in the shared mapping) · `label?: string` (overrides the auto-humanized text; tone lookup still uses `status`) · `testID?`
- **Tokens used:** `bg-success-soft`/`text-success`, `bg-warning-soft`/`text-warning`, `bg-danger-soft`/`text-danger`, `bg-surface-sunken`/`text-text-secondary`, `bg-info-soft`/`text-info`
- **Used in:** gallery; will be used by every list/detail screen with a status
- **Example:**
  ```tsx
  <StatusChip status={transaction.status} />
  ```
- **Notes:** `getStatusTone(status)` is also exported — the single source for the status→tone mapping (mirrors `ui-tokens.md §1.4` exactly); an unmapped status falls back to `neutral` rather than throwing. Tested in `StatusChip.test.tsx` (every tone family + case-insensitivity + the fallback).

### Badge
- **Surface:** mobile
- **Path:** `src/components/ui/Badge.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** Three small indicators ui-rules.md §5.5 describes separately, bundled behind one variant prop since they're the same visual family: a labelled pill (`"New"`, `"Pro"`), a numeric count badge (tab/bell/menu, 99+ cap), and the unread dot.
- **Props:** `variant?: 'label'|'count'|'dot'` (default `label`) · `label` variant: `tone?: 'neutral'|'primary'|'accent'|'success'|'warning'|'danger'|'info'` (default `neutral`), `children: string` · `count` variant: `count: number` (renders nothing if `<= 0`) · `dot` variant: no other props · `testID?`
- **Tokens used:** soft-bg/strong-text pairs per tone (same family as `StatusChip`, but tone is explicit, never looked up from a status string), `bg-danger` (count), `bg-accent` (dot)
- **Used in:** gallery; will be used by the header bell, Manage tab badge, announcement "new" indicator
- **Example:**
  ```tsx
  <Badge variant="count" count={unreadCount} />
  ```
- **Notes:** Deliberately decoupled from `StatusChip`'s status-string lookup (ui-tokens.md §1.4 scopes that mapping to `StatusChip` specifically) — `Badge`'s tone is always explicit.

### Card
- **Surface:** mobile
- **Path:** `src/components/ui/Card.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** Generic surface card — meeting/election/KPI/quick-action/bank-account/association cards all compose this (ui-rules.md §5.4). **Not** the Passbook (a distinct, signature component with its own tokens — ui-rules.md §5.1 — not built yet, not a `Card` variant).
- **Props:** `children` · `noPadding?` (default `false`) · `className?` · `testID?`
- **Tokens used:** `bg-surface`, `rounded-lg`, `border-border` (light only — `dark:border-transparent` in dark mode)
- **Used in:** gallery
- **Example:**
  ```tsx
  <Card><Text variant="body-strong">October meeting</Text></Card>
  ```
- **Notes:** Never a shadow (ui-rules.md §5.4 is explicit) — dark mode drops the border entirely rather than drawing one in the dark border token, matching the spec's "surface alone reads against bg" wording.

### Avatar
- **Surface:** mobile
- **Path:** `src/components/ui/Avatar.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** Member initials-on-tint circle, or an association-logo-fallback square (ui-rules.md §5.14).
- **Props:** `name: string` (source for initials) · `size?: 32|40|64` (default `40`) · `shape?: 'circle'|'square'` (default `circle`) · `colorSeed?: number|string` (e.g. member id — picks a chart-palette colour; ignored when `tintColor` given) · `tintColor?: string` (a real hex from data, e.g. `Association.primaryColor`) · `testID?`
- **Tokens used:** `useThemeTokens().chart` (the 6-colour chart palette, at 12% tint for the background, full strength for the initials text — a data-derived pick, not a static class, hence the `style` escape hatch via `Text`)
- **Used in:** gallery; will be used by member list rows, the association card
- **Example:**
  ```tsx
  <Avatar name={member.firstName + ' ' + member.lastName} colorSeed={member.id} />
  ```
- **Notes:** **No image loading yet** — `expo-image` isn't installed (nothing needs a real logo/photo through F1.4); deferred to whichever feature first needs it (likely F1.8 or F2.x), same "defer until a real screen needs it" discipline this project uses elsewhere. Initials-only until then. **F2.1 (2026-10-20):** `expo-image` is now installed (the Association Code screen's logo). `Avatar` itself is unchanged — it's still the initials fallback, used directly whenever a tenant/member has no logo/photo; the real image is rendered by the caller (`AssociationConfirmationCard`), not by `Avatar`.

### Divider
- **Surface:** mobile
- **Path:** `src/components/ui/Divider.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** A hairline separator (ui-tokens.md §5 `--border-hairline`).
- **Props:** `orientation?: 'horizontal'|'vertical'` (default `horizontal`) · `className?`
- **Tokens used:** `bg-border`
- **Used in:** `ListGroup` (between rows)
- **Notes:** Uses `StyleSheet.hairlineWidth` via `style` (not expressible as a className — a platform-resolved sub-pixel value, not a design token).

### Skeleton
- **Surface:** mobile
- **Path:** `src/components/ui/Skeleton.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** Loading placeholder shaped like real content (ui-rules.md §5.11 — never a full-screen spinner except Splash).
- **Props:** `width: number | \`${number}%\`` · `height: number` · `radius?: 'xs'|'sm'|'md'|'lg'|'full'` (default `sm`) · `className?`
- **Tokens used:** `bg-surface-sunken`, `rounded-*`
- **Used in:** gallery
- **Notes:** Opacity-pulse shimmer via `react-native-reanimated`; off entirely under `useReducedMotion()` (renders a static mid-opacity block instead), per ui-rules.md §6. **Not RTL-tested** — see "Dev tooling & known gaps" below; rendering it under Jest needs `react-native-reanimated`'s native Worklets module, which isn't available there (a pre-existing-class gap, not new to this component). Verified by type-check + lint only.

### Money
- **Surface:** mobile
- **Path:** `src/components/ui/Money.tsx`
- **Added / changed:** F1.4 (2026-10-20) · F1.6 (2026-10-20: now imports `formatMoney` from `@/lib/money` instead of owning its own copy; props unchanged)
- **Purpose:** The only way to display a monetary amount (ui-rules.md §5.16, code-standards.md §11 rule #10 — money is never a float).
- **Props:** `value: string|number|Decimal` · `size?: TextVariant` (default `body-strong`) · `tone?: TextTone` (default `default`) · `compact?: boolean` (₦25k/₦1.2m — charts/KPI tiles only) · `creditLabel?: string` (default `"Credit"`) · `testID?`
- **Tokens used:** forces `fontVariant: ['tabular-nums']` via `Text`'s `style` escape hatch, regardless of `size`
- **Used in:** gallery; will be used by every amount in the app
- **Example:**
  ```tsx
  <Money value={summary.outstanding} size="display" tone="onPassbook" />
  ```
- **Notes:** `formatMoney()`/`toDecimal()`/`sumMoney()` now live in `src/lib/money.ts` (F1.6) — see that module's entry below for detail; `Money.test.tsx` was trimmed to component-rendering checks only, with formatting edge cases (negative/credit, compact, decimal-precision) moved to `lib/money.test.ts`. Negative values render as `"<creditLabel> <abs amount>"` (e.g. `"Credit ₦2,000.00"`) — ui-rules.md §5.16's prose says "leading minus and the word context" but its own example shows no minus sign; the concrete example was treated as ground truth over the ambiguous prose.

### Spinner
- **Surface:** mobile
- **Path:** `src/components/ui/Spinner.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** Thin `ActivityIndicator` wrapper resolving a real token colour (RN's `ActivityIndicator` needs a colour value, not a className).
- **Props:** `tone?: 'primary'|'inverse'|'secondary'|'danger'` (default `primary`) · `size?: 'sm'|'lg'` (default `sm`, maps to RN's `'small'`/`'large'`)
- **Used in:** `Button` (loading state), gallery
- **Notes:** Reads `useThemeTokens()` — components that render `Spinner` conditionally (like `Button`) need `ThemeProvider` mounted (or the hook mocked in tests).

## Layout (`src/components/layout`)

### Screen
- **Surface:** mobile
- **Path:** `src/components/layout/Screen.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** The outer wrapper every route screen renders into — safe area, the 16dp gutter + 560dp max content width (ui-rules.md §2), scroll-or-fixed, pull-to-refresh, optional keyboard-avoiding.
- **Props:** `children` · `scroll?: boolean` (default `true`) · `refreshing?` · `onRefresh?` · `keyboard?: boolean` (default `false`, wraps in `KeyboardAvoidingView` — code-standards.md §8) · `edges?: Edge[]` (default `[]` — pass `['top']`/`['bottom']` only for a screen with no native header/no tab bar below it) · `className?`
- **Tokens used:** `bg-bg`, `px-4`, `max-w-[560px]`
- **Used in:** gallery; will wrap nearly every route screen
- **Example:**
  ```tsx
  <Screen refreshing={query.isRefetching} onRefresh={query.refetch}>{children}</Screen>
  ```
- **Notes:** Doesn't assume a header or tab bar exists below/above it — `edges` defaults to neither, since most routes already get a safe-area inset from one of those; pass edges explicitly for the screens that don't.

### ScreenHeader
- **Surface:** mobile
- **Path:** `src/components/layout/ScreenHeader.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** The custom 52px header row for screens that need more than the native `Stack.Screen` title (large-title tab roots, modal `Cancel`/`Save` rows, a bell/action icon) — ui-rules.md §5.9, §2's "Form (modal)" skeleton.
- **Props:** `title: string` · `large?: boolean` (default `false` — `h1` for tab roots vs `h3` for detail/modal headers) · `onBack?: () => void` (renders a back chevron `IconButton` when given) · `backLabel?` · `rightActions?` (up to 2 `IconButton`s) · `leftAction?` (e.g. a "Cancel" text button for modals; ignored when `onBack` is given) · `showDivider?: boolean` (default `false`)
- **Used in:** gallery
- **Notes:** Stays presentational — it never reads scroll position itself (architecture.md §4's layer rule: `components/**` are props-in/props-out only); the caller toggles `showDivider` once the screen has actually scrolled, per ui-rules.md §5.9's "hairline appears on scroll."

### Section
- **Surface:** mobile
- **Path:** `src/components/layout/Section.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** The "Section heading — See all" pattern (ui-rules.md §2/§3).
- **Props:** `title?: string` · `onSeeAll?: () => void` (renders the "See all" ghost text button when given) · `seeAllLabel?` (default `"See all"`) · `children` · `className?`
- **Used in:** gallery
- **Notes:** Only owns the 12dp heading-to-content gap; the 24dp gap *between* sibling Sections is the parent screen's job (a `gap-6` flex container) — Section doesn't self-margin.

### ListItem / ListGroup
- **Surface:** mobile
- **Path:** `src/components/layout/ListItem.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** The workhorse row (ui-rules.md §5.3) and its grouping container (the "ledger rows, not card soup" pattern, ui-rules.md §1 rule #2).
- **Props:** `ListItem`: `leading?` (a pre-built icon-in-circle or `Avatar` — ListItem doesn't compose that itself) · `title: string` · `meta?: string` · `trailing?` · `showChevron?` · `onPress?` (renders a `Pressable` with `android_ripple` tinted `primary/12` when given, else a plain `View`) · `compact?: boolean` (48dp vs 56dp) · `disabled?` · `testID?` — `ListGroup`: `children` (any number of `ListItem`s) · `testID?`
- **Tokens used:** `bg-surface`, `rounded-md`, `border-border` (light)/`dark:border-transparent`, `bg-border` (dividers)
- **Used in:** gallery; will be used by every list screen
- **Example:**
  ```tsx
  <ListGroup>
    <ListItem leading={<CategoryIcon />} title="October dues" meta="Due 31 Oct" trailing={<Money value={25000} />} onPress={onPress} />
  </ListGroup>
  ```
- **Notes:** **Simplification, flagged:** `ListGroup`'s dividers are full-width, not inset to each row's text start as ui-rules.md §5.3 describes — no real screen exists yet to validate per-row leading-icon widths against; revisit when one does.

### StickyFooter
- **Surface:** mobile
- **Path:** `src/components/layout/StickyFooter.tsx`
- **Added / changed:** F1.4 (2026-10-20)
- **Purpose:** The fixed action row above the keyboard/home indicator for forms and payment flows (ui-rules.md §2).
- **Props:** `children` (a row of `Button`s)
- **Tokens used:** `bg-surface`, `border-border` (top hairline), elevation-1 (see Notes)
- **Used in:** gallery
- **Notes:** **Found and fixed a real gap while building this:** `ui-tokens.md §6` defines an `elevation` scale (1/2/3, with exact shadow colour/offset/radius/opacity per level) that F1.2 never mirrored into `src/theme/tokens.ts` (only `color`/`space`/`radius`/`icon`/`motion`/`layout`/`z` existed). Added `tokens.elevation` now (first feature that actually needed a shadow) rather than hardcoding the hex inline — `tokens.test.ts`'s parity check only scans `tokens.light.color`/`tokens.dark.color`, so this didn't need a test change.

## UI primitives — BottomSheet (F1.5)

### BottomSheet
- **Surface:** mobile
- **Path:** `src/components/ui/BottomSheet.tsx`
- **Added / changed:** F1.5 (2026-10-20) · Phase 1 retro (2026-10-20: fixed the close button — see Notes)
- **Purpose:** The one gorhom wrapper every sheet in the app goes through (ui-rules.md §5.10) — filters, pickers (`SelectSheet`), confirmations (`ConfirmSheet`), quick actions (`FileAttachField`).
- **Props:** `title?: string` · `snapPoints?` (default `['50%','90%']`) · `onDismiss?: () => void` · `children`
- **Tokens used:** `bg-surface` (sheet background), `border-strong` (grabber), `overlay/45` (backdrop opacity), `rounded-xl` (top corners, 24dp)
- **Used in:** `SelectSheet`, `FileAttachField`, `ConfirmSheet`
- **Example:**
  ```tsx
  const sheetRef = useRef<BottomSheetModal>(null);
  <BottomSheet ref={sheetRef} title="Choose a bank">{content}</BottomSheet>
  // sheetRef.current?.present() / .dismiss()
  ```
- **Notes:** A `forwardRef<BottomSheetModal, BottomSheetProps>` — callers own the ref and call `.present()`/`.dismiss()` themselves (no imperative wrapper hook built). Requires `BottomSheetModalProvider` (inside `GestureHandlerRootView`) mounted once at the app root — both wired in `app/_layout.tsx` at F1.5. Never stack more than one (ui-rules.md §5.10) — not enforced in code, a convention for callers to respect. **Bug found and fixed in the Phase 1 retro review:** the header's close (X) button used to only fire the optional `onDismiss` callback — it never called `.dismiss()` on the sheet itself, so pressing it did nothing in `SelectSheet`/`FileAttachField` (neither passes `onDismiss`) and only fired `ConfirmSheet`'s callback without closing. Fixed by giving the component its own internal ref (`useImperativeHandle` forwards it to the caller's ref, same instance either way) and having the X button call that ref's `.dismiss()` directly; `onDismiss` now only ever does what gorhom's own prop means — notify after the sheet closes by any means.

## Forms (`src/components/forms`)
Every field below shares `FieldShell` (chrome) and `RHFControlProps<TFieldValues>` (the `control`/`name` pair), both exported from `FieldShell.tsx`. Each is generic over `TFieldValues extends FieldValues` and calls `useController({ control, name })` itself. Two fields (`SearchField`, `SegmentedControl`) are deliberately plain-controlled instead — see their own Notes.

### FieldShell
- **Surface:** mobile
- **Path:** `src/components/forms/FieldShell.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** Label above / input / helper-or-error below (ui-rules.md §5.6) — composed internally by every other field in this folder, never used directly by screens.
- **Props:** `label?` · `helper?` · `error?` · `required?` · `children`
- **Notes:** Also exports `RHFControlProps<TFieldValues>` (`{ control, name }`), the shared base type every field in this folder extends.

### TextField
- **Surface:** mobile
- **Path:** `src/components/forms/TextField.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** The default single/multi-line text input (ui-rules.md §5.6) — never wire a raw `TextInput` in a screen (code-standards.md §8).
- **Props:** `RHFControlProps<TFieldValues>` + `label?` · `helper?` · `placeholder?` · `keyboardType?` · `autoCapitalize?` (default `'none'`) · `returnKeyType?` · `onSubmitEditing?` · `multiline?` · `maxLength?` · `editable?` (default `true`) · `testID?`
- **Tokens used:** `bg-surface-sunken`, `border-border-strong` → `focus:border-2 focus:border-focus`, `border-danger` on error, `rounded-md`, height 52 (or `min-h-[52px]` multiline)
- **Example:**
  ```tsx
  <TextField control={control} name="fullName" label="Full name" autoCapitalize="words" />
  ```

### PasswordField
- **Surface:** mobile
- **Path:** `src/components/forms/PasswordField.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** Show/hide toggle + optional strength meter (ui-rules.md §5.6 — strength "on create/reset screens" only, not login).
- **Props:** `RHFControlProps<TFieldValues>` + `label?` · `helper?` · `placeholder?` · `showStrength?: boolean` (default `false`) · `testID?`
- **Notes:** Strength score is a simple 4-point heuristic (length ≥ 8, uppercase, digit, symbol) → 4-segment bar + label (Weak/Fair/Good/Strong). The bar's tone classes are a static lookup array (`['bg-danger','bg-warning','bg-info','bg-success']`), never a template-literal-constructed class name — NativeWind/Tailwind can't statically discover a dynamically-built class string.

### OtpInput
- **Surface:** mobile
- **Path:** `src/components/forms/OtpInput.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** A6 Verify Email's 6-digit code (ui-rules.md §5.6) — auto-advance, paste-fills-all, iOS `oneTimeCode` autofill.
- **Props:** `RHFControlProps<TFieldValues>` + `label?` · `helper?` · `length?` (default `6`) · `testID?`
- **Notes:** Form value is the joined digit string. Only the first box gets `textContentType="oneTimeCode"` and `maxLength={length}` (so a full autofill/paste lands there); every other box is `maxLength={1}`. Backspace on an empty box focuses the previous one.

### AmountField
- **Surface:** mobile
- **Path:** `src/components/forms/AmountField.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** Large right-aligned ₦ amount with live thousands separators + preset chips (ui-rules.md §5.6 — M12 Donate, etc.).
- **Props:** `RHFControlProps<TFieldValues>` + `label?` · `helper?` · `presets?: number[]` (rendered as separate chips) · `testID?`
- **Notes:** Form value is a **plain numeric string** (code-standards.md §8/§11 — "amount fields hold strings in form state"), never converted to `Decimal` here; that happens with `toDecimal()` at submit. `keyboardType="decimal-pad"` per code-standards.md §8.

### DateField
- **Surface:** mobile
- **Path:** `src/components/forms/DateField.tsx`
- **Added / changed:** F1.5 (2026-10-20) · F1.6 (2026-10-20: display formatting now goes through the real `lib/dates.ts` instead of a temporary local `Intl.DateTimeFormat`)
- **Purpose:** Opens the native date/time picker (ui-rules.md §5.6 — deliberately **not** a `SelectSheet`).
- **Props:** `RHFControlProps<TFieldValues>` + `label?` · `helper?` · `mode?: 'date'|'time'|'datetime'` (default `'date'`) · `minimumDate?` · `maximumDate?` · `placeholder?` · `testID?`
- **Notes:** Pulled in `@react-native-community/datetimepicker` — **owner-approved** at F1.5 (no picker was documented anywhere in context before this feature; see `library-docs.md`). Form value is an ISO string. Android shows the library's own imperative dialog; iOS wraps the inline picker in a plain `Modal` with a "Done" button (`display="spinner"`). Display formatting is `formatDate(iso, 'long')` from `@/lib/dates` (F1.6). Trigger `Pressable` got an explicit `accessibilityRole="button"` + `accessibilityLabel` in the Phase 1 retro review (was relying on its visible text alone, inconsistent with `Section`/`ListItem`'s pattern).

### SelectSheet
- **Surface:** mobile
- **Path:** `src/components/forms/SelectSheet.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** Picker opening a `BottomSheet` list, searchable above 8 options (ui-rules.md §5.6).
- **Props:** `RHFControlProps<TFieldValues>` + `label?` · `helper?` · `options: { label: string; value: string }[]` · `placeholder?` · `testID?`
- **Notes:** Uses a plain `FlatList` (not `@shopify/flash-list`, not installed yet) — fine for the modest option counts this is designed for. The in-sheet search box is a local, un-debounced `TextInput` (filtering an already-in-memory array), not `SearchField`. Trigger `Pressable` got an explicit `accessibilityRole="button"` + `accessibilityLabel` in the Phase 1 retro review.

### SearchField
- **Surface:** mobile
- **Path:** `src/components/forms/SearchField.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** Leading icon, clear button, 300ms debounce (ui-rules.md §5.6) — live list filtering (MG1 member search, etc.).
- **Props:** `value: string` · `onChangeText: (text: string) => void` · `placeholder?` (default `'Search'`) · `debounceMs?` (default `300`) · `testID?`
- **Notes:** **Deliberately not RHF-bound** (build-plan.md's F1.5 bullet says "all RHF-bound," but no real screen in project-overview.md ties a search box to a submitted form value — every use is a live filter). Syncs an externally-changed `value` prop during render (comparing against a tracked previous value), not in a `useEffect` — the `react-hooks/set-state-in-effect` ESLint rule flags the effect form of this pattern.

### Checkbox
- **Surface:** mobile
- **Path:** `src/components/forms/Checkbox.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** Boolean field, e.g. A5 Register's terms checkbox.
- **Props:** `RHFControlProps<TFieldValues>` + `label: string` · `testID?`
- **Notes:** Not the same as C7 Ballot's "selected radio card" (a `Card` + `border-thick`, per ui-tokens.md §5) — different component for a different pattern, not built yet. Got `hitSlop={8}` in the Phase 1 retro review (same convention as `IconButton`) — the row's `py-2` padding alone fell short of the 44dp tap-target minimum.

### Switch
- **Surface:** mobile
- **Path:** `src/components/forms/Switch.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** Boolean field, e.g. N2 Notification Preferences' per-category toggles.
- **Props:** `RHFControlProps<TFieldValues>` + `label: string` · `helper?` · `testID?`
- **Notes:** Wraps RN's built-in `Switch` with themed `trackColor`/`thumbColor` (RN's `Switch` needs resolved colour values, not classNames). **Changed in the Phase 1 retro review:** the whole row is now a `Pressable` (`accessibilityRole="switch"`) that toggles the field, not just the small native `Switch` control — RN's touch responder system gives the inner `Switch` exclusive capture of taps landing directly on it, so this doesn't double-toggle; it only grows the usable tap area to the full row.

### SegmentedControl
- **Surface:** mobile
- **Path:** `src/components/forms/SegmentedControl.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** 2–4 peer-view toggle (ui-rules.md §5.7) — e.g. Upcoming|Past, or GV4's per-row Present/Absent/Excused/Late.
- **Props:** `options: { label: string; value: T }[]` (2–4) · `value: T` · `onChange: (value: T) => void` · `testID?`
- **Notes:** **Deliberately plain-controlled** (value/onChange), not RHF-bound — same reasoning as `SearchField`. Selected pill gets `elevation-1` in light mode only (`tokens.elevation[1]`, read via `useThemeMode()`'s `scheme`); dark mode uses `bg-surface-raised` with no shadow, per the spec's exact wording.

### FileAttachField
- **Surface:** mobile
- **Path:** `src/components/forms/FileAttachField.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** Camera / Photos / Files attachment (library-docs.md's "Files" section) — a `BottomSheet` quick-actions menu.
- **Props:** `RHFControlProps<TFieldValues>` + `label?` · `helper?` · `allowedTypes?` (default `['image/jpeg','image/png','application/pdf']`, api-contract.md §6's real multer limits) · `maxSizeBytes?` (default 5MB) · `testID?`
- **Notes:** Form value is `{ uri, name, type, size? } | null`. Images compressed with `quality: 0.7` only — the max-2000px-long-edge resize from library-docs.md's own spec is deferred (no `expo-image-manipulator` pinned; that table's own wording already allows this: "add to table when introduced"). A type/size violation shows as the field's helper text, not a thrown error. **Fixed in the Phase 1 retro review:** `fromCamera`/`fromPhotos`/`fromFiles` had no try/catch and no feedback on a denied permission — both now show through the same helper-text slot (`setAttachError`) rather than silently no-op'ing. The "Attach a file" trigger `Pressable` also got an explicit `accessibilityRole="button"` + `accessibilityLabel`.

## Feedback (`src/components/feedback`)

### EmptyState
- **Surface:** mobile
- **Path:** `src/components/feedback/EmptyState.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** ui-rules.md §5.11's "Empty" data-screen state.
- **Props:** `icon?: LucideIcon` (default `Inbox`) · `title: string` · `description?` · `actionLabel?` · `onAction?`
- **Used in:** gallery

### ErrorState
- **Surface:** mobile
- **Path:** `src/components/feedback/ErrorState.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** ui-rules.md §5.11's "Error" data-screen state — plain words, "Try again," no apologies.
- **Props:** `title?` (default `"We couldn't load this."`) · `description?` · `onRetry?`
- **Used in:** gallery

### OfflineBanner
- **Surface:** mobile
- **Path:** `src/components/feedback/OfflineBanner.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** ui-rules.md §5.11's "Offline" banner, under the header.
- **Props:** `lastUpdatedLabel?: string`
- **Notes:** Doesn't disable mutations itself — that's the screen's job via `useOnline()` (F1.6+), not this component's.

### ModuleLocked
- **Surface:** mobile
- **Path:** `src/components/feedback/ModuleLocked.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** ui-rules.md §5.11's "Module locked" state — deliberately no upgrade/purchase button (rule #16: no in-app selling).
- **Props:** `moduleName: string`

### SubscriptionInactive
- **Surface:** mobile
- **Path:** `src/components/feedback/SubscriptionInactive.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** ui-rules.md §5.11's "Subscription inactive" state.
- **Props:** none

### NoPermission
- **Surface:** mobile
- **Path:** `src/components/feedback/NoPermission.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** ui-rules.md §5.11's "No permission" state — only reachable via deep link.
- **Props:** `onGoHome?: () => void` (default: `router.replace('/')`)

### ConfirmSheet
- **Surface:** mobile
- **Path:** `src/components/feedback/ConfirmSheet.tsx`
- **Added / changed:** F1.5 (2026-10-20)
- **Purpose:** ui-rules.md §5.10's destructive/irreversible-action confirmation — title states the action, body states the consequence, "Keep it" + a danger button repeating the verb.
- **Props:** `title: string` · `description: string` · `confirmLabel: string` · `cancelLabel?` (default `'Keep it'`) · `destructive?` (default `true`) · `onConfirm: () => void` · `onDismiss?`
- **Notes:** A `forwardRef<BottomSheetModal, ConfirmSheetProps>` that forwards to its own internal ref via `useImperativeHandle` — exposes `.present()`/`.dismiss()` to the caller while also using the same ref for its own "Keep it" button. Biometric re-auth (architecture.md §7.5) runs at the call site after confirm, not inside this component.

### TabBar
- **Surface:** mobile
- **Path:** `src/components/layout/TabBar.tsx`
- **Added / changed:** F1.8 (2026-10-20)
- **Purpose:** ui-rules.md §5.8's bottom tab bar — height 64 + safe area, `surface` background with a top hairline, icon 24 + `micro` label, active state shown by a 32×4 `primary` pill above the icon (not a filled background blob).
- **Props:** `BottomTabBarProps` from `expo-router/tabs` (`state`, `descriptors`, `navigateToTab`, `insets`) — passed straight through by `(tabs)/_layout.tsx`'s `tabBar={(props) => <TabBar {...props} />}`, not a custom prop shape of its own.
- **Example:**
  ```tsx
  <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
    <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
  </Tabs>
  ```
- **Notes:** `state.routes`/`descriptors` arrive already filtered to visible tabs — Expo Router's own `useVisibleTabsWithRedirect` excludes hidden routes (the Manage tab's `href: canManage ? undefined : null`) before they reach this component, so it does no hidden-tab filtering itself. Not RTL-tested — same pre-existing "rendering a `lucide-react-native` icon crashes under Jest" gap as `IconButton`/`ListItem`'s chevron (`ui-registry.md`'s own "Dev tooling & known gaps (F1.4)" below); verified by type-check + lint + a successful `expo export -p web` bundle only.

## Charts (`src/components/charts`)
_(none yet)_

## Dev tooling & known gaps (F1.4)
Not reusable UI components, but infrastructure every future test/screen that uses an icon or `react-native-reanimated` relies on.
- **Dev-only component gallery:** `app/(dev)/gallery.tsx` + `app/(dev)/_layout.tsx` (the group's layout `<Redirect>`s to `/` when `!__DEV__` — Metro has no "exclude this route from the bundle" primitive, so this makes it unreachable in production rather than literally absent). Demonstrates every component above in every variant/state, including a real `react-hook-form` + `zod` form (F1.5's DoD) and a `ConfirmSheet` trigger. Verified by type-check + lint + a successful `expo export -p web` **bundle** (Metro resolved and bundled the route with zero errors, both at F1.4 and again at F1.5 with every new dependency) — but **not** by the static HTML's rendered text content, which came back empty for this specific route (see the Jest gap below; the same `lucide-react-native`/`react-native-css-interop` interaction silently empties Expo Router's Suspense-based static prerender on Node, which also lacks a `document`). The real target platforms (iOS/Android dev client, via Metro) aren't expected to hit this — no device was available this session to confirm directly; flagged for before demo, same pattern as several prior sessions' browser-dependent gaps.
- **lucide-react-native under Jest — fixed:** `jest.config.js` (new — replaces the `"jest"` key that was in `package.json`) extends `jest-expo`'s real preset object (not a hand-copied regex) to (1) allow `lucide-react-native` through `transformIgnorePatterns` and (2) rename the babel-jest transform key from `\.[jt]sx?$` to `\.m?[jt]sx?$` so its ESM-only `.mjs` build actually gets transformed to CJS. Without this, merely *importing* any `lucide-react-native` icon under Jest threw "Must use import to load ES Module."
- **lucide-react-native icons rendering under Jest — NOT fixed, flagged:** once import succeeds, actually *rendering* a component that uses a `lucide-react-native` icon throws `Cannot read properties of undefined (reading 'documentElement')` from inside `react-native-css-interop`'s web runtime — jest-expo's test environment defines a bare, truthy `window` global with no `document`, which makes css-interop's `typeof window`-based web-vs-native detection pick the web runtime even though the test environment is meant to emulate native. Routing through `react-native-reanimated/jest/resolver` (reanimated's own documented Jest workaround) "fixes" this for reanimated specifically but replaces Jest's module resolver *project-wide* (it delegates to `react-native-worklets/jest/resolver` for everything else), which broke unrelated `.tsx` files too — every file gets `react-native-css-interop/jsx-runtime` auto-injected via `babel.config.js`'s `jsxImportSource: 'nativewind'`. Reverted rather than shipped. **Consequence:** `IconButton`, `ListItem`'s chevron, `Skeleton`, and every F1.5 component that renders an icon (`PasswordField`, `OtpInput`'s autofill, `SelectSheet`, `SearchField`, `FileAttachField`, feedback states, `ScreenHeader`'s back button) are verified by type-check + lint only, not RTL — `Button`/`Money`/`StatusChip` (F1.4's actual RTL-test requirement) import neither and are unaffected, all 25 tests passing. F1.5 added no new RTL-test requirement (its DoD is "registry updated; form example in gallery validates with zod," both satisfied without rendering under Jest). Root-cause and fix properly before any future feature needs to RTL-test a component that renders an icon.

## Storage, permissions & utilities (F1.6)
Not reusable UI components, but the `lib/`/`hooks/`/`stores/` foundation every future feature/screen builds on.
- **`lib/cn.ts`:** `cn(...values)` — merges conditional NativeWind classNames. **Not `clsx`-based** (no new dependency): a plain `filter(Boolean-ish).join(' ')`, no dedupe/conflict resolution. Replaced the duplicated local `joinClasses`/`.filter(Boolean).join(' ')` idiom across 11 F1.4/F1.5 files (`Text`, `Button`, `Card`, `Divider`, `IconButton`, `Skeleton`, `Screen`, `ScreenHeader`, `Section`, `TextField`) — behavior-preserving, confirmed by the full test suite still passing after the sweep. `Avatar`/`Badge`/`StatusChip`/`ListItem` were deliberately left alone: their `.join(' ')` calls have no conditional/falsy entries, so there was nothing for `cn()` to fix.
- **`lib/storage.ts`:** one shared `createMMKV({ id: 'societyledger' })` instance + typed helpers (`get/setString`, `get/setBoolean`, `get/setNumber`, `get/setObject` — JSON — `remove`). **Absorbed `ThemeProvider.tsx`'s (F1.2) own dedicated instance** — same `id`, so existing persisted `prefs.themeMode` values survive; `ThemeProvider`'s public API (`useThemeMode`/`useThemeTokens`) is unchanged.
- **`lib/secure.ts`:** `loadTokenCache()` (call once at boot — not yet wired into `app/_layout.tsx`, no boot sequence exists until F1.7), `getTokenCache()` (sync, memory-only), `setTokens(partial)`/`clearTokens()` (update both memory and SecureStore). Keys `sl.accessToken`/`sl.refreshToken`/`sl.accessExpiresAt`, `keychainAccessible: AFTER_FIRST_UNLOCK`.
- **`lib/money.ts`:** `toDecimal()`, `formatMoney()`, `sumMoney()` — absorbed from `Money.tsx` (F1.4), which now imports from here instead of owning its own copy (props unchanged). No static `Decimal.sum(...)` on `decimal.js-light` (that's full `decimal.js`) — `sumMoney()` reduces manually with `.plus()`. 100% test coverage (statements/branches/functions/lines, verified with a real `--coverage` run, not just "tests exist" — this feature's DoD).
- **`lib/dates.ts`:** `formatDate(iso, variant)` — `'short'` ("Tue 14 Oct"), `'long'` ("14 Oct 2026"), `'time'` ("3:30 PM"), `'monthYear'` ("October 2026"), `'relative'` (`formatDistanceToNowStrict`, e.g. "5 minutes ago"). No built-in "Today, 3:30 PM" variant — compose it yourself from the also-exported `isToday(iso)` + `formatDate(iso, 'time')`. No `date-fns-tz`: this machine's (and real users') local timezone is already `Africa/Lagos` (confirmed via `Intl.DateTimeFormat().resolvedOptions().timeZone`; no DST in Nigeria), so plain local-time formatting already matches. Absorbed `DateField.tsx`'s (F1.5) temporary `Intl.DateTimeFormat`. 100% test coverage.
- **`lib/i18n.ts` + `en.json`:** `t(key, params?)` — flat `domain.screen.element` string keys (code-standards.md §2), `{{param}}` placeholder substitution. Only the handful of keys actually needed exist so far (`common.*`, `errors.*`, one `validation.*` example) — don't pre-populate speculative keys for screens that don't exist yet.
- **`lib/permissions.ts`:** `PERMISSIONS` alias map copied **verbatim from `apps/api/src/lib/permissions.ts`** (not web's copy), plus `can`/`canAny`/`canAll` operating on a real `permissions: string[]`. **Resolved the MEETING_MINUTES/MEETING_ATTENDANCE drift** project-overview.md §6.9 flagged — found that the API side was already fixed during Track R's G26 (real dedicated keys `meetings.manage_minutes`/`meetings.manage_attendance`, confirmed server-enforced), but `apps/web`'s own copy was never updated to match — a real, live, currently-unfixed gap, logged as new gap **G94** in `progress-tracker.md` rather than fixed here (out of mobile's scope, architecture.md rule #14) or silently ignored. 100% test coverage.
- **`lib/docs.ts`:** `docsUrl(path, surface)` (mirrors `apps/web/src/lib/docs.ts`'s shape exactly — UTM-tagged, `EXPO_PUBLIC_DOCS_URL`-based; no `URL`/`URLSearchParams` object, since that's not reliably available in Hermes without a polyfill this app doesn't carry — plain string concatenation instead), `getDocsPathForScreen(screenId)` (looks up the shared `DOCS_LINKS` from `@societyledger/shared`, a new workspace dependency), `openDocs(screenId)` (opens the in-app browser via `expo-web-browser`'s `openBrowserAsync` — pulled forward ahead of the Paystack flow that originally motivated listing that package; never opens a plan-billing path, per rule #16).
- **`hooks/useCan.ts`:** `useCan(alias | alias[])` — the only way components check permissions (architecture.md §7.4). Reads `stores/session`'s `permissions` array (F1.6's minimal pull-forward shape at the time this line was written — see F1.7's section below for the expanded real shape; `useCan`'s own public API never changed).
- **`hooks/useOnline.ts` / `hooks/useAppState.ts`:** thin reactive wrappers over `@react-native-community/netinfo` and RN's core `AppState`. `useAppState` needed an explicit `as AppStateStatus` cast — RN's generated `.d.ts` types `AppState.currentState` as a loose `string | null | undefined`, not narrowed to the real `AppStateStatus` union.
- **`stores/session.ts` — a deliberate minimal pull-forward:** `{ permissions: string[]; setPermissions }` only, via `zustand` (upgraded from `expo install`'s auto-resolved 4.x to the documented 5.x). Exists solely so `useCan` has somewhere real to read from; F1.7 expands it into the full session store (user, tokens, `requiresOnboarding`, populated from `/auth/me`) without changing `useCan`'s public API — same precedent as F1.2's `ThemeProvider` MMKV instance and F1.4's `Money` decimal helpers.

## API client, error handling & session state (F1.7)
Not reusable UI components, but the `api/`/`stores/`/`providers/` foundation every future screen's data-fetching relies on.
- **`api/client.ts`:** one `axios` instance, `baseURL: ${EXPO_PUBLIC_API_URL}/api`. Request interceptor attaches `X-Tenant` (`stores/tenant`), a bearer token (proactively refreshed when under 60s from expiry), `X-Client: mobile`, `X-App-Version`. Response interceptor: 401 → single-flight `refreshSession()` (one shared in-flight promise so N concurrent 401s trigger exactly one `/auth/refresh` call, all retried with the new token) → on refresh failure, `forceSignOut()` (clears SecureStore, resets `stores/session` + `stores/modules`, toasts "Session expired"). 403 with `error: 'MODULE_DISABLED' | 'FEATURE_DISABLED'` → `useModulesStore.getState().markDisabled(module)`. Everything rethrows as `ApiError`. Verified by 6 real tests (`client.test.ts`, via `axios-mock-adapter`): single-flight dedup, sign-out on failed refresh, both disabled-error variants, 429 not retried, tokens never logged.
- **`api/errors.ts`:** `ApiError` — one normalized shape for network failures (`isNetwork`), timeouts (`isTimeout`, detected via `error.code === 'ECONNABORTED'`), and real HTTP failures (`status`, `code?`, `fieldErrors?` from the API's zod-issue-shaped `errors[]`). `ApiError.fromAxiosError()` is the single conversion point — nothing else constructs one from a raw `AxiosError`.
- **`api/envelope.ts`:** `unwrap(responsePromise)` — the one place that reads the API's `{success:true,data}` / `{success:false,message,code}` envelope, including the rare 2xx-with-`success:false` case; every API call site gets back plain `T`, never the envelope.
- **`stores/tenant.ts` (new):** `current`/`recent` (max 5, deduped by subdomain), persisted via `zustand/persist` on an MMKV-backed `StateStorage` adapter (`lib/storage.ts`'s shared instance, key `tenant.store`).
- **`stores/modules.ts` (new):** `disabled: Set<string>` + `markDisabled`/`isDisabled`/`reset`, in-memory only (not persisted — re-derived from the next 403, or cleared on sign-out).
- **`stores/session.ts` — expanded from F1.6's minimal pull-forward to its real shape:** `user: SessionUser | null` (`id`, `email`, `role`, `permissions`, `roles`, `requiresOnboarding`, `platformRole`, `member`), `status: 'idle' | 'authenticated' | 'unauthenticated'` (starts `'idle'`, distinct from `'unauthenticated'` — lets a boot-time "checking session" state differ from "confirmed signed out"), `setUser`/`setStatus`/`reset`. `useCan`'s selector changed internally (`state.user?.permissions`) but its public signature is unchanged.
- **`providers/QueryProvider.tsx`:** one `QueryClient` (`staleTime: 60s`, `gcTime: 24h`, retries only `ApiError`s with `isNetwork: true`, up to twice) wrapped in `PersistQueryClientProvider` with an MMKV-backed `AsyncStoragePersister`; `shouldDehydrateQuery` only persists query keys whose domain segment is in `PERSISTED_DOMAINS`. `onlineManager` wired to NetInfo, `focusManager` to `AppState`. Mounted in `app/_layout.tsx`, outermost (inside `GestureHandlerRootView`), alongside a boot-time `loadTokenCache()` call.
- **Architecture-doc gap, resolved pragmatically, not silently:** `architecture.md §5`'s layer-import table omits `stores/modules` from `api/client.ts`'s allowed imports, but the doc's own data-flow diagram and this feature's build-plan bullet both require the 403→store write. `client.ts` imports it anyway — the table is treated as an incomplete enumeration, not a hard boundary; flagged in `library-docs.md` for the table to be tightened in a future pass.
- **Testing-stack correction (affects every future feature's tests, not just this one):** `msw` — the tool `library-docs.md`/`code-standards.md` previously named for all mocked-HTTP tests — turned out to be unusable here: no `msw/native` export, ESM-only dependency tree, and even once importable, `msw/node`'s `setupServer` never intercepted axios because axios resolves to its browser build under `jest-expo` (no `XMLHttpRequest`, no real `fetch`-based interception point msw can hook). Switched to `axios-mock-adapter` (wraps the axios instance directly), verified via `client.test.ts`. Full root-cause detail and the doc corrections are in `library-docs.md`'s "Testing stack" section.
- **`renderHook()` is `async` too, same class of gap as `render()`:** `@testing-library/react-native@14.1.0`'s `renderHook()` (confirmed by reading `dist/render-hook.js`) must be awaited — an un-awaited call destructures `{ result: undefined }`, so `result.current` throws rather than failing with an obvious "did you forget await" message. Hit and fixed in `useCan.test.tsx`.

## App shell & navigation skeleton (F1.8)
Not components — the route structure, guard and deep-link parser build-plan.md F1.8 asks for.
- **`app/index.tsx`:** the F1.2 design-tokens proof screen that lived here moved to `app/(dev)/tokens.tsx` (reachable via `/_sitemap`, same as `(dev)/gallery`). This route was a placeholder `<Redirect href="/(app)/(tabs)/home" />` until F2.1 built the real bootstrap — see that section below.
- **`app/(app)/_layout.tsx` — the one guard (architecture.md §5):** reads `useSessionStore`'s `status`; anything other than `'authenticated'` (both the boot-time `'idle'` and signed-out `'unauthenticated'`) returns `<Redirect href="/(auth)/welcome" />`, else renders a plain `<Stack screenOptions={{ headerShown: false }} />`. Tested directly (`_layout.test.tsx`, 3 tests) by mocking `expo-router`'s `Redirect`/`Stack` and driving `useSessionStore` — avoids pulling in the full router tree (every `(tabs)` screen, MMKV-backed stores) just to test a branch. Independently reconfirmed by `expo export -p web`'s own static prerender: every `(app)/*` route came back as an empty shell at build time, because the guard fires there too (no session exists at build time) and redirects before any screen content renders.
- **`app/(app)/(tabs)/_layout.tsx`:** 5 tabs (Home, Money, Community, Manage, Profile) via `Tabs` from **`expo-router/tabs`** — not the root `expo-router` export, which is deprecated in this SDK (see `library-docs.md`'s Expo Router section). Custom `tabBar={(props) => <TabBar {...props} />}`. Manage tab visibility: `href: canManage ? undefined : null` where `canManage = useCan(MANAGE_TAB_PERMISSIONS)` — a new exported array in `lib/permissions.ts` (project-overview.md §6.9's "visible if" column, one alias per Manage section).
- **5 tab-root placeholder screens** (`home`, `money`, `community`, `manage`, `profile` — each `index.tsx` only, no nested `_layout.tsx` yet, added only once a detail screen under that tab needs one) + **`app/(app)/notifications/index.tsx`:** `ScreenHeader` (large title) + a header-bell `IconButton` (`Bell`, no unread badge yet — that's F3.2) that pushes to `/(app)/notifications`, + `EmptyState` naming which future feature fills the tab in. All placeholders, replaced screen-by-screen as Phase 2/3 features land — not a shared abstraction, since each will become structurally different real content.
- **`app/(auth)/_layout.tsx` + `app/(auth)/welcome.tsx`:** `welcome` was a placeholder `EmptyState` (real content at F2.1 — see below). The other 11 architecture.md-listed `(auth)` screens (association, login, register, verify-email, forgot/reset-password, accept-invite, pending, blocked, web-only, create-association) were deliberately **not** stubbed at F1.8 — they get real content at F2.1–F2.3, and empty stand-ins then would just have been churn to redo.
- **Deliberately out of scope, not stubbed:** the `(lock)/unlock.tsx` group (F2.4 — app lock) and the `onboarding/*` group (no build-plan feature has claimed it yet) — neither is referenced by any guard this feature builds, so there's no "Unmatched Route" risk from omitting them. Modal-presented routes (`presentation: 'modal'`) aren't configured anywhere either — no form screen exists yet to need one; the first feature that adds one configures it at that point.
- **`lib/linking.ts`:** `parseDeepLink(url)` — zod-validates `societyledger://invite`, `.../reset-password`, `.../payments/return`, `.../notifications/<route>` into a typed `DeepLink | null` (architecture.md §8.3). Uses `expo-linking`'s `Linking.parse()`, not the DOM `URL`/`URLSearchParams` API (confirmed at F1.6 not reliably available under Hermes without a polyfill this app doesn't carry). 100% test coverage (10 tests) — needed mocking `expo-constants` to avoid a real Jest-only crash inside `Linking.parse()` itself (`library-docs.md`'s Testing stack note has the full diagnosis). Wiring into `+native-intent.tsx` is deferred to F2.3, when Accept Invite/Reset Password exist to route to.
- **`lib/permissions.ts`:** added `MANAGE_TAB_PERMISSIONS: PermissionAlias[]` — one alias per Manage section from project-overview.md §6.9, used directly as `useCan(MANAGE_TAB_PERMISSIONS)` (no new helper function needed; `useCan` already accepts an alias array and runs `canAny`).
- **Found and fixed in passing (environment/tooling, not app code):** Expo Router's typed-routes declaration (`.expo/types/router.d.ts`) is only regenerated by the live `expo start` dev server, never by `expo export` — `tsc --noEmit` showed phantom "not assignable" errors against every new route's `href` until a brief `expo start` run caught up. Documented in `library-docs.md` so the next feature that adds routes doesn't re-diagnose this from scratch.

## Mobile Phase 2 — Auth & tenant lookup (F2.1)
First features in `src/features/*`/`src/api/endpoints/*` — the layering `code-standards.md §3/§6/§7` describes, with nothing built against it yet before this. All pieces below are one-off (used by exactly one screen each), so none are promoted to "Shared feature components"/the Index per this file's own registration rule.
- **`app/index.tsx` — the real splash (A1):** `features/session/useBootstrap.ts`'s `useSessionBootstrap()` reads `lib/secure`'s token cache; no token → `/(auth)/welcome`; a token → `GET /auth/me` (`api/endpoints/auth.ts`'s new `authApi.getMe`) → `features/session/mappers.ts`'s `mapMeUserToSessionUser()` populates `stores/session` → `/(app)/(tabs)/home`. **Deliberately simple, not F2.4's job duplicated:** no cached-`/auth/me` instant UI, no foreground re-validation, and `platformRole`/`requiresOnboarding` both route to tabs for now (A12 and the onboarding wizard don't exist yet — Phase 8). A network/timeout failure leaves the stored refresh token alone (still routes to Welcome, since there's no offline-cache fallback yet); a genuine 401/403 auth rejection clears it. `(app)/_layout.tsx`'s guard comment updated to describe this as the real source of `setUser`/`setStatus`, not a to-do.
- **`app/(auth)/welcome.tsx` — the real carousel (A2):** `features/auth/components/WelcomeCarousel.tsx` — plain paging `ScrollView` + dot indicators (no new carousel dependency; nothing else needs one yet), 3 slides, Lucide icons (no illustration assets exist). "Get started" → `/(auth)/association`; "Create an association" (A13, not built before Mobile Phase 8) is a `toast`, not a dead route.
- **`app/(auth)/association.tsx` — Association Code (A3):** debounced lookup via `hooks/useDebouncedValue.ts` (new, generic 400ms debounce — `SearchField` has its own inline copy of the same idea for its narrower case) feeding `features/tenant/queries.ts`'s `useCheckSubdomain` (`api/endpoints/associations.ts`). Client-side rejects reserved subdomains (`features/tenant/schemas.ts`'s `associationCodeSchema`, using `@societyledger/shared`'s `RESERVED_SUBDOMAINS` — same list the server checks) before ever calling the API. **`SUSPENDED` is not an HTTP error** — `check-subdomain` returns `success: true` with `status: 'SUSPENDED'` (only `CANCELLED` is a 403) — so `features/tenant/components/AssociationConfirmationCard.tsx` branches on `tenant.status` itself: `ACTIVE` shows the Continue button, anything else shows the suspended message instead. Logo via `lib/assets.ts`'s new `resolveAssetUrl()` (prefixes a relative `/uploads/...` path with the API origin) + `expo-image` (newly installed, pre-approved in `library-docs.md`), falling back to `Avatar` when there's no logo. Recent list (`features/tenant/components/RecentAssociationsList.tsx`) reads `stores/tenant`'s existing `recent[]`; picking one sets it current and continues without re-fetching.
- **Backend fix, found while verifying A5 ahead of F2.3:** `POST /member-invites/self-register` (the endpoint mobile will use for Register, since `/auth/register` creates a bare `User` with no `Member` at all — a pre-existing, real gap, not a mobile-specific one) never checked the association's `selfSignupEnabled` setting, unlike `/auth/register`. Fixed in `member-invites.controller.ts` (same `403 SELF_SIGNUP_DISABLED` gate) — owner-directed, in scope despite architecture.md rule #14's mobile-backend restriction, since this closes a real security/correctness gap rather than adding new behaviour.

## Mobile Phase 2 — Login & account states (F2.2)
- **`app/(auth)/login.tsx` — the real form (A4), replacing F2.1's placeholder:** `features/auth/schemas.ts`'s `loginSchema` + `features/auth/mutations.ts`'s `useLogin()` (`POST /auth/login` via `api/endpoints/auth.ts`'s new `authApi.login`) — on success, stores the mobile token pair (`lib/secure.setTokens`, always present since `client.ts` always sends `X-Client: mobile`) and populates `stores/session` via new `features/auth/mappers.ts`'s `mapLoginUserToSessionUser()` (the login-shape counterpart to F2.1's `/me`-shape mapper), then `router.replace`s to tabs. New `features/auth/components/AssociationBadge.tsx` ("tap to change" row at the top) reuses `ListItem` the same way `RecentAssociationsList` does. Error-code routing is a lookup table on the screen itself (`code-standards.md §4` — routing logic belongs in the route, not the mutation hook): `EMAIL_NOT_VERIFIED` → `verify-email` (with `email` param), `PENDING_APPROVAL` → `pending`, `PLATFORM_LOGIN_REQUIRED` → `web-only`, `ACCOUNT_REJECTED`/`ACCOUNT_SUSPENDED`/`ASSOCIATION_SUSPENDED`/`ASSOCIATION_CANCELLED`/`ASSOCIATION_NOT_FOUND` → `blocked` with a `variant` param, `429` → a fixed rate-limit toast, anything else → `error.message` as a toast (already user-facing text, per `code-standards.md §10`).
- **`app/(auth)/verify-email.tsx` (A6):** `OtpInput` (built at F1.5, first real use) + `features/auth/mutations.ts`'s `useVerifyEmail()`/`useResendVerification()` (`POST /auth/verify-email`/`/auth/resend-verification`). 60s resend cooldown via a plain `setInterval`, not a new dependency. On success, always continues to `pending` (the API's own success message says every self-registered account needs admin approval next, regardless of whether email verification itself had a pending approval attached).
- **`app/(auth)/pending.tsx` (A10):** "Check again" returns to Login with `email` prefilled (new, local — no deep link reaches this screen yet) rather than re-attempting the login call directly: no password is kept around once Login's screen unmounts, by design, so there's nothing to retry with. "Sign out" clears the tenant and returns to Welcome (nothing to revoke server-side — login never succeeded).
- **`app/(auth)/blocked.tsx` (A11):** one screen, 5 copy variants keyed by a `variant` route param (`account-rejected`/`account-suspended`/`association-suspended`/`association-cancelled`/`association-not-found`) validated by new `lib/params.ts`'s `parseParams()` (code-standards.md §4's named-but-previously-unbuilt pattern — returns `null` on a bad param rather than throwing, since no root `ErrorBoundary` exists yet). "Contact support" opens `mailto:support@societyledger.com.ng` (the `.com.ng` address, matching R6.16/G68's consistency decision); "Switch association" clears the tenant and returns to Welcome.
- **`app/(auth)/web-only.tsx` (A12):** plain text + a new `expo-clipboard` copy button for `admin.societyledger.com.ng` — deliberately no link button (project-overview.md §6.1 — avoid steering staff credentials through a phone flow). "Sign out" same as Pending/Blocked.
- **New shared test infra, not a UI component:** `src/test-utils/renderWithProviders.tsx`'s `renderHookWithQueryClient()` — this feature's `useLogin`/etc. tests are this app's first `@tanstack/react-query` hook tests. **QueryClient-only** on purpose, not the fuller theme/safe-area/bottom-sheet wrapper `library-docs.md` previously (and incorrectly) described as already built — see that file's corrected "Testing stack" entry for why.

## Mobile Phase 2 — Register, forgot/reset password, accept invite (F2.3)
- **`app/(auth)/register.tsx` (A5), replacing F2.2's placeholder:** new `features/auth/schemas.ts`'s `registerSchema` (password/confirm match via `.refine`, `acceptTerms` via `z.boolean().refine` — not `z.literal(true, {message})`, which this zod 3.x pin doesn't accept that form of) + new `useSelfRegister()` (`POST /member-invites/self-register` via new `api/endpoints/memberInvites.ts` — never `/auth/register`, per F2.1's finding). Always continues to `verify-email.tsx` (F2.2, reused as-is) with the email prefilled — self-registered accounts are never pre-verified.
- **`app/(auth)/forgot-password.tsx` (A7), replacing F2.2's placeholder:** new `useForgotPassword()` (`POST /auth/forgot-password`). Shows a persistent "Check your email" success state in place of the form (not a toast-and-navigate) — matches the API's own always-succeeds, no-enumeration behaviour.
- **`app/(auth)/reset-password.tsx` (A8), new:** reached only via `app/+native-intent.tsx`'s deep-link rewrite. New `features/auth/schemas.ts`'s `newPasswordSchema` (shared "choose a password" shape, reused by Accept Invite too) + new `useResetPassword()` (`POST /auth/reset-password`). **Real finding:** `associationId` scoping is optional server-side for this endpoint (`auth.service.ts`'s `resetPassword`) — the reset itself works with no tenant resolved at all; the screen resolves one anyway (reusing F2.1's `features/tenant/queries.ts`'s `useCheckSubdomain` with the deep link's `tenant` param) purely so Login works directly afterward without bouncing to Association Code.
- **`app/(auth)/accept-invite.tsx` (A9), new:** reached only via the deep-link rewrite. New `features/auth/queries.ts`'s `useVerifyInvite()` (`GET /member-invites/verify?token=`, no tenant needed — no `tenantMiddleware` on that route) resolves the invite; its response's `association.subdomain` (server-confirmed, not a client param) feeds the same `useCheckSubdomain` to set the tenant store. New `useAcceptInvite()` (`POST /member-invites/accept`) stores the returned mobile token pair but builds no `SessionUser` — the response is too thin (no `permissions`/`roles`/`requiresOnboarding`) — so the screen hands off to `/` and lets F2.1's `useSessionBootstrap` re-derive the full session from `/auth/me`, the same path a normal login takes, instead of a third duplicate mapper. Skeleton-shaped loading state (not a spinner, per ui-rules.md §5.11) while the invite verifies; an invalid/expired/already-used token is a terminal `EmptyState`, not an `ErrorState` (no "Try again" makes sense for a dead link).
- **`app/+native-intent.tsx`, new:** wires F1.8's `lib/linking.ts` (deferred twice, until these screens existed) into Expo Router's `redirectSystemPath`. `invite` links don't carry a `tenant` param forward (Accept Invite derives it from the verify response instead); `resetPassword` links do. `paymentsReturn` (F2.8) and `notifications` (F3.x) fall through unchanged — not wired to a screen yet.
- **New DTOs:** `types/api/memberInvites.ts` (`VerifyInviteResponseDTO`, `AcceptInviteResponseDTO`, `SelfRegisterResponseDTO`).

## Mobile Phase 2 — Session lifecycle & app lock (F2.4)
- **`features/session/queries.ts`'s `useMe()`, new — makes the splash bootstrap cache-first:** `features/session/useBootstrap.ts` refactored from a plain async function into a `useQuery` consumer. The query key `['session', 'me']` deliberately matches `QueryProvider.tsx`'s `PERSISTED_DOMAINS` allow-list (added at F1.7, unused until now) — a previous session's persisted `/auth/me` response rehydrates into `data` before the network call resolves, giving an instant route decision on a warm start. `staleTime: 5min` alone gets "refetch on foreground" for free, since `QueryProvider.tsx`'s `focusManager` is already wired to `AppState`. **Real nuance handled:** once cached `data` exists, a failed background refetch shows up as `isRefetchError` (status stays `'success'`), not `isError` — the bootstrap's error-handling effect checks both.
- **`features/session/mutations.ts`'s `useLogout()`, new:** `POST /auth/logout` is best-effort (a documented exception to "never swallow errors silently" — local state wipes regardless of the server call's outcome). Takes an options to accept `{ clearTenant?: boolean }` — plain sign-out keeps the tenant (quick re-login), "Switch association" also clears it. Wired to new minimal rows on the `(tabs)/profile` placeholder (`Security`, `Switch association`, `Sign out`) — not the real P1 menu (F3.3's), but the only way to reach this logic for real before then.
- **`stores/appLock.ts`, new:** `isLocked`, deliberately **not persisted** — starting `true` on every cold start (fresh JS process) is "lock on cold start" for free, no special-casing. `stores/prefs.ts`, new (first real use of code-standards.md §9's reserved "prefs" store slot): `biometricsEnabled`, `autoLockMinutes` (default 5), `hasSeenBiometricPrompt`, persisted under the existing `prefs.*` MMKV namespace. Theme itself stays on `ThemeProvider`'s own separate mechanism (F1.2) — not migrated into this store, out of scope here.
- **`app/(lock)/unlock.tsx` (A14), new:** prompts device auth on mount; "Sign out" is a full `useLogout()`, not just a lock bypass. `app/(app)/_layout.tsx`'s guard extended with a second gate (`isLocked && biometricsEnabled` → redirect here) and now mounts new `hooks/useAutoLockTimer.ts` (re-locks after `autoLockMinutes` spent backgrounded — a plain `AppState` timer, no new dependency) and new `components/feedback/PrivacyOverlay.tsx` (an opaque `bg-bg` cover, not an actual blur — no blur library installed, and a solid cover hides the OS app-switcher snapshot equally well).
- **`app/(app)/(tabs)/profile/security.tsx` (P3), new — biometric toggle + auto-lock timeout only** (password change/sessions list are F3.3's). Deliberately a plain-controlled toggle (raw `RNSwitch`), not the RHF-bound `components/forms/Switch` — same "applies immediately, no submitted form value" reasoning F1.5 used for `SearchField`/`SegmentedControl`. Enabling re-verifies with a real device prompt before flipping the flag, not just a UI toggle.
- **`features/auth/components/BiometricOptInSheet.tsx`, new:** "prompted once after first login" (architecture.md §7.5) — wired into `login.tsx`'s success path, gated on device support + `prefs.hasSeenBiometricPrompt`, not shown unconditionally.
- **`hooks/useReauth.ts` + `lib/biometrics.ts`, new:** the reusable re-auth primitive for future sensitive actions (first real caller is likely F3.5's ballot). **Simplified from library-docs.md's own note** ("if none set, shows password confirm sheet"): resolves `false` with an explanatory toast instead of a global confirm-sheet singleton — no real caller exists yet to validate that UX against; revisit when one lands.
- **`app.config.ts`:** `ios.infoPlist.NSFaceIDUsageDescription` added directly (not a `plugins` array entry — confirmed `expo-local-authentication` ships no `app.plugin.js`, unlike `expo-image-picker`'s permission-string pattern two rows above it).

## Mobile Phase 2 — Home (F2.5)
- **`app/(app)/(tabs)/home/index.tsx` (H1), replaced:** The real Home screen. `getGreeting()` picks morning/afternoon/evening copy from `new Date().getHours()` — no caching (render frequency is low enough). `refreshing` watches `isRefetching` on the three always-visible queries (`summaryQuery`, `paymentsQuery`, `announcementsQuery`) — meetings/voting are also refetched on pull-to-refresh only when the user has the required permission. Header shows the association `Avatar` (square, tinted with `tenant.primaryColor`) + bell `IconButton` → `/(app)/notifications`. Every detail route that doesn't exist yet (payment history, payment detail, announcement detail, meeting detail, voting) opens a "coming soon" toast — same convention as F2.1/F2.5's `QuickActionsGrid`.
- **`features/home/components/RecentPaymentsList.tsx`, new:** Renders the 3 most recent payments from `useMemberPayments()` (the full history — this component slices `[0,3]` itself, per the build-plan's "no server-side slice" finding). Row type derived as `Awaited<ReturnType<typeof memberFinanceApi.getPayments>>[number]` — no manually-maintained local type. Status chip always "paid" (the payments endpoint only returns confirmed records). Shows `EmptyState` for zero rows (not a silent degrade — empty-list is a legitimate state to communicate). Error shows `InlineErrorRow`.
- **`features/home/components/AnnouncementsList.tsx`, new:** Renders up to 3 announcement notifications (pre-filtered by `useAnnouncements`'s client-side `type === 'announcement'` filter — `GET /notifications` has no type param). Each row's `Megaphone` icon is `color.primary` for unread, `color.textTertiary` for read. No permission gate (every member can see announcements). Shows `EmptyState` (not a silent degrade), error shows `InlineErrorRow`.
- **`features/home/components/InlineErrorRow.tsx`:** In-row error pattern (title + "Try again" `TextButton`) for sections that shouldn't crash the whole screen on failure — BalanceCard (F2.5 earlier), RecentPaymentsList, AnnouncementsList, UpcomingMeetingCard, ActiveVoteCard all use it.
- **`features/notifications/queries.ts`'s `useAnnouncements(limit)`:** `GET /notifications` → client-side filter `type === 'announcement'`, then `slice(0, limit)` via `select`. No permission gate. Query key `[tenant, 'notifications', 'announcements', limit]`.
- **`features/meetings/queries.ts`'s `useUpcomingMeetings(limit)`:** `GET /meetings` (the member-facing "my upcoming meetings" endpoint, confirmed by reading the real controller). Gated by `MEETING_VIEW` permission (`enabled: canViewMeetings` in callers).
- **`features/voting/queries.ts`'s `useActiveVoting()`:** `GET /voting/active`. Gated by `ELECTION_VIEW` permission.
- **`features/memberFinance/queries.ts`'s `useMemberPayments()` note:** Returns the full newest-first history; no server-side limit. Callers slice to their preview size (H1 uses 3).
- **i18n:** 44 new `home.*` keys added to `src/lib/en.json` (greeting morning/afternoon/evening/plain, balance, meeting, vote, quickActions × 6, payments, announcements).
- **Route type fix:** `app/+native-intent.test.ts` renamed → `app/native-intent.test.ts`. Expo Router SDK 58's route scanner treats any `app/+*.ts` file that isn't one of the reserved special prefixes (`+html`, `+native-intent.tsx`, `+api`, `+middleware`) as an invalid route, causing a hard Metro error. The rename unblocked `expo start` and allowed `.expo/types/router.d.ts` to be regenerated with the full route union (47 → 57 routes now that Phase 2 screens are present). The `+native-intent.tsx` route itself is unaffected.

## Mobile Phase 2 — Premium auth surface (F2.5a, 2026-10-21)

A design language for status/auth screens: gold-rimmed hero badge, letterspaced wordmark,
forest-green-to-gold accent rule, and a green→gold gradient CTA. Built as **shared primitives,
not per-screen styling**, so screens added later inherit it by composition.

### `Button` — `gradient` and `accent-ghost` variants
- **Path:** `src/components/ui/Button.tsx`
- **`gradient`:** the premium primary CTA. Renders an `react-native-svg` `LinearGradient`
  (`ctaGradientFrom` → `accent` → `ctaGradientTo`) behind the label; label tone `onCtaGradient`.
  **Every primary CTA in the app uses this** — adopting it on a new screen is one prop.
- **`accent-ghost`:** gold text-only secondary (replaces `ghost` where the action is a de-escalation
  like "Sign out").
- **Pill radius is a style value, not a class.** `SIZE_CLASSES[size].radius` is half the container
  height (lg 27 / md 22 / sm 18) and feeds both the container `borderRadius` and the SVG `rect`'s
  `rx`. **An SVG `rect` clamps `rx` to half the _width_,** so a "fully round" value like `rx="999"`
  turns a wide button into an ellipse rather than a pill. It also sidesteps `twMerge` ordering,
  since `SIZE_CLASSES.container` is applied after `CONTAINER_CLASSES` and would win a class war.
- **Gradient `id`s are per-instance** (`useId()`): SVG gradient ids are global, so two gradient
  Buttons on one screen would otherwise share one definition.

### `AuthHeroScreen`
- **Path:** `src/components/layout/AuthHeroScreen.tsx`
- **Props:** `icon`, `title`, `description?`, `wordmark?`, `children`, `actions`
- **Purpose:** the standard status/auth layout — badge, wordmark, title, accent rule, description,
  body, actions. **Use this for any new status screen** rather than hand-rolling the composition.
- **Two layout invariants it exists to protect** (both cost a debugging cycle to find):
  1. **It passes `Screen scroll={false}` and owns its own `ScrollView`.** `flex: 1` has no effect
     inside a ScrollView's content container, so the default `Screen` (which *is* a ScrollView)
     silently collapses any `flex: 1` child to zero height — cards lose their background and
     siblings overlap.
  2. **Its content container sets no `alignItems`.** `alignItems: 'center'` makes Yoga size children
     to their content on the cross axis, so a nested `width: '100%'` has no resolved parent width
     and collapses — an icon-and-text row renders as a bare icon with its text gone. Children
     stretch; individual pieces centre via `alignSelf` / `align="center"`.
- `flexGrow: 1` + `justifyContent: 'center'` centres while content fits and scrolls once it doesn't.
  `actions` live **inside** the centred group so the gap above them is a constant (28dp / 22dp
  compact) instead of absorbing every spare pixel on a tall device.

### `HeroBadge`, `AccentRule`
- **Paths:** `src/components/ui/HeroBadge.tsx`, `src/components/ui/AccentRule.tsx`
- `HeroBadge` — gold-rimmed arch (top radius = width/2, bottom 16) with a green gradient fill;
  self-shrinks under 760dp viewport height. `AccentRule` — the 64×3 gold gradient divider.
  Both are decorative by default and hidden from assistive tech unless given a label.

### `SupportCard`
- **Path:** `src/components/feedback/SupportCard.tsx`
- **Props:** `message` (required), `nudge?`, `nudgeLabel?`
- Two-part WhatsApp block: a lead-in nudge row, then the card (brand logo as an SVG `Path`,
  "Need help?", the number, an inset action chip). Opens `wa.me/<number>?text=<message>` so the
  chat is **pre-drafted** — callers pass an account-identifying message. `encodeURIComponent` is
  required: the copy contains apostrophes that otherwise truncate the draft.
- `WHATSAPP_GREEN` is a literal by design — a third-party brand mark, not a theme colour (same
  rationale as `on-passbook` being literal white).

### Tokens added
`ctaGradientFrom` `#1B4332`, `ctaGradientTo` `#D4AF37`, `onCtaGradient` `#0A1F14` — theme-independent,
following the `passbook` pattern: present in **both** `tokens.ts` theme objects but declared only in
`global.css`'s `:root`, which is what lets `tokens.test.ts` skip the dark-mode check. Also mapped in
`tailwind.config.js` (`cta-gradient-from/to`, `on-cta-gradient`) and exposed as the `onCtaGradient`
`Text` tone.

### Adopted by
`pending`, `blocked`, `web-only` (via `AuthHeroScreen`); `welcome`, `login`, `register`,
`forgot-password`, `reset-password`, `verify-email`, `accept-invite`, `unlock` (gradient CTA);
`association`, `login`, `register`, `forgot-password`, `reset-password` (`AuthBrandMark`, restyled
to the gold-rimmed tile + letterspaced wordmark + accent rule).

## Mobile Phase 2 — Money overview & ledger (F2.6, 2026-10-21)

5 screens in `app/(app)/(tabs)/money/`: `index.tsx` (M1), `ledger/index.tsx` (M6),
`ledger/statement.tsx` (M7), `payments.tsx` (M13), `transaction/[id].tsx` (M14).
New API layer: `src/api/endpoints/memberLedger.ts` + `src/features/memberLedger/queries.ts`.

### Route paths — nested index.tsx behaviour
Expo Router registers a nested `index.tsx` (one that is not the tab's own index) at the
**directory path without `/index`**. The `router.d.ts` shows `/money/ledger`, not `/money/ledger/index`.
Only the tab-root `index.tsx` files (e.g. `money/index.tsx`) map to `/money`. Always check
`.expo/types/router.d.ts` before hardcoding a path.

### Money Overview (M1) — `app/(app)/(tabs)/money/index.tsx`
- **`Passbook` card** at top with `label="Ledger balance"`, `amount` from ledger `currentBalance`
  (falls back to `toDecimal(summary.totalOutstanding)` while ledger is loading).
- **`stampLabel`** is either `"N OVERDUE"` or `"PAID UP"` — derived from `summary.overdueCount`.
- **Recent activity**: up to 3 `recentEntries` from ledger summary, each as a `ListItem` with a
  trailing `<View>` showing sign+amount (raw `formatMoney()` in `<Text>`) and running balance
  (`<Money>` component). **Do not nest `<Money>` inside `<Text>`** — `Money` renders its own `<Text>`.
- Quick-links to `/money/ledger`, `/money/payments`, `/money/ledger/statement`.

### My Ledger (M6) — `app/(app)/(tabs)/money/ledger/index.tsx`
- **Paginated `FlatList<ListItem>`** where `ListItem = MonthHeader | EntryItem`. Month grouping is
  done client-side in `groupByMonth()` from a flat stream of `DecimalisedEntry[]` (all pages flat-mapped).
- **Balance strip** above the list: currentBalance, totalDebits, totalCredits.
- **Sign + colour**: DEBIT entries use `color.danger`, CREDIT entries use `color.success`.
  Amount is `{isCredit ? '+' : '–'}{formatMoney(entry.amount)}` inside `<Text style={{color}}>`.
  Running balance uses `<Money value={entry.runningBalance} size="caption" tone="secondary" />`.
- **Infinite scroll**: `onEndReached` → `entriesQuery.fetchNextPage()` (only if `hasNextPage && !isFetchingNextPage`).
- `ListFooterComponent` must be `undefined` (not `null`) when there is nothing to show — FlatList's
  prop type does not accept `null`.
- `getItemLayout` returns `length: 56` for both entry rows and month headers (good enough approximation;
  exact sizes would need measurement).
- Statement navigation: `router.push('/money/ledger/statement')` via `IconButton` in `ScreenHeader.rightActions`.

### Statement (M7) — `app/(app)/(tabs)/money/ledger/statement.tsx`
- **4 preset periods** in a `as const` array: 1 / 3 / 6 / 12 months ago → today (computed at
  module-evaluation time, so dates are stable for the session).
- `const period = PERIODS[selectedIndex]!` — non-null assertion is safe because `selectedIndex` is
  bounded to `[0, PERIODS.length - 1]` by the `setSelectedIndex` calls.
- **Share**: uses `Share.share()` from React Native core (`import { Share } from 'react-native'`).
  **`expo-sharing` is not installed in this project.** The share payload is a plain text string
  built from statement data — no file system involved.
- `StickyFooter` with "Share statement" button disabled until the statement query resolves.

### Payment History (M13) — `app/(app)/(tabs)/money/payments.tsx`
- `FlatList<Payment>` where `Payment` is derived via `Awaited<ReturnType<typeof memberFinanceApi.getPayments>>[number]`.
- `METHOD_LABELS: Record<string, string>` maps the API's snake_case method keys to display strings
  with a `?? payment.paymentMethod` fallback.
- `StatusChip status="paid"` on every row — all payments returned by this endpoint are confirmed.
- **`@shopify/flash-list` is not installed.** Always use `FlatList` from `react-native`.

### Transaction Detail (M14) — `app/(app)/(tabs)/money/transaction/[id].tsx`
- `useLocalSearchParams<{ id: string }>()` extracts the dynamic segment.
- Data comes from `useMemberOutstanding()` — finds the item by `Number(id)`. No dedicated detail
  endpoint exists; the outstanding list is the source of truth.
- `EmptyState` (with `AlertCircle` icon) if the item is not found or the query is still loading.
- `Skeleton radius="lg"` (not `"xl"` — `SkeletonRadius = 'xs'|'sm'|'md'|'lg'|'full'`).

### `memberLedgerApi` — `src/api/endpoints/memberLedger.ts`
- **3 methods:** `getLedgerSummary()`, `getLedgerEntries(params?)`, `getStatement(startDate, endDate)`.
- All `MoneyValue` fields are converted via `toDecimal()` before returning — callers receive `Decimal`.
- `decimaliseEntry()` is a private helper applied to each entry in both `getLedgerEntries` and `getLedgerSummary.recentEntries`.

### TanStack Query hooks — `src/features/memberLedger/queries.ts`
- `useMyLedgerSummary()` — `useQuery`, key `[tenant, 'memberLedger', 'summary']`.
- `useMyLedgerEntries(filters?)` — `useInfiniteQuery`, `initialPageParam: 1`,
  `getNextPageParam: (lastPage) => page < totalPages ? page + 1 : undefined`.
- `useMyStatement(startDate, endDate)` — `useQuery`, `enabled: Boolean(startDate && endDate)`.
- `useMemberOutstanding()` — lives in `src/features/memberFinance/queries.ts` (calls `memberFinanceApi.getOutstanding()`).

### G18 — Ledger sync gap (fixed alongside F2.6)
`memberLedgerService.createFromTransaction()` (DEBIT) and `createFromPayment()` (CREDIT) existed
but were never called. Wired into 5 paths — all wrapped in non-critical try/catch so a ledger
failure never rolls back the payment:
1. `finance.controller.ts` — `createTransaction` (after accounting sync)
2. `finance.controller.ts` — `recordPayment` (after cache invalidation)
3. `finance.controller.ts` — bulk payments loop (per-payment, alongside accounting sync)
4. `nigerian-payments.service.ts` — reconciliation auto-match (after `onPaymentRecorded`)
5. `nigerian-payments.service.ts` — proof verification (added to `accountingSyncs` array via `.then(() => {})` to satisfy `Promise<void>` typing)

Existing data can be backfilled via admin `POST /ledger/bulk-sync`.

## Mobile Phase 2 — Dues, levies, penalties, donations (F2.7, 2026-10-21)

5 screens in `app/(app)/(tabs)/money/`: `dues.tsx` (M8), `levies.tsx` (M9), `penalties.tsx` (M10),
`donations/index.tsx` (M11+M12). M1 (`index.tsx`) updated with Breakdown section.
New: `src/types/api/memberFinance.ts` extended with 5 DTOs; `src/api/endpoints/memberFinance.ts`
extended with 5 methods; `src/features/memberFinance/queries.ts` extended with 4 hooks;
`src/features/memberFinance/mutations.ts` (new) with `useMakeDonation()`.

### My Dues (M8) — `app/(app)/(tabs)/money/dues.tsx`
- **Status filter**: 3-way `SegmentedControl` (All / Unpaid / Paid) — client-side only.
- **Outstanding banner**: red `bg-danger/10` when `totalOutstanding > 0`; green `bg-success/10` + "Your account is clear" when zero. Mirrors web's dynamic summary card exactly.
- **Pay now per row**: rendered inside `View.items-end` inside a custom row View (not `ListItem.trailing`) so the button can stack below the amount + StatusChip. Pay button routes to `/money/pay?transactionId=<id>` (F2.8 placeholder, `as never` until typed route exists).
- **DueRow** is a custom `View` (not `ListItem`) rendered inside `ListGroup` children — `ListGroup` wraps any children with dividers/border, not just `ListItem`s.
- `Decimal` is imported from `decimal.js-light` (not `decimal.js` — not installed).

### My Levies (M9) — `app/(app)/(tabs)/money/levies.tsx`
- **Progress bar**: custom `View`-based bar — `h-1.5 w-full rounded-full bg-border` outer, `bg-primary h-full rounded-full` inner with `width: pct%`. No separate library.
- `paid%` is computed as `Math.round((Number(paid) / Number(amount)) * 100)`.
- **Contribute now** button: routes to `/money/pay?transactionId=<item.transactionId>` when `transactionId` is non-null. When null (no transaction linked), shows a disabled "Contact admin to pay" button — no navigation.

### My Penalties (M10) — `app/(app)/(tabs)/money/penalties.tsx`
- Same dynamic banner pattern as M8 (danger/success). `reason` field from API (sourced from txn.notes) shown in meta; falls back to `referenceNumber`.

### My Donations + Donate (M11+M12) — `app/(app)/(tabs)/money/donations/index.tsx`
- **M11** (list) + **M12** (donate form) combined in one screen — parity with web's single page + Modal. Mobile uses `BottomSheet` (from `@gorhom/bottom-sheet`, requires `BottomSheetModalProvider` at app root) instead of a Modal.
- **Cause picker**: `SelectSheet` bound to `categoryId` field; options sourced from `donationCategories[]` returned by `GET /members/me/donations` — the member-safe source (NOT the officer-scoped `GET /finance/advanced/donations/allocations`).
- **`isAnonymous`**: `Switch` component (RHF-bound).
- **`paymentMethod`**: hardcoded `'bank_transfer'` — no picker. Matches web implementation exactly.
- **`onSubmit`** is a sync function calling `makeDonation.mutate()` — NOT `async/await`. Using `async` would cause a TS type error on `Button.onPress` (expects `(event) => void`, not `Promise<void>`).
- Pattern for calling `handleSubmit` on `Button.onPress`: `onPress={() => handleSubmit(onSubmit)()}`.

### Money Overview (M1) — Breakdown section added
- 4 new `ListItem` rows in a new "Breakdown" `Section` below the existing quick-links rail.
- `meta` strings pull live outstanding amounts from `useMemberFinanceSummary()` data when available.
- Routes use `as never` cast until F2.7's new routes appear in `router.d.ts` (dev server regenerates it on next `expo start`).

## Mobile Phase 2 — Pay online + bank transfer (F2.8 + F2.9, 2026-10-21)

New screens: `app/(app)/(tabs)/money/pay.tsx` (M2/M3/M4/M5) and
`app/(app)/(tabs)/money/transaction/[reference].tsx` (payment result, Paystack verify).
API: RBAC fixed on Paystack `initialize`/`verify` routes (added `PAYMENTS_VIEW_OWN`);
new `GET /members/me/payment-info` returns `{ paystackEnabled, bankAccounts[] }`.
New hooks: `useInitializePaystackPayment`, `useSubmitPaymentProof`, `usePaymentInfo`,
`useVerifyPaystackPayment`. `+native-intent.tsx` now routes `paymentsReturn` deep link to
`/money/transaction/[reference]`.

### Pay screen (M2/M4) — `app/(app)/(tabs)/money/pay.tsx`
- Receives `transactionId` param; finds levy in cached levies query.
- **Tab switcher**: two `TouchableOpacity` tabs — "Pay online" / "Bank transfer" — styled with `backgroundColor: color.primary` (active) vs transparent.
- **Online tab**: disabled state when `paystackEnabled === false` (EmptyState). When enabled: "Pay ₦X now" button calls `useInitializePaystackPayment`, then `WebBrowser.openAuthSessionAsync(authorizationUrl, 'societyledger://')`. On success, parses `reference` from returned URL and calls `router.replace('/money/transaction/[reference]')`.
- **Bank transfer tab**: lists active bank accounts with copy-to-clipboard per row. Attach receipt via `expo-image-picker` (gallery/camera) or `expo-document-picker` (PDF). Plain `TextInput` for optional notes (not RHF — use this pattern for non-form inputs). "Submit payment proof" calls `useSubmitPaymentProof` (multipart/form-data POST to `/nigerian-payments/proofs`).
- **Guards**: loading + error state; "Already paid" state when balance ≤ 0.

### Payment Result (M5) — `app/(app)/(tabs)/money/transaction/[reference].tsx`
- **Web parity** with `/dashboard/finance/payments/verify/page.tsx`: shows amount paid, receipt number, reference, transaction status badge, payment date on success. Shows error message + gateway response on failure.
- **Loading state**: skeleton hero + skeleton list items (no spinner-only screen).
- **Done** navigates `router.replace('/(app)/(tabs)/money')` and invalidates `summary`, `levies`, `outstanding` query keys.
- **Try again**: calls `verifyQuery.refetch()` — does not re-initialize the payment.
- Route param is `reference` (alphanumeric Paystack reference), not `id` (numeric). Lives alongside existing `[id].tsx` (transaction detail) in same directory — Expo Router resolves by param name.

## Shared feature components (used by 2+ screens)
- **`SupportCard`** — `pending` (approval-delay message) and `blocked` (access-reason message).

## Patterns (recurring compositions, not components)
- **"Coming soon" toast** — every detail route that doesn't exist yet calls `toast(t('<domain>.<action>ComingSoon'))`. Established at F2.1's Welcome screen. Used by H1 for payment detail, announcement detail, meeting detail, voting, and "See all payments". The "See all announcements" is the only H1 action that navigates to a real screen (`/(app)/notifications`).
- **Permission-gated widget** — `UpcomingMeetingCard` / `ActiveVoteCard` accept a `canView: boolean` prop and return `null` when it's `false`; the query itself is also gated (`enabled: canView`) so no request fires for unpermissioned members. Used for `MEETING_VIEW` / `ELECTION_VIEW` on H1.
- **"Silent degrade" vs "real empty state"** — preview widgets (meetings, voting) return `null` on error/empty/no-permission since their absence from the home screen is graceful. List sections (payments, announcements) show a real `EmptyState` since empty-list is a legitimate state worth communicating to the member.
- **Premium status screen** — `AuthHeroScreen` + `Button variant="gradient"` for the primary action + `Button variant="accent-ghost"` for the de-escalating one. Any new status/empty/blocked screen should compose this rather than restyling from scratch; see "Premium auth surface" above.
- **Lazy native-module access** — a native module that throws while its own module body evaluates (e.g. `expo-local-authentication` calling `requireNativeModule`) must be loaded inside a function via `require`, not a top-level `import`. A top-level import propagates the throw to **every screen that transitively imports the file**, which Expo Router then reports as "missing the required default export" — the screens render blank. `src/lib/biometrics.ts` is the reference implementation. Use `require` rather than `await import()` so `jest.mock`'s CJS-shaped mocks still intercept it.

---

# Docs site (`apps/docs`)

## Docs layout (`components/layout`)

### Logo
- **Surface:** docs
- **Path:** `components/layout/logo.tsx`
- **Added / changed:** D1.2 (2026-10-12)
- **Purpose:** Nav wordmark — icon-in-gradient-box + gradient-clip "SocietyLedger" text, used as `nav.title` in `lib/layout.shared.tsx`.
- **Props:** none.
- **Tokens used:** `docs-logo-icon-bg`, `docs-logo-text` (custom `@utility`s in `app/theme.css`, driven by `--color-docs-logo-from/-to`).
- **Used in:** every docs page (root nav, via `baseOptions()`).
- **Example:**
  ```tsx
  <Logo />
  ```
- **Notes:** deliberately reuses `apps/web`'s existing teal→green gradient brand (owner's call, D1.2) instead of the ledger+brass system the rest of `ui-tokens.md §14` assumes — see `ui-tokens.md §14.2`'s note on `--color-docs-logo-from/-to`. Icon is `lucide-react`'s `Users` (docs' icon set), not `@tabler/icons-react`'s `IconUsers` (web's).

### Footer
- **Surface:** docs
- **Path:** `components/layout/footer.tsx`
- **Added / changed:** D1.2 (2026-10-12)
- **Purpose:** Slim bottom bar on every page: copyright, link to `/docs`, link to the web app.
- **Props:** none.
- **Tokens used:** `border-fd-border`, `text-fd-muted-foreground`, `text-fd-foreground`.
- **Used in:** `app/layout.tsx` (root layout, rendered after `{children}`).
- **Example:**
  ```tsx
  <Footer />
  ```
- **Notes:** content is intentionally minimal — `ui-rules.md §11` doesn't fully spec a footer composition yet; extend at D6.3 if more links are needed.

### NotFound (`app/not-found.tsx`)
- **Surface:** docs
- **Path:** `app/not-found.tsx`
- **Added / changed:** D1.2 (2026-10-12)
- **Purpose:** Site-wide 404 — message, a button that opens the existing Fumadocs search dialog (`useSearchContext().setOpenSearch(true)`, reused rather than rebuilt), and a link back to `/docs`.
- **Props:** none (Next.js file convention).
- **Tokens used:** `text-fd-*`, `border-fd-border`, `bg-fd-secondary`/`bg-fd-accent`.
- **Used in:** any unmatched route.
- **Notes:** client component (`'use client'`) because it calls `useSearchContext()`; confirmed it still prerenders correctly to static `out/404.html` under `output: 'export'`.

## Docs MDX components (`components/mdx`)
All registered in `components/mdx.tsx`'s `getMDXComponents()`, per `code-standards.md §17.4`'s allow-list. Demo of every one: `content/docs/_kitchen-sink.mdx` (`status: draft`, so hidden from the production sidebar — view with `NEXT_PUBLIC_SHOW_DRAFTS=true`).

### AppliesTo
- **Surface:** docs
- **Path:** `components/mdx/applies-to.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Audience chips · platform badges · module/permission notes, auto-rendered from the page's frontmatter (`ui-rules.md §11.4`).
- **Props:** none — reads `useDocsPageData()` (`lib/docs-page-context.tsx`).
- **Tokens used:** `--docs-applies-bg`, `docs-text-small`.
- **Used in:** every task/concept/reference/platform page, inserted by `app/docs/[[...slug]]/page.tsx` right after the description — never written in MDX by hand. Omitted on `overview`/`faq` pages.
- **Example:** (not authored in MDX — automatic)
- **Notes:** Client component (needs `useContext`); the page route passes only the plain, serializable frontmatter fields into `<DocsPageProvider>` (`audience`, `platforms`, `permission`, `module`) — never the full Fumadocs `page.data`, which also carries the compiled MDX body function and isn't serializable across the client boundary (hit this exact error during D1.4, fixed by narrowing the context's type).

### PermissionNote / PlanNote
- **Surface:** docs
- **Path:** `components/mdx/permission-note.tsx`, `components/mdx/plan-note.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** "You need the **X** permission." / "Available on plans that include **Y**." — one sentence each, from the same frontmatter context as `AppliesTo`. Render nothing if the page isn't gated.
- **Props:** none.
- **Used in:** `code-standards.md §17.3`'s task-page template, inside "Before you start".
- **Example:**
  ```mdx
  ## Before you start
  <PermissionNote />
  ```
- **Notes:** Plain-language lookups (`lib/permission-labels.ts`, `lib/module-labels.ts`) are sparse by design — filled in as pages reference a permission/module during authoring; falls back to a humanized version of the key. Reconciled against the real permission list at D6.1 (`scripts/gen-reference.ts`).

### Callout
- **Surface:** docs
- **Path:** `components/mdx/callout.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Left 4-px rule + icon in the type colour on its soft background (`ui-rules.md §11.5`).
- **Props:** `type?: 'note' | 'tip' | 'warning' | 'danger'` (default `note`) · `title?: ReactNode` · `children`.
- **Tokens used:** `--docs-callout-<type>-bg` / `-border`.
- **Used in:** any page, max 2 per page, never at the very top (authoring convention, not enforced).
- **Example:**
  ```mdx
  <Callout type="warning" title="Before you continue">Voiding a transaction can't be undone after 30 seconds.</Callout>
  ```
- **Notes:** Built from scratch rather than wrapping Fumadocs' own `Callout` — its type enum (`info`/`warn`/`error`/`success`/`idea`) doesn't match ours, and it reads `--color-fd-*` vars, not the dedicated `--docs-callout-*` pairs `ui-tokens.md §14.2` defines for exactly this component.

### Steps / Step
- **Surface:** docs
- **Path:** re-exported from `fumadocs-ui/components/steps` as-is (no wrapper file).
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Numbered circles for a real sequence of actions (`ui-rules.md §11.5`).
- **Example:**
  ```mdx
  <Steps>
  <Step>Go to <MenuPath items={["Finance", "Levies"]} />.</Step>
  <Step>Select <UiLabel>New campaign</UiLabel>.</Step>
  </Steps>
  ```
- **Notes:** Not wrapped — Fumadocs' own `.fd-step` marker colour is `--color-fd-primary`, which `ui-tokens.md §14.2` sets to the exact same hex as `--docs-step-marker` in both themes (same ledger-green token, two names for the same use). Re-skinning it would be pure duplication.

### Screenshot
- **Surface:** docs
- **Path:** `components/mdx/screenshot.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Light/dark image pair, click-to-zoom, numbered markers, `pending` placeholder before the real capture exists (`ui-rules.md §11.5`, `architecture.md §14.7`).
- **Props:** `pending?: string` (placeholder mode) · `src?: string` · `alt?: string` · `markers?: { n: number; x: number; y: number }[]` (percentages) · `caption?: ReactNode` · `variant?: 'desktop' | 'phone'` (default `desktop`; sets the default `width`/`height` to the real capture sizes from `architecture.md §14.7` — 1280×800 / 390×844 — and centres phone screenshots at max 360 px).
- **Tokens used:** `--docs-screenshot-frame`, `--docs-marker-bg` / `-fg`.
- **Used in:** every task page, at least once.
- **Example:**
  ```mdx
  <Screenshot src="/images/payments/verifying-payment-proofs-1.webp" alt="Payment proof detail showing the receipt image and the Verify payment and Reject buttons" markers={[{ n: 1, x: 72, y: 88 }]} />
  ```
- **Notes:** Dark variant filename is derived from `src` (inserts `-dark` before the extension) — never pass it separately. Wraps Fumadocs' `ImageZoom` (not a raw `<img>`, per `code-standards.md §17.4`); zoom/Esc-to-close behaviour is inherited from `react-medium-image-zoom`, not reimplemented. The `pending`-vs-`src`/`alt` split isn't a discriminated union at the type level (destructuring didn't narrow it cleanly) — checked at runtime, with a dev-only `console.error` if neither is given.

### MenuPath
- **Surface:** docs
- **Path:** `components/mdx/menu-path.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Bold segments joined by a chevron icon, not a typed "→" glyph; wraps on phones (`ui-rules.md §11.5`).
- **Props:** `items: string[]`.
- **Example:** `<MenuPath items={["Finance", "Levies", "New campaign"]} />` → **Finance** › **Levies** › **New campaign**

### UiLabel
- **Surface:** docs
- **Path:** `components/mdx/ui-label.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Bold text, no box/border — reads like the words on the button, not a keyboard key (`ui-rules.md §11.5`).
- **Props:** `children`.
- **Example:** `Select <UiLabel>Save member</UiLabel>.`

### PlatformBadge
- **Surface:** docs
- **Path:** `components/mdx/platform-badge.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** *Web* / *Mobile* pill badge.
- **Props:** `platform: 'web' | 'mobile'`.
- **Tokens used:** `--docs-badge-web-bg` / `-fg`, `--docs-badge-mobile-bg` / `-fg`, `docs-text-micro`.
- **Used in:** `AppliesTo` (one per frontmatter `platforms` entry); also usable standalone.

### RoleTabs / RoleTab
- **Surface:** docs
- **Path:** `components/mdx/role-tabs.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Tabs per role ("Members", "Treasurers & admins") — only when content truly differs (`ui-rules.md §11.5`).
- **Props:** `roles: string[]` on `<RoleTabs>`; one `<RoleTab>` child per role, in order.
- **Example:**
  ```mdx
  <RoleTabs roles={["Members", "Treasurers & admins"]}>
  <RoleTab>Members see a simplified balance view.</RoleTab>
  <RoleTab>Treasurers see every member's balance.</RoleTab>
  </RoleTabs>
  ```
- **Notes:** Thin rename over Fumadocs' `Tabs`/`Tab` in "simple items" mode. No persistence — each `RoleTabs` instance is independent (unlike `PlatformTabs`).

### PlatformTabs / PlatformTab
- **Surface:** docs
- **Path:** `components/mdx/platform-tabs.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Tabs "Web" / "Mobile"; remembers the reader's choice across pages; default = device type (`ui-rules.md §11.5`).
- **Props:** one `<PlatformTab>` child per platform, in the order Web, Mobile.
- **Example:**
  ```mdx
  <PlatformTabs>
  <PlatformTab>Go to **Finance → Levies**.</PlatformTab>
  <PlatformTab>Open **Manage → Finance → Levies**.</PlatformTab>
  </PlatformTabs>
  ```
- **Notes:** Uses Fumadocs' built-in `groupId`+`persist` on the underlying `Tabs` (shares one localStorage-backed value across every `PlatformTabs` instance site-wide) — but only passes `persist={true}` after a feature-detect write/read/remove succeeds, since Fumadocs' own implementation calls `localStorage` directly with no try/catch (`ui-rules.md §11.5` explicitly asks for the try/catch; Fumadocs' `sessionStorage` call for `groupId` without `persist` still isn't wrapped — accepted as a smaller residual risk in Fumadocs' own well-tested code, not something worth forking the library over). Default tab follows `matchMedia('(pointer: coarse)')`.

### StatusChip
- **Surface:** docs
- **Path:** `components/mdx/status-chip.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Same status → colour mapping as the mobile app, with text (`ui-rules.md §11.5`).
- **Props:** `status: string` · `label?: string` (defaults to `status` verbatim).
- **Tokens used:** `--color-fd-success` / `-warning` / `-error` / `-info` / `-muted-foreground` (added at D1.2 for Fumadocs' own Callout, reused here for the same 5-tone semantics as `ui-tokens.md §1.4`).
- **Example:** `<StatusChip status="overdue" />`
- **Notes:** Tone lookup lives in `lib/status-tone.ts` (single source, mirrors `ui-tokens.md §1.4` exactly). Background is `color-mix(in oklab, <tone> 16%, transparent)` with full-saturation tone text — not a pre-vetted AA pair from `ui-tokens.md` like the platform badges; worth a real contrast check in a later accessibility pass.

### CardGrid / Card
- **Surface:** docs
- **Path:** `components/mdx/card-grid.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** 2 columns desktop, 1 on phones; hover border → primary, no lift/shadow (`ui-rules.md §11.5`).
- **Props:** `Card`: `icon?`, `title`, `description?`, `href?`, `external?` (same as Fumadocs' own).
- **Example:**
  ```mdx
  <CardGrid>
  <Card title="Recording a payment" description="Record a payment a member made." href="/docs/finance/recording-a-payment" />
  </CardGrid>
  ```
- **Notes:** Thin rename of Fumadocs' `Cards`/`Card` — their default styling already matches the spec. Also used automatically (not hand-authored) on `overview`-type pages: `app/docs/[[...slug]]/page.tsx` renders one `<CardGrid>` of the page's direct child pages after the MDX body, fulfilling `code-standards.md §17.3`'s "all pages (auto CardGrid)" overview template clause.

### Faq / FaqItem
- **Surface:** docs
- **Path:** `components/mdx/faq.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Accordion; question in 600 weight; each item deep-linkable (`ui-rules.md §11.5`).
- **Props:** `FaqItem`: `question: string` (slugified into the accordion item's `id`).
- **Example:**
  ```mdx
  <Faq>
  <FaqItem question="Why can't I see the Finance menu?">You need the Finance permission.</FaqItem>
  </Faq>
  ```
- **Notes:** Wraps Fumadocs' `Accordions`/`Accordion`. `code-standards.md §17.3`'s FAQ-*page* template (plain H2 per question, for SEO/heading-anchor browsing) still stands for the 9 troubleshooting-faq pages at D6.2 — this component is for Q&A blocks inside other pages (e.g. a section overview) that want the collapsed treatment; authors choose per page.

### Glossary
- **Surface:** docs
- **Path:** `components/mdx/glossary.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Inline term tooltip.
- **Props:** `definition: string` · `children` (the term itself).
- **Example:** `A <Glossary definition="Minimum attendance required for a meeting's decisions to be valid.">quorum</Glossary> is needed before voting opens.`
- **Notes:** Definition is supplied at the point of use, not looked up from a shared registry — `core-concepts/glossary` (D2.2) is prose, not structured data, and nothing yet needs a term→definition store. Revisit if that changes. Click-to-toggle disclosure (not true hover-tooltip) — keyboard-operable (Enter/Space to open, Escape or blur to close), a deliberately simpler pattern than a full WAI-ARIA tooltip given the scope.

### Diagram
- **Surface:** docs
- **Path:** `components/mdx/diagram.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** SVG wrapper with caption + collapsed text alternative (`ui-rules.md §11.5`/§11.8).
- **Props:** `alt: string` (required — also the text alternative content) · `caption?: ReactNode` · `children` (hand-authored inline SVG).
- **Example:**
  ```mdx
  <Diagram alt="Money flows from a charge to a payment to the member ledger." caption="How money moves">
  <svg>…</svg>
  </Diagram>
  ```
- **Notes:** Authors write the SVG using `currentColor`/CSS variables so it works in both themes (`ui-rules.md §11.5`) — this component only supplies the frame, caption and the "Describe this diagram" `<details>` disclosure.

### VideoEmbed
- **Surface:** docs
- **Path:** `components/mdx/video-embed.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Lazy, privacy-enhanced video embed — a click-to-load facade, so the iframe (and its cookies/JS) never loads until the reader opts in.
- **Props:** `youtubeId: string` · `title: string`.
- **Example:** `<VideoEmbed youtubeId="dQw4w9WgXcQ" title="Taking attendance on your phone" />`
- **Notes:** Even after loading, uses `youtube-nocookie.com`. Thumbnail is `next/image` from `i.ytimg.com` (added to `next.config.mjs`'s `images.remotePatterns`), not a raw `<img>`.

### Related
- **Surface:** docs
- **Path:** `components/mdx/related.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** Up to 3 related cards, from frontmatter (`ui-rules.md §11.4`).
- **Props:** `items: { title: string; description?: string; href: string }[]`.
- **Used in:** inserted automatically by `app/docs/[[...slug]]/page.tsx` (resolves each frontmatter `related` URL via `source.getPageByHref`) — never written in MDX by hand.
- **Notes:** Presentational only; the page route does the lookup since it has `source` and this component doesn't.

### Feedback
- **Surface:** docs
- **Path:** `components/mdx/feedback.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** "Was this page helpful?" Yes/No, optional 280-char comment on No (`ui-rules.md §11.5`, `architecture.md §14.8`).
- **Props:** `slug: string` (the page URL, for the GA4 event).
- **Used in:** inserted automatically by the page route, after the MDX body.
- **Notes:** Dispatches through `lib/analytics.ts`'s `trackEvent()`, a no-op stub until D1.5 wires up `NEXT_PUBLIC_GA_ID`/consent-mode `gtag` — this component won't need to change then. Comment textarea has a visually-hidden `<label>` (placeholder text alone isn't an accessible label).

### LastUpdated
- **Surface:** docs
- **Path:** `components/mdx/last-updated.tsx`
- **Added / changed:** D1.4 (2026-10-12)
- **Purpose:** "Last updated <date>" from frontmatter `lastVerified` (`architecture.md §14.3`).
- **Props:** `date?: string`.
- **Notes:** Renders nothing if `lastVerified` is absent. `architecture.md §14.3`'s "falls back to git commit date" clause is intentionally not implemented yet — every real page sets `lastVerified` when written (`code-standards.md §17.5`), so the fallback only covers a hand-edited page that skipped that step; shelling out to `git log` for all 197 (currently all-draft, all-unverified) pages on every build isn't worth the build-time cost before a concrete page needs it.

## Docs page patterns
_(none yet — e.g. "Task page = purpose · Before you start · Steps + Screenshot · What happens next · Related", "Lifecycle concept = Diagram + status table + task links")_

## Docs content tooling (D1.3)
Not reusable UI components, but conventions every docs content author relies on from D1.3 onward:
- **Frontmatter schema:** `apps/docs/lib/docs-schema.ts` (zod, extends Fumadocs' `pageSchema`). Fields and order per `architecture.md §14.3`. `pnpm -F @societyledger/docs check:frontmatter` validates every page against it.
- **Icon field (`meta.json` / frontmatter `icon`):** must be an exact `lucide-react` export name (PascalCase) — resolved automatically via `lucideIconsPlugin()`, no icon map to maintain. Some names from older Lucide releases don't exist in the installed `lucide-react@1.50` (e.g. `BarChart3` → `ChartColumn`, `BookMarked` → `Bookmark`, `HelpCircle` → `CircleQuestionMark`); check with `node -e "console.log(!!require('lucide-react').icons.<Name>)"` before using a new one.
- **Sitemap source of truth:** `apps/docs/scripts/sitemap-data.ts` mirrors `project-overview.md §9.6` (21 sections, 197 pages) as typed data. `pnpm -F @societyledger/docs gen:skeleton` writes `meta.json`/`.mdx` stubs from it, never overwriting an existing file, and reports drift between the data file and `content/docs/**` on disk.
- **Draft visibility:** `status: draft` pages are hidden from the sidebar via `getVisiblePageTree()` (`lib/source.ts`) unless `NEXT_PUBLIC_SHOW_DRAFTS=true`. `app/sitemap.ts` (D1.5) also excludes them. Search and `generateStaticParams` still include every page regardless of status — a draft page is reachable by direct URL and indexed in search, just absent from the sidebar and `sitemap.xml`. Revisit if that scope ever needs tightening.

## Docs search, SEO & analytics (D1.5)
Not reusable UI components; the pieces behind `build-plan.md`'s D1.5 bullet.
- **Search:** `app/api/search/route.ts`'s `buildIndex` tags each page with its section (`tag: page.slugs[0]`) and folds `lib/search-synonyms.ts`'s term pairs into the page's hidden, indexed `structuredData.contents` when either side of a pair appears in its title/description/`keywords` frontmatter/body. `components/search.tsx` adds a `<TagsList>` (from `sitemap-data.ts`'s sections) so readers can filter by section. See `library-docs.md`'s Search note for why this isn't a literal `keywords` field — the installed engine's advanced schema doesn't have one. The `docs_search` GA4 event (`architecture.md §14.6`, listed alongside `docs_feedback`/`docs_outbound`) was missed in the original D1.5 pass and backfilled at D1.6 — `components/search.tsx` now fires it once per completed query via a `useEffect` keyed on `search.data`.
- **SEO:** `app/sitemap.ts` (published pages only), `app/robots.ts` (`noindex` on preview is an HTTP header at the Dokploy/nginx level, D1.7 — not in this file), canonical URL + `metadataBase` in `generateMetadata`, `TechArticle` + `BreadcrumbList` JSON-LD (`components/json-ld.tsx`, `lib/breadcrumbs.ts`) rendered per page in `app/docs/[[...slug]]/page.tsx`.
- **Analytics:** `components/analytics.tsx`, mounted once in `app/layout.tsx`. Renders nothing without `NEXT_PUBLIC_GA_ID` (same fallback as `apps/web`'s `GoogleAnalytics`). Loads GA4 with `consent` defaults (`analytics_storage`/`ad_storage` denied) — owner's explicit D1.5 decision: no visible consent banner for now, revisit before launch if an NDPR read says one's required. Also carries the `docs_outbound` click tracking (`architecture.md §14.8`) via one delegated `document` click listener, rather than wrapping every link to the app.
- **Outbound UTM:** `lib/utm.ts`'s `withUtm(url, medium)` — applied to the header nav link (`lib/layout.shared.tsx`, medium `header`) and the footer's "Open SocietyLedger" link (`components/layout/footer.tsx`, medium `footer`), so the main site's analytics can attribute traffic from docs.
- **`Feedback`'s GA4 wiring:** `lib/analytics.ts`'s `trackEvent()` (stubbed at D1.4) now fires for real once `window.gtag` exists — no change needed in the `Feedback` component itself, the seam paid off as intended.

## Docs screenshot pipeline (D1.6)
Not reusable UI components; `scripts/screenshots/` conventions every future flow file needs. **Unverified** — see `library-docs.md`'s Playwright note for exactly what wasn't (and couldn't be) tested this session.
- **Seed data:** `apps/api/prisma/seeds/demo-association.seed.ts` (new — Playwright didn't exist in this repo before D1.6, and neither did any demo-tenant seed). Run with `pnpm -F @societyledger/api seed:demo`; full data model and demo logins in `scripts/screenshots/seed-demo.md`.
- **Config:** `scripts/screenshots/capture.config.ts` (4 projects + a `setup` project), `constants.ts` (shared base URL / demo password / frozen capture instant / role list).
- **Flow contract:** `scripts/screenshots/flows/*.ts` export `{ section, shots: [{ name, role, url, prepare?, clip? }] }` (`Flow`/`Shot` types in `flows/dashboard.ts`); `flows/index.ts` aggregates them. One flow exists so far: `flows/dashboard.ts` (`section: 'reports'`, matching the build-plan DoD's own example).
- **Runner:** `scripts/screenshots/capture.spec.ts` (the actual Playwright test, generic over every flow) + `capture.ts` (the `pnpm -F @societyledger/docs screenshots [--section=<name>]` CLI wrapper authors actually invoke).
- **Filename convention extension:** `code-standards.md §17.2` gained a `-phone` marker for when a phone-web capture coexists with the desktop one — the original wording only reserved room for a light/dark suffix, not a 4-way desktop/phone × light/dark matrix.

## Docs CI & hosting (D1.7) — Docs Phase D1 complete
Not reusable UI components; the pieces behind `build-plan.md`'s D1.7 bullet, which closes out Docs Phase D1 (7/7).
- **Hosting:** `apps/docs/Dockerfile` + `apps/docs/nginx/default.conf.template`, added as a new `docs` service in root `docker-compose.dokploy.yml` (one Compose stack, same model `api`/`web` already use) — **actually built and run locally** with real `docker build`/`docker run`, not just written. Two real bugs fixed in the process (see `library-docs.md`'s Dokploy section): a `turbo prune` cross-package `tsconfig.json extends` gap, and an nginx template `envsubst` crash on an absent (not just empty) env var.
- **CI:** `.github/workflows/docs.yml` — install → `gen:reference` → fail-on-uncommitted-diff → type-check → lint → build → `check:links` → `check:frontmatter` → coverage PR comment (`architecture.md §14.9`). Validated with `actionlint` (zero issues).
- **New scripts:** `scripts/gen-reference.ts` (stub until D6.1), `scripts/coverage.ts` (per-section published/draft/review table + a `covers`-frontmatter web-route-coverage proxy), `scripts/check-links.ts` (regex-based internal link check against the known-URL set from `sitemap-data.ts` — not full MDX parsing, so a `href={variable}` built from a JS expression won't be caught).

---

# Admin console (`apps/admin`)

## Admin shell & layout (`src/components`)

### AdminAppShell
- **Surface:** admin
- **Path:** `src/components/AppShell.tsx`
- **Added / changed:** A1.6 (2026-10-18)
- **Purpose:** Root console chrome — dark-green 248px nav, 56px top bar; active item gets brass left-border marker.
- **Props:** `children: React.ReactNode`
- **Tokens used:** `--admin-chrome-bg`, `--admin-chrome-fg`, `--admin-chrome-fg-muted`, `--admin-chrome-active-bg`, `--admin-chrome-active-marker`
- **Used in:** `(console)/layout.tsx` (wraps every authenticated console page)
- **Notes:** Collapses to hamburger below Mantine `sm` breakpoint. Nav items hardcoded (17 items, X4–X21 + Account).

### PageHeader
- **Surface:** admin
- **Path:** `src/components/PageHeader.tsx`
- **Added / changed:** A1.6 (2026-10-18)
- **Purpose:** H2 title + optional description + optional right-side actions row; appears at the top of every console page.
- **Props:** `title: string` · `description?: string` · `actions?: ReactNode`
- **Tokens used:** Mantine heading scale (h2)
- **Used in:** every console page (X4–X21)
- **Example:**
  ```tsx
  <PageHeader title="Associations" description="All registered tenants" actions={<Button>New</Button>} />
  ```

### EnvBadge
- **Surface:** admin
- **Path:** `src/components/EnvBadge.tsx`
- **Added / changed:** A1.6 (2026-10-18)
- **Purpose:** Inline PROD / STAGING pill — reads `NEXT_PUBLIC_ENV` by default.
- **Props:** `env?: string` (override)
- **Tokens used:** `--admin-env-prod-bg`, `--admin-env-prod-fg`, `--admin-env-staging-bg`, `--admin-env-staging-fg`
- **Used in:** TopBar area (X4+), impersonation banner (A2+)

## Admin data components (`src/components`)

### DataTable
- **Surface:** admin
- **Path:** `src/components/DataTable.tsx`
- **Added / changed:** A1.6 (2026-10-18)
- **Purpose:** Generic typed table — columns config, hover highlight, skeleton loading, empty state row.
- **Props:** `columns: Column<T>[]` · `rows: T[]` · `rowKey: (row: T) => string | number` · `loading?: boolean` · `emptyMessage?: string`
- **Tokens used:** `--admin-row-hover`, `--admin-border`, `--admin-surface`
- **Used in:** every list screen (X5 associations, X7 platform users, X8 settlements, X13 action logs, X14 audit logs, X15 webhooks, X16 cron jobs, X17 blog, X18 help content, X19 support)
- **Example:**
  ```tsx
  <DataTable columns={cols} rows={data} rowKey={(r) => r.id} loading={isLoading} />
  ```

### FilterBar
- **Surface:** admin
- **Path:** `src/components/FilterBar.tsx`
- **Added / changed:** A1.6 (2026-10-18)
- **Purpose:** Search input + optional Select filters + "Clear" button; sits above DataTable on list screens.
- **Props:** `search?` · `onSearchChange?` · `searchPlaceholder?` · `filters?: FilterDefinition[]` · `onReset?` · `hasActiveFilters?`
- **Used in:** list screens that support filtering (X5, X7, X8, X13, X14, X19)

### StatCard
- **Surface:** admin
- **Path:** `src/components/StatCard.tsx`
- **Added / changed:** A1.6 (2026-10-18)
- **Purpose:** KPI tile — label, large number, optional icon, optional trend line.
- **Props:** `label: string` · `value: string | number` · `icon?: ReactNode` · `trend?: string` · `trendPositive?: boolean`
- **Tokens used:** `--admin-surface`, `--admin-border`
- **Used in:** X4 Dashboard, X9 Analytics

### StatusBadge
- **Surface:** admin
- **Path:** `src/components/StatusBadge.tsx`
- **Added / changed:** A1.6 (2026-10-18)
- **Purpose:** Mantine Badge that maps status strings to colours (ACTIVE=green, SUSPENDED=orange, CANCELLED/PAST_DUE=red, etc).
- **Props:** `status: string` · `size?: 'xs' | 'sm' | 'md'`
- **Used in:** DataTable cells on X5, X7, X8

### EmptyState
- **Surface:** admin
- **Path:** `src/components/EmptyState.tsx`
- **Added / changed:** A1.6 (2026-10-18)
- **Purpose:** Centred icon + title + description + optional CTA when a list is empty.
- **Props:** `title?` · `description?` · `icon?` · `action?: ReactNode`
- **Used in:** DataTable empty slot or standalone on filtered-to-zero screens

### ErrorState
- **Surface:** admin
- **Path:** `src/components/ErrorState.tsx`
- **Added / changed:** A1.6 (2026-10-18)
- **Purpose:** Centred error icon + message + optional retry button for fetch failures.
- **Props:** `title?` · `message?` · `onRetry?`
- **Used in:** any async data panel that fails to load

### Forbidden
- **Surface:** admin
- **Path:** `src/components/Forbidden.tsx`
- **Added / changed:** A1.6 (2026-10-18)
- **Purpose:** "Access Denied" state for pages where the user's platformRole doesn't grant access.
- **Props:** `message?`
- **Used in:** any console screen behind a platformRole check

## Admin action components

### ReasonField
- **Surface:** admin
- **Path:** `src/components/ReasonField.tsx`
- **Added / changed:** A1.6 (2026-10-18)
- **Purpose:** `Textarea` for capturing a required reason before a destructive action.
- **Props:** `value: string` · `onChange: (v: string) => void` · `required?` · `label?`
- **Used in:** ConfirmDestructive (embedded), DangerZone forms (A2+)

### ConfirmDestructive
- **Surface:** admin
- **Path:** `src/components/ConfirmDestructive.tsx`
- **Added / changed:** A1.6 (2026-10-18)
- **Purpose:** Modal with ReasonField + optional exact-value confirmation input (e.g. type the subdomain to delete) for permanent destructive actions. §16.10 rule 6.
- **Props:** `opened` · `onClose` · `onConfirm(reason)` · `title` · `description` · `confirmValue?` · `confirmLabel?` · `loading?`
- **Used in:** X5 suspend/cancel association, X14 permanent delete, X19 close support ticket
- **Notes:** Submit requires non-empty reason AND (if `confirmValue` set) exact match. Never auto-dismiss on success — caller closes after mutation settles.

## Admin form components (`src/components/forms`)

### BlogPostForm
- **Surface:** admin
- **Path:** `src/components/forms/BlogPostForm.tsx`
- **Added / changed:** A2.10 (2026-10-19)
- **Purpose:** Create/edit form for a blog post (title, slug, excerpt, content, cover image, status, category, tags). Same component drives both `/blog/new` and `/blog/[id]/edit` — pass `postId` for edit mode, omit for create.
- **Props:** `postId?: number`
- **Tokens used:** `--admin-surface`, `--admin-border`
- **Used in:** X17 Blog CMS (`/blog/new`, `/blog/[id]/edit`)
- **Example:**
  ```tsx
  <BlogPostForm /* create */ />
  <BlogPostForm postId={42} /* edit */ />
  ```
- **Notes:** Slug auto-fills from title (slugified) until the user edits it manually. The blog admin API requires a client-supplied `slug` (unlike documentation pages below, which auto-generate it server-side) — found this the hard way while building the page, since the pre-existing "New category" modal had been silently broken for the same reason (missing required `slug`) since it shipped.

### DocPageForm
- **Surface:** admin
- **Path:** `src/components/forms/DocPageForm.tsx`
- **Added / changed:** A2.11 (2026-10-19)
- **Purpose:** Create/edit form for a help/documentation page (title, excerpt, content, section; status only shown in edit mode — new pages always start DRAFT). Same component drives both `/help/new` and `/help/[id]/edit` — pass `pageId` for edit mode, omit for create.
- **Props:** `pageId?: number`
- **Tokens used:** `--admin-surface`, `--admin-border`
- **Used in:** X18 Help Content (`/help/new`, `/help/[id]/edit`)
- **Notes:** No slug field — the documentation API generates it server-side from the title (unlike BlogPostForm above). The pre-existing "New section" modal had the same missing-required-`slug` bug as blog's category modal.

## Admin page patterns
- **List page:** `PageHeader` (title + create button) → `FilterBar` → `DataTable` (with `StatusBadge` in status column)
- **Detail page:** breadcrumb → `PageHeader` → Tabs (URL-synced with `searchParams`) → `DangerZone` section last (A2+)
- **Create/edit page:** `PageHeader` → form Card (`--admin-surface`/`--admin-border`) → Cancel/Save row; form component takes an optional `id` prop and switches POST↔PUT
- **Destructive action:** hover row → action button → `ConfirmDestructive` modal → mutation → notification

---

# Web (`apps/web`) — docs links & impersonation only

_(none yet — expected from D6.3: HelpLink, sidebar "User manual" item, docs URL helper; from A2.12/A3.1: `/auth/impersonate` exchange page, updated ContextIndicator banner)_

---

## Retired
_(none)_
