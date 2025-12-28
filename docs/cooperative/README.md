# Cooperatives & Loans Module Documentation

## Phase 8.5 - Enterprise Feature

This module provides comprehensive thrift/savings society and loan management functionality for associations. It enables members to save money, apply for loans, and manage guarantor relationships.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Frontend Pages](#frontend-pages)
6. [Testing Guide](#testing-guide)

---

## Overview

The Cooperatives & Loans module is an Enterprise-tier feature that provides:

- **Savings Management**: Multiple savings account types (Regular, Target, Fixed Deposit)
- **Loan Products**: Configurable loan types with interest rates, tenure, and fees
- **Loan Applications**: Full application workflow with guarantor requirements
- **Guarantor System**: Members can guarantee loans for other members
- **Repayment Tracking**: Automated repayment schedules and payment processing
- **Dashboard Analytics**: Real-time statistics on savings and loan portfolios

### Key Features

| Feature | Description |
|---------|-------------|
| Savings Accounts | Open accounts, process deposits/withdrawals, track balances |
| Loan Products | Configure loan types with interest rates, tenure limits, fees |
| Loan Applications | Submit, review, approve/reject, and disburse loans |
| Guarantor Management | Request, accept/decline guarantor commitments |
| Repayment Processing | Record payments, track schedules, handle overdue loans |
| Dashboard | Overview of savings, loans, pending actions, recent activity |

---

## Architecture

### Backend Structure

```
apps/api/src/modules/cooperatives/
├── cooperatives.types.ts      # TypeScript interfaces and types
├── cooperatives.validation.ts # Zod validation schemas
├── cooperatives.service.ts    # Business logic layer
├── cooperatives.controller.ts # Request handlers
└── cooperatives.routes.ts     # Express route definitions
```

### Frontend Structure

```
apps/web/src/
├── lib/api/cooperatives.ts                           # API client functions
└── app/dashboard/cooperatives/
    ├── page.tsx                                      # Dashboard
    ├── savings/page.tsx                              # Savings accounts
    ├── loans/page.tsx                                # Active loans
    ├── loan-products/page.tsx                        # Loan products config
    ├── applications/page.tsx                         # Loan applications list
    ├── applications/[id]/page.tsx                    # Application detail
    └── guarantors/page.tsx                           # Guarantor requests
```

### Permissions

All cooperative routes require authentication. Specific permissions:

| Permission | Required For |
|------------|--------------|
| `FINANCE_VIEW` | View dashboard, accounts, loans, applications |
| `FINANCE_CREATE` | Create accounts, process transactions, submit applications |
| `FINANCE_APPROVE` | Review/approve applications, disburse loans |
| `MEMBER_VIEW` | View member cooperative profiles |

---

## Database Schema

### Models

#### SavingsAccount
Stores member savings accounts with balance tracking.

| Field | Type | Description |
|-------|------|-------------|
| accountNumber | String | Unique account identifier |
| accountType | Enum | REGULAR, THRIFT, TARGET, FIXED_DEPOSIT |
| balance | Decimal | Current balance |
| targetAmount | Decimal? | Target for target savings |
| monthlyContribution | Decimal? | Expected monthly deposit |
| interestRate | Decimal | Annual interest rate |
| status | Enum | ACTIVE, DORMANT, CLOSED, MATURED |

#### SavingsTransaction
Records all savings account transactions.

| Field | Type | Description |
|-------|------|-------------|
| type | Enum | DEPOSIT, WITHDRAWAL, INTEREST, TRANSFER_IN, TRANSFER_OUT, FEE |
| amount | Decimal | Transaction amount |
| balanceAfter | Decimal | Balance after transaction |
| paymentMethod | String? | CASH, BANK_TRANSFER, etc. |
| reference | String? | External reference |

#### LoanProduct
Configurable loan types offered by the association.

| Field | Type | Description |
|-------|------|-------------|
| name | String | Product name |
| minAmount/maxAmount | Decimal | Loan amount limits |
| interestRate | Decimal | Interest rate percentage |
| interestType | Enum | FLAT, REDUCING_BALANCE, COMPOUND |
| minTenureMonths/maxTenureMonths | Int | Tenure limits |
| requiresGuarantor | Boolean | Whether guarantors needed |
| minGuarantors | Int | Minimum guarantors required |
| processingFeePercent/Fixed | Decimal | Processing fees |
| gracePeriodDays | Int | Days before late fees apply |
| lateFeePercent/Fixed | Decimal | Late payment penalties |

#### LoanApplication
Loan requests from members.

| Field | Type | Description |
|-------|------|-------------|
| applicationNumber | String | Unique application ID |
| amount | Decimal | Requested loan amount |
| tenureMonths | Int | Requested tenure |
| purpose | String | Loan purpose description |
| status | Enum | DRAFT → PENDING_REVIEW → APPROVED/REJECTED → DISBURSED |
| monthlyRepayment | Decimal | Calculated monthly payment |
| totalRepayment | Decimal | Total amount to repay |

#### LoanGuarantor
Tracks guarantor commitments for loan applications.

| Field | Type | Description |
|-------|------|-------------|
| guarantorMemberId | Int | Member acting as guarantor |
| guaranteeAmount | Decimal | Amount being guaranteed |
| status | Enum | PENDING, ACCEPTED, DECLINED, RELEASED |

#### Loan
Active loans after disbursement.

| Field | Type | Description |
|-------|------|-------------|
| loanNumber | String | Unique loan identifier |
| principalAmount | Decimal | Original loan amount |
| outstandingBalance | Decimal | Remaining balance |
| totalPaid | Decimal | Amount paid so far |
| status | Enum | ACTIVE, OVERDUE, DEFAULTED, PAID_OFF, WRITTEN_OFF |
| nextPaymentDate | DateTime | Next due date |

#### LoanRepaymentSchedule
Installment schedule for each loan.

| Field | Type | Description |
|-------|------|-------------|
| installmentNumber | Int | Payment number (1, 2, 3...) |
| dueDate | DateTime | When payment is due |
| principalDue/interestDue | Decimal | Breakdown of payment |
| status | Enum | PENDING, PARTIAL, PAID, OVERDUE, WAIVED |

#### LoanRepayment
Actual payments made against loans.

| Field | Type | Description |
|-------|------|-------------|
| amount | Decimal | Payment amount |
| principalPortion/interestPortion | Decimal | Payment allocation |
| paymentMethod | String | How payment was made |


---

## API Endpoints

Base URL: `/api/cooperatives`

### Dashboard

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/dashboard` | Get cooperative dashboard stats | FINANCE_VIEW |
| GET | `/my-profile` | Get current user's cooperative profile | Authenticated |
| GET | `/members/:id/profile` | Get member's cooperative profile | MEMBER_VIEW |

### Savings Accounts

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/savings-accounts` | List savings accounts | FINANCE_VIEW |
| POST | `/savings-accounts` | Create savings account | FINANCE_CREATE |
| GET | `/savings-accounts/:id` | Get single account | FINANCE_VIEW |

### Savings Transactions

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/savings-transactions` | List transactions | FINANCE_VIEW |
| POST | `/savings-transactions` | Process deposit/withdrawal | FINANCE_CREATE |

### Loan Products

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/loan-products` | List loan products | FINANCE_VIEW |
| POST | `/loan-products` | Create loan product | FINANCE_CREATE |
| PUT | `/loan-products/:id` | Update loan product | FINANCE_EDIT |

### Loan Applications

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/loan-applications` | List applications | FINANCE_VIEW |
| POST | `/loan-applications` | Submit application | Authenticated |
| GET | `/loan-applications/:id` | Get application details | FINANCE_VIEW |
| POST | `/loan-applications/:id/review` | Approve/reject | FINANCE_APPROVE |
| POST | `/loan-applications/:id/disburse` | Disburse approved loan | FINANCE_APPROVE |

### Guarantors

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/guarantor-requests/pending` | Get pending requests | Authenticated |
| POST | `/guarantor-requests/:id/respond` | Accept/decline request | Authenticated |

### Loans

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/loans` | List active loans | FINANCE_VIEW |
| GET | `/loans/:id` | Get loan details | FINANCE_VIEW |

### Loan Repayments

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/loan-repayments` | List repayments | FINANCE_VIEW |
| POST | `/loan-repayments` | Process repayment | FINANCE_CREATE |

---

## Frontend Pages

### 1. Dashboard (`/dashboard/cooperatives`)

Overview page showing:
- Total savings balance and active accounts
- Outstanding loans and overdue amounts
- Default rate percentage
- This month's deposits, withdrawals, disbursements, repayments
- Pending actions alert (applications, guarantor requests, overdue)
- Quick action buttons
- Recent loan applications list

### 2. Savings (`/dashboard/cooperatives/savings`)

Savings account management:
- List all savings accounts with search/filter
- Create new account modal (select member, account type, target amount)
- Deposit modal (amount, payment method, reference)
- Withdrawal modal (amount, payment method, reference)
- View account details

### 3. Loans (`/dashboard/cooperatives/loans`)

Active loans management:
- List all loans with search/filter by status
- View loan details (principal, outstanding, status)
- Record repayment modal (amount, payment method)
- Navigate to loan detail page

### 4. Loan Products (`/dashboard/cooperatives/loan-products`)

Loan product configuration:
- Grid view of all loan products
- Create product modal with all configuration options
- Interest rate, tenure, fees, guarantor requirements
- Activate/deactivate products

### 5. Applications (`/dashboard/cooperatives/applications`)

Loan application management:
- List all applications with status filter
- Create new application modal
- Select loan product, enter amount, tenure, purpose
- Add guarantors if required
- Navigate to application detail

### 6. Application Detail (`/dashboard/cooperatives/applications/[id]`)

Single application view:
- Full loan details (amount, tenure, interest, fees)
- Calculated repayment amounts
- Applicant information
- Guarantor list with status
- Review actions (approve/reject) for pending applications
- Disburse action for approved applications
- Review history and comments

### 7. Guarantors (`/dashboard/cooperatives/guarantors`)

Guarantor request management:
- List pending guarantor requests for current user
- View loan details being guaranteed
- Accept/decline buttons
- Decline reason input when declining
