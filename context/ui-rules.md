# UI Rules — SocietyLedger Mobile, Docs & Admin

> How the mobile interface (§1–§10), the documentation site (§11–§12) and the admin console (§13) look and behave. Values come from `ui-tokens.md`; components that implement these rules are listed in `ui-registry.md`. Before building any screen, check the registry and reuse.

---

## 1. Principles
1. **One memorable element: the Passbook.** The deep-green ruled balance card with a brass stamp is the app's signature. It appears on Home (member), Money overview, Savings account detail and Loan detail — nowhere else. Everything around it stays quiet.
2. **Ledger rows, not card soup.** Lists are grouped rows on a surface with hairline separators (like ledger lines). Cards are reserved for things that are genuinely separate objects (a meeting, an election, a KPI tile). Never wrap every section in its own card.
3. **Money is the headline.** Amounts are the largest, boldest thing in any money row; tabular figures; right-aligned in rows; colour only for status, never decoration.
4. **Plain words, sentence case.** "Pay ₦25,000", not "Proceed to payment". The action name is consistent through the flow: button "Submit proof" → toast "Proof submitted" → status "Submitted".
5. **Designed for patchy data and cheap phones.** Skeletons not spinners, cached data with an offline banner, big touch targets, no heavy blur/transparency effects (except the privacy overlay).
6. **Permission-shaped UI.** If a user can't do something, the control isn't there.

---

## 2. Layout
- **Screen gutter** 16 dp left/right. Content max width 560 dp, centred on tablets.
- **Safe areas** always respected via `Screen` (top handled by header; bottom by tab bar or `StickyFooter`).
- **Vertical rhythm:** 24 dp between sections; 12 dp between a section heading and its content; 16 dp padding inside cards.
- **Alignment:** left-aligned text everywhere. Centred text only in empty/error states, the passbook stamp, and auth illustrations. Amounts right-aligned in rows, left-aligned in heroes.
- **Tab roots** use a large title (`text-h1`) that collapses into the header on scroll (iOS large-title behaviour; Android: title scrolls with content, header gets a hairline when scrolled).
- **Detail screens** use a standard header (title `text-h3`, back button, up to 2 action icons; extra actions in an overflow `…` sheet).
- **Forms** are single-column; primary action in a `StickyFooter` above the keyboard; destructive actions at the bottom of the form, separated by 32 dp, as text buttons in danger colour.

### Screen skeletons
```
Tab root                         Detail                         Form (modal)
┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│ Good morning, Ada   🔔•  │    │ ‹  Payment proof     ⋯   │    │ Cancel   New member      │
│ Opuogun State Union      │    ├──────────────────────────┤    ├──────────────────────────┤
│┌────────────────────────┐│    │ Summary block            │    │ Label                    │
││ PASSBOOK  ₦25,000.00   ││    │ (key facts, status chip) │    │ [ input              ]   │
││ ─────────────────────  ││    │                          │    │ Label                    │
││ Next due 31 Oct  [PAY] ││    │ Section heading          │    │ [ input              ]   │
│└────────────────────────┘│    │ ┌──────────────────────┐ │    │ …                        │
│ Quick actions (grid 3×2) │    │ │ row ─────────── ₦ │ │    │                          │
│ Section heading   See all│    │ │ row ─────────── ₦ │ │    │                          │
│ ┌──────────────────────┐ │    │ └──────────────────────┘ │    ├──────────────────────────┤
│ │ row ────────────── ₦ │ │    ├──────────────────────────┤    │ [      Save member     ] │
│ │ row ────────────── ₦ │ │    │ [ Reject ]  [  Verify  ] │    └──────────────────────────┘
│ └──────────────────────┘ │    └──────────────────────────┘
├──────────────────────────┤
│ Home Money Community … │
└──────────────────────────┘
```

---

