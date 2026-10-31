# Caching audit (branch Performance-Caching, 2026-10-31)

Read from the code. **No baseline timings or per-screen request counts have been measured yet** (see "Baseline"). Counts below are from searching the source and are approximate.

## 1. What exists today

| App | Fetch layer | Version | Persistence | Tenant in keys |
|---|---|---|---|---|
| Web (`apps/web`) | TanStack Query + axios (`lib/axios.ts`, 30 s timeout) | **v4** | none | **No.** 0 of 232 keys include the association |
| Mobile (`apps/mobile`) | TanStack Query + axios (`api/client.ts`, 15 s timeout) | v5 | MMKV, allow-list of 7 domains | Yes (tenant subdomain first) |
| Admin (`apps/admin`) | TanStack Query via its own proxy | v5 | none | n/a (staff) |
| API (`apps/api`) | Express + Prisma, Redis with in-memory fallback, tag-based `cacheService` | n/a | n/a | Keys are tenant-scoped (`generateKey`) |

Web: 91 files use queries, 38 use mutations, about 50 files fetch inside `useEffect` with axios directly (outside the query cache), 19 `staleTime` overrides, 93 `invalidateQueries` calls, 7 `keepPreviousData`, 6 `refetchInterval`, default `staleTime` 60 s, `refetchOnWindowFocus` off.
Mobile: 74 files use queries, 46 `staleTime` overrides, 70 `invalidateQueries` calls, default `staleTime` 60 s, `gcTime` 24 h, NetInfo and AppState wired.

## 2. Problems found

### Client
1. **Web keys carry no association, and nothing clears the cache on logout or association switch** (mobile clears with `queryClient.clear()`; web does not). Cross-association or cross-user display is possible in one browser session. Highest priority because it is a correctness and privacy risk, not only speed.
2. **Mobile persists almost nothing.** The allow-list names `session, memberFinance, memberLedger, meetings, voting, notifications, profile`; most screens (dashboard, members, cash, payments, Ajo) are not persisted, so a cold start shows spinners everywhere.
3. **Polling.** Mobile refetches every 60 s on the dashboard, members, cash overview, payments (twice) and support, and every 30 s on notifications, while the screen is open. Web polls on the needs-attention card, Ajo staff hooks (waiting count), and the election progress.
4. **Fetches outside the query cache.** About 50 web files fetch in `useEffect`, so they never dedupe, never cache, and refetch on every mount.
5. **Blunt invalidation on web Ajo:** any write refreshes every `['ajo', …]` query. Safe, but each payment re-downloads far more than it changed.
6. **Duplicate endpoints.** `/ajo/groups/:id` is fetched from 21 files and `/ajo/memberships/:id` from 8 under differing keys, so the same data can be requested more than once.
7. **v4 to v5 migration surface (web):** 394 `isLoading` uses, 9 `onSuccess/onError/onSettled` callbacks on queries (removed in v5), 7 `keepPreviousData` (becomes `placeholderData`).
8. **Staleness is set ad hoc** (19 web, 46 mobile overrides, plus defaults) with no shared table.

### Server
1. **The Ajo module has no server caching.** Board, circle summaries, payments, payouts and reports recompute on every request. Only dashboard, association reports, blog and docs use `cacheService`.
2. **No response compression** (no `compression` middleware; `helmet` only). **No `Cache-Control`** headers on API responses found.
3. **Unbounded lists.** About 160 `findMany` calls without `take`; the largest clusters are `ajo-board.service.ts` (21), `cooperatives.service.ts` (19), `accounting.service.ts` (16), `member-finance.controller.ts` (14), `ajo-order.service.ts` (13), `finance.controller.ts` (12). Not all are large in practice; each needs checking against realistic data.
4. **Queries in loops** exist but are few and mostly in jobs and bulk writes: `sms.service.ts:267`, `onboarding.controller.ts:199`, `report-member-ledger.ts:41`, `late-fees.cron.ts:57`. None of these is on a hot read path.
5. **Indexes:** 298 `@@index` across 158 models, so the common tenant filters are likely covered. Needs `EXPLAIN` on the hot Ajo and member queries to find gaps; not yet done.
6. **Connection pool:** no pool settings found in `lib/prisma.ts` or the example env files. They may be in the deployed `DATABASE_URL` (Dokploy). Needs confirming.
7. `lib/prisma.ts` retries connection errors up to 3 times with 2 to 6 s waits (written for a cold-starting host); on a slow database this can add up to 12 s to a failing request.

## 3. Proposed plan, by impact

1. Web: v4 to v5 (alone, no behaviour change).
2. Web: association- and user-scoped keys via the shared factory; clear cache on logout and association switch (closes the leak risk).
3. Server (no behaviour change): compression, `Cache-Control` and ETag, pool check, pagination of the biggest unbounded lists.
4. Server: Redis aggregates for Ajo (board, circle summary, report lists) and association figures, tagged by association and invalidated by writes and by the payment webhook.
5. Shared package: key factory, staleTime/gcTime table, API client, hooks. Then move read-only domains over (settings, members, meetings, dashboard), widen mobile persistence, add prefetching and the offline or updating indicator, and remove the extra polling in favour of focus and invalidation.
6. Money domains last (balances, payments, dues, thrift contributions and payouts), behind tests and your live check.
7. Index fixes from `EXPLAIN` on the hot queries, then re-measure.

## 4. Persistence proposal (for your approval)

Persist (per user, cleared on logout and association switch): session and profile, association settings, roles, categories, plans, members list (first page), meetings, notifications list, polls and elections (read-only parts).
Do **not** persist: payment status, contributions in flight, payout and approval state, the group bank account number, payout account details, proof links, anything returned by a reveal endpoint.
Balances and dues: persisted only as "last known, updated at" and always refetched on open.

## 5. Baseline (not measured yet)

Needs a running stack. Today only the API (port 4001) is running; web and Metro are not. What can be measured:
- **Database queries per endpoint:** in-process with Prisma query events against the scratch database, on the demo Ajo seed. Can be done without you.
- **Requests per screen and time to first content on Slow 3G:** needs web running in a throttled browser and the app on a throttled emulator or device.

## 6. What was done, and what was measured (2026-10-31)

Corrections to the audit above: "`/ajo/groups/` is fetched from 21 files" counted a URL prefix, not duplicate requests (they are different sub-resources); the real duplicate was the dashboard overview, fetched under one key by two pages (now one scoped entry).

| Measure | Before | After |
|---|---|---|
| Database queries to open the circle board (8 reads, 3-person circle) | 121 | 121 first open; **0** on a repeat open within 30 s; 121 again, with the new payment, on the first open after a confirmed payment |
| Members page requests per visit | 3 (members, stats, waiting) on every mount, loader on every filter change | same 3, but the saved list shows at once, they run together and revalidate on open, old rows stay while a filter loads; first page prefetched from the dashboard |
| Response size | uncompressed JSON | gzip; unchanged answers are a 304 |
| Officers' waiting-payments badge/queue (asked every minute) | scans every payment the association ever had | index on (association, status, received at) |
| Cash overview and support list polling (mobile) | every 60 s | every 120 s |

Not measured, and needing a person at a browser or device: requests per screen and time to first useful content on Slow 3G, airplane mode and reconnect, association switch, signing in as a different user, and a payment completing with the balance updating at once.
