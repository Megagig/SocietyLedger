# Accounting System Documentation

**Phase 9 - Completed December 28, 2025**

## Overview

The Accounting System provides comprehensive double-entry bookkeeping capabilities for associations, including chart of accounts management, journal entries with approval workflow, financial statement generation, and budget planning with variance analysis.

## Features

### 1. Chart of Accounts (TASK-ACC-001)
- Standard chart of accounts template with 50+ pre-configured accounts
- Account types: Assets, Liabilities, Equity, Income, Expenses
- Hierarchical account structure with parent-child relationships
- Normal balance tracking (Debit/Credit)
- System accounts protection (cannot be deleted)

### 2. Journal Entry System (TASK-ACC-002)
- Double-entry bookkeeping with balanced debits and credits
- Auto-generated entry numbers (JE-YYYY-NNNNN format)
- Multiple line items per entry
- Reference number tracking
- Source type tracking (manual, auto_sync)

### 3. Income Statement / P&L (TASK-ACC-003)
- Revenue and expense breakdown by account
- Period-based filtering (this month, last month, quarter, year, custom)
- Period comparison with variance calculation
- Percentage change analysis

### 4. Balance Sheet (TASK-ACC-004)
- Assets: Current, Fixed, Other
- Liabilities: Current, Long-term
- Equity with retained earnings calculation
- Balance verification (Assets = Liabilities + Equity)

### 5. Cash Flow Statement (TASK-ACC-005)
- Operating activities
- Investing activities
- Financing activities
- Beginning and ending cash balances
- Net cash change calculation

### 6. Budget Planning (TASK-ACC-006)
- Fiscal year-based budgets
- Monthly and quarterly budget amounts
- Budget approval workflow
- Variance analysis with status indicators

### 7. Approval Workflow (TASK-ACC-007)
- Draft → Pending Approval → Approved/Rejected → Posted
- Maker-checker separation (cannot approve own entries)
- Rejection reason tracking
- Audit trail with timestamps

### 8. Auto-sync Transactions (TASK-ACC-008)
- Automatic journal entry creation from financial transactions
- Payment synchronization
- Account mapping based on transaction type
- Duplicate prevention

## API Endpoints

### Chart of Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/accounting/chart-of-accounts/initialize` | Initialize standard chart |
| GET | `/api/accounting/chart-of-accounts` | List all accounts |
| POST | `/api/accounting/chart-of-accounts` | Create new account |
| PUT | `/api/accounting/chart-of-accounts/:id` | Update account |
| DELETE | `/api/accounting/chart-of-accounts/:id` | Delete/deactivate account |

### Journal Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounting/journal-entries` | List entries with pagination |
| POST | `/api/accounting/journal-entries` | Create new entry |
| GET | `/api/accounting/journal-entries/:id` | Get entry details |
| PUT | `/api/accounting/journal-entries/:id` | Update draft entry |
| POST | `/api/accounting/journal-entries/:id/submit` | Submit for approval |
| POST | `/api/accounting/journal-entries/:id/approval` | Approve/reject |
| POST | `/api/accounting/journal-entries/:id/post` | Post approved entry |

### Financial Statements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounting/income-statement` | Generate P&L report |
| GET | `/api/accounting/balance-sheet` | Generate balance sheet |
| GET | `/api/accounting/cash-flow` | Generate cash flow statement |

### Budgets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounting/budgets` | List budgets |
| POST | `/api/accounting/budgets` | Create budget |
| GET | `/api/accounting/budgets/:id` | Get budget details |
| PUT | `/api/accounting/budgets/:id` | Update draft budget |
| POST | `/api/accounting/budgets/:id/approve` | Approve budget |
| POST | `/api/accounting/budgets/:id/activate` | Activate budget |
| GET | `/api/accounting/budgets/:id/variance` | Get variance report |

### Sync & Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/accounting/sync/transaction/:id` | Sync transaction |
| POST | `/api/accounting/sync/payment/:id` | Sync payment |
| GET | `/api/accounting/dashboard` | Get dashboard data |

## Database Schema