## 3. Typography usage
- One family: Manrope. Hierarchy comes from size + weight, not colour or italics.
- Screen titles `h1` (tab roots) / `h3` (detail headers). Section headings `h3` in sentence case with an optional trailing "See all" text button (`text-label`, primary).
- **Do not** add small labels above headings ("eyebrows"), all-caps labels, or bold/colour on a single word in a heading.
- Body copy `body`; secondary meta in `caption` + `text-secondary`; one meta line per row max.
- Numbers: always via `Money` (amounts), `Stat` (counts/percentages) or `Text variant="num"` — these force tabular figures.
- Truncate titles to 1 line, descriptions to 2 lines (`numberOfLines`), with full text on the detail screen.

---

## 4. Colour usage
- Backgrounds: `bg` for screens, `surface` for groups/cards, `surface-sunken` for inputs and tracks.
- Primary colour is for the **one** primary action per screen, the active tab, links and selection. Never paint large areas primary except the Passbook (which uses `passbook`).
- Brass `accent` appears only on: the passbook stamp, unread dots, the "new" indicator on announcements, and highlighted winner in election results. Max one brass element per screen outside the passbook.
- Status colours only for status (chips, amount sign for overdue, chart semantics). An overdue amount is `danger`; paid amounts stay `text`.
- Dark mode is a first-class theme: test every screen in both.

---

## 5. Components & their rules

### 5.1 Passbook card (signature)
- Fill `passbook`, radius `xl`, padding 20, ruled lines (1 dp, `bg-on-passbook/[0.07]`, every 28 dp) drawn behind content, subtle 2-dp brass top edge.
- Content: label (`label`, on-passbook-muted) → amount (`display`, on-passbook) → meta line (next due date / account number) → actions row.
- **Stamp** (top-right): rotated −8°, 2-dp `passbook-stamp` border, radius `sm`, `micro` all caps tracking 1.2: `PAID UP` (outstanding = 0), `{n} OVERDUE`, `ACTIVE` (savings), `{n}/{m} REPAID` (loans). Animates once (scale 1.15 → 1, 320 ms) when its value changes; never loops.
- Primary action inside the card uses `Button variant="onPassbook"` (white fill, passbook-coloured text).
- Amount can be hidden: eye icon toggles `₦ •••••` (preference persisted) for privacy in public.

### 5.2 Buttons
| Variant | Look | Use |
|---|---|---|
| `primary` | `bg-primary`, `text-inverse`, radius md, height 52 (lg) / 44 (md) / 36 (sm) | One per screen; main action |
| `secondary` | `bg-surface`, 1-dp `border-strong`, `text` | Secondary actions |
| `soft` | `bg-primary-soft`, `text-on-primary-soft` | Inline actions in lists/cards (e.g. "Pay", "Verify") |
| `ghost` | transparent, `text-primary` | Tertiary, "See all", "Cancel" in headers |
| `danger` | `bg-danger`, `text-inverse` | Confirm destructive action inside ConfirmSheet only |
| `danger-ghost` | transparent, `text-danger` | Destructive entry points (Delete member) |
| `onPassbook` | white fill, `passbook` text | Only inside Passbook |
- Labels are verbs + object, sentence case: "Pay ₦25,000", "Submit proof", "Verify payment", "Save member". No trailing arrows.
- Loading: label replaced by spinner, width preserved, `accessibilityState.busy`.
- Disabled: 40 % opacity, only for transient conditions (offline, invalid after submit, in-flight). Offline buttons show caption "You're offline" below.
- Full-width in footers; intrinsic width inline. Two buttons side-by-side: secondary left, primary right, equal width.
- Press feedback: scale 0.97 + `primary-pressed` (no ripple-everything on Android; use `android_ripple` with `primary/12` on rows only).
- Haptics: light impact on primary success actions (payment success, vote cast, attendance marked); none on navigation.

### 5.3 List rows (`ListItem`) — the workhorse
- Min height 56 (compact 48). Padding 16 horizontal, 12 vertical.
- Anatomy: leading (icon in 36-dp `surface-sunken` circle, or `Avatar`) · title (`body-lg` / `body-strong`) + meta (`caption`, secondary) · trailing (amount via `Money`, `StatusChip`, chevron, or switch).
- Grouped inside `ListGroup` (`surface`, radius md, 1-dp border in light / no border in dark) with hairline separators inset to the text start.
- Money rows: title = what it is ("October dues"), meta = date · category, trailing = amount stacked over status chip.
- Swipe actions (FlashList + gesture handler) only in: notifications (read/delete), attendance (no—use segmented control), nothing else. Always mirror swipe actions in a long-press menu for accessibility.

