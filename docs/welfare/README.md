# Welfare & Social Funds Module Documentation

**Phase:** 5.5  
**Status:** ✅ Complete  
**Last Updated:** December 28, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Reference](#api-reference)
5. [Frontend Pages](#frontend-pages)
6. [Permissions & Access Control](#permissions--access-control)
7. [Business Logic](#business-logic)
8. [Integration Points](#integration-points)

---

## Overview

The Welfare & Social Funds module enables associations to manage welfare contributions and support payouts for their members. This is a key feature for Nigerian/African market associations where mutual support systems (bereavement, medical emergencies, education, etc.) are culturally significant.

### Key Features

- **Multiple Fund Types:** Support for various welfare categories (General, Bereavement, Medical, Education, Emergency, Maternity, Wedding)
- **Contribution Management:** Record, track, and confirm member contributions
- **Payout Request Workflow:** Multi-step approval process for welfare disbursements
- **Eligibility Rules:** Configurable waiting periods and minimum contribution requirements
- **Member Profiles:** Track individual welfare participation and eligibility
- **Dashboard Analytics:** Real-time fund balances, participation rates, and pending actions

### Target Users

| Role | Capabilities |
|------|-------------|
| **Admin** | Full management of funds, contributions, and payouts |
| **Treasurer** | Financial management, approve/disburse payouts |
| **Financial Secretary** | Record contributions, view reports |
| **Member** | View own contributions, request payouts |

---

## Architecture

### Module Structure

```
apps/api/src/modules/welfare/
├── index.ts                 # Module exports
├── welfare.controller.ts    # HTTP request handlers
├── welfare.service.ts       # Business logic
├── welfare.routes.ts        # Route definitions
├── welfare.validation.ts    # Zod schemas
└── welfare.types.ts         # TypeScript interfaces

apps/web/src/app/dashboard/welfare/
├── page.tsx                 # Main dashboard
├── social-funds/page.tsx    # Fund management
├── contributions/page.tsx   # Contribution tracking
└── requests/page.tsx        # Payout requests

apps/web/src/lib/api/
└── welfare.ts               # API client functions
```

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Express   │────▶│   Prisma    │
│   (Next.js) │     │   Backend   │     │  (Postgres) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
   API Client         Controller           Database
   (welfare.ts)       + Service            Models
```

---

## Database Schema

### WelfareFund Model

```prisma
model WelfareFund {
  id                      Int                    @id @default(autoincrement())
  associationId           Int                    @map("association_id")
  name                    String
  description             String?
  fundType                WelfareFundType        @default(GENERAL)
  targetBalance           Decimal?               @db.Decimal(12, 2)
  currentBalance          Decimal                @default(0) @db.Decimal(12, 2)
  monthlyContribution     Decimal?               @db.Decimal(12, 2)
  isContributionMandatory Boolean                @default(false)
  minContribution         Decimal?               @db.Decimal(12, 2)
  maxPayout               Decimal?               @db.Decimal(12, 2)
  waitingPeriodDays       Int                    @default(0)
  minContributionMonths   Int                    @default(0)
  status                  WelfareFundStatus      @default(ACTIVE)
  createdBy               Int
  createdAt               DateTime               @default(now())
  updatedAt               DateTime               @updatedAt
  
  // Relations
  association             Association
  creator                 User
  contributions           WelfareContribution[]
  payoutRequests          WelfarePayoutRequest[]
}
```

### WelfareContribution Model

```prisma
model WelfareContribution {
  id               Int                       @id @default(autoincrement())
  associationId    Int
  fundId           Int
  memberId         Int
  amount           Decimal                   @db.Decimal(12, 2)
  contributionDate DateTime
  paymentMethod    String?
  reference        String?
  notes            String?
  status           WelfareContributionStatus @default(PENDING)
  confirmedBy      Int?
  confirmedAt      DateTime?
  createdAt        DateTime                  @default(now())
  updatedAt        DateTime                  @updatedAt
  
  // Relations
  association      Association
  fund             WelfareFund
  member           Member
  confirmer        User?
}
```

### WelfarePayoutRequest Model

```prisma
model WelfarePayoutRequest {
  id                    Int                 @id @default(autoincrement())
  associationId         Int
  fundId                Int
  memberId              Int
  requestNumber         String              // Auto-generated: WPR000001
  payoutType            WelfarePayoutType
  amount                Decimal             @db.Decimal(12, 2)
  reason                String
  supportingDocuments   String?
  status                WelfarePayoutStatus @default(PENDING)
  reviewedBy            Int?
  reviewedAt            DateTime?
  reviewComments        String?
  approvedBy            Int?
  approvedAt            DateTime?
  approvedAmount        Decimal?            @db.Decimal(12, 2)
  rejectionReason       String?
  disbursedBy           Int?
  disbursedAt           DateTime?
  disbursementMethod    String?
  disbursementReference String?
  requestedAt           DateTime            @default(now())
  
  // Relations
  association           Association
  fund                  WelfareFund
  member                Member
  reviewer              User?
  approver              User?
  disburser             User?
}
```

### Enums

```prisma
enum WelfareFundType {
  GENERAL      // General welfare fund
  BEREAVEMENT  // Death/funeral support
  MEDICAL      // Medical emergencies
  EDUCATION    // Educational support
  EMERGENCY    // General emergencies
  MATERNITY    // Childbirth support
  WEDDING      // Marriage support
}

enum WelfareFundStatus {
  ACTIVE
  SUSPENDED
  CLOSED
}

enum WelfareContributionStatus {
  PENDING
  CONFIRMED
  REJECTED
}

enum WelfarePayoutType {
  BEREAVEMENT
  MEDICAL
  EDUCATION
  EMERGENCY
  MATERNITY
  WEDDING
  OTHER
}

enum WelfarePayoutStatus {
  PENDING       // Awaiting review
  UNDER_REVIEW  // Being reviewed
  APPROVED      // Approved, awaiting disbursement
  REJECTED      // Request rejected
  DISBURSED     // Payment made
  CANCELLED     // Cancelled by requester
}
```

---

## API Reference

### Base URL
```
/api/welfare
```

### Authentication
All endpoints require JWT authentication via the `authMiddleware`.

### Dashboard Endpoints

#### GET /dashboard
Get welfare dashboard statistics.

**Permissions:** `WELFARE_VIEW` or `WELFARE_MANAGE`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalFunds": 5,
    "activeFunds": 4,
    "totalBalance": "500000.00",
    "totalContributions": "1200000.00",
    "totalPayouts": "700000.00",
    "pendingPayoutRequests": 3,
    "memberParticipationRate": 75
  }
}
```

#### GET /fund-summaries
Get summary statistics for all funds.

**Permissions:** `WELFARE_VIEW` or `WELFARE_MANAGE`

#### GET /eligibility
Check member eligibility for a specific fund.

**Query Parameters:**
- `fundId` (required): Fund ID
- `memberId` (optional): Member ID (defaults to current user's member)

**Response:**
```json
{
  "success": true,
  "data": {
    "isEligible": true,
    "reason": null
  }
}
```

#### GET /my-profile
Get current user's welfare profile.

**Permissions:** `WELFARE_VIEW`

#### GET /members/:memberId/profile
Get a specific member's welfare profile (admin view).

**Permissions:** `WELFARE_MANAGE`

---

### Welfare Fund Endpoints

#### GET /funds
List all welfare funds with pagination and filtering.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `fundType` (optional): Filter by fund type
- `status` (optional): Filter by status
- `search` (optional): Search by name/description

**Permissions:** `WELFARE_VIEW` or `WELFARE_MANAGE`

#### POST /funds
Create a new welfare fund.

**Permissions:** `WELFARE_MANAGE`

**Request Body:**
```json
{
  "name": "Bereavement Support Fund",
  "description": "Support for members who lose loved ones",
  "fundType": "BEREAVEMENT",
  "targetBalance": 1000000,
  "monthlyContribution": 5000,
  "isContributionMandatory": true,
  "minContribution": 1000,
  "maxPayout": 100000,
  "waitingPeriodDays": 90,
  "minContributionMonths": 3
}
```

#### GET /funds/:id
Get a single welfare fund with statistics.

**Permissions:** `WELFARE_VIEW` or `WELFARE_MANAGE`

#### PUT /funds/:id
Update a welfare fund.

**Permissions:** `WELFARE_MANAGE`

#### DELETE /funds/:id
Delete a welfare fund (only if no confirmed contributions or pending payouts).

**Permissions:** `WELFARE_MANAGE`

---

### Contribution Endpoints

#### GET /contributions
List contributions with filtering.

**Query Parameters:**
- `page`, `limit`
- `fundId` (optional)
- `memberId` (optional)
- `status` (optional)
- `startDate`, `endDate` (optional)

**Permissions:** `WELFARE_CONTRIBUTION_VIEW` or `WELFARE_CONTRIBUTION_MANAGE`

#### POST /contributions
Record a single contribution.

**Permissions:** `WELFARE_CONTRIBUTION_MANAGE`

**Request Body:**
```json
{
  "fundId": 1,
  "memberId": 5,
  "amount": 5000,
  "contributionDate": "2025-12-28",
  "paymentMethod": "bank_transfer",
  "reference": "TRF123456",
  "notes": "December contribution"
}
```

#### POST /contributions/bulk
Record contributions for multiple members.

**Permissions:** `WELFARE_CONTRIBUTION_MANAGE`

**Request Body:**
```json
{
  "fundId": 1,
  "memberIds": [1, 2, 3, 4, 5],
  "amount": 5000,
  "contributionDate": "2025-12-28",
  "paymentMethod": "cash",
  "notes": "Monthly meeting collection"
}
```

#### POST /contributions/:id/confirm
Confirm or reject a pending contribution.

**Permissions:** `WELFARE_CONTRIBUTION_CONFIRM`

**Request Body:**
```json
{
  "status": "CONFIRMED",
  "notes": "Verified payment receipt"
}
```

---

### Payout Request Endpoints

#### GET /payouts
List payout requests with filtering.

**Query Parameters:**
- `page`, `limit`
- `fundId`, `memberId` (optional)
- `status`, `payoutType` (optional)
- `startDate`, `endDate` (optional)

**Permissions:** `WELFARE_PAYOUT_VIEW` or `WELFARE_PAYOUT_APPROVE`

#### POST /payouts
Create a payout request.

**Permissions:** `WELFARE_PAYOUT_REQUEST`

**Request Body:**
```json
{
  "fundId": 1,
  "payoutType": "MEDICAL",
  "amount": 50000,
  "reason": "Hospital bills for surgery",
  "supportingDocuments": "https://drive.google.com/..."
}
```

#### POST /payouts/bereavement
Create a bereavement support request (special workflow).

**Permissions:** `WELFARE_PAYOUT_REQUEST`

**Request Body:**
```json
{
  "fundId": 1,
  "amount": 100000,
  "deceasedName": "John Doe",
  "relationship": "Father",
  "dateOfDeath": "2025-12-25",
  "supportingDocuments": "Death certificate link"
}
```

#### POST /payouts/:id/review
Review (approve/reject) a payout request.

**Permissions:** `WELFARE_PAYOUT_APPROVE`

**Request Body:**
```json
{
  "status": "APPROVED",
  "approvedAmount": 50000,
  "comments": "Approved as requested"
}
```

Or for rejection:
```json
{
  "status": "REJECTED",
  "rejectionReason": "Insufficient documentation provided"
}
```

#### POST /payouts/:id/disburse
Disburse an approved payout.

**Permissions:** `WELFARE_PAYOUT_DISBURSE`

**Request Body:**
```json
{
  "disbursementMethod": "bank_transfer",
  "disbursementReference": "TRF789012",
  "notes": "Transferred to member's account"
}
```

#### POST /payouts/:id/cancel
Cancel a pending payout request (by the requester).

**Permissions:** `WELFARE_PAYOUT_REQUEST`

---

## Frontend Pages

### Dashboard (`/dashboard/welfare`)
- Overview statistics (total balance, contributions, payouts)
- Pending actions alert for admins
- Fund summaries with quick navigation
- Member profile card (for non-admin users)
- Quick action buttons

### Social Funds (`/dashboard/welfare/social-funds`)
- Grid view of all welfare funds
- Create/Edit fund modal
- Fund type icons and status badges
- Delete confirmation with safety checks

### Contributions (`/dashboard/welfare/contributions`)
- Table view of all contributions
- Filter by fund, status
- Record contribution modal
- Confirm/Reject actions for pending contributions

### Payout Requests (`/dashboard/welfare/requests`)
- Table view of all payout requests
- Filter by fund, status, type
- Create request modal with eligibility check
- Review modal for approvers
- Disburse action for approved requests
- Cancel action for requesters

---

## Permissions & Access Control

### Permission Constants

```typescript
// Welfare & Social Funds (Phase 5.5)
WELFARE_VIEW: 'welfare:view',
WELFARE_MANAGE: 'welfare:manage',
WELFARE_CONTRIBUTION_VIEW: 'welfare:contribution:view',
WELFARE_CONTRIBUTION_MANAGE: 'welfare:contribution:manage',
WELFARE_CONTRIBUTION_CONFIRM: 'welfare:contribution:confirm',
WELFARE_PAYOUT_VIEW: 'welfare:payout:view',
WELFARE_PAYOUT_REQUEST: 'welfare:payout:request',
WELFARE_PAYOUT_APPROVE: 'welfare:payout:approve',
WELFARE_PAYOUT_DISBURSE: 'welfare:payout:disburse',
```

### Role Permissions Matrix

| Permission | Admin | Treasurer | Fin. Secretary | Member |
|------------|-------|-----------|----------------|--------|
| WELFARE_VIEW | ✅ | ✅ | ✅ | ✅ |
| WELFARE_MANAGE | ✅ | ✅ | ❌ | ❌ |
| WELFARE_CONTRIBUTION_VIEW | ✅ | ✅ | ✅ | ✅ |
| WELFARE_CONTRIBUTION_MANAGE | ✅ | ✅ | ✅ | ❌ |
| WELFARE_CONTRIBUTION_CONFIRM | ✅ | ✅ | ❌ | ❌ |
| WELFARE_PAYOUT_VIEW | ✅ | ✅ | ✅ | ✅ |
| WELFARE_PAYOUT_REQUEST | ✅ | ✅ | ✅ | ✅ |
| WELFARE_PAYOUT_APPROVE | ✅ | ✅ | ❌ | ❌ |
| WELFARE_PAYOUT_DISBURSE | ✅ | ✅ | ❌ | ❌ |

---

## Business Logic

### Eligibility Rules

Members must meet the following criteria to request payouts:

1. **Waiting Period:** Member must have been in the association for at least `waitingPeriodDays` days
2. **Minimum Contributions:** Member must have contributed for at least `minContributionMonths` unique months
3. **No Pending Requests:** Member cannot have another pending/approved request for the same fund

### Contribution Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   PENDING   │────▶│  CONFIRMED  │     │  REJECTED   │
│             │     │             │     │             │
│ (Recorded)  │     │ (Verified)  │     │ (Invalid)   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   │
       └───────────────────┴──▶ Fund balance updated
                                (only on CONFIRMED)
```

### Payout Request Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   PENDING   │────▶│UNDER_REVIEW │────▶│  APPROVED   │────▶│  DISBURSED  │
│             │     │             │     │             │     │             │
│ (Submitted) │     │ (Reviewing) │     │ (Approved)  │     │ (Paid out)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   │
┌─────────────┐     ┌─────────────┐            │
│  CANCELLED  │     │  REJECTED   │            │
│             │     │             │            │
│ (By member) │     │ (By admin)  │            │
└─────────────┘     └─────────────┘            │
                                               │
                                               ▼
                                    Fund balance deducted
```

### Fund Balance Management

- **Contributions:** Balance increases when contribution status changes to `CONFIRMED`
- **Payouts:** Balance decreases when payout status changes to `DISBURSED`
- **Atomic Transactions:** All balance updates use Prisma transactions to ensure consistency

---

## Integration Points

### Audit Logging
All CRUD operations are logged to the `AuditLog` table:
- Fund creation/update/deletion
- Contribution recording/confirmation
- Payout request creation/review/disbursement

### Notifications (Future)
Integration points for:
- Email notifications on payout status changes
- SMS reminders for contribution due dates
- In-app notifications for pending approvals

### Reports (Future)
Data available for:
- Welfare fund utilization reports
- Member participation analytics
- Payout trend analysis

---

## Related Documentation

- [API Testing Guide](./TESTING_GUIDE.md)
- [Permissions System](../architecture/permissions.md)
- [Financial Management](../finances/FINAN_MANA_IMPLEMENTATION_SUMMARY.md)