### Models
- `ChartOfAccount` - Account definitions
- `JournalEntry` - Transaction headers
- `JournalEntryLine` - Transaction line items
- `Budget` - Budget headers
- `BudgetItem` - Budget line items
- `AccountingPeriod` - Fiscal period management

### Enums
- `AccountType`: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
- `NormalBalance`: DEBIT, CREDIT
- `JournalEntryStatus`: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, POSTED, VOIDED
- `BudgetStatus`: DRAFT, PENDING_APPROVAL, APPROVED, ACTIVE, CLOSED
- `PeriodStatus`: OPEN, CLOSED, LOCKED

## Frontend Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/dashboard/accounting` | Overview with stats and trends |
| Chart of Accounts | `/dashboard/accounting/chart-of-accounts` | Account management |
| Journal Entries | `/dashboard/accounting/journal-entries` | Entry management |
| Income Statement | `/dashboard/accounting/income-statement` | P&L report |
| Balance Sheet | `/dashboard/accounting/balance-sheet` | Balance sheet report |
| Cash Flow | `/dashboard/accounting/cash-flow` | Cash flow statement |
| Budgets | `/dashboard/accounting/budgets` | Budget management |

## Standard Chart of Accounts

The system initializes with a standard chart of accounts:

### Assets (1000-1999)
- 1100 Current Assets (Cash, Receivables, Prepaid)
- 1200 Fixed Assets (Equipment, Furniture, Depreciation)

### Liabilities (2000-2999)
- 2100 Current Liabilities (Payables, Accrued, Deferred)
- 2200 Long-term Liabilities (Loans)

### Equity (3000-3999)
- 3100 Opening Balance Equity
- 3200 Retained Earnings
- 3300 Current Year Earnings

### Income (4000-4999)
- 4100 Membership Income (Dues, Registration)
- 4200 Levy Income
- 4300 Donation Income
- 4400 Penalty Income
- 4500 Interest Income
- 4600 Other Income

### Expenses (5000-5999)
- 5100 Administrative Expenses
- 5200 Professional Fees
- 5300 Event Expenses
- 5400 Welfare Expenses
- 5500 Bank Charges
- 5600 Depreciation
- 5700 Miscellaneous

## Permissions

| Permission | Description |
|------------|-------------|
| `accounting:view` | View accounting data |
| `accounting:create` | Create entries and budgets |
| `accounting:edit` | Edit draft entries |
| `accounting:approve` | Approve/reject entries |
| `accounting:post` | Post approved entries |
| `accounting:admin` | Full accounting access |

## Usage Examples

### Initialize Chart of Accounts
```typescript
POST /api/accounting/chart-of-accounts/initialize
// Creates 50+ standard accounts for the association
```

### Create Journal Entry
```typescript
POST /api/accounting/journal-entries
{
  "entryDate": "2025-12-28",
  "description": "Monthly dues collection",
  "reference": "INV-2025-001",
  "lines": [
    { "accountId": 5, "debitAmount": 50000, "creditAmount": 0 },
    { "accountId": 15, "debitAmount": 0, "creditAmount": 50000 }
  ]
}
```

### Generate Income Statement
```typescript
GET /api/accounting/income-statement?period=this_month&includeComparison=true
```

### Create Budget
```typescript
POST /api/accounting/budgets
{
  "name": "2025 Annual Budget",
  "fiscalYear": 2025,
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "items": [
    { "accountId": 15, "annualAmount": 1200000 },
    { "accountId": 25, "annualAmount": 500000 }
  ]
}
```

## File Structure

```
apps/api/src/modules/accounting/
├── accounting.types.ts      # Type definitions
├── accounting.validation.ts # Zod schemas
├── accounting.service.ts    # Business logic
├── accounting.controller.ts # Request handlers
└── accounting.routes.ts     # Route definitions

apps/web/src/app/dashboard/accounting/
├── page.tsx                 # Dashboard
├── chart-of-accounts/
│   └── page.tsx            # Account management
├── journal-entries/
│   └── page.tsx            # Entry management
├── income-statement/
│   └── page.tsx            # P&L report
├── balance-sheet/
│   └── page.tsx            # Balance sheet
├── cash-flow/
│   └── page.tsx            # Cash flow
└── budgets/
    └── page.tsx            # Budget management

apps/web/src/lib/api/
└── accounting.ts           # API client
```