### 5.4 Cards
- `surface`, radius lg, 1-dp `border` (light) / `surface` on `bg` (dark), padding 16, **no shadow**.
- Used for: meeting card, election/poll card, KPI tile, quick-action tile, bank account card, association card.
- KPI tile: label (`label`, secondary) · value (`num-lg`) · change (`caption` with ▲/▼ glyph and success/danger colour + text "vs last month"). Two per row, 12-dp gap.
- Quick actions: 3-column grid, tile = 32-dp icon in `primary-soft` circle + `caption` label, max 6 tiles.

### 5.5 Status chips & badges
- `StatusChip`: height 24, radius sm, `micro` weight 600, soft background + strong text from the status mapping (`ui-tokens.md §1.4`). Text always present ("Overdue", "Paid", "Pending").
- Count badge (tab/bell/menu): min 18 dp circle, `danger` fill, `micro` white, "99+" cap.
- Unread dot: 8 dp `accent`.
- Role chips (profile): `surface-sunken` + `text-secondary`.

### 5.6 Inputs
- Label above (`label`), input height 52, radius md, `surface-sunken` fill, 1-dp `border-strong` → 2-dp `focus` on focus, `danger` on error. Helper/error below (`caption`).
- Amount field: large (`h2`) right-aligned ₦ value with live thousands separators, quick preset chips beneath (e.g. ₦1,000 · ₦5,000 · ₦10,000 — rendered as separate chips, not a dotted string).
- Pickers open a `SelectSheet` (searchable when > 8 options). Dates open the native date picker.
- OTP: 6 boxes, auto-advance, paste fills all, `oneTimeCode` autofill on iOS / SMS retriever not used.
- Password: show/hide toggle; strength meter on create/reset screens.
- Search: `SearchField` with leading search icon, clear button, 300 ms debounce.

### 5.7 Segmented controls & tabs within screens
- `SegmentedControl` for 2–4 peer views (Upcoming | Past, Me | Association, Income | Balance | Cash flow). Track `surface-sunken`, selected pill `surface` + `elevation-1` (light) / `surface-raised` (dark).
- More than 4 views → horizontally scrollable chip row.

### 5.8 Bottom tab bar
- Height 64 + safe area, `surface` with top hairline. 4–5 items: icon 24 + `micro` label. Active: icon + label `primary`, with a 32×4 `primary` pill above the icon (no filled background blob). Inactive: `text-secondary`.
- Badge on Manage tab = sum of pending queue counts the user can act on.

### 5.9 Headers
- Height 52, `bg` colour (blends with screen), hairline appears on scroll. Back chevron + previous title (iOS) / arrow (Android). Right: max two `IconButton`s (44-dp targets). The notification bell with badge sits on every tab root header.

### 5.10 Bottom sheets
- Top radius xl, grabber 36×4 `border-strong`, backdrop `overlay/45`, title `h2` left-aligned with close `IconButton`.
- Use for filters, pickers, confirmations, quick actions, receipts. Never stack more than one sheet.
- `ConfirmSheet` for destructive/irreversible actions: title states the action ("Delete this transaction?"), body states the consequence in one sentence, buttons: `secondary` "Keep it" + `danger` with the same verb ("Delete transaction"). Biometric re-auth runs after confirm for the actions in architecture.md §7.5.

### 5.11 Feedback states (every data screen)
| State | Component | Rules |
|---|---|---|
| Loading | `Skeleton` blocks shaped like the real layout | Never a full-screen spinner except Splash. Shimmer off when reduce-motion. |
| Empty | `EmptyState` | 48-dp icon, title stating the situation ("No payments yet"), one line telling what to do, optional primary action ("Make a payment"). |
| Error | `ErrorState` | What happened in plain words ("We couldn't load your payments."), "Try again" button; network vs server copy differs. No apologies. |
| Offline | `OfflineBanner` | Slim `warning-soft` banner under header: "You're offline. Showing saved data from 10:42." Mutations disabled. |
| Module locked | `ModuleLocked` | "Welfare isn't part of your association's plan." + "Your association admin can add it from the website." (no upgrade/purchase button). |
| Subscription inactive | `SubscriptionInactive` | "Your association's subscription has ended." + admin guidance. Read-only data still shown where cached. |
| No permission | `NoPermission` | Only reachable by deep link: "You don't have access to this page." + Go home. |
| Pull to refresh | native `RefreshControl` tinted primary | All tab roots and lists. |

