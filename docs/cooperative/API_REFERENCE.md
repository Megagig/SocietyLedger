# Cooperatives & Loans API Reference

Base URL: `/api/cooperatives`

All endpoints require authentication via JWT token in the Authorization header.

---

## Dashboard Endpoints

### GET /dashboard

Get cooperative dashboard statistics.

**Permission:** FINANCE_VIEW

**Response:**
```json
{
  "success": true,
  "data": {
    "savingsSummary": {
      "totalAccounts": 25,
      "activeAccounts": 22,
      "totalBalance": "1500000.00",
      "totalDepositsThisMonth": "250000.00",
      "totalWithdrawalsThisMonth": "50000.00",
      "averageBalance": "68181.82"
    },
    "loansSummary": {
      "totalActiveLoans": 15,
      "totalDisbursed": "5000000.00",
      "totalOutstanding": "3500000.00",
      "totalCollectedThisMonth": "450000.00",
      "overdueLoans": 3,
      "overdueAmount": "150000.00",
      "defaultRate": 4.5
    },
    "pendingActions": {
      "pendingLoanApplications": 5,
      "pendingGuarantorRequests": 8,
      "overdueRepayments": 12
    },
    "recentActivity": {
      "recentDeposits": [...],
      "recentRepayments": [...],
      "recentApplications": [...]
    }
  }
}
```

### GET /my-profile

Get current user's cooperative profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "memberId": 1,
    "memberName": "John Doe",
    "savingsAccounts": [...],
    "totalSavings": "250000.00",
    "activeLoans": [...],
    "totalOutstandingLoans": "150000.00",
    "guarantorExposure": "100000.00",
    "guaranteedLoans": [...],
    "loanEligibility": {
      "maxLoanAmount": "500000.00",
      "eligibleProducts": [...],
      "reasons": []
    },
    "creditScore": 750,
    "memberSince": "2023-01-15T00:00:00.000Z"
  }
}
```

### GET /members/:id/profile

Get specific member's cooperative profile.

**Permission:** MEMBER_VIEW

**Parameters:**
- `id` (path): Member ID

---

## Savings Account Endpoints

### GET /savings-accounts

List savings accounts with pagination and filters.

**Permission:** FINANCE_VIEW

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10) |
| memberId | number | Filter by member |
| accountType | string | REGULAR, THRIFT, TARGET, FIXED_DEPOSIT |
| status | string | ACTIVE, DORMANT, CLOSED, MATURED |
| search | string | Search by name or account number |

**Response:**
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": 1,
        "accountNumber": "SAV-2024-0001",
        "accountType": "REGULAR",
        "balance": "150000.00",
        "status": "ACTIVE",
        "member": {
          "id": 1,
          "firstName": "John",
          "lastName": "Doe",
          "membershipId": "MEM-001"
        },
        "targetAmount": null,
        "monthlyContribution": null,
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### POST /savings-accounts

Create a new savings account.

**Permission:** FINANCE_CREATE

**Request Body:**
```json
{
  "memberId": 1,
  "accountType": "TARGET",
  "targetAmount": 500000,
  "monthlyContribution": 50000,
  "interestRate": 5.0,
  "notes": "Saving for house down payment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Savings account created successfully",
  "data": {
    "id": 1,
    "accountNumber": "SAV-2024-0001",
    ...
  }
}
```

### GET /savings-accounts/:id

Get single savings account details.

**Permission:** FINANCE_VIEW

---

## Savings Transaction Endpoints

### GET /savings-transactions

List savings transactions.

**Permission:** FINANCE_VIEW

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| savingsAccountId | number | Filter by account |
| type | string | DEPOSIT, WITHDRAWAL, INTEREST, etc. |
| startDate | string | Filter from date (ISO format) |
| endDate | string | Filter to date (ISO format) |

### POST /savings-transactions

Process a deposit or withdrawal.

**Permission:** FINANCE_CREATE

**Request Body:**
```json
{
  "savingsAccountId": 1,
  "type": "DEPOSIT",
  "amount": 50000,
  "paymentMethod": "BANK_TRANSFER",
  "reference": "TRF-123456",
  "notes": "Monthly contribution"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deposit processed successfully",
  "data": {
    "id": 1,
    "type": "DEPOSIT",
    "amount": "50000.00",
    "balanceAfter": "200000.00",
    ...
  }
}
```

**Error Response (Insufficient Balance):**
```json
{
  "success": false,
  "message": "Insufficient balance for withdrawal"
}
```


---

## Loan Product Endpoints

### GET /loan-products

List loan products.

**Permission:** FINANCE_VIEW

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| isActive | boolean | Filter by active status |
| search | string | Search by name |

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "name": "Emergency Loan",
        "description": "Quick loans for emergencies",
        "minAmount": "10000.00",
        "maxAmount": "500000.00",
        "interestRate": "5.00",
        "interestType": "FLAT",
        "minTenureMonths": 1,
        "maxTenureMonths": 12,
        "processingFeePercent": "1.00",
        "processingFeeFixed": "0.00",
        "requiresGuarantor": false,
        "minGuarantors": 0,
        "maxLoanToSavingsRatio": "2.00",
        "gracePeriodDays": 7,
        "lateFeePercent": "2.00",
        "lateFeeFixed": "500.00",
        "isActive": true
      }
    ],
    "pagination": {...}
  }
}
```

