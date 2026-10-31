# Thrift (Ajo) — security review (T12.1)

Reviewed 2026-10-30 by reading the code against the checklist below. It is not a penetration test and no outside firm was involved. Nothing here was exercised in a browser or on a phone. A finding marked **fixed** has a test; a finding marked **open** is waiting on an owner action.

## Scope and method

Files read: `ajo.routes.ts` (every route and the permission it needs), `ajo-access.ts` (add-on gate), `ajo-contribution.service.ts`, `ajo-allocation.service.ts`, `ajo-payout.service.ts` (status guards and locks), `ajo-payout-account.service.ts`, `ajo-members.controller.ts`, and the controllers behind every `readers` route that takes a membership or group id (groups, cycle, savings, contributions, risk), plus `ajo-public.routes.ts`.

## Checklist and result

| Area | What was checked | Result |
|---|---|---|
| Add-on gate | Every `/api/ajo` route sits behind sign-in and `requireAjoAccess()`; an expired add-on allows only GET/HEAD/OPTIONS; a failed check refuses (503) rather than allows | Pass. See F-1 |
| Money recording | Amount greater than zero; payment cannot exceed what is owed; every record needs an idempotency key stored per association; a reused key with different details is refused (409) | Pass |
| Double confirm | Confirm takes a per-membership advisory lock and updates only where the status is still REPORTED/CASH_RECEIVED, so one of two simultaneous confirms wins and the other replays | Pass |
| Overpayment race | Two payments reported at once can each pass the owed check; the owed check is repeated at confirm under the lock and refuses with EXCEEDS_OWED | Pass |
| Self-confirmation | A person who recorded or made a payment cannot confirm it, except a sole reconciler with a note; an officer cannot confirm their own payment recorded as received | Pass |
| Payouts | Prepare, approve, pay, void, fail and reverse are each a status-guarded update; one bank reference cannot pay two payouts; changing a payout account voids approved payouts; self-approval needs a note | Pass |
| Payout accounts | Number encrypted at rest and shown masked; reveal is audited; another association's member is "not found"; a change starts a cool-off, resets verification, notifies the person and the officers | Pass. See F-3 |
| Cross-tenant access | Every lookup read carries `associationId`; another tenant's record is reported as missing, never as forbidden | Pass |
| Object-level access | Every `readers` route that takes a membership id checks the caller is that person or an officer (a collector only for people currently assigned, on the schedule) | Pass |
| Separation of duties | Disputes cannot be decided by the person who raised them; swaps need one of the slots to be the requester's own; plans need the member or an officer with a note; late-fee waivers | **F-2 fixed** |
| Public surface | `/api/public/ajo` is rate limited (30 a minute), tells a wrong guess nothing; statement code is 10 characters from a 32-letter alphabet (about 50 bits) | Pass |
| Phone codes | 5 wrong tries, 5 codes a day per person | Pass |

## Findings

| ID | Finding | Severity | Status |
|---|---|---|---|
| F-1 | When `FEATURE_FLAG_MODE=shadow`, an expired add-on lets writes through (it logs and sets a header only). Safe as an emergency switch, harmful if left on | Needs a check | **Open — owner/ops:** confirm the production value is not `shadow` before launch |
| F-2 | An officer could waive their own late fee. The waiver needed a reason and was audited, but there was no second person | Medium | **Fixed.** `waiveLateFee` refuses a waiver on your own fee while another officer holds `ajo.manage`; a sole officer may still do it. Test: `ajo-latefees.integration.test.ts` "does not let an officer waive their own late fee" |
| F-3 | An officer with `ajo.manage` can change or reveal another member's payout account without a password re-check (payout approval and case closing do ask for one). Mitigated by the cool-off, the voided approvals, the notices to the person and the officers, and the audit entry | Low | Open, logged. Decide whether to require the password on change/reveal |
| F-4 | Repeating a payment with a known idempotency key returns the stored payment without checking who is asking. Needs the key, which is a random value the app generates | Low | Open, logged |
| F-5 | Public statement-code lookup could be guessed | Info | Closed: about 50 bits and rate limited |
| F-6 | An admin who is also in the circle can set the payout order, including their own place. The reason is required and everyone in the circle sees who set it and why | Info | Accepted: transparency is the control (owner decision, Track T-C) |

## Not covered

- Penetration testing, dependency audit, infrastructure and backup review.
- The association side of SocietyLedger (only the Ajo module was reviewed).
- Behaviour in a browser or on a phone.
