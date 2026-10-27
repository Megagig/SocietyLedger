# Donations, member ledgers and books: the fix and the repair that runs on deploy

## What was wrong

A donation was recorded on the member ledger as a **credit with no matching debit**, so every donor looked as if the association owed them
money (a negative balance). In the books it was posted two or three times: once as bank income, then again as a payment against **Dues**
Receivable, and a third time by the cash-collection route. The result was cash and bank overstated, Dues Receivable negative, and income
doubled on cash donations. Separately:

- online payments (Paystack, Nomba) never reached the member ledger, and Nomba never reached the books;
- deleting a charge or voiding a cash donation left its ledger and book entries behind;
- a member's own "make a donation" action wrote to neither the ledger nor the books;
- donation receipt numbers were numbered per association but unique across the system, so the first donation of a second association could fail;
- two payments for the same member arriving together could write a wrong running balance.

## How it works now

A donation is a **charge plus a payment**, exactly like dues:

| Step | Member ledger | Books |
|---|---|---|
| Donation recorded or pledged | Debit (what was given or promised) | Dr Donation Pledges Receivable (1123) / Cr Donation Income (4300) |
| Money received | Credit | Dr Bank (1112) or Cash in Hand (1114) / Cr Donation Pledges Receivable (1123) |

So an instant donation leaves the member's balance at ₦0, an unpaid pledge shows as owed, and a part-paid pledge shows what is left. The
donation total on the member ledgers always equals the 1123 account, which is what the repair checks.

Every payment route (card, Nomba, bank transfer proof, cash, restore after delete) now finishes through one function,
`services/payment-sync.service.ts`. Deleting or voiding takes the ledger and books entries back out (`modules/finance/charge-unwind.ts`).

## What the pages show now

- An entry's sign follows the **balance column**: a charge or pledge shows `+` (it adds to what the member owes), a payment shows `-` (it takes it away). It used to be the other way round, which made a growing balance look like money owed *to* the member.
- Positive balance = **the member owes the association** ("Owed by the member"). Negative = **the member is in credit**.
- A pledge reads **"Donation pledge: <cause>"** and payments against it **"Pledge payment: <cause>"**. An unpaid pledge is owed until it is paid or removed; a donation given on the spot is a debit and a credit that cancel out.
- Existing donation lines are re-worded by the repair (or by pressing **Sync Ledger** on a member's ledger page).

## What runs when you deploy

`docker-entrypoint.sh` runs, in order: migrations, the seeds, then **`scripts/repair-ledgers-and-books.ts`**, then the API.
The repair goes through every association:

1. **Member ledgers:** adds the missing debit for each donation or pledge and the missing credit for each online payment, removes entries
   whose charge or payment no longer exists, and renumbers the running balance. Waivers, savings, loans and manual adjustments are never touched.
2. **Books** (associations with accounting set up): works out, for each donation, what the books should hold and posts **one correcting journal
   entry** for the difference. Entries for charges that were deleted are reversed. It also posts anything that never reached the books at all
   (for example Nomba payments), but only for charges made after the association's books were set up.
3. **Checks:** every member ledger agrees with their charges and payments, and the donation total on the ledgers equals account 1123.

Rules it keeps:
- It **never edits or deletes a posted entry**. Every fix is a new, balanced entry **dated today**, so a closed accounting period is never rewritten.
- It is **safe to run again**: a second run finds nothing to do (tested).
- It **never stops the API from starting.** A failure is printed and the API starts anyway.

Each association it changed gets one line in the container log, for example:
`[repair] oko-youth-forum (#12): ledger +6 -1 ~0 across 7 member(s); books: 5 correction(s), 2 reversal(s)`
and a final `[repair] N association(s) checked ...; X changed, Y need attention.`

### An association that "needs attention"
The only case the repair declines is an association whose **current accounting period is closed**: it will not post into a closed period.
The log says so. Its member ledgers are still fixed; its books are corrected on the first start after an admin reopens the period.

## Before you deploy
1. **Back up the production database** (the repair writes to it). It is a few new rows, not a rewrite, but a backup is cheap.
2. Optional rehearsal: `pnpm --filter api repair:books -- --dry-run` against a copy prints what would change without changing anything.

## Switches
| Variable | Default | Effect |
|---|---|---|
| `REPAIR_BOOKS_ON_START` | `true` | `false` skips the repair at start. |
| `pnpm --filter api repair:books` | | Runs it by hand. Add `--dry-run` to only report, `--association=<id>` for one association. |

## What was verified
- A "before" database was built with the **old** code covering every path (instant donation, unpaid pledge, a pledge paid in full, a part-paid
  pledge, the cash route, an online-paid due, a deleted donation, an association with no books, an association with a closed period). The repair brought the main association from
  cash and bank ₦195,000 (real: ₦89,000), Dues Receivable −₦62,000 and Donation Income ₦98,000 (real: ₦70,000) to exactly ₦89,000, ₦0 and ₦70,000, with the waiver and savings entries kept.
- A second run changed nothing (journal entries and ledger rows unchanged).
- The **new** code, run from scratch on every path above, ended fully balanced with nothing left for the repair to do, including two donations recorded at the same moment, twelve ledger writes at once, and a second association's first donation.
