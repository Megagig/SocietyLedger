# Member Finance Self-Service - API Reference

## Base URL

```
/api/members/me
```

## Authentication

All endpoints require:
- Valid JWT token in `Authorization: Bearer <token>` header
- Association context via `X-Tenant-Id` header or subdomain
- `MEMBER_FINANCE_VIEW` permission

## Endpoints

---

### Get Finance Summary

Returns comprehensive overview of member's financial status.

```http
GET /api/members/me/finance-summary
```

#### Response

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
    "upcomingPayments": [
      {
        "id": 5,
        "category": { "id": 1, "name": "Monthly Dues", "type": "due" },
        "amount": 5000,
        "balance": 5000,
        "dueDate": "2025-02-28T00:00:00.000Z",
        "status": "pending"
      }
    ],
    "recentTransactions": [
      {
        "id": 1,
        "category": { "id": 1, "name": "Monthly Dues", "type": "due" },
        "amount": 5000,
        "paid": 5000,
        "balance": 0,
        "status": "paid",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Error Responses

| Status | Message |
|--------|---------|
| 400 | Authentication required |
| 404 | Member profile not found |
| 500 | Failed to fetch finance summary |

---

### Get Dues

Returns all dues assigned to the member.

```http
GET /api/members/me/dues
```

#### Response

```json
{
  "success": true,
  "data": {
    "dues": [
      {
        "id": 1,
        "referenceNumber": "TXN000001",
        "category": {
          "id": 1,
          "name": "Monthly Dues",
          "type": "due",
          "frequency": "monthly"
        },
        "amount": 5000,
        "paid": 5000,
        "balance": 0,
        "dueDate": "2025-01-31T00:00:00.000Z",
        "status": "paid",
        "isOverdue": false,
        "payments": [
          {
            "id": 1,
            "amountPaid": 5000,
            "paymentDate": "2025-01-15T10:30:00.000Z",
            "paymentMethod": "bank_transfer"
          }
        ],
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### Get Levies

Returns all levy campaign assignments for the member.

```http
GET /api/members/me/levies
```

#### Response

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
          "description": "New office building construction",
          "targetAmount": 5000000,
          "deadline": "2025-06-30T00:00:00.000Z",
          "status": "ACTIVE",
          "category": { "id": 3, "name": "Building Levy" }
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

---

### Get Penalties

Returns all penalties assigned to the member.

```http
GET /api/members/me/penalties
```

#### Response

```json
{
  "success": true,
  "data": {
    "penalties": [
      {
        "id": 10,
        "referenceNumber": "TXN000010",
        "category": {
          "id": 5,
          "name": "Late Payment Fee",
          "type": "penalty"
        },
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

---

### Get Donations

Returns donation history and available donation categories.

```http
GET /api/members/me/donations
```

#### Response

```json
{
  "success": true,
  "data": {
    "donations": [
      {
        "id": 20,
        "referenceNumber": "TXN000020",
        "category": {
          "id": 10,
          "name": "General Fund",
          "type": "donation"
        },
        "amount": 10000,
        "purpose": "General Fund",
        "isAnonymous": false,
        "receiptNumber": "DON000001",
        "payments": [
          {
            "id": 15,
            "amountPaid": 10000,
            "paymentDate": "2025-01-20T14:00:00.000Z",
            "paymentMethod": "bank_transfer"
          }
        ],
        "createdAt": "2025-01-20T14:00:00.000Z"
      }
    ],
    "donationCategories": [
      {
        "id": 10,
        "name": "General Fund",
        "description": "Support general association operations"
      },
      {
        "id": 11,
        "name": "Welfare Fund",
        "description": "Member welfare and emergency support"
      }
    ]
  }
}
```

---

### Get Payment History

Returns the member's payment history.

```http
GET /api/members/me/payments
```

#### Response

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
          "category": {
            "id": 1,
            "name": "Monthly Dues",
            "type": "due"
          }
        },
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

---

### Get Outstanding Items

Returns all outstanding items available for payment.

```http
GET /api/members/me/outstanding
```

#### Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 5,
        "type": "dues",
        "category": {
          "id": 1,
          "name": "Monthly Dues",
          "type": "due"
        },
        "campaign": null,
        "amount": 5000,
        "balance": 5000,
        "dueDate": "2025-02-28T00:00:00.000Z"
      },
      {
        "id": 15,
        "type": "levy",
        "category": {
          "id": 3,
          "name": "Building Levy",
          "type": "levy"
        },
        "campaign": {
          "name": "Building Fund"
        },
        "amount": 50000,
        "balance": 25000,
        "dueDate": "2025-06-30T00:00:00.000Z"
      }
    ]
  }
}
```

---

### Process Payment

Process payment for selected transactions.

```http
POST /api/members/me/pay
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| transactionIds | number[] | Yes | Array of transaction IDs to pay |
| paymentMethod | string | Yes | Payment method enum |
| reference | string | No | Payment reference/receipt number |
| notes | string | No | Additional notes |

**Payment Methods:**
- `BANK_TRANSFER`
- `CASH`
- `CARD`
- `POS`
- `MOBILE_MONEY`

#### Request Example

```json
{
  "transactionIds": [5, 15],
  "paymentMethod": "BANK_TRANSFER",
  "reference": "REF123456",
  "notes": "Payment for February dues and building levy"
}
```

#### Response

```json
{
  "success": true,
  "message": "Successfully recorded 2 payment(s)",
  "data": {
    "payments": [
      {
        "id": 20,
        "associationId": 1,
        "transactionId": 5,
        "amountPaid": 5000,
        "paymentDate": "2025-02-15T10:00:00.000Z",
        "paymentMethod": "bank_transfer",
        "receiptNumber": "PAY000020",
        "confirmedBy": 10,
        "confirmedAt": "2025-02-15T10:00:00.000Z"
      },
      {
        "id": 21,
        "associationId": 1,
        "transactionId": 15,
        "amountPaid": 25000,
        "paymentDate": "2025-02-15T10:00:00.000Z",
        "paymentMethod": "bank_transfer",
        "receiptNumber": "PAY000021",
        "confirmedBy": 10,
        "confirmedAt": "2025-02-15T10:00:00.000Z"
      }
    ]
  }
}
```

#### Error Responses

| Status | Message |
|--------|---------|
| 400 | Validation error |
| 400 | Some transactions not found or already paid |
| 404 | Member profile not found |
| 500 | Failed to process payment |

---

### Make Donation

Create a new donation.

```http
POST /api/members/me/donate
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| categoryId | number | Yes | Donation category ID |
| amount | number | Yes | Donation amount (positive) |
| paymentMethod | string | Yes | Payment method enum |
| reference | string | No | Payment reference |
| notes | string | No | Additional notes |
| isAnonymous | boolean | No | Make donation anonymous (default: false) |

#### Request Example

```json
{
  "categoryId": 10,
  "amount": 25000,
  "paymentMethod": "BANK_TRANSFER",
  "isAnonymous": false
}
```

#### Response

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

#### Error Responses

| Status | Message |
|--------|---------|
| 400 | Validation error |
| 404 | Member profile not found |
| 404 | Donation category not found |
| 500 | Failed to record donation |

---

## Data Types

### Transaction Status

| Value | Description |
|-------|-------------|
| pending | Not yet paid |
| partial | Partially paid |
| paid | Fully paid |
| overdue | Past due date, not fully paid |
| waived | Waived by admin |

### Category Type

| Value | Description |
|-------|-------------|
| due | Regular membership dues |
| levy | Special levy/contribution |
| penalty | Late fee or fine |
| donation | Voluntary donation |

### Levy Campaign Status

| Value | Description |
|-------|-------------|
| DRAFT | Not yet active |
| ACTIVE | Currently accepting contributions |
| COMPLETED | Target reached or deadline passed |
| CANCELLED | Campaign cancelled |

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "path": ["field"],
      "message": "Validation message"
    }
  ]
}
```

---

## Rate Limiting

No specific rate limits for member finance endpoints. Standard API rate limits apply.

---

## Audit Logging

The following actions create audit log entries:

| Action | Table | Description |
|--------|-------|-------------|
| MEMBER_PAYMENT | payments | Payment processed by member |
| MEMBER_DONATION | donations | Donation made by member |

Audit logs include:
- User ID
- Association ID
- Timestamp
- Action details
- New values