### 5.12 Toasts
- Top, below status bar, `surface-raised`, `elevation-2`, radius md, icon by type. Success copy uses the past tense of the action verb ("Payment recorded"). Errors state the cause and fix ("Amount is more than the balance. Enter ₦12,500 or less."). Undo action for deletions (5 s).

### 5.13 Charts
- Only via `components/charts/*`. Max 6 series; no 3D, no gradients under lines (flat 12 % area fill allowed for single-series trends).
- Axis labels `caption` `text-secondary`, gridlines `border`, compact money (`₦1.2m`).
- Every chart has a title (`h3`), an optional one-line takeaway (`caption`) and an accessible text alternative.
- Donut: max 5 slices + "Other"; legend as rows below with amounts and percentages.

### 5.14 Avatars & logos
- Member avatar: initials on a colour derived from member id (from chart palette, 12 % tint background + strong text). Sizes 32 / 40 / 64.
- Association logo: rounded `md` square, `contain`, `surface-sunken` background; fallback = initials on association `primaryColor` (or ledger-600).

### 5.15 Images & documents (proofs, attachments)
- Thumbnails 64×64 radius sm; tap opens full-screen viewer (pinch zoom, double-tap zoom, swipe down to close, share button). PDFs open with the OS viewer via share/QuickLook.

### 5.16 Money display rules
- Always `₦` prefix, thousands separators, 2 decimals in detail screens and rows; compact (`₦25k`, `₦1.2m`) only in charts and KPI tiles.
- Negative/credit values shown with a leading minus and the word context ("Credit ₦2,000") — never parentheses.
- Overdue amounts in `danger`; savings growth in `success`; everything else `text`.

### 5.17 Election ballot & voting
- Stepper header "Position 2 of 5" (a real sequence, so numbering is appropriate), candidate radio cards (photo, name, short manifesto toggle), selected = 2-dp `primary` border + check.
- Review page lists choices; submit button "Cast my vote"; after biometric confirm, success screen with haptic + "Your vote is recorded" and no way to change.

### 5.18 Attendance taking
- Sticky search + counts bar ("Present 42 · Absent 8 · Unmarked 12" rendered as three separate count chips). Each row: avatar, name, member ID, 4-option segmented control (Present / Late / Excused / Absent) with single-letter compact labels on narrow screens + full labels for screen readers. "Mark all unmarked present" ghost button.

---

## 6. Motion
- Allowed: sheet open/close, screen transitions (platform default), press scale, stamp settle (once), payment-success check draw (once, 320 ms), skeleton shimmer, list item insertion fade (120 ms).
- Not allowed: staggered entrance animations on screen load, parallax, looping animations, animated gradients.
- Respect reduce-motion (`useReducedMotion`).

---

## 7. Copy & voice
- Second person, plain verbs, sentence case, no exclamation marks except payment success ("Payment received").
- Name things the way members do: "dues", "levies", "my contributions", "loan", "savings", "meeting" — not system words ("ledger entries" → "statement"; "transactions" stays for officers).
- Errors: what happened + what to do. Never "Oops", "Something went wrong" alone, or apologies.
- Empty states invite action.
- Dates: "Today, 3:30 PM", "Tue 14 Oct", "14 Oct 2026" (long). Relative only in notifications ("5 min ago").

---

## 8. Accessibility checklist (per screen)
- Touch targets ≥ 44×44 dp (use `hitSlop` for small icons).
- Every icon-only control labelled; status chips announce "Status: overdue".
- Focus order follows visual order; sheets trap focus; returning focus to the trigger on close.
- Content readable at font scale 1.3 without clipping; rows grow vertically.
- Charts have text alternatives; colour never the only signal.
- Passbook amount announced as "Outstanding balance, 25 thousand naira".