### POST /loan-products

Create a new loan product.

**Permission:** FINANCE_CREATE

**Request Body:**
```json
{
  "name": "Business Loan",
  "description": "Loans for business expansion",
  "minAmount": 100000,
  "maxAmount": 5000000,
  "interestRate": 8.5,
  "interestType": "REDUCING_BALANCE",
  "minTenureMonths": 6,
  "maxTenureMonths": 36,
  "processingFeePercent": 1.5,
  "requiresGuarantor": true,
  "minGuarantors": 2,
  "maxLoanToSavingsRatio": 3.0,
  "gracePeriodDays": 14,
  "lateFeePercent": 2.5
}
```

### PUT /loan-products/:id

Update a loan product.

**Permission:** FINANCE_EDIT

---

## Loan Application Endpoints

### GET /loan-applications

List loan applications.

**Permission:** FINANCE_VIEW

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| memberId | number | Filter by applicant |
| status | string | PENDING_REVIEW, APPROVED, REJECTED, DISBURSED, etc. |
| loanProductId | number | Filter by product |
| search | string | Search by name or application number |

### POST /loan-applications

Submit a new loan application.

**Permission:** Authenticated (any member)

**Request Body:**
```json
{
  "loanProductId": 1,
  "amount": 200000,
  "tenureMonths": 12,
  "purpose": "Home renovation project",
  "guarantorIds": [2, 3],
  "collateralDescription": "Vehicle registration documents",
  "collateralValue": 500000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Loan application submitted successfully",
  "data": {
    "id": 1,
    "applicationNumber": "LA-2024-0001",
    "amount": "200000.00",
    "tenureMonths": 12,
    "monthlyRepayment": "18333.33",
    "totalRepayment": "220000.00",
    "totalInterest": "20000.00",
    "processingFee": "3000.00",
    "status": "PENDING_REVIEW",
    ...
  }
}
```

### GET /loan-applications/:id

Get single application details.

**Permission:** FINANCE_VIEW

**Response includes:**
- Full application details
- Calculated repayment amounts
- Applicant information
- Guarantor list with status
- Review/approval history

### POST /loan-applications/:id/review

Review (approve/reject) a loan application.

**Permission:** FINANCE_APPROVE

**Request Body (Approve):**
```json
{
  "action": "approve",
  "comments": "Application meets all criteria"
}
```

**Request Body (Reject):**
```json
{
  "action": "reject",
  "comments": "Insufficient savings history",
  "rejectionReason": "Member has less than 6 months savings history"
}
```

### POST /loan-applications/:id/disburse

Disburse an approved loan.

**Permission:** FINANCE_APPROVE

