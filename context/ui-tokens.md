# UI Tokens — SocietyLedger Mobile, Docs & Admin

> Every colour, spacing value, radius, type size, shadow and motion value the mobile app (§0–§13), the docs site (§14) and the admin console (§15) may use. **No hard-coded hex, px or font-size values anywhere else, ever.** Tokens are CSS variables in `apps/mobile/src/theme/global.css` (consumed by NativeWind classes) and mirrored for JS in `src/theme/tokens.ts` (charts, navigation, status bar). Change a value here first, then in both files, in the same commit.

---

## 0. Design direction (why these values)

**Concept: "the passbook."** Across Nigerian cooperatives, thrift (ajo/esusu) groups and town unions, the trusted record of money is a paper passbook: ruled lines, handwritten amounts, an officer's ink stamp. SocietyLedger Mobile borrows that vernacular in one place — the **Passbook card** on Home and Money (deep ledger-green, faint ruled lines, a brass stamp for status) — and keeps everything else quiet, cool and legible: ledger-style rows with hairline rules instead of stacks of floating cards.

- **Continuity with web:** the web brand is teal (`#14b8a6` family). Mobile keeps the teal family but anchors it darker (`ledger-700`) for contrast on cheap, bright phone screens, and adds **brass** as the single accent for money highlights and stamps.
- **Not cream, not near-black-with-neon:** light mode is a cool, faintly green paper white; dark mode is deep ledger-green, derived from the brand rather than a generic tinted black.
- **Numbers first:** Manrope with tabular figures so columns of naira line up like a ledger.

---

## 1. Colour

All colours are defined as **space-separated RGB channels** so Tailwind opacity modifiers work (`bg-primary/10`). Hex in comments for reference only.

### 1.1 Brand scales (raw — use semantic tokens in code, raw scales only inside `global.css`)
| Token | Hex | Notes |
|---|---|---|
| `--ledger-50` | `#EEF7F5` | |
| `--ledger-100` | `#D3EBE6` | |
| `--ledger-200` | `#A8D7CE` | |
| `--ledger-300` | `#6FBDB0` | |
| `--ledger-400` | `#3CA294` | dark-mode primary |
| `--ledger-500` | `#178678` | ≈ web teal-600 |
| `--ledger-600` | `#0E7064` | |
| `--ledger-700` | `#0B5C53` | light-mode primary |
| `--ledger-800` | `#0A4842` | passbook surface |
| `--ledger-900` | `#083731` | |
| `--ledger-950` | `#05221F` | |
| `--brass-100` | `#F7EBCF` | |
| `--brass-300` | `#E3C27A` | |
| `--brass-500` | `#C8962E` | accent |
| `--brass-700` | `#8A6516` | accent text on light |
| `--slate-0` | `#FFFFFF` | |
| `--slate-25` | `#F5F8F7` | app background (light) |
| `--slate-50` | `#EDF2F0` | |
| `--slate-100` | `#DDE5E3` | borders (light) |
| `--slate-200` | `#C5D0CD` | |
| `--slate-400` | `#8A9B97` | |
| `--slate-500` | `#5E706C` | secondary text (light) |
| `--slate-700` | `#33433F` | |
| `--slate-900` | `#13211F` | primary text (light) |
| `--night-950` | `#0C1716` | app background (dark) |
| `--night-900` | `#122120` | surface (dark) |
| `--night-800` | `#1A2D2B` | raised (dark) |
| `--night-700` | `#25403C` | borders (dark) |

