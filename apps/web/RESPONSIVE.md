# Responsive rules for the SocietyLedger web app

Short version: every page must work from 320px to 2560px wide, in a browser tab and as the installed PWA, with no horizontal page scroll. Use what is here; do not add a new CSS or UI library.

## Breakpoints

Tailwind's defaults, mobile first: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536. Mantine's matching `em` breakpoints for Mantine components.

| Width | What the user gets |
|---|---|
| under 1024 (phones and tablets) | menu button and bottom navigation; the sidebar is a drawer; inputs are 16px; tap targets 44px |
| 1024 and up | fixed 288px sidebar, no bottom navigation |
| 1536 and up | page content is centred and capped at 1536px (`max-w-screen-2xl` in `AuthenticatedLayout`) |

The `lg` line is the one that matters: below it the app behaves like a phone app.

## Layout patterns

**Navigation.** `Sidebar`, `AdminSidebar` and `MemberSidebar` share `components/layout/useNavDrawer.ts`: the drawer closes after navigating, opens from the bottom navigation's **Menu** tab (`requestNavToggle`), closes on Escape, keeps Tab inside, locks page scroll, and returns focus. When closed it is `invisible`, so hidden links are not in the tab order. The menu button is 44px and sits below the status bar (`env(safe-area-inset-top)`). A new sidebar must call `useNavDrawer`.

**Rows of buttons and filters.** Anything with two or more controls in a row needs `flex-wrap` (and `min-w-[12rem]` on a growing search input). This is the cause of almost every horizontal overflow we found.

**Tables.** Keep the table inside `overflow-x-auto`. A wrapper that is `overflow-x-auto` with a direct `<table>` child gets a fade at the edge where columns are hidden (`globals.css`, scroll-driven, no markup needed). Figures are tabular. If a table has more than about five columns and matters on phones, consider a card list for `< md` (`hidden md:block` table plus a `md:hidden` list, as `dashboard/members` does).

**Modals.** Mantine modals are bottom sheets under 640px automatically (`globals.css`); long content scrolls inside. Do not set `fullScreen` unless you want a different look. Custom `fixed inset-0` dialogs must set `max-h-[100dvh] overflow-y-auto` themselves.

**Forms.** Single column on phones. Inputs are 16px and at least 44px high below `lg` (global rule). Use the right `type` and `inputMode` (`tel`, `email`, `numeric` for naira amounts). Keep labels visible. Put submit buttons in the normal flow so the keyboard never covers them.

**Money.** Always shown in full (₦12,345,678.90): never truncated, abbreviated or wrapped. KPI cards and plan cards size their figure to the card with `sl-stat`, `sl-stat-row`, `sl-stat-value` and `sl-card`, `sl-price` (container queries). Use them for any new KPI tile. Never use a fixed pixel width for an amount.

**Long text.** Names, e-mails and reference numbers wrap (`main` has `overflow-wrap`). In flex rows give the text block `min-w-0`.

**Full-height layouts.** Use `min-h-dvh` / `h-dvh`, not `100vh`, and `pb-safe` / `env(safe-area-inset-*)` where content meets the screen edge in the installed app.

**Touch.** Interactive targets 44×44. Icon-only buttons get this automatically below `lg`; for custom shapes add `max-lg:min-h-11 max-lg:min-w-11`. Mantine `ActionIcon`: add `className="sl-touch"`. Nothing may work only on hover.

**Large screens.** Content is capped at 1536px. Do not set your own `max-w` smaller than that on whole pages.

## Colours and tokens

Use the semantic tokens (`bg-surface`, `text-ink`, `var(--c-…)`), never hardcoded hex or raw Tailwind colours, in new code. (Older code still uses `gray-*` classes; do not copy them.)

## The overflow test

`node responsive/overflow-sweep.mjs --all` visits every route at 320, 375, 768, 1024 and 1440px and exits with an error if any page's `document.documentElement.scrollWidth` is more than 1px wider than the window (1px is sub-pixel rounding). It runs against the scratch stack described in `responsive/README.md`. Run it before opening a pull request that adds or changes a page.

The harness borrows Playwright and axe-core from the pnpm store (through `apps/docs`) so it needs no new dependency. Declare `@playwright/test` and `axe-core` as `apps/web` devDependencies if you want it to run in CI without the docs workspace.

## Checklist for a new screen
1. Open it at 320px and at 768px. Nothing sideways, nothing cut off.
2. Every action reachable on a phone. Nothing hidden to make it fit: move it into a menu, wrap it, or scroll its container.
3. Tab through it with the keyboard.
4. Zoom the browser to 200%.
5. Enter the longest name, e-mail and amount you can think of.
6. Run the overflow test.
