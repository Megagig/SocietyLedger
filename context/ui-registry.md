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
| _(first mobile entries with F1.4)_ | | | | |

---

# Mobile app (`apps/mobile`)

## UI primitives (`src/components/ui`)
_(none yet)_

## Layout (`src/components/layout`)
_(none yet)_

## Forms (`src/components/forms`)
_(none yet)_

## Feedback (`src/components/feedback`)
_(none yet)_

## Charts (`src/components/charts`)
_(none yet)_

## Shared feature components (used by 2+ screens)
_(none yet)_

## Patterns (recurring compositions, not components)
_(none yet — e.g. "Money row = ListItem + Money + StatusChip", "Approval detail = summary block + documents + StickyFooter with Reject/Approve")_

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
