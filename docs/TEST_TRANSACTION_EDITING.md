# Transaction Editing UI Test Guide

## What to Look For

### 1. Debug Banner (Purple)
At the top of every transaction details page, you'll now see a **purple debug banner** that shows:
- Transaction status
- Total paid amount
- Balance
- Payment count
- Your permissions (TRANSACTION_EDIT and PAYMENT_CREATE)
- Button visibility logic with ✅/❌ indicators

This banner will tell you exactly why buttons are showing or hidden.

### 2. Edit Button (Blue)
**Should appear when:**
- Status is NOT 'paid'
- Status is NOT 'waived'
- Total Paid = ₦0 (no payments made yet)
- User has `ledger.edit` permission

**Button text:** "Edit Transaction"
**Color:** Blue (bg-blue-600)
**Icon:** ✏️ Edit icon

**To test:**
1. Go to an unpaid transaction (pending/overdue status)
2. Verify no payments have been recorded (Total Paid = ₦0)
3. Check the debug banner - it should say "✅ Should Show" for Edit Button
4. You should see a blue "Edit Transaction" button

### 3. Void & Replace Button (Orange)
**Should appear when:**
- Status is 'paid' OR
- Total Paid > ₦0 (has at least one payment)
- User has `ledger.edit` permission

**Button text:** "Void & Replace"
**Color:** Orange (bg-orange-600)
**Icon:** 📄 FileText icon

**To test:**
1. Go to a paid transaction OR a partially paid transaction
2. Check the debug banner - it should say "✅ Should Show" for Void & Replace
3. You should see an orange "Void & Replace" button

### 4. View History Button (Gray)
**Should appear when:**
- Transaction has been edited before (has editHistory or lastEditedAt)

**Button text:** "View History"
**Color:** Gray (bg-gray-600)
**Icon:** 🕐 History icon

## Test Scenarios

### Scenario 1: Unpaid Transaction (Pending)
```
Status: pending
Total Paid: ₦0
Expected Buttons:
- ✅ Edit Transaction (blue)
- ❌ Void & Replace
- ✅ Record Payment (green)
- ✅ Pay Online (if available)
```

### Scenario 2: Partially Paid Transaction
```
Status: partial
Total Paid: ₦5,000 (of ₦10,000)
Expected Buttons:
- ❌ Edit Transaction
- ✅ Void & Replace (orange)
- ✅ Record Payment (green)
```

### Scenario 3: Fully Paid Transaction
```
Status: paid
Total Paid: ₦10,000
Expected Buttons:
- ❌ Edit Transaction
- ✅ Void & Replace (orange)
- ❌ Record Payment
```

### Scenario 4: Edited Transaction (Unpaid)
```
Status: pending
Total Paid: ₦0
Last Edited: Yes
Expected Buttons:
- ✅ View History (gray)
- ✅ Edit Transaction (blue)
- ❌ Void & Replace
- ✅ Record Payment (green)
```

## Common Issues & Solutions

### Issue: "No buttons showing at all"
**Check:**
1. Debug banner shows your permissions - do you have `ledger.edit` permission?
2. Is the user logged in and permissions loaded?
3. Check browser console for errors

### Issue: "Edit button not showing on pending transaction"
**Check:**
1. Debug banner - what does "Total Paid" show?
2. If Total Paid > 0, Edit button won't show (use Void & Replace instead)
3. Check if status is actually 'pending' or 'overdue'

### Issue: "Void & Replace not showing on paid transaction"
**Check:**
1. Debug banner - does it show status as 'paid'?
2. Does debug banner show Total Paid > 0?
3. Do you have `ledger.edit` permission?

## Permission Requirements

### To see Edit/Void buttons:
Your role must have the `ledger.edit` permission assigned:
- Super Admins: ✅ Always have access
- Other roles: Check role permissions in settings

### To see Payment buttons:
Your role must have the `payments.manual_create` permission:
- Super Admins: ✅ Always have access
- Treasurers: Usually have this permission
- Regular members: Usually don't have this permission

## How to Assign Permissions

If you don't have the required permissions:
1. Go to **Settings** → **Roles & Permissions**
2. Find your role (e.g., Admin, Treasurer)
3. Look for **Ledger Management** section
4. Enable `ledger.edit` permission
5. Save and reload the page

## API Verification

If buttons still don't show, verify the backend:

```bash
# Check if TRANSACTION_EDIT permission exists in API
grep -r "ledger.edit" apps/api/src/lib/permissions.ts

# Check if edit endpoint exists
grep -r "editTransaction" apps/api/src/controllers/finance.controller.ts

# Check if void-and-replace endpoint exists
grep -r "voidAndReplaceTransaction" apps/api/src/controllers/finance.controller.ts
```

All three should return results if the backend is properly set up.

## Removing Debug Banner

Once you've verified everything works, remove the debug banner by deleting this section from the file:
`apps/web/src/app/dashboard/finance/transactions/[id]/page.tsx`

Look for the comment `{/* Debug Info Banner - Remove in production */}` and delete that entire div.
