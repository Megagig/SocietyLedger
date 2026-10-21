# Memory — Mobile Phase 2: F2.7 Dues, levies, penalties, donations (complete)

Last updated: 2026-10-21

## What was built

**F2.7 — Dues, levies, penalties, donations (complete)**

Types extended (`apps/mobile/src/types/api/memberFinance.ts`):
- Added: `DueDTO`, `DuesResponseDTO`, `LevyCampaignDTO`, `LevyAssignmentDTO`, `LeviesResponseDTO`, `PenaltyDTO`, `PenaltiesResponseDTO`, `DonationCategoryDTO`, `DonationDTO`, `DonationsResponseDTO`

API layer (`apps/mobile/src/api/endpoints/memberFinance.ts`):
- Added: `getDues()`, `getLevies()`, `getPenalties()`, `getDonations()`, `makeDonation(body)`
- All amount fields converted to Decimal via `toDecimal()` at this boundary layer

Queries (`apps/mobile/src/features/memberFinance/queries.ts`):
- Added keys: `dues`, `levies`, `penalties`, `donations`
- Added hooks: `useMemberDues()`, `useMemberLevies()`, `useMemberPenalties()`, `useMemberDonations()`

Mutations — NEW file `apps/mobile/src/features/memberFinance/mutations.ts`:
- `useMakeDonation()` — invalidates `donations` + `summary` on success

Screens:
- `apps/mobile/app/(app)/(tabs)/money/dues.tsx` — M8 My Dues. Status filter (SegmentedControl), outstanding banner (danger/success), Pay now per row → `/money/pay?transactionId=<id>` (F2.8 stub). Custom `DueRow` View inside `ListGroup`.
- `apps/mobile/app/(app)/(tabs)/money/levies.tsx` — M9 My Levies. Progress bar (custom View, no library), deadline, Contribute now → `/money/pay?levyId=<id>`.
- `apps/mobile/app/(app)/(tabs)/money/penalties.tsx` — M10 My Penalties. Dynamic danger/success banner, Pay penalty.
- `apps/mobile/app/(app)/(tabs)/money/donations/index.tsx` — M11 (list) + M12 (BottomSheet donate form). SelectSheet cause picker from `donationCategories[]`, AmountField presets, isAnonymous Switch, paymentMethod hardcoded to `bank_transfer`.
- `apps/mobile/app/(app)/(tabs)/money/index.tsx` — M1 updated: new "Breakdown" Section with 4 ListGroup rows (Dues/Levies/Penalties/Donations) showing live outstanding from finance summary.

Backend (not modified — all needed endpoints pre-existed):
- `GET /members/me/dues`, `/levies`, `/penalties`, `/donations`, `POST /members/me/donate` all pre-built

Docs:
- `context/progress-tracker.md` — F2.7 marked complete; Current status + Next feature updated (F2.8).
- `context/ui-registry.md` — "Mobile Phase 2 — Dues, levies, penalties, donations (F2.7)" section added.

## Decisions made

- **`decimal.js-light`, NOT `decimal.js`** — The installed library is `decimal.js-light`. Importing from `decimal.js` causes TS2307 "cannot find module". Always import `type { Decimal } from 'decimal.js-light'`.
- **Custom row Views inside `ListGroup`** — `ListItem` has no `accessoryRight` prop. For rows needing a button stacked below the amount (dues, penalties), use a custom `View` child inside `ListGroup`. `ListGroup` wraps any children with dividers+border, not just `ListItem`s.
- **`onSubmit` must be sync for `Button.onPress`** — `Button.onPress` expects `(event) => void`. An `async onSubmit` causes a TypeScript mismatch via `handleSubmit`. Pattern: make `onSubmit` sync and call `mutation.mutate()` with `onSuccess` callback inside.
- **Pay button routes use `as never` cast** — `/money/pay` doesn't exist yet (F2.8). Until Expo Router regenerates `router.d.ts` on next `expo start`, use `router.push('/money/pay' as never)`.
- **Donation cause picker = `donationCategories[]` from GET /members/me/donations** — member-safe source. NOT `GET /finance/advanced/donations/allocations` (officer-scoped).
- **BottomSheet for M12** — web uses Modal; mobile uses `@gorhom/bottom-sheet`'s `BottomSheet` component. `BottomSheetModalProvider` already in `app/_layout.tsx`.
- **Progress bar = custom View** — no separate progress bar library. Two Views (bg-border outer + bg-primary inner with `width: pct%`).

## Problems solved

- **`decimal.js` TS2307** — not installed; use `decimal.js-light`.
- **`TextVariant "title"` invalid** — `Money.size` is a `TextVariant`; `"title"` doesn't exist. Use `"h2"` for headline amounts.
- **`handleSubmit(onSubmit)` type mismatch on Button.onPress** — make `onSubmit` sync; use `mutation.mutate()` pattern.
- **QueryProvider hydration errors** — fixed in previous session: `shouldDehydrateQuery` + `buster: 'v2'` to clear stale MMKV cache.

## Current state

- **F2.1–F2.7: complete.** All auth flows, session lifecycle, home screen, 5 money screens (F2.6), and 5 finance detail screens (F2.7) working.
- `type-check` clean for `apps/mobile`.
- New routes not yet in `.expo/types/router.d.ts`: `/money/dues`, `/money/levies`, `/money/penalties`, `/money/donations`. Will auto-regenerate on next `expo start` with the dev server.

## Next session starts with

**F2.8 — Pay online with Paystack**
Run `/architect F2.8` first before implementing.

## Open questions

- Pay buttons (dues/levies/penalties) route to `/money/pay` which doesn't exist yet. Will resolve when F2.8 ships.
- Real member profile photo: needs `Member.photoUrl` DB field + migration + upload endpoint. Deferred.
- Pre-existing test suite failure (`Cannot find module 'babel-preset-expo'`): 36 suites affected, unrelated to F2.x — investigate before Milestone M1.