---

## 9. Platform conventions
- iOS: large titles on tab roots, swipe-back gesture, modal sheets with "Cancel"/"Done" text buttons in header.
- Android: predictive back supported (Expo Router Stack v5 when stable), full-screen modals with close icon, `android_ripple` on rows, edge-to-edge with transparent system bars coloured by theme.
- Keep platform-native pickers (date/time) and share sheets.

---

## 10. Do / Don't quick list
| Do | Don't |
|---|---|
| Group rows in a `ListGroup` with hairlines | Put every row in its own shadowed card |
| One primary button per screen | Two filled primary buttons side by side |
| Status chip with text | Coloured dot alone |
| `Money` component for every amount | `₦${amount}` string building |
| Sentence-case section titles | ALL-CAPS labels or eyebrow text above titles |
| Skeletons shaped like content | Centered spinner on blank screen |
| Hide controls the user can't use | Show disabled controls for missing permissions |
| Brass only for stamps, unread, winners | Brass buttons, brass headings |

---

## 11. Docs site UI rules (`apps/docs`)

### 11.1 Principles
1. **Reading first.** 720-px prose column, 16/28 body, generous section spacing; nothing competes with the steps.
2. **Find, then do.** Search (⌘K) and the sidebar get people to a page in seconds; every page answers "can I do this, and how?" in its first screen (title → description → Applies to → first step).
3. **One brand.** Same ledger green + brass, Manrope and voice as the mobile app; the `/docs` home hero is the only place the passbook treatment appears on the site.
4. **Screenshots show, words explain.** Every task page has screenshots that match the steps; text never says "as shown below" without the image being right there.
5. **Works on a phone from WhatsApp.** Members arrive from shared links on phones — the page must be readable with no horizontal scrolling and with the TOC tucked away.

### 11.2 Layout
```
Desktop ≥ 1280 px
┌───────────────────────────────────────────────────────────────────────────────┐
│ [logo] SocietyLedger Docs        [ Search  ⌘K ]     Open SocietyLedger  ☀/☾   │
├──────────────┬────────────────────────────────────────────┬───────────────────┤
│ Sidebar 272  │ Home › Payments › Verifying payment proofs │ On this page      │
│ Start        │ Verifying payment proofs                   │  Before you start │
│  Introduction│ Check a member's transfer receipt and …    │  Verify a proof   │
│  Getting …   │ ┌ Applies to ─────────────────────────────┐│  What happens next│
│ For members  │ │ Officers · Web Mobile · Payments module ││                   │
│  Member guide│ └─────────────────────────────────────────┘│                   │
│ Running …    │ ## Before you start                        │                   │
│  Members     │ ## Verify a payment proof                  │                   │
│  Finance     │  ① Go to Payments → Verification           │                   │
│  Payments  ● │  ② …                                       │                   │
│  …           │ [ screenshot ]                             │                   │
│              │ ## Related   [card] [card]                 │                   │
│              │ Was this page helpful?  Yes  No            │                   │
│              │ ‹ Previous            Next ›   Updated …   │                   │
├──────────────┴────────────────────────────────────────────┴───────────────────┤
│ Footer                                                                        │
└───────────────────────────────────────────────────────────────────────────────┘
Tablet 768–1279: sidebar stays, TOC hidden (moves to "On this page" dropdown under the title).
Phone < 768: sidebar in a drawer (hamburger), search icon in header, TOC dropdown, 16-px gutters.
```

### 11.3 Docs home (`/docs`)
- Hero band in passbook green with faint ruled lines: title "SocietyLedger documentation", one-sentence description, a large search field.
- "Start here" — three role cards: *I run an association* (→ Getting started), *I'm an officer* (→ module overviews), *I'm a member* (→ Member guide).
- "Browse by area" — `CardGrid` of all sections with lucide icon, title, one-line description (no counts, no numbering).
- "Popular tasks" — 6 links curated from analytics (initially: paying online, verifying proofs, adding a member, creating a levy, taking attendance, running an election).
- "Get the app" strip (after mobile launch) and "Still stuck? Contact support".

