# Phase 3.5: Nigerian Payment Features

**Implementation Date:** December 28, 2025  
**Status:** ✅ Fully Implemented  
**Location:** `apps/api/src/modules/nigerian-payments/`

## Overview

The Nigerian Payment Features module provides comprehensive bank transfer tracking, reconciliation, and payment verification capabilities specifically designed for Nigerian associations. This module addresses the common payment patterns in Nigeria where bank transfers are the primary payment method.

## Features Implemented

### 1. Bank Transfer Tracking (TASK-PAY-001)

Record and track bank transfers with detailed sender information.

**Endpoint:** `POST /api/payments/nigerian/bank-transfers`

**Request Body:**
```json
{
  "transactionId": 123,
  "bankAccountId": 1,
  "memberId": 45,
  "senderBankName": "Zenith Bank",
  "senderAccountNumber": "1234567890",
  "senderAccountName": "John Doe",
  "amount": 50000,
  "reference": "TRF/2024/001234",
  "transferDate": "2024-12-28T10:00:00Z",
  "narration": "Monthly dues payment",
  "notes": "Payment for December 2024"
}
```

**Features:**
- Link transfers to existing transactions
- Track sender bank details
- Store transfer reference numbers
- Support verification workflow

### 2. Multiple Bank Account Support (TASK-PAY-002)

Associations can configure multiple bank accounts for receiving payments.

**Endpoints:**
- `GET /api/payments/nigerian/bank-accounts` - List all accounts
- `POST /api/payments/nigerian/bank-accounts` - Create account
- `PATCH /api/payments/nigerian/bank-accounts/:id` - Update account
- `DELETE /api/payments/nigerian/bank-accounts/:id` - Delete account

**Request Body (Create):**
```json
{
  "bankName": "Zenith Bank",
  "accountName": "Association Name",
  "accountNumber": "1234567890",
  "bankCode": "057",
  "isDefault": true,
  "description": "Main collection account"
}
```

**Features:**
- Support for all major Nigerian banks
- Default account designation
- Soft delete for accounts with transactions

### 3. Payment Reconciliation (TASK-PAY-003)

Match bank statement entries to recorded payments.

**Endpoint:** `POST /api/payments/nigerian/reconcile`

**Request Body:**
```json
{
  "transactionId": 123,
  "bankTransferId": 456,
  "statementEntryId": 789,
  "matchType": "MANUAL",
  "matchedAmount": 50000,
  "variance": 0,
  "notes": "Matched manually by admin"
}
```

**Match Types:**
- `AUTO_REFERENCE` - Matched by reference number (100% confidence)
- `AUTO_AMOUNT` - Matched by amount (70-90% confidence)
- `MANUAL` - Manually matched by admin

### 4. Auto-matching Transactions (TASK-PAY-004)

Automatically match payments based on reference numbers and amounts.

**Endpoints:**
- `POST /api/payments/nigerian/auto-match` - Find potential matches
- `POST /api/payments/nigerian/auto-match/apply` - Apply selected matches

**Response (auto-match):**
```json
{
  "success": true,
  "data": {
    "matched": 5,
    "unmatched": 3,
    "matches": [
      {
        "transactionId": 123,
        "bankTransferId": 456,
        "confidence": 100,
        "matchType": "AUTO_REFERENCE"
      }
    ]
  }
}
```

**Matching Algorithm:**
1. First tries to match by reference number (highest confidence)
2. Then matches by member + amount
3. Finally matches by amount only (lowest confidence)

### 5. Bank Statement Import (TASK-PAY-005)

Import bank statements (CSV format) for reconciliation.

**Endpoint:** `POST /api/payments/nigerian/import-statement`

**Request Body:**
```json
{
  "bankAccountId": 1,
  "filename": "statement_dec_2024.csv",
  "entries": [
    {
      "transactionDate": "2024-12-28",
      "valueDate": "2024-12-28",
      "reference": "TRF/001234",
      "description": "Transfer from John Doe",
      "creditAmount": 50000,
      "balance": 1500000
    }
  ],
  "startDate": "2024-12-01",
  "endDate": "2024-12-31"
}
```

**Features:**
- Parse CSV bank statements
- Track import history
- Link entries to bank accounts
- Support for debit and credit entries

### 6. Unmatched Payments Dashboard (TASK-PAY-006)

Dashboard showing payments that need manual matching.

