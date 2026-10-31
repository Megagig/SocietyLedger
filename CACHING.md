# Caching: how to add a screen without breaking it

One package decides how web, mobile and admin cache: `packages/query` (`@societyledger/query`). It holds logic only, no React, because web and admin run React 18 and mobile runs React 19. Each app has a few-line hook over it.

## The rules that never change

1. **Every key starts with the association** and, for one person's own data, carries their id. Build keys with `key()` / `userKey()` (or the hooks below); they refuse to be built without a tenant. Never hand-write `['members', ...]`.
2. **Money is never confirmed optimistically.** A payment, contribution or payout is shown as done only after the server says so.
3. **After a change, refresh by named event**, not by guessing keys, and not the whole cache.
4. **Payments, payouts and anything secret are never saved on a device.** Saving is opt-in per domain.
5. **Writes never retry by themselves.** A person (or an idempotency key) decides.

## 1. Choose a domain and its freshness (`packages/query/src/policy.ts`)

| Class | Trusted for | Use for | Saved on the device |
|---|---|---|---|
| `static` | 30 min | settings, roles, categories, plans | yes |
| `directory` | 5 min | members, meetings, polls, profile | yes (first page only) |
| `aggregate` | 90 s | dashboard, reports, the circle board | dashboard only |
| `money` | 30 s, and always rechecked when a screen opens | balances, payments, dues, contributions, payouts, Ajo | no (a few balances as "last known") |
| `live` | 0 | a code, a one-time link, a progress bar | no |

A domain with no entry gets `directory` and is **not** saved. Add an entry in `DOMAINS` to give it a class. Pick `money` whenever the screen shows what someone owes or has paid.

## 2. Ask for the data

```ts
// web
const { data } = useScopedQuery({ domain: 'settings', parts: ['association'], queryFn: () => api.get(...) });
// personal data (the key carries the person)
useScopedQuery({ domain: 'ajoSavings', personal: true, parts: [membershipId], queryFn });
```

Mobile hooks build the same key with `key(tenant, domain, ...)`. Spread `queryDefaults(domain)` for the window. For a list the person filters or searches, pass `meta: { persist: false }` so it is not saved, and `placeholderData: keepPreviousData` so it does not flash empty.

## 3. After a mutation, invalidate by event

```ts
onSuccess: () => invalidateFor(queryClient, tenant, 'payment.changed')   // after the server has answered
```

| Event | Refreshes |
|---|---|
| `payment.changed` | payments, dues, balances, ledgers, Ajo, the board, dashboard, reports |
| `payout.changed` | payouts, Ajo, the board, dashboard, reports, balances |
| `dues.changed` | dues, balances, ledgers, payments, dashboard, reports |
| `ledger.changed` | expenses, cash, balances, dashboard, reports |
| `circle.changed` | Ajo, the board, status, savings, dashboard |
| `member.changed` | members, profile, dashboard, Ajo, reports |
| `profile.changed`, `settings.changed`, `meeting.changed`, `vote.changed`, `notification.changed` | their own screens |

A new mutation: find its event (or add one in `invalidate.ts` with a test), call `invalidateFor` in `onSuccess`. If it changes money, name every domain that shows that money, including what adds it up.

## 4. Sign-out, switching, and the saved copy

- **Web:** one query client per signed-in identity (`lib/query/QueryBoundary.tsx`). A different person or association gets a new empty client; the saved copy of the one who left is deleted.
- **Mobile:** any move into `unauthenticated` (logout, failed token refresh, cold start with an expired session) wipes memory and the saved copy (`lib/queryClient.ts`).
- The saved copy is reused only by the same build, association and person (the buster), and only if `shouldPersistQuery` allows it.

## 5. On the server

- Responses are compressed. Reads are `Cache-Control: private, no-cache` (the app asks if it changed; a 304 saves the download; no shared cache keeps it), writes are `no-store`. Do not add `max-age` to a read: a saved change must show on the next read. A route may set its own header.
- The circle board is cached for 30 s per association and per viewer (`modules/ajo/ajo-cache.ts`). Every Ajo write bumps the association's version before the writer gets its answer; scheduled jobs bump everything. **Do not cache anything about one person's own money here.**
- Dashboard and reports use `cacheService` with tags. Anything that records a payment must end in `syncPaymentEffects`, which clears them.
- A new hot filter that has no index starts a table scan as history grows; check the query plan before shipping.

## Tests to copy

`packages/query/__tests__/query.test.ts` (keys, policy, persistence, invalidation, reset), `apps/web/__tests__/query/*` (identity change, saved data, scoped hook, Ajo invalidation), `apps/mobile/src/lib/queryClient.test.ts` (session end), `apps/api/__tests__/ajo/ajo-cache.test.ts` (server cache), `apps/api/__tests__/http-cache.test.ts`, `apps/api/__tests__/payment-sync-cache.test.ts`.