### 11.4 Page anatomy (every page)
1. Breadcrumb (section › page), `docs-text-small`, text-secondary.
2. Title (`docs-text-title`), description (`docs-text-description`).
3. **Applies to** box (`docs-applies-bg`, radius md): audience chips · platform badges (*Web*, *Mobile*) · plan/module note · permission in plain words ("You need permission to verify payments"). Auto-generated; omitted on overview/FAQ pages.
4. Body.
5. Related cards (max 3).
6. Feedback row, prev/next, last updated.

### 11.5 Component rules
| Component | Rules |
|---|---|
| **Steps** | Numbered circles in `docs-step-marker`; one action per step; step text ≤ 2 sentences; screenshot after the step it illustrates (inside the step for long procedures). Numbering only for real sequences. |
| **Screenshot** | 1-px `docs-screenshot-frame`, radius md, no drop shadow; caption optional (`docs-text-small`); click to zoom (lightbox, Esc closes); light/dark image pair switches with theme; phone screenshots max 360 px wide, centred; annotation markers = brass circles with numbers that match step numbers, max 4 per image. |
| **Callout** | Left 4-px rule + icon in the type colour on its soft background; title optional; max 2 per page; never at the very top of a page (the Applies-to box handles prerequisites). |
| **MenuPath** | Bold segments joined by a chevron icon (not a typed "→" glyph); wraps on phones. |
| **UiLabel** | Bold text, no box/border (labels should look like the words on the button, not like keyboard keys). |
| **PlatformTabs** | Tabs "Web" / "Mobile"; remembers the reader's choice across pages (localStorage, try/catch); default = device type (phone → Mobile once mobile docs exist). |
| **RoleTabs** | Tabs per role ("Members", "Treasurers & admins"); only when content truly differs. |
| **CardGrid** | 2 columns desktop, 1 on phones; card = icon (20 px, primary) + title (600) + one-line description; hover: border → primary, no lift/shadow. |
| **Faq** | Accordion; question in 600 weight; one open at a time not enforced; each item has an anchor link. |
| **StatusChip** | Same status → colour mapping as mobile (`ui-tokens.md §1.4`), with text. |
| **Diagram** | SVG using docs tokens via `currentColor`/CSS variables (works in both themes); caption + text alternative below (collapsed "Describe this diagram"). |
| **Tables** | Header row on `docs-code-bg`, hairline rows, left-aligned text, right-aligned amounts with tabular figures; horizontal scroll container only for reference tables. |
| **Feedback** | "Was this page helpful?" + two text buttons (Yes / No); after a choice: "Thanks — this helps us improve the manual." No emoji. |
| **Search dialog** | Results grouped by section, show page title + matched heading + snippet; empty state suggests "Try a different word, e.g. dues, levy, receipt" and links to Troubleshooting & FAQ. |

### 11.6 Links & navigation behaviour
- Internal links: same tab, primary colour, underline on hover/focus; external links (app, stores): external-link icon, new tab.
- Heading anchors: link icon appears on hover/focus of H2/H3; copying gives the full URL.
- Keyboard: ⌘K / Ctrl K opens search; Tab order header → sidebar → content → TOC; visible focus ring (`--color-fd-ring`, 2 px).
- Sidebar: current page highlighted with `fd-accent` background + primary text; current section expanded; scroll position preserved.

### 11.7 Docs motion
Only: search dialog fade/scale (150 ms), drawer slide, lightbox fade, accordion height. No entrance animations, no parallax. Respect `prefers-reduced-motion`.

### 11.8 Docs accessibility
WCAG 2.1 AA: contrast per token checks; alt text on every screenshot describing its content; diagrams with text alternatives; skip-to-content link; logical heading order; tabs/accordions follow WAI-ARIA patterns (Fumadocs defaults); zoomable to 200 % without loss.

### 11.9 Docs do / don't
| Do | Don't |
|---|---|
| One goal per task page | "Everything about Finance" mega-pages |
| Bold UI labels exactly as in the app | Paraphrased button names |
| Screenshots from the demo association | Real member names or amounts |
| Section FAQ linked from the overview | Questions buried in long pages |
| Plain-language permission notes | Raw permission keys like `payments.nigerian.verify` (except in the Permissions reference) |
| Prices on the main site pricing page | Prices in the docs |

