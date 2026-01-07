# Manual Testing Guide - API-UI Gaps Implementation

## Overview

This guide provides step-by-step instructions for manually testing all features implemented in the API-UI gaps project. Each module includes test scenarios, expected results, and troubleshooting tips.

**Test Environment**: Development/Staging  
**Tested On**: January 7, 2026  
**Modules Covered**: 5 (Payments, SMS, Exports, Notifications, Cron Jobs)

---

## 🎯 Test Preparation

### ⚠️ CRITICAL: Add Permissions to Database First!

**Before starting any tests**, you MUST run the SQL script to add new permissions:

```bash
cd apps/api
psql -h localhost -U your_username -d your_database -f prisma/seeds/add-new-permissions.sql
```

**Then restart both servers**:
```bash
# Terminal 1: API
cd apps/api && npm run dev

# Terminal 2: Web  
cd apps/web && npm run dev
```

**📖 Full Setup Guide**: [apps/api/prisma/seeds/README-NEW-PERMISSIONS.md](../../apps/api/prisma/seeds/README-NEW-PERMISSIONS.md)

---

### Prerequisites
1. **User Account**: Create test user with appropriate permissions
2. **Test Data**: 
   - At least 5 members with phone numbers
   - Sample bank account
   - Test transactions
3. **Permissions**: Ensure test user has all required permissions:
   - `PAYMENT_RECORD`, `PAYMENT_VERIFY` - **REQUIRED to see Payment Management link**
   - `SMS_SEND`, `SMS_VIEW` - **REQUIRED to see SMS Dashboard link**
   - `REPORT_VIEW`, `REPORT_FINANCIAL` - **REQUIRED to see Export Data link**
   - `NOTIFICATION_SEND`
   - `SYSTEM_SETTINGS_MANAGE` - **REQUIRED to see Cron Jobs link**

⚠️ **IMPORTANT**: If you don't see navigation links in the sidebar, verify your user has the required permissions!

### Test User Setup
```sql
-- Grant all permissions to test user
UPDATE users SET role = 'admin' WHERE email = 'testuser@example.com';
```

---

## � Troubleshooting Navigation Links

**Problem**: Can't see new navigation links (Payment Management, SMS Dashboard, Export Data, Cron Jobs)

**Solution**:
1. Check user permissions in database or admin panel
2. Required permissions:
   - **Payment Management**: `PAYMENT_RECORD` permission
   - **SMS Dashboard**: `SMS_SEND` permission
   - **Export Data**: `REPORT_VIEW` permission
   - **Cron Jobs**: `SYSTEM_SETTINGS_MANAGE` permission

**Quick Permission Grant** (for testing):
```sql
-- Grant all required permissions to test user
UPDATE users SET role = 'admin' WHERE email = 'your-test-email@example.com';
```

OR use the Dynamic RBAC system:
1. Log in as super admin
2. Navigate to Settings → Roles & Permissions
3. Assign permissions to test user's role

---

## �📦 Phase 3.6: Nigerian Payments UI Testing

### Test 1: Payment Dashboard Access
**URL**: `/dashboard/payments`

#### Prerequisites:
- User must have `PAYMENT_RECORD` permission
- If "Payment Management" link is not visible in sidebar, grant the permission first

#### Steps:
1. Navigate to **Finance → Payment Management** in sidebar
   - *Note: This link appears under the Finance section, requires `PAYMENT_RECORD` permission*
   - *If not visible: Your user doesn't have the required permission*
2. Verify dashboard loads without errors

#### Expected Results:
- ✅ Stats cards display (Pending Verification, Unmatched Transfers, Payment Proofs, Bank Accounts)
- ✅ Recent transfers table shows data
- ✅ Quick action buttons visible
- ✅ No console errors

#### Test Cases:
- [ ] Dashboard loads for admin user
- [ ] Dashboard blocked for non-authorized user (shows permission error)
- [ ] Stats cards show correct counts
- [ ] Recent transfers limited to 5 items
- [ ] Quick action buttons navigate correctly

---

### Test 2: Bank Accounts Management
**URL**: `/dashboard/payments/bank-accounts`

#### Test 2.1: Add Bank Account
**Steps:**
1. Click "Add Bank Account" button
2. Fill form:
   - Account Name: "Test Association Account"
   - Bank: Select "First Bank of Nigeria"
   - Account Number: "1234567890"
   - Description: "Main account"
   - Toggle "Set as default"
3. Click "Create"

**Expected Results:**
- ✅ Modal opens with empty form
- ✅ Nigerian banks dropdown populated (20+ banks)
- ✅ Success notification appears
- ✅ Table refreshes with new account
- ✅ Default badge shows if set as default
- ✅ Account appears in dropdown for transfers

