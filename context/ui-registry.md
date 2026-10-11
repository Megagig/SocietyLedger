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
| _(empty — first docs entries arrive with D1.2/D1.4; first admin entries with A1.5/A1.6; first mobile entries with F1.4)_ | | | | |

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
_(none yet — expected from D1.2/D1.5: Header links, Footer, Feedback, LastUpdated, home hero)_

## Docs MDX components (`components/mdx`)
_(none yet — expected from D1.4: AppliesTo, Callout, Steps/Step, Screenshot, MenuPath, UiLabel, PlatformBadge, PermissionNote, PlanNote, RoleTabs, PlatformTabs, StatusChip, CardGrid, Faq, Glossary, Diagram, VideoEmbed, Related)_

## Docs page patterns
_(none yet — e.g. "Task page = purpose · Before you start · Steps + Screenshot · What happens next · Related", "Lifecycle concept = Diagram + status table + task links")_

---

# Admin console (`apps/admin`)

## Admin shell & layout (`src/components/layout`)
_(none yet — expected from A1.6: AppShell, NavGroup, TopBar, EnvBadge, ImpersonationPill, UserMenu, PageHeader)_

## Admin data components (`src/components`)
_(none yet — expected from A1.6: DataTable, FilterBar, StatCard, StatusBadge, EmptyState, ErrorState, Forbidden, charts/TrendChart, charts/BarBreakdown, charts/DonutBreakdown)_

## Admin action components
_(none yet — expected from A1.6/A2.12: ConfirmDestructive, ReasonField, ImpersonationDialog, DangerZone)_

## Admin page patterns
_(none yet — e.g. "List page = PageHeader + FilterBar + DataTable", "Detail page = breadcrumb + PageHeader + Tabs (URL-synced) + DangerZone last")_

---

# Web (`apps/web`) — docs links & impersonation only

_(none yet — expected from D6.3: HelpLink, sidebar "User manual" item, docs URL helper; from A2.12/A3.1: `/auth/impersonate` exchange page, updated ContextIndicator banner)_

---

## Retired
_(none)_