---

## 12. Docs links inside the web and mobile apps
- **Mobile:** "User manual" row (P12) uses `ListItem` with `BookOpen` icon and an external-link trailing icon; the header `?` is an `IconButton` with `CircleHelp` icon, label "Help for this screen"; both open the in-app browser via `openDocs()`; the browser toolbar uses `--color-surface` / `--color-primary`. Never shown offline (the row shows "Available when you're online").
- **Web:** `HelpLink` is a Mantine `ActionIcon` (subtle variant, `IconHelpCircle`, tooltip "Help for this page") placed at the right end of the page title row; sidebar "User manual" item at the bottom of the nav, separated by a divider, with an external-link icon; header/footer "Docs" links open the docs site in a new tab.
- Links go to the **most specific** page in the link map; if none, the section overview; never the bare docs home from a module screen.

---

## 13. Admin console UI rules (`apps/admin`)

### 13.1 Principles
1. **Unmistakably the platform console.** Fixed dark-green chrome, an always-visible environment badge (Production / Staging) and the words "SocietyLedger Admin" in the top bar. Nobody should confuse it with a tenant dashboard.
2. **Data first, dense but calm.** Tables and filters are the main interface; compact rows, tabular numbers, no decorative cards or illustrations.
3. **Make dangerous things slow.** Read actions are one click; destructive actions need confirmation, a reason and sometimes typing the subdomain.
4. **Always show who and why.** Every change shows up in the Action log with actor and reason; detail pages show recent activity for that association.
5. **Parity before polish.** Migrated pages keep their behaviour; layout is unified through the shared shell and components.

### 13.2 Layout
```
┌──────────────┬──────────────────────────────────────────────────────────────────────┐
│ SocietyLedger│  [Production]   Search associations…            ⧗ 1 impersonation  AO ▾│  ← top bar 56 px
│ Admin        ├──────────────────────────────────────────────────────────────────────┤
│              │ Associations                                         [ Export CSV ]   │  ← PageHeader
│ Overview     │ 214 associations · 9 suspended                                        │
│  Dashboard   │ [Status ▾] [Tier ▾] [Created ▾] [Search……………]          Reset filters  │  ← FilterBar
│  Analytics   │ ┌──────────────────────────────────────────────────────────────────┐ │
│ Tenants      │ │ Name              Subdomain     Tier   Status    Members  Created │ │
│ ▌Associations│ │ Opuogun State U.  opuogunstate  Pro    Active      412   12 Jan 26│ │  ← DataTable
│  Operations  │ │ …                                                                 │ │
│  Approvals   │ └──────────────────────────────────────────────────────────────────┘ │
│ Money        │  ‹ 1 2 3 … 11 ›                              25 per page ▾            │
│  Settlements │                                                                       │
│ Platform     │                                                                       │
│  Modules     │                                                                       │
│  Settings    │                                                                       │
│  Webhooks    │                                                                       │
│  Jobs        │                                                                       │
│ Content      │                                                                       │
│  Blog        │                                                                       │
│  Help content│                                                                       │
│  Support     │                                                                       │
│ Logs         │                                                                       │
│  Actions     │                                                                       │
│  Audit       │                                                                       │
└──────────────┴──────────────────────────────────────────────────────────────────────┘
```
- Navigation groups (in this order): Overview (Dashboard, Analytics) · Tenants (Associations, Operations, Approvals, Impersonation) · Money (Settlements) · Platform (Modules, Settings, Webhooks, Jobs) · Content (Blog, Help content, Support) · Logs (Actions, Audit). Items hidden when the platform role lacks access.
- Active item: `--admin-chrome-active-bg` with the brass marker; group labels in sentence case, `xs`, muted — not all caps.
- Content max width: none for tables (fluid), 960 px for forms and settings.