**Test Cases:**
- [ ] Can create account with valid data
- [ ] Cannot create account with missing required fields
- [ ] Cannot create duplicate account number
- [ ] Account number validates as numeric
- [ ] Default flag works correctly
- [ ] Account appears in system immediately

#### Test 2.2: Edit Bank Account
**Steps:**
1. Click edit icon on any account
2. Change account name
3. Click "Update"

**Expected Results:**
- ✅ Modal pre-fills with existing data
- ✅ Changes save successfully
- ✅ Table updates immediately

**Test Cases:**
- [ ] Can edit all fields
- [ ] Cannot set blank values for required fields
- [ ] Changes persist after page refresh

#### Test 2.3: Delete Bank Account
**Steps:**
1. Click delete icon on account
2. Confirm deletion

**Expected Results:**
- ✅ Confirmation prompt appears
- ✅ Account removed from table
- ✅ Cannot delete if associated with transfers

**Test Cases:**
- [ ] Can delete unused account
- [ ] Cannot delete account with transfers
- [ ] Deletion requires confirmation
- [ ] Table updates after deletion

#### Test 2.4: Copy Account Number
**Steps:**
1. Click copy icon next to account number

**Expected Results:**
- ✅ Account number copied to clipboard
- ✅ Toast notification confirms copy

**Test Cases:**
- [ ] Copy function works on all browsers
- [ ] Tooltip shows "Copied!" after clicking

---

### Test 3: Record Bank Transfer
**URL**: `/dashboard/payments/bank-transfers/new`

#### Test 3.1: Record Transfer with Proof
**Steps:**
1. Click "Record Transfer" from dashboard or bank transfers page
2. Fill form:
   - Member: Select test member
   - Bank Account: Select test account
   - Amount: 50000
   - Reference: "TEST001"
   - Date: Today's date
   - Upload payment proof (PNG/JPG < 5MB)
3. Click "Record Transfer"

**Expected Results:**
- ✅ Member dropdown populated
- ✅ Bank account dropdown populated
- ✅ File upload accepts images only
- ✅ Preview shows uploaded image
- ✅ Success notification appears
- ✅ Redirects to transfers list
- ✅ Transfer appears in table

**Test Cases:**
- [ ] Can record transfer with all fields
- [ ] Cannot submit without required fields
- [ ] Amount validates as positive number
- [ ] Reference accepts alphanumeric
- [ ] Image upload validates file type (PNG, JPG, PDF only)
- [ ] Image upload validates size (< 5MB)
- [ ] Date cannot be future date
- [ ] Member receives notification

#### Test 3.2: Record Transfer without Proof
**Steps:**
1. Record transfer without uploading proof

**Expected Results:**
- ✅ Transfer saves successfully
- ✅ Proof status shows "No Proof"
- ✅ Can add proof later

**Test Cases:**
- [ ] Can save without proof
- [ ] Transfer marked as unverified
- [ ] Can edit to add proof later

---

### Test 4: Bank Transfers List
**URL**: `/dashboard/payments/bank-transfers`

#### Test 4.1: View Transfers
**Steps:**
1. Navigate to bank transfers page
2. Verify table displays

**Expected Results:**
- ✅ All transfers listed with pagination
- ✅ Status badges colored correctly (Pending=yellow, Verified=green, Rejected=red)
- ✅ Amounts formatted with currency
- ✅ Dates formatted correctly

**Test Cases:**
- [ ] Table loads with data
- [ ] Pagination works (20 per page)
- [ ] All columns display correctly
- [ ] Status colors match status

#### Test 4.2: Search Transfers
**Steps:**
1. Enter reference number in search box
2. Wait for results (debounced 500ms)

**Expected Results:**
- ✅ Results filter as you type
- ✅ Shows "No results" if not found
- ✅ Clear search resets results

**Test Cases:**
- [ ] Search by reference works
- [ ] Search by member name works
- [ ] Search by amount works
- [ ] Case-insensitive search
- [ ] Debounce prevents excessive API calls

#### Test 4.3: Filter Transfers
**Steps:**
1. Use status filter dropdown
2. Use date range picker

**Expected Results:**
- ✅ Status filter updates results
- ✅ Date filter works correctly
- ✅ Multiple filters combine

**Test Cases:**
- [ ] Can filter by status (Pending/Verified/Rejected)
- [ ] Can filter by date range
- [ ] Can combine filters
- [ ] Clear filters resets to all transfers

#### Test 4.4: Verify Transfer (Admin Only)
**Steps:**
1. Click verify icon on pending transfer
2. Confirm verification

**Expected Results:**
- ✅ Status changes to "Verified"
- ✅ Badge turns green
- ✅ Member receives notification

**Test Cases:**
- [ ] Admin can verify transfers
- [ ] Non-admin cannot see verify button
- [ ] Cannot verify already verified transfer
- [ ] Verification is permanent (cannot undo)

