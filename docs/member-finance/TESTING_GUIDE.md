# Member Finance Self-Service - Testing Guide

## Prerequisites

1. Running API server (`npm run dev` in `apps/api`)
2. Running Web server (`npm run dev` in `apps/web`)
3. At least one association with:
   - Active members with user accounts
   - Financial categories (dues, levies, penalties, donations)
   - Transactions assigned to members
   - Levy campaigns with member assignments

## Test Accounts Setup

### Create Test Member Account

1. Login as Admin
2. Go to Members → Add Member
3. Create a member with email
4. Enable login for the member (Member → Actions → Enable Login)
5. Member receives invitation email and sets password

### Assign Financial Data to Member

As Admin:
1. **Create Dues**: Finance → Transactions → Create → Select member, category (type: due), amount, due date
2. **Create Levy Assignment**: Finance → Levy Campaigns → Create campaign → Assign members
3. **Create Penalty**: Finance → Transactions → Create → Select member, category (type: penalty)
4. **Create Donation Category**: Finance → Categories → Create → Type: donation

---

## Test Scenarios

### 1. Overview Page Tests

**Location**: `/dashboard/my-finances`

#### TC-1.1: View Finance Summary
1. Login as member
2. Navigate to My Finances → Overview
3. **Expected**: 
   - Payment progress bar shows correct percentage
   - Summary cards display accurate totals
   - Quick action buttons are functional
   - Upcoming payments list shows items with due dates

#### TC-1.2: Overdue Alert Display
1. Ensure member has overdue transactions (past due date, unpaid)
2. Navigate to Overview
3. **Expected**: Red alert banner shows with overdue count and amount

#### TC-1.3: No Outstanding Items
1. Ensure member has no outstanding transactions
2. Navigate to Overview
3. **Expected**: 
   - Progress bar shows 100%
   - Outstanding card shows ₦0
   - "No upcoming payments" message

---

### 2. Dues Page Tests

**Location**: `/dashboard/my-finances/dues`

#### TC-2.1: View All Dues
1. Navigate to My Finances → My Dues
2. **Expected**: 
   - Summary card shows total outstanding
   - All dues assigned to member are listed
   - Each due shows category, amount, due date, status

#### TC-2.2: Status Badges
1. View dues with different statuses
2. **Expected**:
   - Paid: Green badge with checkmark
   - Pending: Blue badge with clock
   - Partial: Yellow badge
   - Overdue: Red badge with warning icon

#### TC-2.3: Pay Individual Due
1. Click "Pay Now" on an unpaid due
2. **Expected**: Redirects to payment page with due pre-selected

#### TC-2.4: Empty State
1. Member with no dues assigned
2. **Expected**: "All Caught Up!" message with checkmark icon

---

### 3. Levies Page Tests

**Location**: `/dashboard/my-finances/levies`

#### TC-3.1: View Levy Assignments
1. Navigate to My Finances → My Levies
2. **Expected**:
   - Summary card shows total outstanding
   - Each levy shows campaign name, description, deadline
   - Progress bar shows contribution percentage

#### TC-3.2: Progress Tracking
1. View levy with partial payment
2. **Expected**:
   - Progress bar reflects paid/total ratio
   - "Paid" and "Target" amounts displayed
   - Balance due shown

#### TC-3.3: Contribute to Levy
1. Click "Contribute Now" on active levy
2. **Expected**: Redirects to payment page

#### TC-3.4: Completed Levy
1. View fully paid levy
2. **Expected**:
   - Green status badge
   - 100% progress bar
   - No "Contribute Now" button

---

### 4. Penalties Page Tests

**Location**: `/dashboard/my-finances/penalties`

#### TC-4.1: View Penalties
1. Navigate to My Finances → Penalties
2. **Expected**:
   - Summary card shows outstanding penalties (red) or good standing (green)
   - Penalties listed with category, amount, reason, date

#### TC-4.2: No Penalties
1. Member with no penalties
2. **Expected**: 
   - Green "No Outstanding Penalties" banner
   - "No Penalties" empty state message

#### TC-4.3: Pay Penalty
1. Click "Pay Penalty" on unpaid penalty
2. **Expected**: Redirects to payment page with penalty pre-selected

---

### 5. Donations Page Tests

**Location**: `/dashboard/my-finances/donations`

#### TC-5.1: View Donation History
1. Navigate to My Finances → My Donations
2. **Expected**:
   - Summary card shows total donated
   - Donation list with category, amount, date, receipt number

