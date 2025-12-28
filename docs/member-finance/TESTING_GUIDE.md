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