#### Test 4.5: View Transfer Details
**Steps:**
1. Click view icon on any transfer
2. Review modal details

**Expected Results:**
- ✅ Modal shows all transfer details
- ✅ Payment proof displays if uploaded
- ✅ Can download proof
- ✅ Shows audit trail

**Test Cases:**
- [ ] Details modal opens
- [ ] All fields display correctly
- [ ] Image viewer works for proofs
- [ ] Download proof button works

---

### Test 5: Payment Reconciliation
**URL**: `/dashboard/payments/reconciliation`

#### Test 5.1: View Reconciliation Dashboard
**Steps:**
1. Navigate to reconciliation page

**Expected Results:**
- ✅ Stats cards show counts (Total Unmatched, Auto-Matched, Pending Manual Review, Recently Matched)
- ✅ Unmatched transfers table displays
- ✅ Pending transactions table displays

**Test Cases:**
- [ ] Dashboard loads stats
- [ ] Both tables populate
- [ ] Counts accurate

#### Test 5.2: Run Auto-Match
**Steps:**
1. Click "Run Auto-Match" button
2. Review results modal
3. Click "Apply All Matches"

**Expected Results:**
- ✅ Auto-match algorithm runs
- ✅ Results modal shows potential matches
- ✅ Each match shows confidence score
- ✅ Can apply all or individual matches
- ✅ Success notification after applying

**Test Cases:**
- [ ] Auto-match finds matches based on amount/date/reference
- [ ] High confidence matches (>90%) highlighted
- [ ] Can review before applying
- [ ] Applied matches remove from unmatched list
- [ ] Transaction status updates to "Reconciled"

#### Test 5.3: Manual Match
**Steps:**
1. Click "Match" button on unmatched transfer
2. Select corresponding transaction from dropdown
3. Click "Match Transfer"

**Expected Results:**
- ✅ Modal opens with transaction selector
- ✅ Dropdown shows pending transactions
- ✅ Match saves successfully
- ✅ Both transfer and transaction marked as matched

**Test Cases:**
- [ ] Can manually match any unmatched transfer
- [ ] Dropdown filters by similar amounts
- [ ] Cannot match already matched items
- [ ] Match creates proper link in database

---

### Test 6: Statement Import
**URL**: `/dashboard/payments/import`

#### Test 6.1: Download Template
**Steps:**
1. Click "Download Template" button

**Expected Results:**
- ✅ CSV file downloads
- ✅ Template has correct headers (Date, Reference, Amount, Description)

**Test Cases:**
- [ ] Template downloads
- [ ] Has correct format

#### Test 6.2: Import Valid CSV
**Steps:**
1. Prepare CSV with sample transactions:
   ```csv
   Date,Reference,Amount,Description
   2026-01-07,REF001,50000,Payment from John Doe
   2026-01-07,REF002,75000,Payment from Jane Smith
   ```
2. Upload CSV file
3. Review preview table
4. Click "Import Transactions"

**Expected Results:**
- ✅ File uploads successfully
- ✅ Preview shows parsed data
- ✅ Validation passes
- ✅ Import completes
- ✅ Success message shows count
- ✅ Transactions appear in system

**Test Cases:**
- [ ] Can upload CSV file
- [ ] Preview displays correctly
- [ ] Validates date format
- [ ] Validates amount format
- [ ] Imports all valid rows
- [ ] Shows error for invalid rows

#### Test 6.3: Import Invalid CSV
**Steps:**
1. Upload CSV with errors (missing dates, negative amounts)
2. Review error messages

**Expected Results:**
- ✅ Validation catches errors
- ✅ Error messages list specific issues
- ✅ No import occurs until fixed

**Test Cases:**
- [ ] Rejects missing required fields
- [ ] Rejects invalid date formats
- [ ] Rejects negative amounts
- [ ] Shows clear error messages
- [ ] Allows re-upload after fixing

---

### Test 7: Payment Verification Queue
**URL**: `/dashboard/payments/verification`

#### Test 7.1: View Verification Queue
**Steps:**
1. Navigate to verification page
2. Switch between tabs

**Expected Results:**
- ✅ Payment Proofs tab shows unverified proofs
- ✅ Bank Transfers tab shows unverified transfers
- ✅ Image viewer displays proofs
- ✅ Pagination works

**Test Cases:**
- [ ] Both tabs load data
- [ ] Images display correctly
- [ ] Can zoom images
- [ ] Pagination functional

#### Test 7.2: Approve Payment Proof
**Steps:**
1. Select proof from list
2. Review image
3. Click "Approve"
4. Add approval note (optional)
5. Confirm

**Expected Results:**
- ✅ Status changes to "Approved"
- ✅ Proof removed from queue
- ✅ Member receives notification
- ✅ Note saved to audit trail