---

## Manual Testing Guide

This guide provides step-by-step instructions for manually testing all features of the Accounting module.

### Prerequisites

1. **Start the development servers:**
   ```bash
   # Terminal 1 - API Server
   cd apps/api
   npm run dev
   
   # Terminal 2 - Web App
   cd apps/web
   npm run dev
   ```

2. **Login as an admin user** with `finance:view` and `finance:manage` permissions

3. **Navigate to Accounting** in the sidebar

---

### Test 1: Initialize Chart of Accounts

**Objective:** Set up the standard chart of accounts for the association

**Steps:**
1. Navigate to `/dashboard/accounting/chart-of-accounts`
2. If no accounts exist, click the "Initialize Chart of Accounts" button
3. Wait for the initialization to complete

**Expected Results:**
- ✅ Success toast message appears
- ✅ 50+ accounts are created with proper hierarchy
- ✅ Accounts are organized by type (Assets, Liabilities, Equity, Income, Expenses)
- ✅ Each account has a code, name, type, and normal balance

**Verification:**
- Check that account codes follow the pattern:
  - 1xxx = Assets
  - 2xxx = Liabilities
  - 3xxx = Equity
  - 4xxx = Income
  - 5xxx = Expenses

---

### Test 2: Create a Custom Account

**Objective:** Add a new account to the chart of accounts

**Steps:**
1. Navigate to `/dashboard/accounting/chart-of-accounts`
2. Click "Add Account" button
3. Fill in the form:
   - Code: `5800`
   - Name: `Training Expenses`
   - Type: `EXPENSE`
   - Sub Type: `operating_expense`
   - Description: `Expenses for member training and workshops`
   - Normal Balance: `DEBIT`
4. Click "Create Account"

**Expected Results:**
- ✅ New account appears in the list
- ✅ Account is properly categorized under Expenses
- ✅ Success toast message appears

**Verification:**
- Refresh the page and verify the account persists
- Check that the account appears in journal entry dropdowns

---

### Test 3: Create a Journal Entry (Draft)

**Objective:** Create a double-entry journal entry

**Steps:**
1. Navigate to `/dashboard/accounting/journal-entries`
2. Click "New Journal Entry" button
3. Fill in the form:
   - Entry Date: Today's date
   - Description: `Test membership dues collection`
   - Reference: `TEST-001`
4. Add line items:
   - Line 1: Account = `1121 Member Dues Receivable`, Debit = `50000`, Credit = `0`
   - Line 2: Account = `4110 Membership Dues`, Debit = `0`, Credit = `50000`
5. Click "Save as Draft"

**Expected Results:**
- ✅ Entry is created with status "DRAFT"
- ✅ Entry number is auto-generated (JE-2025-XXXXX)
- ✅ Total Debit = Total Credit = 50,000
- ✅ Entry appears in the journal entries list

**Validation Test:**
- Try creating an unbalanced entry (debits ≠ credits)
- ✅ Should show validation error: "Total debits must equal total credits"

---

### Test 4: Journal Entry Approval Workflow

**Objective:** Test the maker-checker approval process

**Steps:**

**Step 4a: Submit for Approval**
1. Find the draft entry created in Test 3
2. Click "Submit for Approval" button
3. Confirm the submission

**Expected Results:**
- ✅ Status changes to "PENDING_APPROVAL"
- ✅ Entry can no longer be edited

**Step 4b: Approve the Entry (as different user or admin)**
1. Navigate to the pending entry
2. Click "Approve" button
3. Confirm approval

**Expected Results:**
- ✅ Status changes to "APPROVED"
- ✅ Approved by and Approved at fields are populated (Cannot approve your own entry)

**Step 4c: Post the Entry**
1. Find the approved entry
2. Click "Post" button
3. Confirm posting

