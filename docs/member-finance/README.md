# Member Finance Self-Service Module

## Overview

The Member Finance Self-Service module allows association members to view and manage their own financial data including dues, levies, penalties, donations, and payment history. This module provides a member-centric view of financial obligations and enables self-service payments.

## New Feature: Member Financial Ledger (Phase 11.7)

The Member Financial Ledger provides a complete, auditable financial history per member - a single source of truth for all member financial activity.

### Key Features
- **Complete Financial History**: Every financial action affecting a member creates a ledger entry
- **Opening/Closing Balance**: Statement generation with accurate balance calculations
- **Append-Only Design**: Ledger entries are never deleted; corrections use reversal/adjustment entries
- **Multi-Source Integration**: Automatically captures transactions, payments, waivers, cooperative activities
- **PDF Export**: Generate professional statements for members
- **RBAC Enforcement**: Members see only their own data; admins can view any member

### Ledger Entry Types
| Type | Description | Effect on Balance |
|------|-------------|-------------------|
| DEBIT | Charges to member (dues, levies, penalties) | Increases outstanding |
| CREDIT | Payments, refunds, waivers | Decreases outstanding |
| ADJUSTMENT | Manual corrections | Varies |

### Ledger Categories
| Category | Description |
|----------|-------------|
| DUES | Membership dues |
| LEVY | Special levies/contributions |
| PENALTY | Late fees, fines |
| DONATION | Voluntary donations |
| REFUND | Refunds to member |
| WAIVER | Waived amounts |
| ADJUSTMENT | Manual adjustments |
| SAVINGS_DEPOSIT | Cooperative savings deposit |
| SAVINGS_WITHDRAWAL | Cooperative savings withdrawal |
| LOAN_DISBURSEMENT | Loan disbursement |
| LOAN_REPAYMENT | Loan repayment |
| OTHER | Other transactions |

### Balance Calculation
Balance is computed as: `SUM(DEBITS) - SUM(CREDITS)`
- Positive balance = Member owes money (outstanding)
- Negative balance = Member has credit
- Zero balance = Account is balanced

### Frontend Pages

#### Member Self-Service (`/dashboard/my-finances/ledger`)
- Balance overview card
- Summary statistics (debits, credits, adjustments, entry count)
- Category breakdown
- Filterable entries table
- Statement generation with date range
- PDF export

#### Admin View (`/dashboard/finance/member-ledger`)
- All members list with balances
- Search and sort functionality
- Bulk sync capability
- Click to view individual member ledger

#### Admin Member Detail (`/dashboard/finance/member-ledger/[memberId]`)
- Same features as member self-service
- Sync individual member ledger
- Export statements for any member

## Architecture

### Backend Structure

```
apps/api/src/modules/member-finance/
├── member-finance.controller.ts   # All endpoint handlers
└── member-finance.routes.ts       # Route definitions with RBAC
```

### Frontend Structure

```
apps/web/src/app/dashboard/my-finances/
├── page.tsx              # Overview dashboard
├── dues/page.tsx         # View and pay dues
├── levies/page.tsx       # View and pay levy assignments
├── penalties/page.tsx    # View and pay penalties
├── donations/page.tsx    # View donations and make new ones
├── payments/page.tsx     # Payment history
└── pay/page.tsx          # Multi-select payment page
```

## Permission Model

### Permission Required

```typescript
MEMBER_FINANCE_VIEW: 'member:finance:view'
```

This permission is automatically granted to users with the `member` role.

### Role Mapping

| Role | Has Access |
|------|------------|
| super_admin | ✅ |
| admin | ❌ (uses FINANCE_VIEW instead) |
| treasurer | ❌ (uses FINANCE_VIEW instead) |
| financial_secretary | ❌ (uses FINANCE_VIEW instead) |
| member | ✅ |

## API Endpoints

All endpoints are mounted at `/api/members/me/` and require authentication.

### GET /api/members/me/finance-summary