#### TC-5.2: Make New Donation
1. Click "Make Donation" button
2. Fill form:
   - Amount: 10000
   - Category: Select from dropdown
3. Click "Donate"
4. **Expected**:
   - Success toast message
   - New donation appears in list
   - Receipt number generated

#### TC-5.3: Donation Validation
1. Try to donate without amount
2. **Expected**: Error message "Please enter an amount and select a category"

#### TC-5.4: No Donation Categories
1. Association with no donation categories
2. **Expected**: Empty category dropdown, cannot submit

---

### 6. Payment History Tests

**Location**: `/dashboard/my-finances/payments`

#### TC-6.1: View Payment History
1. Navigate to My Finances → Payment History
2. **Expected**:
   - Summary card shows total payments
   - Table with date, description, type, method, amount
   - Type badges colored by category

#### TC-6.2: Empty Payment History
1. Member with no payments
2. **Expected**: "No Payments Found" empty state

---

### 7. Make Payment Page Tests

**Location**: `/dashboard/my-finances/pay`

#### TC-7.1: View Outstanding Items
1. Navigate to My Finances → Make Payment
2. **Expected**:
   - All outstanding items listed
   - Each item shows type badge, category/campaign name, balance, due date

#### TC-7.2: Select Items
1. Click on items to select
2. **Expected**:
   - Selected items highlighted with teal border
   - Checkbox checked
   - Total updates in summary panel

#### TC-7.3: Select All
1. Click "Select All" button
2. **Expected**: All items selected, total shows sum of all balances

#### TC-7.4: Deselect All
1. With items selected, click "Deselect All"
2. **Expected**: All items deselected, total shows ₦0

#### TC-7.5: Process Payment
1. Select one or more items
2. Choose payment method
3. Optionally add reference and notes
4. Click "Pay" button
5. **Expected**:
   - Success toast message
   - Redirects to payment history
   - Items no longer appear in outstanding

#### TC-7.6: Payment Validation
1. Try to pay with no items selected
2. **Expected**: Error "Please select at least one item to pay"

#### TC-7.7: All Paid State
1. Member with no outstanding items
2. **Expected**: 
   - "All Paid Up!" message
   - "Back to My Finances" button

#### TC-7.8: Pre-selected Item
1. Navigate from dues page with `?transactionId=X`
2. **Expected**: Specified transaction pre-selected

---

### 8. API Tests

#### TC-8.1: Unauthorized Access
```bash
curl -X GET http://localhost:4000/api/members/me/finance-summary
```
**Expected**: 401 Unauthorized

#### TC-8.2: Finance Summary
```bash
curl -X GET http://localhost:4000/api/members/me/finance-summary \
  -H "Authorization: Bearer <member_token>" \
  -H "X-Tenant-Id: <association_id>"
```
**Expected**: 200 with summary data

#### TC-8.3: Process Payment
```bash
curl -X POST http://localhost:4000/api/members/me/pay \
  -H "Authorization: Bearer <member_token>" \
  -H "X-Tenant-Id: <association_id>" \
  -H "Content-Type: application/json" \
  -d '{"transactionIds": [1, 2], "paymentMethod": "BANK_TRANSFER"}'
```
**Expected**: 200 with payment confirmation

#### TC-8.4: Invalid Transaction IDs
```bash
curl -X POST http://localhost:4000/api/members/me/pay \
  -H "Authorization: Bearer <member_token>" \
  -H "X-Tenant-Id: <association_id>" \
  -H "Content-Type: application/json" \
  -d '{"transactionIds": [99999], "paymentMethod": "BANK_TRANSFER"}'
```
**Expected**: 400 "Some transactions not found or already paid"

#### TC-8.5: Make Donation
```bash
curl -X POST http://localhost:4000/api/members/me/donate \
  -H "Authorization: Bearer <member_token>" \
  -H "X-Tenant-Id: <association_id>" \
  -H "Content-Type: application/json" \
  -d '{"categoryId": 10, "amount": 5000, "paymentMethod": "CASH"}'
```
**Expected**: 201 with donation receipt

---

### 9. Edge Cases

#### TC-9.1: Member Without User Account
1. Create member without enabling login
2. Try to access member finance endpoints
3. **Expected**: Cannot login, no access

#### TC-9.2: Concurrent Payments
1. Open payment page in two browser tabs
2. Select same item in both
3. Submit payment in first tab
4. Submit payment in second tab
5. **Expected**: Second payment fails with "already paid" error