**Request Body:**
```json
{
  "disbursementMethod": "BANK_TRANSFER",
  "bankAccountId": 1,
  "reference": "TRF-2024-001",
  "notes": "Disbursed to member's registered bank account"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Loan disbursed successfully",
  "data": {
    "loan": {
      "id": 1,
      "loanNumber": "LN-2024-0001",
      "principalAmount": "200000.00",
      "outstandingBalance": "220000.00",
      "status": "ACTIVE",
      "disbursedAt": "2024-01-20T14:30:00.000Z",
      "maturityDate": "2025-01-20",
      "nextPaymentDate": "2024-02-20",
      "nextPaymentAmount": "18333.33"
    },
    "repaymentSchedule": [...]
  }
}
```

---

## Guarantor Endpoints

### GET /guarantor-requests/pending

Get pending guarantor requests for current user.

**Permission:** Authenticated

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": 1,
        "status": "PENDING",
        "guaranteedAmount": "100000.00",
        "createdAt": "2024-01-18T10:00:00.000Z",
        "loanApplication": {
          "id": 5,
          "amount": "200000.00",
          "purpose": "Business expansion",
          "member": {
            "firstName": "Jane",
            "lastName": "Smith",
            "membershipId": "MEM-002"
          },
          "loanProduct": {
            "name": "Business Loan"
          }
        }
      }
    ]
  }
}
```

### POST /guarantor-requests/:id/respond

Accept or decline a guarantor request.

**Permission:** Authenticated (must be the requested guarantor)

**Request Body (Accept):**
```json
{
  "action": "accept"
}
```

**Request Body (Decline):**
```json
{
  "action": "decline",
  "declineReason": "Unable to take on additional guarantor commitments at this time"
}
```

---

## Loan Endpoints

### GET /loans

List active loans.

**Permission:** FINANCE_VIEW

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| memberId | number | Filter by borrower |
| status | string | ACTIVE, OVERDUE, DEFAULTED, PAID_OFF, WRITTEN_OFF |
| loanProductId | number | Filter by product |
| search | string | Search by name or loan number |

### GET /loans/:id

Get single loan details with repayment schedule.

**Permission:** FINANCE_VIEW

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "loanNumber": "LN-2024-0001",
    "principalAmount": "200000.00",
    "interestRate": "10.00",
    "interestType": "FLAT",
    "tenureMonths": 12,
    "monthlyRepayment": "18333.33",
    "totalRepayment": "220000.00",
    "totalInterest": "20000.00",
    "amountDisbursed": "197000.00",
    "totalPaid": "55000.00",
    "principalPaid": "50000.00",
    "interestPaid": "5000.00",
    "outstandingBalance": "165000.00",
    "nextPaymentDate": "2024-04-20",
    "nextPaymentAmount": "18333.33",
    "status": "ACTIVE",
    "disbursedAt": "2024-01-20T14:30:00.000Z",
    "maturityDate": "2025-01-20",
    "member": {...},
    "loanProduct": {...},
    "repaymentSchedule": [
      {
        "id": 1,
        "installmentNumber": 1,
        "dueDate": "2024-02-20",
        "principalDue": "16666.67",
        "interestDue": "1666.67",
        "totalDue": "18333.33",
        "totalPaid": "18333.33",
        "status": "PAID",
        "paidAt": "2024-02-18T09:00:00.000Z"
      },
      ...
    ]
  }
}
```

---

## Loan Repayment Endpoints

### GET /loan-repayments

List loan repayments.

**Permission:** FINANCE_VIEW

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| loanId | number | Filter by loan |
| startDate | string | Filter from date |
| endDate | string | Filter to date |

### POST /loan-repayments

Process a loan repayment.

**Permission:** FINANCE_CREATE

**Request Body:**
```json
{
  "loanId": 1,
  "amount": 20000,
  "paymentMethod": "BANK_TRANSFER",
  "reference": "TRF-PAY-001",
  "notes": "Monthly installment payment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Repayment processed successfully",
  "data": {
    "repayment": {
      "id": 1,
      "amount": "20000.00",
      "principalPortion": "16666.67",
      "interestPortion": "1666.67",
      "lateFee": "1666.66",
      "paidAt": "2024-03-20T10:00:00.000Z"
    },
    "loan": {
      "outstandingBalance": "145000.00",
      "totalPaid": "75000.00",
      "status": "ACTIVE"
    }
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "amount",
      "message": "Amount must be between 10000 and 500000"
    }
  ]
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |
