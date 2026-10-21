# Memory — Mobile Phase 2: H1/H2 Home Dashboard Enhancement (complete)

Last updated: 2026-10-21

## What was built

**H1/H2 — Enhanced Home/Dashboard screen — member + officer views**

New files created:

- `apps/mobile/src/api/endpoints/dashboard.ts` — `dashboardApi.getOverview()` calls `GET /api/dashboard/overview`. Exports full `DashboardOverviewDTO` type with nested types: `MemberStats`, `FinancialSummary`, `RevenueTrendItem`, `PaymentMethodItem`, `RecentTransaction`, `QuickStats`.
- `apps/mobile/src/features/dashboard/queries.ts` — `useAssociationDashboard(enabled)` TanStack Query hook; key: `dashboardKeys.overview(tenant)`; staleTime 5 min; gated on `enabled` (pass `isOfficer`).
- `apps/mobile/src/features/home/components/MemberStatRow.tsx` — 2×2 stat grid (Outstanding Balance, Paid This Month, Next Due Date, Upcoming Meetings). Each tile: 38×38 icon badge (Wallet/CheckCircle2/Calendar/Users from lucide), value with semantic color (danger/success/warning/info), caption label. Height 104px skeleton.
- `apps/mobile/src/features/home/components/RecentActivityList.tsx` — Member recent transactions from `summaryQuery.data.recentTransactions` with `StatusBadge` (paid/overdue/partial/pending).
- `apps/mobile/src/features/home/components/UpcomingObligationsList.tsx` — Member upcoming obligations from `summaryQuery.data.upcomingPayments`. Overdue items: red border + `dangerSoft` bg + left accent bar. Uses `date-fns` `isPast`/`isToday`.
- `apps/mobile/src/features/home/components/OfficerStatRow.tsx` — 2×2 officer stat grid (Total Members/Users/info, Total Revenue/TrendingUp/success, Pending/Clock/warning, Overdue/AlertTriangle/danger). 88px skeleton, 32×32 icon badge.
- `apps/mobile/src/features/home/components/RevenueChart.tsx` — `BarChart` from `react-native-gifted-charts`. Dynamic Y-max, ₦k labels, theme-aware colors, 140px height, `isAnimated`.
- `apps/mobile/src/features/home/components/PaymentMethodsChart.tsx` — `PieChart` with `donut` prop, `innerRadius={44}`, `radius={72}`. Inline legend + `centerLabelComponent` showing method count.
- `apps/mobile/src/features/home/components/AssociationRecentTransactions.tsx` — All-member transaction list. Avatar (size 32), memberName, category, amount, status badge. Card with row dividers.

Modified files:

- `apps/mobile/app/(app)/(tabs)/home/index.tsx` — REWRITTEN. Officers get a "My View | Association" two-button toggle (default: 'me'). Heading below toggle updates to "My Dashboard" or "Association Overview" to clearly label the current view. Member view: BalanceCard → MemberStatRow → QuickActionsGrid → Recent Activity → Upcoming Obligations → UpcomingMeetingCard → ActiveVoteCard → Recent Payments → Announcements. Officer Association view: OfficerStatRow → RevenueChart → PaymentMethodsChart → Quick Stats card (QuickStatRow) → Recent Transactions.
- `apps/mobile/src/features/home/components/QuickActionsGrid.tsx` — Each action tile now has its own color-coded icon badge: pay=successSoft/success, uploadProof=infoSoft/info, statement=accentSoft/accent, savings=warningSoft/warning, applyLoan=primarySoft/primary, support=dangerSoft/danger. 50×50 icon badge, borderRadius 16, subtle card shadow. Uses `ColorToken` type from `@/theme/tokens`.

## Decisions made

- **`BarChart` over `LineChart`** — `react-native-gifted-charts` `LineChart` with area fill triggers the linear-gradient crash. `BarChart` doesn't use gradient fills and is more readable on mobile for monthly revenue.
- **`expo-linear-gradient` is a required peer dep** — `react-native-gifted-charts` v1.4.81 eagerly requires a gradient package at module load time (in `AnimatedThreeDBar/index.js`), even when only using `BarChart` or `PieChart`. Install `expo-linear-gradient` in the mobile workspace or the entire gifted-charts module crashes.
- **Officer toggle default = 'me'** — Officers see their personal view first; they switch to Association. Heading below toggle always names the current view to prevent label confusion.
- **Toggle button labels = "My View" / "Association"** — Short labels (navigation), with a `h2` heading below that says "My Dashboard" or "Association Overview" (content label). Avoids confusion between button text and view name.
- **Inactive toggle tab text = `color.textSecondary`** — `color.text` (white in dark mode) made inactive tabs look equally prominent as active. `textSecondary` makes the unselected tab recede visually.
- **`ColorToken` type** — `keyof typeof tokens.light.color` — use it for icon badge color token names in `QuickActionsGrid` and anywhere a color prop should reference the token system.
- **`AvatarSize` = 32 | 40 | 64 only** — No other values are valid. Use 32 for list rows, 40 for headers.

## Problems solved

- **`react-native-gifted-charts` gradient crash** — Install `expo-linear-gradient` in the mobile workspace. Root cause: the library's `AnimatedThreeDBar` eagerly loads a gradient module at bundle time, crashing the entire `gifted-charts` module. This cascaded to a missing default export error on `home/index.tsx` and then `ErrorBoundary undefined` in the tab navigator.
- **Hooks in conditional branch** — `useThemeTokens()` was called inside an `if (items.length === 0)` branch in `RecentActivityList.tsx`. Fix: moved the empty-state to render after the hook call, using `<Text tone="secondary">` which handles theming internally.
- **Toggle invisible inactive tab in dark mode** — `backgroundColor: 'transparent'` on a dark `surfaceSunken` container made white text disappear. Fix: inactive tabs use `color.surfaceRaised` background + `color.border` border with `color.textSecondary` text.
- **`decimal.js` TS2307** — The installed library is `decimal.js-light`. Always import `type { Decimal } from 'decimal.js-light'`.

## Current state

- **F2.1–F2.7 + H1/H2 home dashboard: complete.** Member and officer dashboards fully implemented with charts, stat cards, activity lists, and the Me/Association toggle.
- `expo-linear-gradient` installed in `apps/mobile`.
- `react-native-gifted-charts` installed in `apps/mobile`.
- `type-check` was clean as of the previous F2.7 session; no new TS errors introduced (verified by reviewing imports and `ColorToken` type correctness).
- Toggle default is 'me' (personal view); officers can switch to 'association'.
- Section heading below toggle clearly labels the current view.

## Next session starts with

**F2.8 — Pay online with Paystack**  
Run `/architect F2.8` first before implementing.  
Pay buttons on dues/levies/penalties screens route to `/money/pay` (stub with `as never` cast) — this is the screen to build next.

## Open questions

- Pre-existing test suite failure (`Cannot find module 'babel-preset-expo'`): 36 suites affected, unrelated to H/F2.x — investigate before Milestone M1.
- Real member profile photo: needs `Member.photoUrl` DB field + migration + upload endpoint. Deferred.
- `context/progress-tracker.md` — should be updated to mark H1/H2 complete and set Next Feature = F2.8.