**Test Cases:**
- [ ] Can approve with/without notes
- [ ] Approved proofs removed from queue
- [ ] Cannot approve twice
- [ ] Notification sent to member

#### Test 7.3: Reject Payment Proof
**Steps:**
1. Select proof from list
2. Click "Reject"
3. Add rejection reason (required)
4. Confirm

**Expected Results:**
- ✅ Reason field required
- ✅ Status changes to "Rejected"
- ✅ Member receives notification with reason
- ✅ Proof remains in system but flagged

**Test Cases:**
- [ ] Cannot reject without reason
- [ ] Rejection reason sent to member
- [ ] Rejected proofs tracked
- [ ] Member can re-upload

---

## 💬 Phase 6.6: SMS/Communications UI Testing

### Test 8: SMS Dashboard
**URL**: `/dashboard/communications`

#### Prerequisites:
- User must have `SMS_SEND` permission
- If "SMS Dashboard" link is not visible in sidebar, grant the permission first

#### Steps:
1. Navigate to **Communication → SMS Dashboard** in sidebar
   - *Note: Requires `SMS_SEND` permission*
2. Review all sections

#### Expected Results:
- ✅ SMS balance displays (with warning if < 100)
- ✅ Total messages sent counter
- ✅ Delivery rate percentage
- ✅ Active campaigns count
- ✅ Recent messages table (last 5)
- ✅ Recent campaigns table (last 5)
- ✅ Quick action buttons functional

#### Test Cases:
- [ ] Dashboard loads all stats
- [ ] Balance warning shows if low
- [ ] Recent messages display
- [ ] Recent campaigns display
- [ ] Quick actions navigate correctly
- [ ] Delivery rate calculates correctly

---

### Test 9: Quick Send SMS
**URL**: `/dashboard/communications/quick-send`

#### Test 9.1: Send to Phone Numbers
**Steps:**
1. Click "Quick Send" or navigate directly
2. Select "Specific Phone Numbers" as recipient type
3. Enter phone numbers (comma or newline separated):
   ```
   08012345678
   09087654321
   07011223344
   ```
4. Enter message (max 160 chars)
5. Review cost estimate
6. Click "Send SMS"

**Expected Results:**
- ✅ Phone number field accepts input
- ✅ Character counter shows remaining chars
- ✅ Cost estimates per recipient
- ✅ Balance check prevents send if insufficient
- ✅ Success notification appears
- ✅ SMS queued for delivery

**Test Cases:**
- [ ] Can send to multiple numbers
- [ ] Comma-separated numbers work
- [ ] Newline-separated numbers work
- [ ] Invalid numbers rejected
- [ ] Message limited to 160 chars
- [ ] Cost calculation accurate
- [ ] Cannot send with insufficient balance
- [ ] Success message confirms send

#### Test 9.2: Send to Member Groups
**Steps:**
1. Select "Member Groups/Filters" as recipient type
2. Check "Send to all members"
3. Enter message
4. Click "Send SMS"

**Expected Results:**
- ✅ All members checkbox works
- ✅ Cost estimates for all members
- ✅ Confirmation prompt if large group
- ✅ SMS sent to all active members

**Test Cases:**
- [ ] Can send to all members
- [ ] Can filter by member type
- [ ] Can filter by groups
- [ ] Can filter by tags
- [ ] Inactive members excluded
- [ ] Cost estimate accurate for group

#### Test 9.3: Insufficient Balance
**Steps:**
1. Attempt to send when balance < recipients

**Expected Results:**
- ✅ Send button disabled
- ✅ Error message shows insufficient balance
- ✅ Top-up option displayed

**Test Cases:**
- [ ] Cannot send with low balance
- [ ] Clear error message
- [ ] Button disabled appropriately

---

### Test 10: SMS Campaigns
**URL**: `/dashboard/communications/campaigns`

#### Test 10.1: View Campaigns
**Steps:**
1. Navigate to campaigns page

**Expected Results:**
- ✅ All campaigns listed
- ✅ Status badges (Draft, Scheduled, In Progress, Completed, Failed)
- ✅ Progress bars show sent/total
- ✅ Search and filter functional

**Test Cases:**
- [ ] Campaigns list loads
- [ ] Status colors correct
- [ ] Progress bars accurate
- [ ] Pagination works
- [ ] Search filters campaigns
- [ ] Status filter works

#### Test 10.2: Create Campaign - Immediate
**Steps:**
1. Click "New Campaign"
2. Fill form:
   - Name: "Test Campaign"
   - Description: "Testing immediate send"
   - Message: "Hello {{name}}, this is a test"
   - Recipients: "Send to all members"
   - Schedule: "Send immediately"
3. Click "Create & Send"