### 13.3 Components
| Component | Rules |
|---|---|
| **PageHeader** | Title (`h1`), one-line summary with live counts, primary action on the right (max one primary + one secondary). Breadcrumb only on detail pages. |
| **FilterBar** | Filters as compact selects/date ranges in one row, search last; "Reset filters" text button appears only when filters are active; all filters mirrored in the URL. |
| **DataTable** | Sticky header, sortable columns marked with an icon, row hover, row click opens detail (with a visible "Open" affordance for keyboard users), right-aligned numbers, status as `StatusBadge`, empty state inside the table frame, skeleton rows while loading, pagination + page size at the bottom. No zebra stripes. |
| **StatCard** | Label (`sm`, secondary) · value (`stat`) · change vs previous period with ▲/▼ and colour + text. Cards in a 4-column grid (2 on tablets). Clicking a card opens the filtered list it summarises. |
| **StatusBadge** | Light variant, `sm` radius, text always present; colour from the shared status mapping (`ui-tokens.md §1.4`). |
| **Tabs (detail pages)** | Association detail uses tabs: Overview · Subscription & billing · Modules & features · Security · Activity. Tab state in the URL (`?tab=billing`). |
| **Danger zone** | Last card on association detail, bordered with `--admin-danger-zone-border`, listing Suspend/Reactivate, Soft delete/Restore, Permanent delete, Force sign-out — each with a one-line consequence. |
| **ConfirmDestructive** | Modal: title = action as a question ("Suspend Opuogun State Union?"), consequence sentence, `ReasonField` (required, min 10 chars, saved to the Action log), typed-subdomain input for permanent delete, buttons "Cancel" + red action button repeating the verb ("Suspend association"). |
| **Impersonation dialog** | Explains what happens ("A new tab opens on opuogunstate.societyledger.com.ng signed in as platform staff. Members can't see that you're there; every action is logged."), reason (required), duration select (30 min / 1 h / 4 h), button "Open as this association". |
| **Impersonation pill** (top bar) | Orange pill "⧗ 1 impersonation" when the current admin has active sessions; click → Impersonation sessions page with "End session". |
| **EnvBadge** | "Production" (danger tones) or "Staging" (info tones), always visible, never dismissible. |
| **Forms** | Single column, labels above, helper text below, Save button bottom-right of the card; unsaved-changes guard on navigation. |
| **Notifications** | Past-tense success ("Association suspended"), errors with the API message and what to do. |
| **Charts** | recharts wrappers with token colours; titles + one-line takeaways; tooltips with full ₦ values. |

### 13.4 Login screens
Centered 400-px card on `--admin-chrome-bg`, logo + "SocietyLedger Admin", EnvBadge, email/password, "Sign in". 2FA: six input boxes, "Use a recovery code" link; setup: QR + manual key + confirm field, then recovery codes with "Download" and "I've saved these codes" checkbox before continuing. No sign-up link, no marketing copy.

### 13.5 Copy
- Plain, specific, staff-facing: "Suspend association", "Extend trial by 14 days", "Apply ₦5,000 credit".
- Consequences stated before the action: "Members of Opuogun State Union won't be able to sign in until you reactivate it."
- Errors say what failed and what to try: "Couldn't extend the trial: the association has an active paid subscription."

### 13.6 Accessibility & behaviour
- Keyboard: `/` focuses the global association search; `g` then `a` → Associations, `g` then `d` → Dashboard (shown in a "Keyboard shortcuts" menu); all actions reachable by keyboard; focus ring visible.
- Contrast per tokens (AA); status never by colour alone.
- Motion: Mantine defaults only (modals, notifications); respect reduced motion.
- Session expiry: a non-blocking banner 5 minutes before the 8-hour limit ("Your session ends at 18:32. Save your work.").

### 13.7 Do / don't
| Do | Don't |
|---|---|
| One shared `DataTable` for every list | Hand-built tables per page (as in the old web pages) |
| Reason required for every destructive action | Silent destructive buttons |
| URL-synced filters and tabs | Filters that reset on refresh |
| Environment badge on every screen | Identical-looking staging and production |
| Theme colours (`ledger.7`, CSS variables) | `text-teal-600`, `bg-gray-800`, inline hex |
| Open tenants only via the impersonation dialog | Links that browse tenant data inside the admin app |