Returns a comprehensive overview of the member's financial status.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalDue": 150000,
    "totalPaid": 100000,
    "totalOutstanding": 50000,
    "overdueAmount": 10000,
    "overdueCount": 2,
    "duesSummary": {
      "total": 80000,
      "paid": 60000,
      "outstanding": 20000,
      "count": 5
    },
    "leviesSummary": {
      "total": 50000,
      "paid": 30000,
      "outstanding": 20000,
      "count": 2
    },
    "penaltiesSummary": {
      "total": 20000,
      "paid": 10000,
      "outstanding": 10000,
      "count": 1
    },
    "donationsSummary": {
      "total": 25000,
      "count": 3
    },
    "upcomingPayments": [...],
    "recentTransactions": [...]
  }
}
```

### GET /api/members/me/dues

Returns all dues assigned to the member.

**Response:**
```json
{
  "success": true,
  "data": {
    "dues": [
      {
        "id": 1,
        "referenceNumber": "TXN000001",
        "category": { "id": 1, "name": "Monthly Dues", "type": "due", "frequency": "monthly" },
        "amount": 5000,
        "paid": 5000,
        "balance": 0,
        "dueDate": "2025-01-31T00:00:00.000Z",
        "status": "paid",
        "isOverdue": false,
        "payments": [...],
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### GET /api/members/me/levies

Returns all levy campaign assignments for the member.

**Response:**
```json
{
  "success": true,
  "data": {
    "levies": [
      {
        "id": 1,
        "campaign": {
          "id": 1,
          "name": "Building Fund",
          "description": "New office building",
          "targetAmount": 5000000,
          "deadline": "2025-06-30T00:00:00.000Z",
          "status": "ACTIVE"
        },
        "amount": 50000,
        "paid": 25000,
        "balance": 25000,
        "status": "partial",
        "isOverdue": false,
        "transactionId": 15,
        "assignedAt": "2025-01-15T00:00:00.000Z"
      }
    ]
  }
}
```

### GET /api/members/me/penalties

Returns all penalties assigned to the member.

**Response:**
```json
{
  "success": true,
  "data": {
    "penalties": [
      {
        "id": 1,
        "referenceNumber": "TXN000010",
        "category": { "id": 5, "name": "Late Payment Fee", "type": "penalty" },
        "amount": 2000,
        "paid": 0,
        "balance": 2000,
        "reason": "Late payment for January dues",
        "status": "pending",
        "payments": [],
        "createdAt": "2025-02-01T00:00:00.000Z"
      }
    ]
  }
}
```

### GET /api/members/me/donations

Returns donation history and available donation categories.

**Response:**
```json
{
  "success": true,
  "data": {
    "donations": [
      {
        "id": 1,
        "referenceNumber": "TXN000020",
        "category": { "id": 10, "name": "General Fund", "type": "donation" },
        "amount": 10000,
        "purpose": "General Fund",
        "isAnonymous": false,
        "receiptNumber": "DON000001",
        "payments": [...],
        "createdAt": "2025-01-20T00:00:00.000Z"
      }
    ],
    "donationCategories": [
      { "id": 10, "name": "General Fund", "description": "Support general operations" },
      { "id": 11, "name": "Welfare Fund", "description": "Member welfare support" }
    ]
  }
}
```

### GET /api/members/me/payments

Returns the member's payment history.

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": 1,
        "amount": 5000,
        "paymentDate": "2025-01-15T10:30:00.000Z",
        "paymentMethod": "bank_transfer",
        "reference": "PAY000001",
        "transaction": {
          "id": 1,
          "referenceNumber": "TXN000001",
          "category": { "id": 1, "name": "Monthly Dues", "type": "due" }
        },
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

### GET /api/members/me/outstanding

Returns all outstanding items that can be paid.

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 5,
        "type": "dues",
        "category": { "id": 1, "name": "Monthly Dues", "type": "due" },
        "campaign": null,
        "amount": 5000,
        "balance": 5000,
        "dueDate": "2025-02-28T00:00:00.000Z"
      },
      {
        "id": 15,
        "type": "levy",
        "category": { "id": 3, "name": "Building Levy", "type": "levy" },
        "campaign": { "name": "Building Fund" },
        "amount": 50000,
        "balance": 25000,
        "dueDate": "2025-06-30T00:00:00.000Z"
      }
    ]
  }
}
```

### POST /api/members/me/pay

Process payment for selected transactions.

**Request:**
```json
{
  "transactionIds": [5, 15],
  "paymentMethod": "BANK_TRANSFER",
  "reference": "REF123456",
  "notes": "Payment for February dues and building levy"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully recorded 2 payment(s)",
  "data": {
    "payments": [...]
  }
}
```

### POST /api/members/me/donate

Make a new donation.

**Request:**
```json
{
  "categoryId": 10,
  "amount": 25000,
  "paymentMethod": "BANK_TRANSFER",
  "isAnonymous": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Donation recorded successfully",
  "data": {
    "transactionId": 25,
    "receiptNumber": "DON000005",
    "amount": 25000
  }
}
```

## Frontend Pages

### Overview Page (`/dashboard/my-finances`)

Displays:
- Payment progress bar
- Overdue alert (if applicable)
- Summary cards for outstanding, dues, levies, penalties
- Quick action buttons
- Upcoming payments list
- Donation summary

### Dues Page (`/dashboard/my-finances/dues`)

Features:
- Summary card with total outstanding
- List of all dues with status badges
- Pay Now button for individual dues
- Status filtering

### Levies Page (`/dashboard/my-finances/levies`)

Features:
- Summary card with total outstanding
- Campaign details with progress bars
- Contribution tracking
- Deadline display

### Penalties Page (`/dashboard/my-finances/penalties`)

Features:
- Account status indicator
- List of penalties with reasons
- Pay Penalty button

### Donations Page (`/dashboard/my-finances/donations`)

Features:
- Total donations summary
- Donation history list
- Make Donation modal
- Category selection

### Payments Page (`/dashboard/my-finances/payments`)

Features:
- Total payments summary
- Payment history table
- Type badges (dues, levy, donation, penalty)
- Receipt numbers

### Make Payment Page (`/dashboard/my-finances/pay`)

Features:
- Multi-select outstanding items
- Select All / Deselect All
- Payment method selection
- Reference and notes fields
- Real-time total calculation

## Database Models Used

### Transaction
Primary model for all financial obligations (dues, levies, penalties, donations).

### Payment
Records individual payments against transactions.

### LevyCampaignAssignment
Links members to levy campaigns with assigned amounts.

### DonationRecord
Additional metadata for donation transactions.

### FinancialCategory
Categorizes transactions by type (due, levy, penalty, donation).

## Sidebar Navigation

The "My Finances" section appears in the sidebar for users with `MEMBER_FINANCE_VIEW` permission:

```
My Finances
├── Overview
├── My Dues
├── My Levies
├── My Donations
├── Penalties
├── Payment History
└── Make Payment
```

## Security Considerations

1. **Member Isolation**: All queries filter by the authenticated user's member record
2. **Association Scoping**: All data is scoped to the user's association
3. **Permission Check**: RBAC middleware validates `MEMBER_FINANCE_VIEW` permission
4. **Transaction Validation**: Payment endpoint verifies transactions belong to the member
5. **Audit Logging**: All payments and donations are logged for audit trail