**Expected Results:**
- ✅ Form validates all fields
- ✅ Variable syntax highlighted
- ✅ Cost estimate shows
- ✅ Campaign creates and starts immediately
- ✅ Redirects to campaigns list
- ✅ Status shows "In Progress"

**Test Cases:**
- [ ] Can create campaign with all fields
- [ ] Cannot submit with missing fields
- [ ] Variables {{name}} work
- [ ] Immediate send starts right away
- [ ] Campaign appears in list
- [ ] Progress updates in real-time

#### Test 10.3: Create Campaign - Scheduled
**Steps:**
1. Click "New Campaign"
2. Fill form
3. Schedule: "Schedule for later"
4. Select future date/time
5. Click "Schedule Campaign"

**Expected Results:**
- ✅ Date picker allows future dates only
- ✅ Campaign saves with "Scheduled" status
- ✅ Scheduled time displays correctly
- ✅ Campaign starts at scheduled time

**Test Cases:**
- [ ] Can schedule for future
- [ ] Cannot schedule past date
- [ ] Campaign waits until scheduled time
- [ ] Status changes to "In Progress" when time arrives

#### Test 10.4: Manage Campaign
**Steps:**
1. View campaign details
2. Try actions based on status:
   - Start (if Draft)
   - Cancel (if In Progress)
   - Delete (any status)

**Expected Results:**
- ✅ Can start draft campaigns
- ✅ Can cancel in-progress campaigns
- ✅ Can delete any campaign
- ✅ Confirmation required for destructive actions

**Test Cases:**
- [ ] Start button works for drafts
- [ ] Cancel stops sending
- [ ] Delete removes campaign
- [ ] Cannot delete in-progress without cancel

---

### Test 11: SMS Templates
**URL**: `/dashboard/communications/templates`

#### Test 11.1: Create Template
**Steps:**
1. Click "New Template"
2. Fill form:
   - Name: "Payment Reminder"
   - Content: "Hi {{name}}, your payment of {{amount}} is due on {{date}}"
3. Click "Create"

**Expected Results:**
- ✅ Template saves successfully
- ✅ Variables detected automatically
- ✅ Character count shows
- ✅ Template appears in list

**Test Cases:**
- [ ] Can create template
- [ ] Variables {{}} detected
- [ ] Character limit enforced
- [ ] Template appears immediately
- [ ] Can use in campaigns

#### Test 11.2: Edit Template
**Steps:**
1. Click edit on any template
2. Modify content
3. Click "Update"

**Expected Results:**
- ✅ Modal pre-fills with data
- ✅ Changes save
- ✅ Variable detection updates

**Test Cases:**
- [ ] Can edit template
- [ ] Changes persist
- [ ] Usage count accurate

#### Test 11.3: Delete Template
**Steps:**
1. Click delete on unused template
2. Confirm deletion

**Expected Results:**
- ✅ Template removed
- ✅ Cannot delete if used in active campaigns

**Test Cases:**
- [ ] Can delete unused template
- [ ] Cannot delete active templates
- [ ] Confirmation required

---

### Test 12: SMS History
**URL**: `/dashboard/communications/history`

#### Test 12.1: View Message History
**Steps:**
1. Navigate to history page

**Expected Results:**
- ✅ All sent messages listed
- ✅ Status badges (Sent, Delivered, Failed)
- ✅ Recipient details visible
- ✅ Message content displayed

**Test Cases:**
- [ ] History loads
- [ ] All messages present
- [ ] Status accurate
- [ ] Pagination works

#### Test 12.2: Filter History
**Steps:**
1. Use filters:
   - Status
   - Date range
   - Recipient
   - Campaign

**Expected Results:**
- ✅ Each filter works independently
- ✅ Filters combine correctly
- ✅ Clear filters resets

**Test Cases:**
- [ ] Can filter by status
- [ ] Can filter by date
- [ ] Can filter by recipient
- [ ] Can filter by campaign
- [ ] Multiple filters work together

#### Test 12.3: View Failed Messages
**Steps:**
1. Filter by "Failed" status
2. View failure details

**Expected Results:**
- ✅ Failed messages show error reason
- ✅ Can retry failed messages
- ✅ Tracks retry attempts

**Test Cases:**
- [ ] Failure reasons displayed
- [ ] Can identify patterns
- [ ] Retry option available

---

## 📤 Phase 10.5: Exports Management UI Testing

### Test 13: Export Data
**URL**: `/dashboard/exports`

#### Prerequisites:
- User must have `REPORT_VIEW` permission
- If "Export Data" link is not visible in sidebar, grant the permission first

#### Test 13.1: Export Financial Summary (PDF)
**Steps:**
1. Navigate to **Reports → Export Data** in sidebar
   - *Note: Requires `REPORT_VIEW` permission*
2. Select "Financial Summary" as type
3. Select "PDF" as format
4. Select period "This Month"
5. Click "Generate Export"