#### TC-9.3: Large Number of Transactions
1. Member with 100+ transactions
2. Navigate to dues page
3. **Expected**: Page loads without timeout, all items displayed

#### TC-9.4: Zero Amount Transaction
1. Transaction with amount = 0
2. View in dues list
3. **Expected**: Shows as paid (balance = 0)

#### TC-9.5: Partial Payment History
1. Transaction with multiple partial payments
2. View in dues page
3. **Expected**: Shows correct paid amount and balance

---

### 10. Permission Tests

#### TC-10.1: Admin Cannot Access Member Finance
1. Login as admin
2. Navigate to `/dashboard/my-finances`
3. **Expected**: Sidebar doesn't show "My Finances" section (admin uses Finance section instead)

#### TC-10.2: Member Cannot Access Admin Finance
1. Login as member
2. Try to navigate to `/dashboard/finance/transactions`
3. **Expected**: Access denied or redirect

#### TC-10.3: Cross-Member Data Isolation
1. Login as Member A
2. Try to pay transaction belonging to Member B
3. **Expected**: Transaction not found in outstanding items

---

## Regression Checklist

After any changes to the member finance module, verify:

- [ ] Overview page loads with correct totals
- [ ] All category pages (dues, levies, penalties, donations) load
- [ ] Payment history shows all past payments
- [ ] Outstanding items list is accurate
- [ ] Payment processing works for single and multiple items
- [ ] Donation creation works
- [ ] Status badges display correctly
- [ ] Progress bars calculate correctly
- [ ] Empty states display appropriately
- [ ] Error messages are user-friendly
- [ ] Audit logs are created for payments and donations

---

## Performance Benchmarks

| Operation | Expected Time |
|-----------|---------------|
| Finance Summary Load | < 500ms |
| Dues List Load | < 300ms |
| Payment Processing | < 1000ms |
| Donation Creation | < 1000ms |

---

## Known Limitations

1. **No Partial Payments**: Current implementation pays full balance only
2. **No Payment Gateway**: Payments are recorded manually (no online payment integration)
3. **No Receipt Download**: Receipt numbers generated but no PDF download
4. **No Email Notifications**: No automatic email on payment/donation


---

# Member Financial Ledger - Testing Guide

## Overview

The Member Financial Ledger provides a complete, auditable financial history per member. This guide covers manual testing procedures for both member self-service and admin functionality.

## Prerequisites

1. Running API server (`npm run dev` in `apps/api`)
2. Running Web server (`npm run dev` in `apps/web`)
3. Database with `MemberFinancialLedger` table (run migrations)
4. At least one association with:
   - Active members with user accounts
   - Financial transactions (dues, levies, penalties)
   - Payments recorded against transactions

## Test Data Setup

### Sync Existing Transactions to Ledger

Before testing, sync existing transactions to create ledger entries:

**Option 1: Bulk Sync (Admin)**
1. Login as Admin/Treasurer/Financial Secretary
2. Navigate to Finance → Member Ledgers
3. Click "Sync All Ledgers" button
4. Wait for sync to complete

**Option 2: Individual Sync**
1. Navigate to Finance → Member Ledgers
2. Click on a member
3. Click "Sync Ledger" button

**Option 3: API**
```bash
# Bulk sync
curl -X POST http://localhost:4000/api/member-ledger/ledger/bulk-sync \
  -H "Authorization: Bearer <admin_token>" \
  -H "X-Tenant-Id: <association_id>"

# Individual sync
curl -X POST http://localhost:4000/api/member-ledger/ledger/5/sync \
  -H "Authorization: Bearer <admin_token>" \
  -H "X-Tenant-Id: <association_id>"
```

---

## Member Self-Service Tests

### Location: `/dashboard/my-finances/ledger`

### TC-L1: View Ledger Summary

**Steps:**
1. Login as member
2. Navigate to My Finances → My Ledger
3. View the Summary tab

**Expected Results:**
- Balance card shows current balance with correct sign (positive = outstanding, negative = credit)
- Summary stats show Total Debits, Total Credits, Adjustments, Total Entries
- Category breakdown shows debits/credits/net per category
- All amounts formatted as Nigerian Naira (₦)

### TC-L2: View Ledger Entries

**Steps:**
1. Navigate to My Ledger → All Entries tab
2. View the entries table

**Expected Results:**
- Entries listed in reverse chronological order (newest first)
- Each entry shows: Date, Type (badge), Category, Description, Amount, Running Balance
- DEBIT entries show red amount with minus sign
- CREDIT entries show green amount with plus sign
- Running balance updates correctly per entry

### TC-L3: Filter Ledger Entries

**Steps:**
1. On All Entries tab, use filters:
   - Select Category: "DUES"
   - Select Type: "DEBIT"
   - Select Date Range: Last 30 days
2. Click Refresh

**Expected Results:**
- Only entries matching all filters are displayed
- Pagination updates to reflect filtered count
- Clear filters restores full list

### TC-L4: Generate Statement

**Steps:**
1. Navigate to My Ledger → Statement tab
2. Select date range (e.g., current month)
3. Click "Generate Statement"

**Expected Results:**
- Statement header shows period dates
- Opening Balance shows balance before start date
- Closing Balance shows balance at end date
- Entries table shows Date, Description, Debit, Credit, Balance columns
- Total Debits and Total Credits match sum of entries
- Closing Balance = Opening Balance + Total Debits - Total Credits

### TC-L5: Export Statement PDF

**Steps:**
1. On Statement tab with generated statement
2. Click "Export PDF" button
3. Wait for download

**Expected Results:**
- PDF file downloads with filename format: `ledger-statement-YYYY-MM-DD-YYYY-MM-DD.pdf`
- PDF contains member info, period, opening/closing balance, all entries
- PDF is properly formatted and readable

### TC-L6: Empty Ledger State

**Steps:**
1. Login as member with no transactions
2. Navigate to My Ledger

**Expected Results:**
- Balance shows ₦0
- Summary stats show 0 for all values
- "No transactions yet" message in category breakdown
- "No ledger entries found" in entries table

---

## Admin Tests

### Location: `/dashboard/finance/member-ledger`

### TC-L7: View All Members with Balances

**Steps:**
1. Login as Admin/Treasurer/Financial Secretary
2. Navigate to Finance → Member Ledgers

**Expected Results:**
- Stats cards show: Total Members, Total Outstanding, Total Credit, Members with Balance
- Table shows all members with: Member ID, Name, Balance, Status, Last Activity
- Balance column colored: Red for outstanding, Green for credit, Gray for zero
- Status badges: "Outstanding", "Credit", or "Balanced"

### TC-L8: Search Members

**Steps:**
1. On Member Ledgers page
2. Enter search term (name, email, or member ID)
3. Press Enter or click Refresh

**Expected Results:**
- Table filters to matching members
- Pagination updates
- Stats reflect filtered results

### TC-L9: Sort Members

**Steps:**
1. Use Sort By dropdown: Balance, Name, Last Activity
2. Use Order dropdown: Ascending, Descending

**Expected Results:**
- Table reorders according to selection
- Balance sort shows highest/lowest first
- Name sort alphabetizes

### TC-L10: View Individual Member Ledger

**Steps:**
1. Click on a member row or the eye icon
2. View member's ledger detail page

**Expected Results:**
- Page shows member name and ID
- Balance card shows member's current balance
- Summary, Entries, Statement tabs function same as member self-service
- Back button returns to member list

### TC-L11: Sync Individual Member

**Steps:**
1. On member ledger detail page
2. Click "Sync Ledger" button
3. Wait for completion

**Expected Results:**
- Success toast shows number of entries synced
- Ledger entries refresh with new data
- Balance updates if new transactions found

### TC-L12: Bulk Sync All Members

**Steps:**
1. On Member Ledgers list page
2. Click "Sync All Ledgers" button
3. Wait for completion

**Expected Results:**
- Loading spinner shows during sync
- Success toast shows: "Synced X of Y members"
- Member list refreshes with updated balances

### TC-L13: Export Member Statement (Admin)

**Steps:**
1. Navigate to specific member's ledger
2. Select date range on Statement tab
3. Click "Export PDF"

**Expected Results:**
- PDF downloads with member-specific filename
- PDF contains member's statement data
- Audit log created for export action

---

## API Tests

### TC-L14: Member Self-Service Endpoints