### 1.2 Semantic colour tokens
| Token (CSS var) | Tailwind class root | Light | Dark | Use |
|---|---|---|---|---|
| `--color-bg` | `bg-bg` | `245 248 247` (#F5F8F7) | `12 23 22` (#0C1716) | Screen background |
| `--color-surface` | `bg-surface` | `255 255 255` | `18 33 32` (#122120) | Cards, list groups, sheets |
| `--color-surface-raised` | `bg-surface-raised` | `255 255 255` | `26 45 43` (#1A2D2B) | Sheets, menus, toasts |
| `--color-surface-sunken` | `bg-surface-sunken` | `237 242 240` (#EDF2F0) | `9 18 17` (#091211) | Inputs, segmented track, skeleton base |
| `--color-border` | `border-border` | `221 229 227` (#DDE5E3) | `37 64 60` (#25403C) | Hairlines, card borders |
| `--color-border-strong` | `border-border-strong` | `197 208 205` (#C5D0CD) | `52 84 79` (#34544F) | Input borders, focused rows |
| `--color-text` | `text-text` | `19 33 31` (#13211F) | `232 240 238` (#E8F0EE) | Primary text |
| `--color-text-secondary` | `text-text-secondary` | `94 112 108` (#5E706C) | `154 176 172` (#9AB0AC) | Secondary text, labels |
| `--color-text-tertiary` | `text-text-tertiary` | `138 155 151` (#8A9B97) | `110 133 129` (#6E8581) | Placeholders, disabled text |
| `--color-text-inverse` | `text-text-inverse` | `255 255 255` | `12 23 22` | Text on primary fills |
| `--color-primary` | `bg-primary` / `text-primary` | `11 92 83` (#0B5C53) | `60 162 148` (#3CA294) | Primary buttons, active tab, links |
| `--color-primary-pressed` | `bg-primary-pressed` | `8 72 66` (#084842) | `111 189 176` (#6FBDB0) | Pressed primary |
| `--color-primary-soft` | `bg-primary-soft` | `238 247 245` (#EEF7F5) | `14 52 47` (#0E342F) | Selected rows, soft buttons, active tab pill |
| `--color-on-primary-soft` | `text-on-primary-soft` | `11 92 83` | `168 215 206` (#A8D7CE) | Text on primary-soft |
| `--color-accent` | `bg-accent` / `text-accent` | `200 150 46` (#C8962E) | `227 194 122` (#E3C27A) | Brass: stamps, highlights, "new" dots. Never for body text on light. |
| `--color-accent-text` | `text-accent-text` | `138 101 22` (#8A6516) | `227 194 122` | Brass text that must pass contrast |
| `--color-accent-soft` | `bg-accent-soft` | `247 235 207` (#F7EBCF) | `58 45 17` (#3A2D11) | Brass tint backgrounds |
| `--color-success` | `text-success` / `bg-success` | `22 128 74` (#16804A) | `74 199 128` (#4AC780) | Paid, verified, present |
| `--color-success-soft` | `bg-success-soft` | `228 245 235` (#E4F5EB) | `16 51 33` (#103321) | |
| `--color-warning` | `text-warning` / `bg-warning` | `194 65 12` (#C2410C) | `251 146 60` (#FB923C) | Partial, pending, due soon |
| `--color-warning-soft` | `bg-warning-soft` | `255 237 225` (#FFEDE1) | `61 32 14` (#3D200E) | |
| `--color-danger` | `text-danger` / `bg-danger` | `180 35 24` (#B42318) | `248 113 102` (#F87166) | Overdue, failed, destructive |
| `--color-danger-soft` | `bg-danger-soft` | `254 232 230` (#FEE8E6) | `66 20 17` (#421411) | |
| `--color-info` | `text-info` / `bg-info` | `37 84 170` (#2554AA) | `125 165 240` (#7DA5F0) | Informational, scheduled, links in body copy |
| `--color-info-soft` | `bg-info-soft` | `231 238 252` (#E7EEFC) | `20 34 66` (#142242) | |
| `--color-overlay` | `bg-overlay` | `8 20 19` @ 0.45 | `0 0 0` @ 0.6 | Sheet/modal backdrop (alpha applied in class: `bg-overlay/45`) |
| `--color-focus` | `border-focus` | `23 134 120` (#178678) | `111 189 176` | Focus ring (keyboard/a11y) |

**Contrast (checked 2026-10-10, WCAG 2.1):** every text token pair above passes AA (≥ 4.5:1) on its intended surface — e.g. primary on white 7.9, text-secondary on bg 4.9, warning 5.2, danger 6.6, success 5.0; dark: text-secondary 7.3, primary 5.4. **Exception:** `text-tertiary` (2.9 light / 4.2 dark) is for placeholders and disabled states only — never for information a user needs to read.

### 1.3 Passbook (hero card) tokens — same in both themes
| Token | Value | Use |
|---|---|---|
| `--color-passbook` | `10 72 66` (#0A4842) | Card fill |
| (no separate var) | `on-passbook` @ 0.07 → class `bg-on-passbook/[0.07]` | Ruled lines (1 dp, every 28 dp) |
| `--color-on-passbook` | `255 255 255` | Amount text |
| `--color-on-passbook-muted` | `168 215 206` (#A8D7CE) | Labels on passbook |
| `--color-passbook-stamp` | `227 194 122` (#E3C27A) | Stamp border + text ("PAID UP", "2 OVERDUE") |

### 1.4 Status → colour mapping (single source; `StatusChip` reads this)
| Status family | Tone | Examples |
|---|---|---|
| positive | success | paid, verified, confirmed, approved, active, present, posted, completed, disbursed, won |
| pending | warning | pending, partial, submitted, under_review, nominations, in_progress, late, due_soon |
| negative | danger | overdue, failed, rejected, cancelled, suspended, absent, defaulted |
| neutral | text-secondary on surface-sunken | draft, closed, inactive, excused, waived, archived |
| scheduled | info | scheduled, upcoming, voting_open, open |

### 1.5 Chart palette (`tokens.chart`) — ordered, colour-blind-safe in sequence
| Order | Light | Dark |
|---|---|---|
| 1 primary series | `#0B5C53` | `#3CA294` |
| 2 | `#C8962E` | `#E3C27A` |
| 3 | `#2554AA` | `#7DA5F0` |
| 4 | `#B4532A` | `#F0A07A` |
| 5 | `#6B5BA8` | `#B3A6E8` |
| 6 | `#5E706C` | `#9AB0AC` |
| expected/target line | `--color-text-tertiary` dashed | same |
| gridlines | `--color-border` | same |

Payment-method colours from the API (`dashboard.service.ts` returns hard-coded hex per method) are **ignored**; map methods to chart palette order instead: transfer 1, card 2, cash 3, POS 4, mobile money 5, other 6.

---

## 2. Typography

**Family:** Manrope (variable, via `@expo-google-fonts/manrope`), weights 400 / 500 / 600 / 700 / 800. Fallback: system. All numeric displays use `fontVariant: ['tabular-nums']` (built into the `Money` and `Stat` components, and the `num` text variant).

| Token | Class | Size / line-height (dp) | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `--text-display` | `text-display` | 40 / 44 | 800 | -0.8 | Passbook amount, payment success amount |
| `--text-h1` | `text-h1` | 28 / 34 | 700 | -0.4 | Screen large titles (tab roots) |
| `--text-h2` | `text-h2` | 22 / 28 | 700 | -0.2 | Section heroes, sheet titles |
| `--text-h3` | `text-h3` | 18 / 24 | 600 | 0 | Section headings, card titles |
| `--text-body-lg` | `text-body-lg` | 17 / 24 | 500 | 0 | Primary row titles, inputs |
| `--text-body` | `text-body` | 15 / 22 | 400 | 0 | Default body |
| `--text-body-strong` | `text-body-strong` | 15 / 22 | 600 | 0 | Emphasis within body, row amounts |
| `--text-label` | `text-label` | 13 / 18 | 600 | 0.1 | Field labels, section labels (sentence case) |
| `--text-caption` | `text-caption` | 12 / 16 | 500 | 0.1 | Meta lines, timestamps, helper text |
| `--text-micro` | `text-micro` | 11 / 14 | 600 | 0.2 | Badges, tab labels, stamp text |
| `--text-num-lg` | `text-num-lg` | 24 / 30 | 700 | -0.3 | KPI tile values |

Rules: sentence case everywhere (titles, buttons, labels, tabs). No all-caps except the passbook stamp (a deliberate stamp imitation, `text-micro`, tracking 1.2). Max body line length ~70 characters on wide screens (`max-w-prose` = 560 dp).

---

## 3. Spacing (4-dp grid)

| Token | Value (dp) | Class suffix | Typical use |
|---|---|---|---|
| `--space-0` | 0 | `0` | |
| `--space-0.5` | 2 | `0.5` | Icon–text nudge |
| `--space-1` | 4 | `1` | Tight inline gaps |
| `--space-2` | 8 | `2` | Chip padding, icon gap |
| `--space-3` | 12 | `3` | Row vertical padding (compact), field gap |
| `--space-4` | 16 | `4` | **Screen gutter**, card padding, row padding |
| `--space-5` | 20 | `5` | Card padding (hero) |
| `--space-6` | 24 | `6` | Between sections |
| `--space-8` | 32 | `8` | Large section separation, empty-state padding |
| `--space-10` | 40 | `10` | Top of auth screens |
| `--space-12` | 48 | `12` | |
| `--space-16` | 64 | `16` | Illustration spacing |

Layout constants (`tokens.layout`): `gutter 16`, `sectionGap 24`, `rowMinHeight 56`, `rowMinHeightCompact 48`, `touchTarget 44`, `tabBarHeight 64 + safe area`, `headerHeight 52`, `maxContentWidth 560`, `stickyFooterPadding 16 + safe area`.

---

## 4. Radius (hierarchy, not one-size-fits-all)

| Token | Value | Class | Use |
|---|---|---|---|
| `--radius-xs` | 4 | `rounded-xs` | Progress bars, tiny indicators |
| `--radius-sm` | 8 | `rounded-sm` | Chips, badges, segmented items |
| `--radius-md` | 12 | `rounded-md` | Buttons, inputs, list groups |
| `--radius-lg` | 16 | `rounded-lg` | Cards, KPI tiles |
| `--radius-xl` | 24 | `rounded-xl` | Passbook card, bottom-sheet top corners |
| `--radius-full` | 9999 | `rounded-full` | Avatars, pill tab indicator, FAB |

## 5. Borders
| Token | Value | Use |
|---|---|---|
| `--border-hairline` | `StyleSheet.hairlineWidth` (JS) / `0.5` | Row separators |
| `--border-thin` | 1 | Cards, inputs |
| `--border-thick` | 2 | Focused input, selected radio card, passbook stamp |

## 6. Elevation (used sparingly — sheets, toasts, FAB only; cards are flat with a border)
| Token | iOS shadow | Android elevation | Use |
|---|---|---|---|
| `--elevation-0` | none | 0 | Default |
| `--elevation-1` | `0 1 2` colour `#0A2A26` @ 0.06 | 1 | Sticky footer |
| `--elevation-2` | `0 4 12` colour `#0A2A26` @ 0.10 | 4 | Toasts, menus |
| `--elevation-3` | `0 12 32` colour `#0A2A26` @ 0.18 | 12 | Bottom sheets, FAB |
Dark mode: shadows off; use `surface-raised` + `border` for separation.

## 7. Icon sizes
| Token | Value | Use |
|---|---|---|
| `--icon-sm` | 16 | Inline with caption |
| `--icon-md` | 20 | Default (rows, buttons) |
| `--icon-lg` | 24 | Tab bar, header actions |
| `--icon-xl` | 32 | Quick actions |
| `--icon-2xl` | 48 | Empty/error states |
Stroke width 1.75 (2 for `sm`).

## 8. Motion
| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 120 ms | Press feedback, toggles |
| `--duration-base` | 200 ms | Sheets content, chip changes |
| `--duration-slow` | 320 ms | Screen-level reveals, payment success |
| `--easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Most transitions |
| `--easing-emphasized` | spring `{ damping: 18, stiffness: 180 }` | Sheets, success check |
| `--press-scale` | 0.97 | Pressable cards/buttons |
Reduced motion: durations → 0, springs → instant, keep opacity fades ≤ 120 ms.

## 9. Z-order (JS only)
`base 0 · sticky 10 · header 20 · tabBar 30 · sheet 40 · toast 50 · lock 100`.

---

## 10. `global.css` (authoritative source — copy exactly in F1.2)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* surfaces */
  --color-bg: 245 248 247;
  --color-surface: 255 255 255;
  --color-surface-raised: 255 255 255;
  --color-surface-sunken: 237 242 240;
  --color-border: 221 229 227;
  --color-border-strong: 197 208 205;
  /* text */
  --color-text: 19 33 31;
  --color-text-secondary: 94 112 108;
  --color-text-tertiary: 138 155 151;
  --color-text-inverse: 255 255 255;
  /* brand */
  --color-primary: 11 92 83;
  --color-primary-pressed: 8 72 66;
  --color-primary-soft: 238 247 245;
  --color-on-primary-soft: 11 92 83;
  --color-accent: 200 150 46;
  --color-accent-text: 138 101 22;
  --color-accent-soft: 247 235 207;
  /* status */
  --color-success: 22 128 74;
  --color-success-soft: 228 245 235;
  --color-warning: 194 65 12;
  --color-warning-soft: 255 237 225;
  --color-danger: 180 35 24;
  --color-danger-soft: 254 232 230;
  --color-info: 37 84 170;
  --color-info-soft: 231 238 252;
  /* misc */
  --color-overlay: 8 20 19;
  --color-focus: 23 134 120;
  /* passbook (theme-independent) */
  --color-passbook: 10 72 66;
  --color-on-passbook: 255 255 255;
  --color-on-passbook-muted: 168 215 206;
  --color-passbook-stamp: 227 194 122;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: 12 23 22;
    --color-surface: 18 33 32;
    --color-surface-raised: 26 45 43;
    --color-surface-sunken: 9 18 17;
    --color-border: 37 64 60;
    --color-border-strong: 52 84 79;
    --color-text: 232 240 238;
    --color-text-secondary: 154 176 172;
    --color-text-tertiary: 110 133 129;
    --color-text-inverse: 12 23 22;
    --color-primary: 60 162 148;
    --color-primary-pressed: 111 189 176;
    --color-primary-soft: 14 52 47;
    --color-on-primary-soft: 168 215 206;
    --color-accent: 227 194 122;
    --color-accent-text: 227 194 122;
    --color-accent-soft: 58 45 17;
    --color-success: 74 199 128;
    --color-success-soft: 16 51 33;
    --color-warning: 251 146 60;
    --color-warning-soft: 61 32 14;
    --color-danger: 248 113 102;
    --color-danger-soft: 66 20 17;
    --color-info: 125 165 240;
    --color-info-soft: 20 34 66;
    --color-overlay: 0 0 0;
    --color-focus: 111 189 176;
  }
}
```
> NativeWind applies the dark block when the colour scheme is dark — including a manual override via `colorScheme.set('dark')`. Confirm the exact dark-variable mechanism for the NativeWind version pinned in F1.2 (v4: `@media (prefers-color-scheme: dark)` inside `:root` or the `.dark:root` selector with `darkMode: 'class'`), and record it in `library-docs.md`.

## 11. `tailwind.config.js` mapping (shape)

```js
const v = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    colors: {
      transparent: 'transparent',
      bg: v('bg'), surface: { DEFAULT: v('surface'), raised: v('surface-raised'), sunken: v('surface-sunken') },
      border: { DEFAULT: v('border'), strong: v('border-strong') },
      text: { DEFAULT: v('text'), secondary: v('text-secondary'), tertiary: v('text-tertiary'), inverse: v('text-inverse') },
      primary: { DEFAULT: v('primary'), pressed: v('primary-pressed'), soft: v('primary-soft') },
      'on-primary-soft': v('on-primary-soft'),
      accent: { DEFAULT: v('accent'), text: v('accent-text'), soft: v('accent-soft') },
      success: { DEFAULT: v('success'), soft: v('success-soft') },
      warning: { DEFAULT: v('warning'), soft: v('warning-soft') },
      danger: { DEFAULT: v('danger'), soft: v('danger-soft') },
      info: { DEFAULT: v('info'), soft: v('info-soft') },
      overlay: v('overlay'), focus: v('focus'),
      passbook: { DEFAULT: v('passbook'), stamp: v('passbook-stamp') },
      'on-passbook': { DEFAULT: v('on-passbook'), muted: v('on-passbook-muted') },
    },
    spacing: { 0: '0px', 0.5: '2px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px' },
    borderRadius: { none: '0px', xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', full: '9999px' },
    fontFamily: { sans: ['Manrope_500Medium'], regular: ['Manrope_400Regular'], semibold: ['Manrope_600SemiBold'], bold: ['Manrope_700Bold'], extrabold: ['Manrope_800ExtraBold'] },
    fontSize: {
      display: ['40px', { lineHeight: '44px', letterSpacing: '-0.8px' }],
      h1: ['28px', { lineHeight: '34px', letterSpacing: '-0.4px' }],
      h2: ['22px', { lineHeight: '28px', letterSpacing: '-0.2px' }],
      h3: ['18px', { lineHeight: '24px' }],
      'body-lg': ['17px', { lineHeight: '24px' }],
      body: ['15px', { lineHeight: '22px' }],
      label: ['13px', { lineHeight: '18px', letterSpacing: '0.1px' }],
      caption: ['12px', { lineHeight: '16px', letterSpacing: '0.1px' }],
      micro: ['11px', { lineHeight: '14px', letterSpacing: '0.2px' }],
      'num-lg': ['24px', { lineHeight: '30px', letterSpacing: '-0.3px' }],
    },
    extend: {},
  },
};
```
Stock Tailwind colours, spacing and font sizes are intentionally **replaced**, not extended, so `bg-teal-500` or `p-7` fail to resolve and get caught in review.

## 12. `tokens.ts` (JS mirror shape)
```ts
export const tokens = {
  light: { color: { bg: '#F5F8F7', surface: '#FFFFFF', /* …every semantic colour as hex… */ }, chart: ['#0B5C53', '#C8962E', '#2554AA', '#B4532A', '#6B5BA8', '#5E706C'] },
  dark:  { color: { bg: '#0C1716', surface: '#122120', /* … */ }, chart: ['#3CA294', '#E3C27A', '#7DA5F0', '#F0A07A', '#B3A6E8', '#9AB0AC'] },
  space: { 0: 0, 0.5: 2, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },
  radius: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
  icon: { sm: 16, md: 20, lg: 24, xl: 32, '2xl': 48 },
  motion: { fast: 120, base: 200, slow: 320, pressScale: 0.97 },
  layout: { gutter: 16, sectionGap: 24, rowMinHeight: 56, rowMinHeightCompact: 48, touchTarget: 44, headerHeight: 52, maxContentWidth: 560 },
  z: { base: 0, sticky: 10, header: 20, tabBar: 30, sheet: 40, toast: 50, lock: 100 },
} as const;
```
A unit test asserts every hex in `tokens.ts` equals the RGB channels in `global.css`.

## 13. Association brand colour
`Association.primaryColor` (optional) is used **only** for the association logo fallback circle and a 3-dp strip on the association card in Profile/Association screens. It never replaces `--color-primary` (unknown contrast).

---

## 14. Docs site tokens (`apps/docs/app/theme.css`)

The docs site shares the mobile palette (ledger green + brass, Manrope) so the manual, the app and the store listings read as one brand. Values are the **same hex values** as §1; only the reading-oriented type scale and widths differ. Docs use CSS variables consumed by Tailwind and by Fumadocs UI.

### 14.1 Fumadocs theme variable overrides
Fumadocs UI reads `--color-fd-*` variables (names per the Fumadocs version pinned in D1.1 — verify and adjust names, not values). Map:

| Fumadocs variable | Light | Dark | Source token |
|---|---|---|---|
| `--color-fd-background` | `#F5F8F7` | `#0C1716` | bg |
| `--color-fd-foreground` | `#13211F` | `#E8F0EE` | text |
| `--color-fd-muted` | `#EDF2F0` | `#091211` | surface-sunken |
| `--color-fd-muted-foreground` | `#5E706C` | `#9AB0AC` | text-secondary |
| `--color-fd-card` | `#FFFFFF` | `#122120` | surface |
| `--color-fd-card-foreground` | `#13211F` | `#E8F0EE` | text |
| `--color-fd-popover` | `#FFFFFF` | `#1A2D2B` | surface-raised |
| `--color-fd-popover-foreground` | `#13211F` | `#E8F0EE` | text |
| `--color-fd-border` | `#DDE5E3` | `#25403C` | border |
| `--color-fd-primary` | `#0B5C53` | `#3CA294` | primary |
| `--color-fd-primary-foreground` | `#FFFFFF` | `#0C1716` | text-inverse |
| `--color-fd-secondary` | `#EEF7F5` | `#0E342F` | primary-soft |
| `--color-fd-secondary-foreground` | `#0B5C53` | `#A8D7CE` | on-primary-soft |
| `--color-fd-accent` | `#EEF7F5` | `#0E342F` | primary-soft (hover/active sidebar item) |
| `--color-fd-accent-foreground` | `#0B5C53` | `#A8D7CE` | on-primary-soft |
| `--color-fd-ring` | `#178678` | `#6FBDB0` | focus |

### 14.2 Docs-specific semantic tokens
| CSS variable | Light | Dark | Use |
|---|---|---|---|
| `--docs-callout-note-bg` / `-border` | `#E7EEFC` / `#2554AA` | `#142242` / `#7DA5F0` | Note callout (info) |
| `--docs-callout-tip-bg` / `-border` | `#E4F5EB` / `#16804A` | `#103321` / `#4AC780` | Tip callout (success) |
| `--docs-callout-warning-bg` / `-border` | `#FFEDE1` / `#C2410C` | `#3D200E` / `#FB923C` | Warning callout |
| `--docs-callout-danger-bg` / `-border` | `#FEE8E6` / `#B42318` | `#421411` / `#F87166` | Danger callout |
| `--docs-step-marker` | `#0B5C53` | `#3CA294` | Numbered step circles |
| `--docs-screenshot-frame` | `#DDE5E3` | `#25403C` | 1-px frame around screenshots |
| `--docs-marker-bg` / `-fg` | `#C8962E` / `#13211F` | `#E3C27A` / `#0C1716` | Numbered annotation markers on screenshots (brass) |
| `--docs-badge-web-bg` / `-fg` | `#EEF7F5` / `#0B5C53` | `#0E342F` / `#A8D7CE` | *Web* platform badge |
| `--docs-badge-mobile-bg` / `-fg` | `#F7EBCF` / `#755510` | `#3A2D11` / `#E3C27A` | *Mobile* platform badge |
| `--docs-applies-bg` | `#EDF2F0` | `#122120` | "Applies to" box |
| `--docs-code-bg` | `#EDF2F0` | `#091211` | Inline code / code blocks |
| `--docs-hero-bg` | `#0A4842` | `#0A4842` | `/docs` home hero band (passbook green, with ruled lines at 7 % white) |

Callout text always uses `--color-fd-foreground`; the coloured `-border` values are the 4-px left rule and icon only (decorative). Badge and marker text pairs pass AA (mobile badge `#755510` on `#F7EBCF`; marker `#13211F` on brass 6.2:1).

### 14.3 Docs typography (reading scale, Manrope)
| Token | Size / line-height (px) | Weight | Use |
|---|---|---|---|
| `--docs-text-title` | 36 / 44 (28 / 36 on < 640 px) | 800, tracking -0.6 | Page title |
| `--docs-text-description` | 18 / 28 | 500, text-secondary | Page description |
| `--docs-text-h2` | 24 / 32 | 700 | Main sections (TOC level 1) |
| `--docs-text-h3` | 19 / 28 | 600 | Sub-sections |
| `--docs-text-body` | 16 / 28 | 400 | Body (more leading than app for long reading) |
| `--docs-text-small` | 14 / 22 | 500 | Captions, Applies-to, table cells |
| `--docs-text-micro` | 12 / 16 | 600 | Badges, markers |
| `--docs-text-sidebar` | 14 / 20 | 500 (active 600) | Sidebar links |
Sentence case everywhere; no all-caps labels; tabular figures in tables with amounts (`font-variant-numeric: tabular-nums`).

### 14.4 Docs layout tokens
| Token | Value | Use |
|---|---|---|
| `--docs-content-max` | 720px | Prose column (≈ 70 characters per line) |
| `--docs-sidebar-width` | 272px | Left sidebar |
| `--docs-toc-width` | 240px | Right "On this page" rail (hidden < 1280 px) |
| `--docs-gutter` | 24px (16px < 640 px) | Page side padding |
| `--docs-section-gap` | 48px | Between H2 sections |
| `--docs-radius-sm` / `-md` / `-lg` | 8 / 12 / 16 px | Badges / callouts, screenshots / cards |
| `--docs-screenshot-max` | 100% of content column; phone screenshots max 360px wide, centred | Screenshots |

### 14.5 Rule
Docs components use only these variables (via Tailwind theme mapping in `theme.css`) — no hex values in TSX/MDX. A unit test in `apps/docs` compares §14.1/§14.2 hex values against `apps/mobile/src/theme/tokens.ts` once mobile exists, so the two brands can't drift.

---

## 15. Admin console tokens (`apps/admin/src/theme`)

Same brand palette as mobile and docs, delivered as a **Mantine 7 theme** (`createTheme`) plus a small set of CSS variables for Tailwind. Admin is dense and data-first: tighter type scale, compact tables, and a fixed dark-green chrome so staff always know they're in the platform console, not a tenant dashboard.

### 15.1 Mantine colour tuples (10 shades, index 0 → 9)
| Name | Shades | Use |
|---|---|---|
| `ledger` (primary) | `#EEF7F5` `#D3EBE6` `#A8D7CE` `#6FBDB0` `#3CA294` `#178678` `#0E7064` `#0B5C53` `#0A4842` `#083731` | `primaryColor: 'ledger'`, `primaryShade: { light: 7, dark: 4 }` |
| `brass` (accent) | `#FBF5E6` `#F7EBCF` `#EFD9A6` `#E3C27A` `#D6AC52` `#C8962E` `#A67C22` `#8A6516` `#6E500F` `#523B0A` | Highlights only (unread, selected-row marker); text on light uses shade 7+ |
| `gray` (override) | `#F5F8F7` `#EDF2F0` `#DDE5E3` `#C5D0CD` `#8A9B97` `#5E706C` `#33433F` `#25403C` `#1A2D2B` `#13211F` | Mantine neutrals, light scheme |
| `dark` (override) | `#E8F0EE` `#9AB0AC` `#6E8581` `#34544F` `#25403C` `#1A2D2B` `#122120` `#0C1716` `#091211` `#05100F` | Mantine dark scheme (dark[7] = page background, dark[6] = surfaces, dark[0] = text) |
| `red` (danger) | Mantine default `red`, but `danger` usages map to `#B42318` light / `#F87166` dark via semantic variables below | Destructive buttons, failed statuses |
| `orange` (warning) | maps to `#C2410C` / `#FB923C` | Pending, impersonation |
| `green` (success) | maps to `#16804A` / `#4AC780` | Active, success |
| `blue` (info) | maps to `#2554AA` / `#7DA5F0` | Info, scheduled |

### 15.2 Admin semantic CSS variables (`theme/admin.css`)
| Variable | Light | Dark | Use |
|---|---|---|---|
| `--admin-chrome-bg` | `#0A4842` | `#091211` | Left navigation and top bar background (same in light mode — the "platform" signal) |
| `--admin-chrome-fg` | `#E8F0EE` | `#E8F0EE` | Nav text |
| `--admin-chrome-fg-muted` | `#A8D7CE` | `#9AB0AC` | Nav group labels, inactive icons |
| `--admin-chrome-active-bg` | `#0E7064` | `#122120` | Active nav item |
| `--admin-chrome-active-marker` | `#E3C27A` | `#E3C27A` | 3-px brass bar left of the active item |
| `--admin-page-bg` | `#F5F8F7` | `#0C1716` | Content background |
| `--admin-surface` | `#FFFFFF` | `#122120` | Cards, tables |
| `--admin-border` | `#DDE5E3` | `#25403C` | Table rules, card borders |
| `--admin-row-hover` | `#EEF7F5` | `#1A2D2B` | Table row hover |
| `--admin-env-prod-bg` / `-fg` | `#FEE8E6` / `#B42318` | `#421411` / `#F87166` | "Production" badge |
| `--admin-env-staging-bg` / `-fg` | `#E7EEFC` / `#2554AA` | `#142242` / `#7DA5F0` | "Staging" badge |
| `--admin-impersonation-bg` / `-fg` | `#FFEDE1` / `#C2410C` | `#3D200E` / `#FB923C` | Active impersonation pill and the tenant-side banner |
| `--admin-danger-zone-border` | `#B42318` | `#F87166` | Danger-zone card border on association detail |

### 15.3 Admin typography (Manrope, dense scale)
| Token | px (size / line) | Weight | Use |
|---|---|---|---|
| `h1` (page title) | 24 / 32 | 700 | `PageHeader` title |
| `h2` | 18 / 26 | 700 | Card / section titles |
| `h3` | 15 / 22 | 600 | Sub-sections, tab panels |
| `body` (`md`) | 14 / 20 | 400 | Default text, table cells |
| `sm` | 13 / 18 | 500 | Secondary text, filters, badges |
| `xs` | 12 / 16 | 500 | Timestamps, table meta |
| `stat` | 28 / 34 | 700, tabular | `StatCard` values |
Sentence case; tabular figures in tables and stats.

### 15.4 Admin spacing, radius, sizes
- Spacing: same 4-px scale as mobile (`xs 4, sm 8, md 12, lg 16, xl 24`, plus 32/48 for page sections). Page padding 24 px; card padding 16 px.
- Radius: `xs 4, sm 6, md 8, lg 12` (denser UI than mobile); badges `sm`, buttons/inputs `md`, cards `lg`.
- Table row height: 44 px (compact 36 px option). Nav width 248 px (collapsed 64 px). Top bar 56 px.
- Shadows: none on cards; `md` shadow only for menus, modals, notifications.

### 15.5 Rule
No hex values in admin components — only Mantine theme colours (`c="ledger.7"`, `var(--mantine-color-ledger-7)`) and the CSS variables above. Raw Tailwind palette classes from the migrated web code (`text-teal-600`, `bg-gray-800`…) must be replaced during migration.