**Expected Results:**
- ✅ Export generates within 10 seconds
- ✅ PDF downloads automatically
- ✅ Success notification appears
- ✅ Last export card updates
- ✅ File contains correct data

**Test Cases:**
- [ ] PDF generates successfully
- [ ] Auto-download works
- [ ] File opens correctly
- [ ] Data accurate for selected period
- [ ] Formatting professional

#### Test 13.2: Export Financial Summary (Excel)
**Steps:**
1. Select "Excel" as format
2. Select custom date range
3. Generate export

**Expected Results:**
- ✅ Excel file generates
- ✅ Multiple sheets if needed
- ✅ Formulas work
- ✅ Data formatted correctly

**Test Cases:**
- [ ] Excel format works
- [ ] Custom date range applied
- [ ] All data included
- [ ] File opens in Excel/LibreOffice

#### Test 13.3: Export All Members
**Steps:**
1. Select "All Members" as type
2. Select status filter "With Balance"
3. Generate export

**Expected Results:**
- ✅ Excel file generated
- ✅ Only members with balance included
- ✅ All columns present (name, email, phone, balance, dues)
- ✅ Data accurate

**Test Cases:**
- [ ] Member data exports
- [ ] Filters applied correctly
- [ ] All fields included
- [ ] Sensitive data handled properly

#### Test 13.4: Quick Export Shortcuts
**Steps:**
1. Click "Export This Month" button in quick actions

**Expected Results:**
- ✅ Export starts immediately
- ✅ Uses default settings
- ✅ Downloads automatically

**Test Cases:**
- [ ] Quick export buttons work
- [ ] Default settings correct
- [ ] No additional input needed

---

### Test 14: Export History
**URL**: `/dashboard/exports/history`

#### Test 14.1: View History
**Steps:**
1. Navigate to export history

**Expected Results:**
- ✅ All exports listed (last 90 days)
- ✅ Shows filename, type, format, size
- ✅ Shows creator and date
- ✅ Shows expiration status

**Test Cases:**
- [ ] History loads
- [ ] All columns display
- [ ] Pagination works
- [ ] Expired files marked

#### Test 14.2: Download from History
**Steps:**
1. Click download icon on recent export

**Expected Results:**
- ✅ File downloads
- ✅ Same file as original export

**Test Cases:**
- [ ] Download works for valid exports
- [ ] Cannot download expired (7+ days)
- [ ] File integrity maintained

#### Test 14.3: Filter History
**Steps:**
1. Filter by type, format, date range

**Expected Results:**
- ✅ Filters work correctly
- ✅ Can combine filters
- ✅ Clear filters resets

**Test Cases:**
- [ ] Type filter works
- [ ] Format filter works
- [ ] Date range filter works
- [ ] Multiple filters combine

---

## 🔔 Phase 6.7: Notifications Center UI Testing

### Test 15: View Notifications
**URL**: `/dashboard/notifications`

#### Test 15.1: Notifications List
**Steps:**
1. Navigate to notifications page

**Expected Results:**
- ✅ All notifications listed
- ✅ All/Unread tabs work
- ✅ Unread count badge accurate
- ✅ Different icons for types

**Test Cases:**
- [ ] Notifications load
- [ ] Tabs switch correctly
- [ ] Unread highlighted
- [ ] Pagination works
- [ ] Icons match types

#### Test 15.2: Mark as Read
**Steps:**
1. Click on unread notification

**Expected Results:**
- ✅ Notification marked as read
- ✅ Background color changes
- ✅ Unread count decreases

**Test Cases:**
- [ ] Single notification marks read
- [ ] "Mark All Read" button works
- [ ] Count updates immediately

#### Test 15.3: Delete Notification
**Steps:**
1. Click delete icon on notification

**Expected Results:**
- ✅ Notification removed from list
- ✅ No confirmation needed (or add if desired)

**Test Cases:**
- [ ] Delete works
- [ ] Notification removed immediately
- [ ] Cannot undo (or add undo)

---

### Test 16: Create Announcement
**URL**: `/dashboard/communication/announcements/new`

#### Test 16.1: Broadcast Announcement
**Steps:**
1. Navigate to create announcement
2. Fill form:
   - Title: "System Maintenance"
   - Message: "The system will be down for maintenance on Sunday"
   - Priority: "Warning"
   - Check "Also send via email"
3. Click "Send Announcement"

**Expected Results:**
- ✅ Form validates
- ✅ Announcement creates
- ✅ All members receive notification
- ✅ Email sent if checked
- ✅ Success message appears
- ✅ Redirects to announcements

**Test Cases:**
- [ ] Announcement sends to all
- [ ] Email option works
- [ ] Priority affects display
- [ ] Character limit enforced (2000)
- [ ] Cannot send empty message

#### Test 16.2: View Sent Announcements
**Steps:**
1. Navigate to announcements list

**Expected Results:**
- ✅ All sent announcements shown
- ✅ Sorted by date (newest first)
- ✅ Read/unread status per user

**Test Cases:**
- [ ] Announcements list loads
- [ ] Can see own sent announcements
- [ ] Search works
- [ ] Date sorting correct

---

## ⚙️ Phase 15: Cron Jobs Management UI Testing

### Test 17: Cron Jobs Dashboard
**URL**: `/dashboard/system/cron-jobs`

#### Prerequisites:
- User must have `SYSTEM_SETTINGS_MANAGE` permission
- If "Cron Jobs" link is not visible in sidebar, grant the permission first

#### Test 17.1: View Dashboard
**Steps:**
1. Navigate to **Settings → Cron Jobs** in sidebar
   - *Note: Requires `SYSTEM_SETTINGS_MANAGE` permission*

**Expected Results:**
- ✅ System status shows (Active/Inactive)
- ✅ Subscription stats display
- ✅ All 4 job cards visible
- ✅ Last checked time shown
- ✅ Schedule information table populated

**Test Cases:**
- [ ] Dashboard loads for admins only
- [ ] Non-admin users see permission error
- [ ] All job cards display
- [ ] Stats accurate
- [ ] Schedule table shows times

#### Test 17.2: Manual Job Trigger - Trial Expiry
**Steps:**
1. Click "Run Now" on "Trial Expiry Check"
2. Wait for completion
3. Review result

**Expected Results:**
- ✅ Button shows loading state
- ✅ Job executes
- ✅ Result modal shows details
- ✅ Success notification appears
- ✅ Last run time updates

**Test Cases:**
- [ ] Job triggers manually
- [ ] Results display correctly
- [ ] Shows expired and expiring counts
- [ ] No errors in execution

#### Test 17.3: Manual Job Trigger - Late Fees
**Steps:**
1. Click "Run Now" on "Late Fees Processing"
2. Review results

**Expected Results:**
- ✅ Job processes all overdue payments
- ✅ Shows count of fees applied
- ✅ Result details accurate

**Test Cases:**
- [ ] Late fees calculated correctly
- [ ] Only overdue items processed
- [ ] No duplicate charges
- [ ] Audit trail created

#### Test 17.4: Manual Job Trigger - Multiple Jobs
**Steps:**
1. Try to run two jobs simultaneously

**Expected Results:**
- ✅ Other buttons disabled while one running
- ✅ Jobs queue or run sequentially
- ✅ No conflicts

**Test Cases:**
- [ ] Cannot run multiple jobs at once
- [ ] UI prevents concurrent execution
- [ ] Jobs complete successfully

#### Test 17.5: Refresh Status
**Steps:**
1. Click "Refresh Status" button

**Expected Results:**
- ✅ All stats refresh
- ✅ Loading indicator shows
- ✅ Data updates without page reload

**Test Cases:**
- [ ] Refresh works
- [ ] Stats update
- [ ] No console errors

---

## 🎭 Cross-Module Integration Testing

### Test 18: Payment to Notification Flow
**Steps:**
1. Record a bank transfer
2. Check member's notifications
3. Verify transfer
4. Check member's notifications again

**Expected Results:**
- ✅ Member receives "Transfer recorded" notification
- ✅ Member receives "Transfer verified" notification
- ✅ Both notifications appear in real-time

**Test Cases:**
- [ ] Notifications sent on payment actions
- [ ] Notification content accurate
- [ ] Links in notifications work

---

### Test 19: SMS Campaign with Template
**Steps:**
1. Create SMS template with variables
2. Create campaign using template
3. Send to test group
4. Check history

**Expected Results:**
- ✅ Template variables replaced
- ✅ All messages sent
- ✅ History shows correct content

**Test Cases:**
- [ ] Templates work in campaigns
- [ ] Variables replaced correctly
- [ ] Member names, amounts personalized

---

### Test 20: Export After Payment Import
**Steps:**
1. Import bank statement CSV
2. Export financial summary
3. Verify imported data in export

**Expected Results:**
- ✅ Imported transactions appear in export
- ✅ Totals calculate correctly
- ✅ Data consistency maintained

**Test Cases:**
- [ ] Import reflects in exports
- [ ] No data loss
- [ ] Calculations accurate

---

## 🔍 Edge Cases & Error Scenarios

### Test 21: Network Errors
**Steps:**
1. Disconnect network
2. Try to load any module
3. Reconnect and retry

**Expected Results:**
- ✅ Clear error message
- ✅ Retry option available
- ✅ No data corruption

**Test Cases:**
- [ ] Handles network errors gracefully
- [ ] Error messages user-friendly
- [ ] Can recover after reconnection

---

### Test 22: Concurrent Users
**Steps:**
1. Have two users verify same payment simultaneously

**Expected Results:**
- ✅ One succeeds, one gets error
- ✅ No duplicate processing
- ✅ UI updates for both users

**Test Cases:**
- [ ] Handles concurrent actions
- [ ] No race conditions
- [ ] Database constraints enforced

---

### Test 23: Large Data Sets
**Steps:**
1. Import 1000+ transactions
2. View bank transfers list
3. Export large dataset

**Expected Results:**
- ✅ Pagination handles large data
- ✅ Performance acceptable (<3s page load)
- ✅ Export completes without timeout

**Test Cases:**
- [ ] Pagination prevents overload
- [ ] Large exports don't timeout
- [ ] Performance acceptable

---

### Test 24: Invalid Data
**Steps:**
1. Try to create bank account with invalid account number
2. Try to send SMS with invalid phone
3. Try to import malformed CSV

**Expected Results:**
- ✅ Validation catches errors
- ✅ Clear error messages
- ✅ No database corruption

**Test Cases:**
- [ ] Input validation works
- [ ] Error messages specific
- [ ] Invalid data rejected

---

## 🛡️ Security Testing

### Test 25: Permission Boundaries
**Steps:**
1. Log in as regular member (non-admin)
2. Try to access admin pages directly via URL

**Expected Results:**
- ✅ Access denied message
- ✅ Redirected or blocked
- ✅ No data exposed

**Test Cases:**
- [ ] `/dashboard/payments` - blocked
- [ ] `/dashboard/payments/verification` - blocked
- [ ] `/dashboard/system/cron-jobs` - blocked
- [ ] `/dashboard/exports` - depends on permissions
- [ ] `/dashboard/communications` - depends on permissions

---

### Test 26: Data Privacy
**Steps:**
1. Export member data
2. Review exported file

**Expected Results:**
- ✅ Passwords not included
- ✅ Sensitive data masked if needed
- ✅ Only authorized data exported

**Test Cases:**
- [ ] No password hashes in exports
- [ ] Bank account numbers handled securely
- [ ] Member privacy respected

---

## 📱 Responsive Design Testing

### Test 27: Mobile View
**Steps:**
1. Access each module on mobile device (or DevTools mobile view)
2. Test all major functions

**Expected Results:**
- ✅ All pages responsive
- ✅ Tables scroll horizontally
- ✅ Forms usable on mobile
- ✅ Buttons accessible
- ✅ Images scale correctly

**Test Cases:**
- [ ] Dashboard cards stack on mobile
- [ ] Tables have horizontal scroll
- [ ] Forms input fields full width
- [ ] Navigation menu works
- [ ] All buttons tap-friendly

---

## 🧹 Cleanup & Maintenance Testing

### Test 28: File Cleanup
**Steps:**
1. Wait 7 days (or change system date)
2. Check export files

**Expected Results:**
- ✅ Files older than 7 days deleted automatically
- ✅ Download links show "Expired"
- ✅ Disk space freed

**Test Cases:**
- [ ] Cron job deletes old exports
- [ ] Expired status accurate
- [ ] No orphaned files

---

## 📊 Test Results Template

### Test Session Template
```
Date: ________________
Tester: ________________
Environment: ________________
Browser: ________________

Module: Phase 3.6 - Nigerian Payments
[ ] Test 1: Payment Dashboard Access - PASS/FAIL
    Notes: ________________________________
[ ] Test 2: Bank Accounts Management - PASS/FAIL
    Notes: ________________________________
[ ] Test 3: Record Bank Transfer - PASS/FAIL
    Notes: ________________________________
...

Module: Phase 6.6 - SMS/Communications
[ ] Test 8: SMS Dashboard - PASS/FAIL
    Notes: ________________________________
...

Critical Bugs Found:
1. ________________________________
2. ________________________________

Minor Issues:
1. ________________________________
2. ________________________________

Overall Assessment: ________________
Sign-off: ________________
```

---

## 🎯 Success Criteria

All modules pass if:
- ✅ All CRUD operations work correctly
- ✅ Permissions enforced properly
- ✅ No console errors in normal use
- ✅ Data persists correctly
- ✅ Notifications send appropriately
- ✅ Exports generate valid files
- ✅ UI responsive on mobile
- ✅ Performance acceptable (<3s page loads)
- ✅ Error messages clear and helpful
- ✅ No data loss or corruption

---

## 📞 Support

If you encounter issues during testing:
1. Check browser console for errors
2. Verify user permissions
3. Check API server logs
4. Review test data setup
5. Document issue with:
   - Steps to reproduce
   - Expected vs actual result
   - Screenshots/console logs
   - Environment details

---

**Testing Completed**: _____________  
**Tested By**: _____________  
**Overall Status**: PASS / FAIL / NEEDS REVISION