```bash
# Get my ledger summary
curl -X GET "http://localhost:4000/api/member-ledger/my-ledger/summary" \
  -H "Authorization: Bearer <member_token>" \
  -H "X-Tenant-Id: <association_id>"

# Get my ledger entries
curl -X GET "http://localhost:4000/api/member-ledger/my-ledger/entries?page=1&limit=20" \
  -H "Authorization: Bearer <member_token>" \
  -H "X-Tenant-Id: <association_id>"

# Get my statement
curl -X GET "http://localhost:4000/api/member-ledger/my-ledger/statement?startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer <member_token>" \
  -H "X-Tenant-Id: <association_id>"

# Get my balance
curl -X GET "http://localhost:4000/api/member-ledger/my-ledger/balance" \
  -H "Authorization: Bearer <member_token>" \
  -H "X-Tenant-Id: <association_id>"
```

**Expected:** 200 OK with appropriate data structure

### TC-L15: Admin Endpoints

```bash
# Get all members with balances
curl -X GET "http://localhost:4000/api/member-ledger/ledger/members?page=1&limit=50" \
  -H "Authorization: Bearer <admin_token>" \
  -H "X-Tenant-Id: <association_id>"

# Get specific member's summary
curl -X GET "http://localhost:4000/api/member-ledger/ledger/5/summary" \
  -H "Authorization: Bearer <admin_token>" \
  -H "X-Tenant-Id: <association_id>"

# Sync member ledger
curl -X POST "http://localhost:4000/api/member-ledger/ledger/5/sync" \
  -H "Authorization: Bearer <admin_token>" \
  -H "X-Tenant-Id: <association_id>"
```

**Expected:** 200 OK with appropriate data structure

### TC-L16: Permission Denied

```bash
# Member trying to access admin endpoint
curl -X GET "http://localhost:4000/api/member-ledger/ledger/members" \
  -H "Authorization: Bearer <member_token>" \
  -H "X-Tenant-Id: <association_id>"
```

**Expected:** 403 Forbidden

### TC-L17: Cross-Tenant Isolation

```bash
# Try to access member from different association
curl -X GET "http://localhost:4000/api/member-ledger/ledger/999/summary" \
  -H "Authorization: Bearer <admin_token>" \
  -H "X-Tenant-Id: <association_id>"
```

**Expected:** 404 Member not found

---

## Edge Cases

### TC-L18: Member with No Transactions

**Scenario:** Member exists but has no financial transactions

**Steps:**
1. Create new member without any transactions
2. Try to sync their ledger
3. View their ledger

**Expected Results:**
- Sync completes with 0 entries created
- Ledger shows empty state
- Balance is ₦0

### TC-L19: Member with Only Credits (Overpayment)

**Scenario:** Member has paid more than owed

**Steps:**
1. Create transaction for ₦5,000
2. Record payment of ₦7,000
3. Sync ledger
4. View ledger

**Expected Results:**
- Balance shows negative (credit) amount: -₦2,000
- Balance card indicates "credit balance"
- Status badge shows "Credit" (green)

### TC-L20: Large Number of Entries

**Scenario:** Member with 500+ ledger entries

**Steps:**
1. Generate many transactions for a member
2. Sync ledger
3. View entries with pagination

**Expected Results:**
- Page loads within 2 seconds
- Pagination works correctly
- Filters work on large dataset
- Statement generation completes

### TC-L21: Date Range Edge Cases

**Scenario:** Statement with no entries in range

**Steps:**
1. Generate statement for date range with no transactions
2. View results

**Expected Results:**
- Opening balance shows balance before start date
- Entries table is empty
- Closing balance equals opening balance
- Total Debits and Credits show ₦0

### TC-L22: Future Date Range

**Scenario:** Statement with future dates

**Steps:**
1. Select date range entirely in the future
2. Generate statement

**Expected Results:**
- Statement generates successfully
- No entries (none exist in future)
- Opening balance = current balance
- Closing balance = opening balance

### TC-L23: Concurrent Sync Attempts

**Scenario:** Multiple sync requests for same member

**Steps:**
1. Open two browser tabs
2. Navigate to same member's ledger
3. Click "Sync Ledger" in both tabs simultaneously

**Expected Results:**
- First sync succeeds
- Second sync fails with "Member already has ledger entries" error
- No duplicate entries created

### TC-L24: Already Synced Member

**Scenario:** Try to sync member who already has ledger entries

**Steps:**
1. Sync member's ledger
2. Try to sync again

**Expected Results:**
- Error: "Member already has ledger entries. Use reconciliation instead."
- Existing entries preserved

### TC-L25: Statement Spanning Multiple Years

**Scenario:** Statement from 2024-01-01 to 2025-12-31

**Steps:**
1. Select 2-year date range
2. Generate statement

**Expected Results:**
- All entries in range included
- Opening balance calculated correctly
- Closing balance accurate
- PDF export handles large statement

### TC-L26: Zero Amount Entries

**Scenario:** Transaction with ₦0 amount

**Steps:**
1. Create transaction with amount = 0
2. Sync ledger
3. View entries

**Expected Results:**
- Entry created with ₦0 amount
- Running balance unchanged
- Entry displays correctly in table

### TC-L27: Very Large Amounts

**Scenario:** Transaction with ₦999,999,999

**Steps:**
1. Create transaction with large amount
2. Sync ledger
3. View ledger

**Expected Results:**
- Amount displays correctly with commas: ₦999,999,999
- Balance calculations accurate
- No overflow errors

### TC-L28: Special Characters in Description

**Scenario:** Transaction with special characters in notes

**Steps:**
1. Create transaction with notes: "Payment for <script>alert('xss')</script>"
2. Sync ledger
3. View entries

**Expected Results:**
- Description displays safely (HTML escaped)
- No XSS vulnerability
- PDF export handles special characters

---

## RBAC Tests

### TC-L29: Member Access Control

| User Role | My Ledger | Admin Ledger List | Other Member Ledger |
|-----------|-----------|-------------------|---------------------|
| Member | ✅ | ❌ | ❌ |
| Admin | ✅ | ✅ | ✅ |
| Treasurer | ✅ | ✅ | ✅ |
| Financial Secretary | ✅ | ✅ | ✅ |

### TC-L30: Sync Permission

| User Role | Sync Own | Sync Other | Bulk Sync |
|-----------|----------|------------|-----------|
| Member | ❌ | ❌ | ❌ |
| Admin | ✅ | ✅ | ✅ |
| Treasurer | ✅ | ✅ | ✅ |
| Financial Secretary | ❌ | ❌ | ❌ |

---

## Performance Benchmarks

| Operation | Expected Time | Max Acceptable |
|-----------|---------------|----------------|
| Ledger Summary Load | < 300ms | 1000ms |
| Entries List (50 items) | < 200ms | 500ms |
| Statement Generation | < 500ms | 2000ms |
| PDF Export | < 2000ms | 5000ms |
| Bulk Sync (100 members) | < 30s | 60s |
| Member List Load | < 500ms | 1500ms |

---

## Regression Checklist

After any changes to the ledger module, verify:

- [ ] Member can view their own ledger summary
- [ ] Member can view their own ledger entries
- [ ] Member can filter entries by category, type, date
- [ ] Member can generate statement with date range
- [ ] Member can export statement as PDF
- [ ] Admin can view all members with balances
- [ ] Admin can search and sort member list
- [ ] Admin can view any member's ledger
- [ ] Admin can sync individual member ledger
- [ ] Admin can bulk sync all ledgers
- [ ] Admin can export any member's statement
- [ ] Balance calculations are accurate
- [ ] Running balance updates correctly
- [ ] Opening/closing balance in statements correct
- [ ] RBAC permissions enforced
- [ ] Tenant isolation maintained
- [ ] Audit logs created for sync and export actions

---

## Known Limitations

1. **No Real-Time Updates**: Ledger entries created on transaction/payment creation, but existing data requires manual sync
2. **No Reconciliation**: Once synced, cannot re-sync; must use adjustments for corrections
3. **No Partial Sync**: Sync is all-or-nothing per member
4. **PDF Export Async**: Large statements may take time; no progress indicator
5. **No Email Delivery**: Statements must be downloaded; no email option

---

## Troubleshooting

### Issue: "Member already has ledger entries" on sync

**Cause:** Member was previously synced
**Solution:** Use adjustment entries for corrections, or delete existing entries (admin only, not recommended)

### Issue: Balance doesn't match expected

**Cause:** Missing transactions or payments not synced
**Solution:** Check source tables (transactions, payments) for missing records

### Issue: Statement shows wrong opening balance

**Cause:** Entries before start date not properly calculated
**Solution:** Verify all historical entries exist; check effectiveDate vs createdAt

### Issue: PDF export fails

**Cause:** Large statement or server timeout
**Solution:** Use smaller date range; check server logs for errors

### Issue: Entries not appearing after payment

**Cause:** Ledger entry not created on payment
**Solution:** Ensure payment creation triggers ledger entry creation; check for errors in payment flow