**Endpoint:** `GET /api/payments/nigerian/unmatched-dashboard`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUnmatched": 15,
    "totalUnmatchedAmount": 750000,
    "pendingBankTransfers": 8,
    "pendingStatementEntries": 7,
    "pendingPaymentProofs": 3,
    "recentUnmatched": [
      {
        "type": "bank_transfer",
        "id": 123,
        "amount": 50000,
        "reference": "TRF/001234",
        "date": "2024-12-28T10:00:00Z",
        "description": "Zenith Bank"
      }
    ]
  }
}
```

### 7. Payment Proof Upload (TASK-PAY-007)

Members can upload payment proof (screenshots, receipts).

**Endpoint:** `POST /api/payments/nigerian/proofs`

**Request:** Multipart form data with file upload

**Supported File Types:**
- JPEG images
- PNG images
- GIF images
- PDF documents

**Max File Size:** 5MB

### 8. Payment Verification Workflow (TASK-PAY-008)

Admin verifies uploaded payment proofs.

**Endpoint:** `POST /api/payments/nigerian/proofs/:id/verify`

**Request Body:**
```json
{
  "status": "APPROVED",
  "notes": "Payment verified against bank statement"
}
```

Or for rejection:
```json
{
  "status": "REJECTED",
  "rejectionReason": "Amount does not match transaction",
  "notes": "Please upload correct proof"
}
```

**Workflow:**
1. Member uploads payment proof
2. Admin reviews proof
3. Admin approves or rejects
4. If approved, transaction is marked as paid
5. Payment record is created automatically

## Database Schema

### New Models

```prisma
model AssociationBankAccount {
  id              Int         @id @default(autoincrement())
  associationId   Int
  bankName        String
  accountName     String
  accountNumber   String
  bankCode        String?
  isDefault       Boolean     @default(false)
  isActive        Boolean     @default(true)
  description     String?
}

model BankTransfer {
  id                  Int
  associationId       Int
  transactionId       Int?
  bankAccountId       Int?
  memberId            Int?
  senderBankName      String
  senderAccountNumber String?
  senderAccountName   String?
  amount              Decimal
  reference           String
  transferDate        DateTime
  narration           String?
  status              BankTransferStatus
  verifiedBy          Int?
  verifiedAt          DateTime?
}

model BankStatementImport {
  id              Int
  associationId   Int
  bankAccountId   Int
  filename        String
  importDate      DateTime
  totalEntries    Int
  matchedEntries  Int
  unmatchedEntries Int
  status          ImportStatus
}

model BankStatementEntry {
  id                Int
  importId          Int
  transactionDate   DateTime
  reference         String?
  description       String
  debitAmount       Decimal?
  creditAmount      Decimal?
  matchStatus       MatchStatus
  matchedTransactionId Int?
  matchConfidence   Int?
}

model PaymentReconciliation {
  id              Int
  associationId   Int
  transactionId   Int
  statementEntryId Int?
  matchType       ReconciliationMatchType
  matchedAmount   Decimal
  variance        Decimal
  status          ReconciliationStatus
}

model PaymentProof {
  id              Int
  associationId   Int
  transactionId   Int?
  bankTransferId  Int?
  memberId        Int
  filename        String
  filepath        String
  fileSize        Int
  mimeType        String
  status          PaymentProofStatus
  verifiedBy      Int?
  rejectionReason String?
}
```

### Enums

```prisma
enum BankTransferStatus {
  PENDING
  VERIFIED
  MATCHED
  REJECTED
}

enum ImportStatus {
  PROCESSING
  COMPLETED
  FAILED
}

enum MatchStatus {
  UNMATCHED
  AUTO_MATCHED
  MANUAL_MATCHED
  REJECTED
}

enum ReconciliationMatchType {
  AUTO_REFERENCE
  AUTO_AMOUNT
  MANUAL
}

enum ReconciliationStatus {
  PENDING
  CONFIRMED
  DISPUTED
}

enum PaymentProofStatus {
  PENDING
  APPROVED
  REJECTED
}
```

## API Reference

### Bank Accounts

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/payments/nigerian/bank-accounts` | List bank accounts | settings:view |
| GET | `/api/payments/nigerian/bank-accounts/:id` | Get bank account | settings:view |
| POST | `/api/payments/nigerian/bank-accounts` | Create bank account | settings:edit |
| PATCH | `/api/payments/nigerian/bank-accounts/:id` | Update bank account | settings:edit |
| DELETE | `/api/payments/nigerian/bank-accounts/:id` | Delete bank account | settings:edit |

### Bank Transfers

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/payments/nigerian/bank-transfers` | List transfers | payment:view |
| GET | `/api/payments/nigerian/bank-transfers/:id` | Get transfer | payment:view |
| POST | `/api/payments/nigerian/bank-transfers` | Record transfer | payment:create |
| PATCH | `/api/payments/nigerian/bank-transfers/:id` | Update transfer | payment:create |
| POST | `/api/payments/nigerian/bank-transfers/:id/verify` | Verify transfer | payment:confirm |

### Statement Import

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/payments/nigerian/import-statement` | Import statement | finance:create |
| GET | `/api/payments/nigerian/statement-imports` | List imports | finance:view |
| GET | `/api/payments/nigerian/statement-entries` | List entries | finance:view |

### Reconciliation

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/payments/nigerian/reconcile` | Reconcile payment | finance:approve |
| POST | `/api/payments/nigerian/reconciliations/:id/confirm` | Confirm reconciliation | finance:approve |
| GET | `/api/payments/nigerian/reconciliations` | List reconciliations | finance:view |

### Auto-Matching

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/payments/nigerian/auto-match` | Find matches | finance:approve |
| POST | `/api/payments/nigerian/auto-match/apply` | Apply matches | finance:approve |

### Payment Proofs

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/payments/nigerian/proofs` | Upload proof | payment:create |
| GET | `/api/payments/nigerian/proofs` | List proofs | payment:view |
| GET | `/api/payments/nigerian/proofs/:id` | Get proof | payment:view |
| POST | `/api/payments/nigerian/proofs/:id/verify` | Verify proof | payment:confirm |

### Dashboard

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/payments/nigerian/unmatched-dashboard` | Get dashboard | finance:view |

### Utilities

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/payments/nigerian/banks` | List Nigerian banks | finance:view |

## Nigerian Banks Supported

The system includes a comprehensive list of Nigerian banks with their codes:

- Access Bank (044)
- Citibank Nigeria (023)
- Ecobank Nigeria (050)
- Fidelity Bank (070)
- First Bank of Nigeria (011)
- First City Monument Bank (214)
- Guaranty Trust Bank (058)
- Heritage Bank (030)
- Jaiz Bank (301)
- Keystone Bank (082)
- Polaris Bank (076)
- Providus Bank (101)
- Stanbic IBTC Bank (221)
- Standard Chartered Bank (068)
- Sterling Bank (232)
- Union Bank of Nigeria (032)
- United Bank for Africa (033)
- Unity Bank (215)
- Wema Bank (035)
- Zenith Bank (057)

## Usage Examples

### Recording a Bank Transfer

```typescript
// POST /api/payments/nigerian/bank-transfers
const response = await fetch('/api/payments/nigerian/bank-transfers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    transactionId: 123,
    bankAccountId: 1,
    memberId: 45,
    senderBankName: 'Zenith Bank',
    senderAccountNumber: '1234567890',
    senderAccountName: 'John Doe',
    amount: 50000,
    reference: 'TRF/2024/001234',
    transferDate: new Date().toISOString(),
    narration: 'Monthly dues payment'
  })
});
```

### Running Auto-Match

```typescript
// Step 1: Find potential matches
const matchResponse = await fetch('/api/payments/nigerian/auto-match', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await matchResponse.json();

// Step 2: Apply selected matches
const applyResponse = await fetch('/api/payments/nigerian/auto-match/apply', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    matches: data.matches.filter(m => m.confidence >= 90)
  })
});
```

### Uploading Payment Proof

```typescript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('transactionId', '123');
formData.append('notes', 'Payment made on Dec 28');

const response = await fetch('/api/payments/nigerian/proofs', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

## Security Considerations

1. **File Upload Security**
   - File type validation (only images and PDFs)
   - File size limit (5MB)
   - Secure file storage path

2. **Permission-Based Access**
   - Bank account management requires settings:edit
   - Payment verification requires payment:confirm
   - Reconciliation requires finance:approve

3. **Audit Logging**
   - All operations are logged to audit_log table
   - Tracks user, action, old/new values

4. **Tenant Isolation**
   - All queries filtered by associationId
   - Cross-tenant access prevented

## Files Created

```
apps/api/src/modules/nigerian-payments/
├── nigerian-payments.controller.ts  # Request handlers
├── nigerian-payments.routes.ts      # Route definitions
├── nigerian-payments.service.ts     # Business logic
├── nigerian-payments.types.ts       # TypeScript types
└── nigerian-payments.validation.ts  # Zod schemas
```

## Related Documentation

- [Financial Management Patterns](../architecture/financial-management-patterns.md)
- [Phase 3: Financial Management Core](../finances/PHASE3_FINANCIAL_MANAGEMENT_COMPLETE.md)
- [Phase 4: Advanced Features](../finances/FINAN_MANA_IMPLEMENTATION_SUMMARY.md)


## Manual Testing Guide

This section provides step-by-step procedures for manually testing all Nigerian Payment Features using cURL or any API client (Postman, Insomnia, etc.).

### Prerequisites

1. **Running API Server**
   ```bash
   cd apps/api
   npm run dev
   ```
   Server should be running at `http://localhost:4000`

2. **Authentication Token**
   First, login to get a JWT token:
   ```bash
   curl -X POST http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@example.com",
       "password": "your_password"
     }'
   ```
   Save the returned token for subsequent requests.

3. **Set Environment Variables** (optional, for convenience)
   ```bash
   export API_URL="http://localhost:4000"
   export TOKEN="your_jwt_token_here"
   ```

---

### Test 1: Bank Account Management (TASK-PAY-002)

#### 1.1 Get List of Nigerian Banks
```bash
curl -X GET "$API_URL/api/payments/nigerian/banks" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "banks": [
      { "code": "057", "name": "Zenith Bank" },
      { "code": "058", "name": "Guaranty Trust Bank" },
      ...
    ]
  }
}
```

#### 1.2 Create a Bank Account
```bash
curl -X POST "$API_URL/api/payments/nigerian/bank-accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bankName": "Zenith Bank",
    "accountName": "Test Association Account",
    "accountNumber": "1234567890",
    "bankCode": "057",
    "isDefault": true,
    "description": "Main collection account"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Bank account created successfully",
  "data": {
    "id": 1,
    "bankName": "Zenith Bank",
    "accountName": "Test Association Account",
    "accountNumber": "1234567890",
    "bankCode": "057",
    "isDefault": true,
    "isActive": true,
    "description": "Main collection account"
  }
}
```

#### 1.3 List All Bank Accounts
```bash
curl -X GET "$API_URL/api/payments/nigerian/bank-accounts" \
  -H "Authorization: Bearer $TOKEN"
```

#### 1.4 Get Single Bank Account
```bash
curl -X GET "$API_URL/api/payments/nigerian/bank-accounts/1" \
  -H "Authorization: Bearer $TOKEN"
```

#### 1.5 Update Bank Account
```bash
curl -X PATCH "$API_URL/api/payments/nigerian/bank-accounts/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description for main account"
  }'
```

#### 1.6 Create Second Bank Account (for testing multiple accounts)
```bash
curl -X POST "$API_URL/api/payments/nigerian/bank-accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bankName": "GTBank",
    "accountName": "Test Association GTB",
    "accountNumber": "0987654321",
    "bankCode": "058",
    "isDefault": false,
    "description": "Secondary account"
  }'
```

---

### Test 2: Bank Transfer Tracking (TASK-PAY-001)

#### 2.1 Record a Bank Transfer
First, you need a transaction ID. Create a transaction or use an existing one, then:

```bash
curl -X POST "$API_URL/api/payments/nigerian/bank-transfers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": 1,
    "bankAccountId": 1,
    "memberId": 1,
    "senderBankName": "First Bank",
    "senderAccountNumber": "3012345678",
    "senderAccountName": "John Doe",
    "amount": 50000,
    "reference": "TRF/FBN/2024/001234",
    "transferDate": "2024-12-28T10:00:00Z",
    "narration": "Monthly dues payment for December",
    "notes": "Member called to confirm transfer"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Bank transfer recorded successfully",
  "data": {
    "id": 1,
    "transactionId": 1,
    "bankAccountId": 1,
    "memberId": 1,
    "senderBankName": "First Bank",
    "amount": "50000",
    "reference": "TRF/FBN/2024/001234",
    "status": "PENDING",
    ...
  }
}
```

#### 2.2 Record Transfer Without Transaction (Unlinked)
```bash
curl -X POST "$API_URL/api/payments/nigerian/bank-transfers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bankAccountId": 1,
    "senderBankName": "UBA",
    "senderAccountNumber": "2098765432",
    "senderAccountName": "Jane Smith",
    "amount": 25000,
    "reference": "TRF/UBA/2024/005678",
    "transferDate": "2024-12-28T11:30:00Z",
    "narration": "Payment - unknown member"
  }'
```

#### 2.3 List All Bank Transfers
```bash
curl -X GET "$API_URL/api/payments/nigerian/bank-transfers" \
  -H "Authorization: Bearer $TOKEN"
```

#### 2.4 List Transfers with Filters
```bash
# Filter by status
curl -X GET "$API_URL/api/payments/nigerian/bank-transfers?status=PENDING" \
  -H "Authorization: Bearer $TOKEN"

# Filter by date range
curl -X GET "$API_URL/api/payments/nigerian/bank-transfers?startDate=2024-12-01&endDate=2024-12-31" \
  -H "Authorization: Bearer $TOKEN"

# Search by reference
curl -X GET "$API_URL/api/payments/nigerian/bank-transfers?search=TRF/FBN" \
  -H "Authorization: Bearer $TOKEN"
```

#### 2.5 Get Single Bank Transfer
```bash
curl -X GET "$API_URL/api/payments/nigerian/bank-transfers/1" \
  -H "Authorization: Bearer $TOKEN"
```

#### 2.6 Verify Bank Transfer (Admin Action)
```bash
curl -X POST "$API_URL/api/payments/nigerian/bank-transfers/1/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "VERIFIED",
    "notes": "Confirmed against bank statement"
  }'
```

#### 2.7 Reject Bank Transfer
```bash
curl -X POST "$API_URL/api/payments/nigerian/bank-transfers/2/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "REJECTED",
    "notes": "Amount does not match, possible fraud"
  }'
```

---

### Test 3: Bank Statement Import (TASK-PAY-005)

#### 3.1 Import Bank Statement
```bash
curl -X POST "$API_URL/api/payments/nigerian/import-statement" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bankAccountId": 1,
    "filename": "zenith_statement_dec_2024.csv",
    "startDate": "2024-12-01",
    "endDate": "2024-12-31",
    "entries": [
      {
        "transactionDate": "2024-12-05",
        "valueDate": "2024-12-05",
        "reference": "TRF/FBN/2024/001234",
        "description": "TRANSFER FROM JOHN DOE",
        "creditAmount": 50000,
        "balance": 1050000
      },
      {
        "transactionDate": "2024-12-10",
        "valueDate": "2024-12-10",
        "reference": "TRF/GTB/2024/009876",
        "description": "TRANSFER FROM MARY JOHNSON",
        "creditAmount": 75000,
        "balance": 1125000
      },
      {
        "transactionDate": "2024-12-15",
        "reference": "CHQ/001234",
        "description": "CHEQUE DEPOSIT",
        "creditAmount": 100000,
        "balance": 1225000
      },
      {
        "transactionDate": "2024-12-20",
        "description": "BANK CHARGES",
        "debitAmount": 500,
        "balance": 1224500
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Bank statement imported successfully with 4 entries",
  "data": {
    "import": {
      "id": 1,
      "filename": "zenith_statement_dec_2024.csv",
      "totalEntries": 4,
      "status": "COMPLETED"
    },
    "entriesCreated": 4
  }
}
```

#### 3.2 List Statement Imports
```bash
curl -X GET "$API_URL/api/payments/nigerian/statement-imports" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3.3 List Statement Entries
```bash
# All entries
curl -X GET "$API_URL/api/payments/nigerian/statement-entries" \
  -H "Authorization: Bearer $TOKEN"

# Filter by import ID
curl -X GET "$API_URL/api/payments/nigerian/statement-entries?importId=1" \
  -H "Authorization: Bearer $TOKEN"

# Filter by match status
curl -X GET "$API_URL/api/payments/nigerian/statement-entries?matchStatus=UNMATCHED" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Test 4: Payment Reconciliation (TASK-PAY-003)

#### 4.1 Manual Reconciliation
```bash
curl -X POST "$API_URL/api/payments/nigerian/reconcile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": 1,
    "bankTransferId": 1,
    "matchType": "MANUAL",
    "matchedAmount": 50000,
    "variance": 0,
    "notes": "Manually matched by admin after verification"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment reconciled successfully",
  "data": {
    "id": 1,
    "transactionId": 1,
    "matchType": "MANUAL",
    "matchedAmount": "50000",
    "status": "PENDING"
  }
}
```

#### 4.2 Reconcile with Statement Entry
```bash
curl -X POST "$API_URL/api/payments/nigerian/reconcile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": 2,
    "statementEntryId": 2,
    "matchType": "AUTO_REFERENCE",
    "matchedAmount": 75000,
    "notes": "Matched by reference number"
  }'
```

#### 4.3 List Reconciliations
```bash
curl -X GET "$API_URL/api/payments/nigerian/reconciliations" \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl -X GET "$API_URL/api/payments/nigerian/reconciliations?status=PENDING" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4.4 Confirm Reconciliation
```bash
curl -X POST "$API_URL/api/payments/nigerian/reconciliations/1/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CONFIRMED",
    "notes": "Verified and confirmed"
  }'
```

**Note:** Confirming a reconciliation will:
- Update the transaction status to "paid"
- Create a payment record automatically
- Set the payment method to "bank_transfer"

#### 4.5 Dispute Reconciliation
```bash
curl -X POST "$API_URL/api/payments/nigerian/reconciliations/2/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DISPUTED",
    "notes": "Amount mismatch, needs review"
  }'
```

---

### Test 5: Auto-Matching (TASK-PAY-004)

#### 5.1 Run Auto-Match (Preview)
```bash
curl -X POST "$API_URL/api/payments/nigerian/auto-match" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Found 3 potential matches",
  "data": {
    "matched": 3,
    "unmatched": 2,
    "matches": [
      {
        "transactionId": 5,
        "bankTransferId": 3,
        "confidence": 100,
        "matchType": "AUTO_REFERENCE"
      },
      {
        "transactionId": 6,
        "statementEntryId": 4,
        "confidence": 90,
        "matchType": "AUTO_AMOUNT"
      }
    ]
  }
}
```

#### 5.2 Apply Selected Auto-Matches
```bash
curl -X POST "$API_URL/api/payments/nigerian/auto-match/apply" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "matches": [
      {
        "transactionId": 5,
        "bankTransferId": 3,
        "confidence": 100,
        "matchType": "AUTO_REFERENCE"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Applied 1 matches, 0 failed",
  "data": {
    "successful": 1,
    "failed": 0,
    "results": [
      {
        "success": true,
        "reconciliationId": 3,
        "transactionId": 5,
        "bankTransferId": 3
      }
    ]
  }
}
```

---

### Test 6: Payment Proof Upload (TASK-PAY-007)

#### 6.1 Upload Payment Proof (with file)
```bash
curl -X POST "$API_URL/api/payments/nigerian/proofs" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/payment_screenshot.jpg" \
  -F "transactionId=1" \
  -F "notes=Payment made via mobile banking"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment proof uploaded successfully",
  "data": {
    "id": 1,
    "transactionId": 1,
    "filename": "payment_screenshot.jpg",
    "fileSize": 245678,
    "mimeType": "image/jpeg",
    "status": "PENDING"
  }
}
```

#### 6.2 Upload Proof for Bank Transfer
```bash
curl -X POST "$API_URL/api/payments/nigerian/proofs" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/bank_receipt.pdf" \
  -F "bankTransferId=2" \
  -F "notes=Official bank receipt"
```

#### 6.3 List Payment Proofs
```bash
# All proofs
curl -X GET "$API_URL/api/payments/nigerian/proofs" \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl -X GET "$API_URL/api/payments/nigerian/proofs?status=PENDING" \
  -H "Authorization: Bearer $TOKEN"

# Filter by member
curl -X GET "$API_URL/api/payments/nigerian/proofs?memberId=1" \
  -H "Authorization: Bearer $TOKEN"
```

#### 6.4 Get Single Payment Proof
```bash
curl -X GET "$API_URL/api/payments/nigerian/proofs/1" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Test 7: Payment Verification Workflow (TASK-PAY-008)

#### 7.1 Approve Payment Proof
```bash
curl -X POST "$API_URL/api/payments/nigerian/proofs/1/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "APPROVED",
    "notes": "Payment verified against bank statement"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment proof approved successfully",
  "data": {
    "id": 1,
    "status": "APPROVED",
    "verifiedAt": "2024-12-28T14:30:00Z"
  }
}
```

**Note:** Approving a payment proof will:
- Update the linked transaction status to "paid"
- Create a payment record automatically
- Update linked bank transfer status to "VERIFIED"

#### 7.2 Reject Payment Proof
```bash
curl -X POST "$API_URL/api/payments/nigerian/proofs/2/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "REJECTED",
    "rejectionReason": "Screenshot is blurry and amount is not visible",
    "notes": "Please upload a clearer image"
  }'
```

---

### Test 8: Unmatched Payments Dashboard (TASK-PAY-006)

#### 8.1 Get Dashboard Data
```bash
curl -X GET "$API_URL/api/payments/nigerian/unmatched-dashboard" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalUnmatched": 5,
    "totalUnmatchedAmount": "175000",
    "pendingBankTransfers": 3,
    "pendingStatementEntries": 2,
    "pendingPaymentProofs": 4,
    "recentUnmatched": [
      {
        "type": "bank_transfer",
        "id": 5,
        "amount": "50000",
        "reference": "TRF/ZEN/2024/001111",
        "date": "2024-12-27T09:00:00Z",
        "description": "Zenith Bank"
      },
      {
        "type": "statement_entry",
        "id": 8,
        "amount": "25000",
        "reference": "TRF/ACC/2024/002222",
        "date": "2024-12-26T15:30:00Z",
        "description": "TRANSFER FROM UNKNOWN"
      }
    ]
  }
}
```

---

### Complete Test Workflow

Here's a complete end-to-end test workflow:

```bash
# 1. Setup: Create bank account
curl -X POST "$API_URL/api/payments/nigerian/bank-accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bankName":"Zenith Bank","accountName":"Test Assoc","accountNumber":"1234567890","bankCode":"057","isDefault":true}'

# 2. Create a financial transaction (use existing finance API)
# Assume transaction ID 10 exists with amount 50000

# 3. Record bank transfer
curl -X POST "$API_URL/api/payments/nigerian/bank-transfers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"transactionId":10,"bankAccountId":1,"senderBankName":"GTBank","amount":50000,"reference":"TRF/GTB/TEST/001","transferDate":"2024-12-28T10:00:00Z"}'

# 4. Import bank statement with matching entry
curl -X POST "$API_URL/api/payments/nigerian/import-statement" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bankAccountId":1,"filename":"test.csv","entries":[{"transactionDate":"2024-12-28","reference":"TRF/GTB/TEST/001","description":"TRANSFER","creditAmount":50000}]}'

# 5. Run auto-match
curl -X POST "$API_URL/api/payments/nigerian/auto-match" \
  -H "Authorization: Bearer $TOKEN"

# 6. Apply matches (use IDs from step 5 response)
curl -X POST "$API_URL/api/payments/nigerian/auto-match/apply" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"matches":[{"transactionId":10,"bankTransferId":1,"confidence":100,"matchType":"AUTO_REFERENCE"}]}'

# 7. Confirm reconciliation
curl -X POST "$API_URL/api/payments/nigerian/reconciliations/1/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"CONFIRMED"}'

# 8. Verify transaction is now paid
curl -X GET "$API_URL/api/finance/transactions/10" \
  -H "Authorization: Bearer $TOKEN"
# Should show status: "paid"
```

---

### Error Scenarios to Test

#### Duplicate Bank Account
```bash
# Try creating account with same account number - should fail
curl -X POST "$API_URL/api/payments/nigerian/bank-accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bankName":"GTBank","accountName":"Duplicate","accountNumber":"1234567890","bankCode":"058"}'
```
**Expected:** 400 error - "A bank account with this account number already exists"

#### Duplicate Transfer Reference
```bash
# Try creating transfer with same reference - should fail
curl -X POST "$API_URL/api/payments/nigerian/bank-transfers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"senderBankName":"Test","amount":1000,"reference":"TRF/FBN/2024/001234","transferDate":"2024-12-28T10:00:00Z"}'
```
**Expected:** 400 error - "A bank transfer with this reference already exists"

#### Invalid File Type Upload
```bash
curl -X POST "$API_URL/api/payments/nigerian/proofs" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/document.docx" \
  -F "transactionId=1"
```
**Expected:** 400 error - "Invalid file type"

#### Reject Without Reason
```bash
curl -X POST "$API_URL/api/payments/nigerian/proofs/1/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"REJECTED"}'
```
**Expected:** 400 error - "Rejection reason is required when rejecting"

---

### Postman Collection

For easier testing, import this Postman collection structure:

```
Nigerian Payments
├── Bank Accounts
│   ├── List Banks
│   ├── Create Account
│   ├── List Accounts
│   ├── Get Account
│   ├── Update Account
│   └── Delete Account
├── Bank Transfers
│   ├── Create Transfer
│   ├── List Transfers
│   ├── Get Transfer
│   ├── Update Transfer
│   └── Verify Transfer
├── Statement Import
│   ├── Import Statement
│   ├── List Imports
│   └── List Entries
├── Reconciliation
│   ├── Reconcile Payment
│   ├── List Reconciliations
│   └── Confirm Reconciliation
├── Auto-Match
│   ├── Run Auto-Match
│   └── Apply Matches
├── Payment Proofs
│   ├── Upload Proof
│   ├── List Proofs
│   ├── Get Proof
│   └── Verify Proof
└── Dashboard
    └── Get Unmatched Dashboard
```

Set up environment variables in Postman:
- `baseUrl`: `http://localhost:4000`
- `token`: Your JWT token


---

## Frontend Implementation

The Nigerian Payment Features include a complete frontend UI built with Next.js 14 and Mantine UI.

### Frontend Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/dashboard/finance/payments/nigerian` | Main dashboard with stats and quick links |
| Bank Accounts | `/dashboard/finance/payments/nigerian/bank-accounts` | Manage receiving bank accounts |
| Bank Transfers | `/dashboard/finance/payments/nigerian/bank-transfers` | Track and verify bank transfers |
| Statements | `/dashboard/finance/payments/nigerian/statements` | Import and view bank statements |
| Reconciliation | `/dashboard/finance/payments/nigerian/reconciliation` | Match payments and run auto-match |
| Payment Proofs | `/dashboard/finance/payments/nigerian/proofs` | Review and verify payment proofs |

### Frontend Files

```
apps/web/src/
├── lib/api/
│   └── nigerian-payments.ts          # API client with TypeScript types
└── app/dashboard/finance/payments/nigerian/
    ├── page.tsx                       # Main dashboard
    ├── bank-accounts/page.tsx         # Bank accounts management
    ├── bank-transfers/page.tsx        # Bank transfers tracking
    ├── statements/page.tsx            # Statement import
    ├── reconciliation/page.tsx        # Reconciliation & auto-match
    └── proofs/page.tsx                # Payment proofs verification
```

### Key Features

1. **Dashboard**
   - Stats cards showing unmatched payments, pending transfers, pending proofs
   - Quick action links to all sub-pages
   - Recent unmatched payments table
   - Pending payment proofs table
   - Bank accounts summary

2. **Bank Accounts Management**
   - Create/Edit/Delete bank accounts
   - Nigerian banks dropdown with auto-fill bank codes
   - Set default account
   - View account usage stats

3. **Bank Transfers**
   - Record new bank transfers
   - Filter by status, date range, search
   - Verify/Reject transfers
   - View transfer details

4. **Statement Import**
   - CSV file upload with client-side parsing
   - Preview parsed entries before import
   - View import history
   - Filter statement entries by match status

5. **Reconciliation**
   - View all reconciliations with status
   - Run auto-match to find potential matches
   - Select and apply matches with confidence scores
   - Confirm or dispute reconciliations

6. **Payment Proofs**
   - Upload payment proof images/PDFs
   - View proof details and preview
   - Approve or reject with reason
   - Filter by status

### UI Components Used

- **Mantine UI**: Card, Table, Modal, Badge, Button, Select, TextInput, FileInput
- **Mantine Dates**: DatePickerInput
- **Tabler Icons**: Various icons for actions and status indicators
- **TanStack Query**: Data fetching and caching
- **Mantine Notifications**: Toast notifications for success/error messages


---

## UI Navigation Guide

This section provides step-by-step instructions for manually testing the Nigerian Payment Features through the web interface.

### Prerequisites

1. **Start the Development Servers**
   ```bash
   # Terminal 1: Start the API server
   cd apps/api
   npm run dev
   # Server runs at http://localhost:4000

   # Terminal 2: Start the Web app
   cd apps/web
   npm run dev
   # App runs at http://localhost:3000
   ```

2. **Login to the Application**
   - Open `http://localhost:3000` in your browser
   - Login with admin credentials
   - You should be redirected to the dashboard

### Navigating to Nigerian Payments

1. **From the Sidebar**
   - Look at the left sidebar
   - Click on **"Finance"** to expand the Finance menu
   - Click on **"Bank Payments"** (last item in the Finance submenu)
   - You'll be taken to `/dashboard/finance/payments/nigerian`

2. **Direct URL Access**
   - You can also navigate directly to: `http://localhost:3000/dashboard/finance/payments/nigerian`

### Testing Each Feature

#### 1. Nigerian Payments Dashboard
**Path:** `/dashboard/finance/payments/nigerian`

**What to Test:**
- View the stats cards showing:
  - Total Unmatched Payments
  - Pending Bank Transfers
  - Pending Payment Proofs
  - Total Unmatched Amount
- Check the "Recent Unmatched Payments" table
- Check the "Pending Payment Proofs" table
- Check the "Bank Accounts" summary
- Click on quick action links to navigate to sub-pages

#### 2. Bank Accounts Management
**Path:** `/dashboard/finance/payments/nigerian/bank-accounts`

**What to Test:**
1. Click **"Add Bank Account"** button
2. Fill in the form:
   - Select a bank from the dropdown (e.g., "Zenith Bank")
   - Bank code should auto-fill
   - Enter account name: "Test Association Account"
   - Enter account number: "1234567890"
   - Add description (optional)
   - Toggle "Set as default account" if desired
3. Click **"Create Account"**
4. Verify the account appears in the table
5. Click the edit icon to modify the account
6. Click the delete icon to remove (will soft-delete if has transactions)

#### 3. Bank Transfers Tracking
**Path:** `/dashboard/finance/payments/nigerian/bank-transfers`

**What to Test:**
1. Click **"Record Transfer"** button
2. Fill in the transfer details:
   - Select bank account (receiving account)
   - Enter sender bank name
   - Enter sender account number
   - Enter sender account name
   - Enter amount
   - Enter reference number
   - Select transfer date
   - Add narration/notes
3. Click **"Record Transfer"**
4. Use the filters to search:
   - Filter by status (Pending, Verified, Matched, Rejected)
   - Filter by date range
   - Search by reference or sender name
5. Click on a transfer to view details
6. Click **"Verify"** to approve a transfer
7. Click **"Reject"** to reject a transfer (requires reason)

#### 4. Bank Statement Import
**Path:** `/dashboard/finance/payments/nigerian/statements`

**What to Test:**
1. Click **"Import Statement"** button
2. Select the bank account
3. Upload a CSV file with bank statement data
   - The CSV should have columns: Date, Reference, Description, Debit, Credit, Balance
4. Preview the parsed entries
5. Click **"Import"** to save
6. View the import history in the "Statement Imports" table
7. Click on an import to view its entries
8. Filter entries by match status

**Sample CSV Format:**
```csv
Date,Reference,Description,Debit,Credit,Balance
2024-12-01,TRF/001,Transfer from John Doe,,50000,1050000
2024-12-02,TRF/002,Transfer from Jane Smith,,25000,1075000
2024-12-03,CHG/001,Bank Charges,500,,1074500
```

#### 5. Payment Reconciliation
**Path:** `/dashboard/finance/payments/nigerian/reconciliation`

**What to Test:**
1. View the list of reconciliations
2. Click **"Run Auto-Match"** button
3. Review the potential matches found:
   - Check confidence scores (100% = reference match, 70-90% = amount match)
   - Select matches to apply
4. Click **"Apply Selected Matches"**
5. View the created reconciliations
6. Click **"Confirm"** to finalize a reconciliation
7. Click **"Dispute"** if there's an issue

#### 6. Payment Proofs Verification
**Path:** `/dashboard/finance/payments/nigerian/proofs`

**What to Test:**
1. Click **"Upload Proof"** button
2. Select a transaction or bank transfer to link
3. Upload an image (JPG, PNG) or PDF file
4. Add notes about the payment
5. Click **"Upload"**
6. View the uploaded proof in the table
7. Click on a proof to view details and preview
8. As admin, click **"Approve"** to verify the payment
9. Or click **"Reject"** and provide a rejection reason

### Complete Test Workflow (UI)

Follow this sequence to test the full payment flow:

1. **Setup Bank Account**
   - Go to Bank Accounts page
   - Create a new bank account for your association

2. **Record a Bank Transfer**
   - Go to Bank Transfers page
   - Record a transfer with a unique reference number
   - Note the reference number for later

3. **Import Bank Statement**
   - Go to Statements page
   - Import a CSV with an entry matching the transfer reference

4. **Run Auto-Match**
   - Go to Reconciliation page
   - Click "Run Auto-Match"
   - The system should find a match with 100% confidence
   - Apply the match

5. **Confirm Reconciliation**
   - Find the new reconciliation in the list
   - Click "Confirm" to finalize
   - The linked transaction should now be marked as "paid"

6. **Upload Payment Proof (Alternative Flow)**
   - Go to Payment Proofs page
   - Upload a screenshot of the bank transfer
   - Link it to a transaction
   - Approve the proof
   - The transaction should be marked as "paid"

7. **Check Dashboard**
   - Return to the main Nigerian Payments dashboard
   - Verify the stats have updated
   - Unmatched counts should decrease

### Troubleshooting

**Issue: "Bank Payments" not showing in sidebar**
- Make sure you're logged in with an account that has Finance permissions
- Try refreshing the page
- Check browser console for errors

**Issue: API errors when loading pages**
- Verify the API server is running on port 4000
- Check that the database migrations have been applied
- Look at the API server logs for error details

**Issue: File upload fails**
- Ensure file is under 5MB
- Only JPG, PNG, GIF, and PDF files are supported
- Check that the uploads directory exists and is writable

**Issue: Auto-match finds no matches**
- Ensure there are unmatched bank transfers or statement entries
- Check that reference numbers match exactly
- Verify amounts are the same for amount-based matching

### Browser Developer Tools

For debugging, open browser DevTools (F12) and check:
- **Network tab**: View API requests and responses
- **Console tab**: Check for JavaScript errors
- **Application tab**: View stored authentication tokens