**Expected Results:**
- ✅ Status changes to "POSTED"
- ✅ Entry is now reflected in financial statements
- ✅ Entry can no longer be modified

**Rejection Test:**
1. Create another draft entry
2. Submit for approval
3. Click "Reject" and provide reason: "Incorrect account used"

**Expected Results:**
- ✅ Status changes to "REJECTED"
- ✅ Rejection reason is saved and displayed

---

### Test 5: Generate Income Statement (P&L)

**Objective:** Generate and view the Profit & Loss statement

**Steps:**
1. Navigate to `/dashboard/accounting/income-statement`
2. Select period: "This Month"
3. Enable "Include Comparison" toggle
4. Click "Generate Report" or wait for auto-load

**Expected Results:**
- ✅ Revenue section shows all income accounts with balances
- ✅ Expenses section shows all expense accounts with balances
- ✅ Net Income = Total Revenue - Total Expenses
- ✅ Comparison shows previous period data
- ✅ Percentage changes are calculated correctly

**Verification:**
- Verify that only POSTED journal entries are included
- Check that the totals match the sum of individual accounts

---

### Test 6: Generate Balance Sheet

**Objective:** Generate and view the Balance Sheet

**Steps:**
1. Navigate to `/dashboard/accounting/balance-sheet`
2. Select "As of Date" (default: today)
3. View the generated report

**Expected Results:**
- ✅ Assets section shows:
  - Current Assets (cash, receivables, prepaid)
  - Fixed Assets (equipment, furniture)
  - Total Assets
- ✅ Liabilities section shows:
  - Current Liabilities
  - Long-term Liabilities
  - Total Liabilities
- ✅ Equity section shows:
  - Equity accounts
  - Retained Earnings (calculated)
  - Total Equity
- ✅ Balance verification: Total Assets = Total Liabilities + Total Equity
- ✅ "Balanced" indicator shows green checkmark

---

### Test 7: Generate Cash Flow Statement

**Objective:** Generate and view the Cash Flow Statement

**Steps:**
1. Navigate to `/dashboard/accounting/cash-flow`
2. Select period: "This Month"
3. View the generated report

**Expected Results:**
- ✅ Operating Activities section shows:
  - Cash inflows from operations
  - Cash outflows from operations
  - Net cash from operating activities
- ✅ Investing Activities section shows:
  - Cash flows from asset purchases/sales
- ✅ Financing Activities section shows:
  - Cash flows from loans, equity
- ✅ Summary shows:
  - Beginning Cash Balance
  - Net Cash Change
  - Ending Cash Balance
- ✅ Ending Cash = Beginning Cash + Net Cash Change

---

### Test 8: Create and Manage Budget

**Objective:** Create a budget and track variance

**Steps:**

**Step 8a: Create Budget**
1. Navigate to `/dashboard/accounting/budgets`
2. Click "Create Budget" button
3. Fill in the form:
   - Name: `2025 Annual Budget`
   - Fiscal Year: `2025`
   - Start Date: `2025-01-01`
   - End Date: `2025-12-31`
   - Description: `Annual operating budget for 2025`
4. Add budget items:
   - Account: `4110 Membership Dues`, Annual Amount: `1,200,000`
   - Account: `5100 Administrative Expenses`, Annual Amount: `300,000`
   - Account: `5300 Event Expenses`, Annual Amount: `500,000`
5. Click "Create Budget"

**Expected Results:**
- ✅ Budget is created with status "DRAFT"
- ✅ Total budget is calculated correctly
- ✅ Budget appears in the list

**Step 8b: Approve Budget**
1. Find the draft budget
2. Click "Approve" button

**Expected Results:**
- ✅ Status changes to "APPROVED"

**Step 8c: Activate Budget**
1. Find the approved budget
2. Click "Activate" button

**Expected Results:**
- ✅ Status changes to "ACTIVE"
- ✅ Any other active budget for the same fiscal year is closed

**Step 8d: View Variance Report**
1. Click on the active budget
2. Navigate to "Variance Analysis" tab or click "View Variance"

**Expected Results:**
- ✅ Shows budget vs actual for each account
- ✅ Variance amount and percentage calculated
- ✅ Status indicators: Under (green), On Track (yellow), Over (red)

---

### Test 9: Auto-sync Transaction to Accounting

**Objective:** Test automatic journal entry creation from financial transactions

**Steps:**
1. Create a financial transaction (dues, levy, or donation) in the Finance module
2. Navigate to `/dashboard/accounting/journal-entries`
3. Find the "Sync Transaction" option or navigate to the transaction
4. Click "Sync to Accounting"

**Expected Results:**
- ✅ Journal entry is automatically created
- ✅ Entry has source type "auto_sync"
- ✅ Entry is automatically POSTED
- ✅ Correct accounts are used based on transaction type:
  - Dues: Debit 1121 (Receivable) / Credit 4110 (Dues Income)
  - Levy: Debit 1122 (Levy Receivable) / Credit 4200 (Levy Income)
  - Donation: Debit 1112 (Bank) / Credit 4300 (Donation Income)

**Duplicate Prevention Test:**
1. Try to sync the same transaction again
2. ✅ Should show error: "Transaction already synced to accounting"

---

### Test 10: Sync Payment to Accounting

**Objective:** Test automatic journal entry creation from payments

**Steps:**
1. Record a payment against a transaction in the Finance module
2. Navigate to the payment or use "Sync Payment" option
3. Click "Sync to Accounting"

**Expected Results:**
- ✅ Journal entry is created for the payment
- ✅ Entry: Debit 1112 (Bank) / Credit 1121 (Receivable)
- ✅ Entry is automatically POSTED
- ✅ Receipt number is used as reference

---

### Test 11: Accounting Dashboard

**Objective:** Verify dashboard displays correct summary data

**Steps:**
1. Navigate to `/dashboard/accounting`
2. Review all dashboard widgets

**Expected Results:**
- ✅ Quick Stats show:
  - Total Assets
  - Total Liabilities
  - Total Equity
  - Net Income (YTD)
  - Cash Balance
- ✅ Recent Entries widget shows last 5 journal entries
- ✅ Pending Approvals count is accurate
- ✅ Budget Status shows (if active budget exists):
  - Total Budget
  - Total Spent
  - Remaining Budget
  - Percent Used
- ✅ Monthly Trend chart shows last 6 months of income vs expenses

---

### Test 12: Search and Filter Journal Entries

**Objective:** Test search and filtering capabilities

**Steps:**
1. Navigate to `/dashboard/accounting/journal-entries`
2. Test the following filters:

**Search Test:**
1. Enter a search term (entry number, description, or reference)
2. ✅ Results are filtered accordingly

**Status Filter:**
1. Select status: "POSTED"
2. ✅ Only posted entries are shown

**Date Range Filter:**
1. Set start date and end date
2. ✅ Only entries within the range are shown

**Sorting:**
1. Click column headers to sort
2. ✅ Entries are sorted by the selected column

---

### Test 13: Edit and Delete Accounts

**Objective:** Test account modification and deletion

**Steps:**

**Edit Account:**
1. Navigate to `/dashboard/accounting/chart-of-accounts`
2. Find a non-system account (one you created)
3. Click "Edit" button
4. Change the name or description
5. Click "Save"

**Expected Results:**
- ✅ Account is updated
- ✅ System accounts cannot have code or type changed

**Delete Account:**
1. Find an account with no journal entries
2. Click "Delete" button
3. Confirm deletion

**Expected Results:**
- ✅ Account is deleted (hard delete if no entries)
- ✅ Account is deactivated (soft delete if has entries)
- ✅ System accounts cannot be deleted

---

### Test 14: Permission-Based Access

**Objective:** Verify role-based access control

**Steps:**
1. Login as a user with only `finance:view` permission
2. Navigate to accounting pages

**Expected Results:**
- ✅ Can view all reports and data
- ✅ Cannot create journal entries
- ✅ Cannot approve entries
- ✅ Cannot modify accounts

**Admin Test:**
1. Login as admin with full permissions
2. ✅ Can perform all operations

---

### Test 15: Error Handling

**Objective:** Verify proper error handling

**Test Cases:**

1. **Invalid Account Code:**
   - Try creating account with duplicate code
   - ✅ Error: "Account with code XXX already exists"

2. **Unbalanced Entry:**
   - Try creating entry where debits ≠ credits
   - ✅ Error: "Total debits must equal total credits"

3. **Edit Posted Entry:**
   - Try editing a posted journal entry
   - ✅ Error: "Can only update draft entries"

4. **Self-Approval:**
   - Try approving your own entry
   - ✅ Error: "Cannot approve your own entry"

5. **Missing Required Fields:**
   - Submit forms with missing required fields
   - ✅ Validation errors are shown

---

### Test 16: Data Integrity

**Objective:** Verify data consistency across the system

**Steps:**
1. Create several journal entries and post them
2. Generate all three financial statements
3. Verify the following:

**Cross-Verification:**
- ✅ Net Income on P&L = Retained Earnings change on Balance Sheet
- ✅ Cash balance on Balance Sheet = Ending Cash on Cash Flow
- ✅ Total Debits = Total Credits across all posted entries

---

## Troubleshooting

### Common Issues

1. **"Chart of accounts already initialized" error**
   - This is expected if accounts already exist
   - Solution: Use the existing accounts or contact admin to reset

2. **Journal entry not appearing in reports**
   - Check that the entry status is "POSTED"
   - Only posted entries affect financial statements

3. **Balance sheet not balancing**
   - Check for unposted entries
   - Verify all accounts have correct normal balance settings

4. **Budget variance showing incorrect data**
   - Ensure the budget is "ACTIVE"
   - Check the date range matches the budget period

### API Testing with cURL

For developers who want to test the API directly:

```bash
# Get auth token first
TOKEN="your-jwt-token"

# Initialize Chart of Accounts
curl -X POST http://localhost:3001/api/accounting/chart-of-accounts/initialize \
  -H "Authorization: Bearer $TOKEN"

# Get Chart of Accounts
curl http://localhost:3001/api/accounting/chart-of-accounts \
  -H "Authorization: Bearer $TOKEN"

# Create Journal Entry
curl -X POST http://localhost:3001/api/accounting/journal-entries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entryDate": "2025-12-28",
    "description": "Test entry",
    "lines": [
      {"accountId": 5, "debitAmount": 1000, "creditAmount": 0},
      {"accountId": 15, "debitAmount": 0, "creditAmount": 1000}
    ]
  }'

# Get Income Statement
curl "http://localhost:3001/api/accounting/income-statement?period=this_month" \
  -H "Authorization: Bearer $TOKEN"

# Get Balance Sheet
curl http://localhost:3001/api/accounting/balance-sheet \
  -H "Authorization: Bearer $TOKEN"

# Get Dashboard
curl http://localhost:3001/api/accounting/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

---

## Test Completion Checklist

| Test | Description | Status |
|------|-------------|--------|
| 1 | Initialize Chart of Accounts | ⬜ |
| 2 | Create Custom Account | ⬜ |
| 3 | Create Journal Entry (Draft) | ⬜ |
| 4 | Journal Entry Approval Workflow | ⬜ |
| 5 | Generate Income Statement | ⬜ |
| 6 | Generate Balance Sheet | ⬜ |
| 7 | Generate Cash Flow Statement | ⬜ |
| 8 | Create and Manage Budget | ⬜ |
| 9 | Auto-sync Transaction | ⬜ |
| 10 | Sync Payment | ⬜ |
| 11 | Accounting Dashboard | ⬜ |
| 12 | Search and Filter | ⬜ |
| 13 | Edit and Delete Accounts | ⬜ |
| 14 | Permission-Based Access | ⬜ |
| 15 | Error Handling | ⬜ |
| 16 | Data Integrity | ⬜ |

**Tester Name:** _________________  
**Date:** _________________  
**Environment:** _________________  
**Notes:** _________________
