# Phase 4: Advanced Features Documentation

**Completion Date:** December 28, 2025  
**Status:** ✅ Complete (10/10 tasks)

## Overview

Phase 4 implements advanced financial features for SocietyLedger including levy campaign management, donation tracking with receipts, and automated penalty/late fee management.

---

## UI Manual Testing Guide

This section provides step-by-step instructions for manually testing Phase 4 features through the web interface.

### Prerequisites

1. Start the development servers:
   ```bash
   # Terminal 1: Start API server
   cd apps/api && npm run dev
   
   # Terminal 2: Start Web server
   cd apps/web && npm run dev
   ```

2. Ensure you have:
   - An admin account with finance permissions
   - At least 3-5 members in the system
   - Access to the dashboard at `http://localhost:3000`

3. Login as an admin user

---

### Test 1: Levy Campaign Management

**Navigate to:** Dashboard → Finance → Levies (`/dashboard/finance/levies`)

#### Step 1.1: Create a Levy Category
1. Click the **"Categories"** tab
2. Click **"Add Category"** button
3. Fill in the form:
   - Name: `Building Fund 2025`
   - Type: Select `levy`
   - Amount: `25000`
   - Description: `Annual building maintenance levy`
4. Click **"Create"**
5. ✅ **Verify:** Category appears in the list with correct details

#### Step 1.2: Create a Levy Campaign
1. Click the **"Campaigns"** tab
2. Click **"Create Campaign"** button
3. Fill in the form:
   - Category: Select `Building Fund 2025`
   - Name: `Q1 Building Levy Drive`
   - Description: `First quarter building fund collection`
   - Target Amount: `500000`
   - Amount Per Member: `25000`
   - Deadline: Select a date 30 days from now
4. Click **"Create Campaign"**
5. ✅ **Verify:** Campaign appears with "ACTIVE" status badge

#### Step 1.3: View Campaign Details
1. Click on the campaign name or **"View"** button
2. ✅ **Verify:** Campaign detail page shows:
   - Progress bar (should be 0%)
   - Target amount: ₦500,000
   - Collected: ₦0
   - Member assignments section (empty initially)

#### Step 1.4: Assign Members to Campaign
1. On the campaign detail page, click **"Assign Members"**
2. Select 3-5 members from the list
3. Confirm the amount per member (₦25,000)
4. Click **"Assign"**
5. ✅ **Verify:** 
   - Members appear in the assignments table
   - Each shows "Pending" status
   - Total assigned amount updates

#### Step 1.5: Check Progress Updates
1. Navigate back to the campaigns list
2. ✅ **Verify:** Campaign card shows updated stats:
   - Total members assigned
   - Progress percentage (still 0% until payments)

---

### Test 2: Donation Management

**Navigate to:** Dashboard → Finance → Donations (`/dashboard/finance/donations`)

#### Step 2.1: Create a Donation Category
1. Click the **"Categories"** tab
2. Click **"Add Category"** button
3. Fill in:
   - Name: `General Donations`
   - Type: Select `donation`
   - Description: `General purpose donations`
4. Click **"Create"**
5. ✅ **Verify:** Category appears in the list

#### Step 2.2: Create a Donation Allocation
1. Click the **"Allocations"** tab
2. Click **"Create Allocation"** button
3. Fill in:
   - Name: `Youth Program Fund`
   - Type: Select `project`
   - Description: `Supporting youth activities and education`
   - Target Amount: `200000`
4. Click **"Create"**
5. ✅ **Verify:** Allocation appears with target amount displayed

#### Step 2.3: Record a Donation
1. Click the **"Recent Donations"** tab
2. Click **"Record Donation"** button
3. Fill in:
   - Member: Select a member from dropdown
   - Category: Select `General Donations`
   - Amount: `15000`
   - Allocation: Select `Youth Program Fund`
   - Donor Message: `For the children's program`
   - Anonymous: Leave unchecked
4. Click **"Record Donation"**
5. ✅ **Verify:** 
   - Donation appears in the list
   - Receipt number generated (format: DON-2025-XXXXXX)
   - Amount and allocation displayed correctly

#### Step 2.4: Preview Donation Receipt
1. Find the donation you just created
2. Click the **"Receipt"** or **"View Receipt"** button
3. ✅ **Verify:** Receipt modal shows:
   - Receipt number
   - Donor name (or "Anonymous" if checked)
   - Amount in Naira format
   - Allocation name
   - Donor message
   - Date of donation

#### Step 2.5: Record Anonymous Donation
1. Click **"Record Donation"** again
2. Fill in:
   - Member: Select any member
   - Amount: `50000`
   - Check **"Anonymous Donation"**
4. Click **"Record Donation"**
5. ✅ **Verify:** Donation shows "Anonymous" instead of member name

---

### Test 3: Penalty & Late Fee Management

**Navigate to:** Dashboard → Finance → Penalties (`/dashboard/finance/penalties`)

#### Step 3.1: View Penalty Types
1. Click the **"Penalty Types"** tab
2. ✅ **Verify:** Shows existing penalty categories (if any)

#### Step 3.2: Create a Late Fee Rule
1. Click the **"Late Fee Rules"** tab
2. Click **"Create Rule"** button
3. Fill in:
   - Name: `Standard Late Payment Fee`
   - Description: `5% fee after 7 days grace period`
   - Trigger Type: Select `Late Payment`
   - Grace Period: `7` days
   - Fee Type: Select `Percentage`
   - Fee Amount: `5`
   - Max Fee Amount: `5000` (optional cap)
4. Click **"Create Rule"**
5. ✅ **Verify:** Rule appears in the list with all details

#### Step 3.3: Create a Fixed Amount Rule
1. Click **"Create Rule"** again
2. Fill in:
   - Name: `Flat Late Fee`
   - Trigger Type: `Late Payment`
   - Grace Period: `14` days
   - Fee Type: Select `Fixed`
   - Fee Amount: `500`
3. Click **"Create Rule"**
4. ✅ **Verify:** Rule shows "₦500" as fee amount

#### Step 3.4: Create a Compounding Rule
1. Click **"Create Rule"**
2. Fill in:
   - Name: `Monthly Recurring Fee`
   - Trigger Type: `Late Payment`
   - Grace Period: `7` days
   - Fee Type: `Fixed`
   - Fee Amount: `200`
   - Check **"Compounding"**
   - Compounding Days: `30`
3. Click **"Create Rule"**
4. ✅ **Verify:** Rule shows compounding indicator

#### Step 3.5: Toggle Rule Status
1. Find a rule in the list
2. Click the **"Deactivate"** or toggle button
3. ✅ **Verify:** Rule status changes to inactive
4. Click again to reactivate
5. ✅ **Verify:** Rule status returns to active

#### Step 3.6: View Waivers Tab
1. Click the **"Waivers"** tab
2. ✅ **Verify:** Shows list of penalty waivers (may be empty initially)

---

### Test 4: Integration Testing (End-to-End)

This test verifies the complete flow from levy assignment to payment to late fee.

#### Step 4.1: Setup Test Data
1. Create a levy category with amount ₦10,000
2. Create a campaign with deadline in the past (e.g., yesterday)
3. Assign 2 members to the campaign

#### Step 4.2: Verify Overdue Status
1. Navigate to Finance → Transactions
2. Find the levy transactions for assigned members
3. ✅ **Verify:** Transactions show "Overdue" status (if past deadline)

#### Step 4.3: Trigger Late Fee Processing (Admin)
1. If you have API access, call:
   ```
   POST /api/cron/late-fees
   ```
2. Or wait for the scheduled cron job (runs daily at 2 AM)

#### Step 4.4: Verify Late Fees Applied
1. Navigate to Finance → Penalties
2. Check the penalties list
3. ✅ **Verify:** Late fees appear for overdue transactions

#### Step 4.5: Waive a Penalty
1. Find a penalty in the list
2. Click **"Waive"** button
3. Fill in:
   - Waived Amount: Enter partial or full amount
   - Reason: `First-time offender, member requested leniency`
4. Click **"Submit Waiver"**
5. ✅ **Verify:** 
   - Waiver appears in the Waivers tab
   - Penalty amount reduced or marked as waived

#### Step 4.6: Record Payment for Levy
1. Navigate to Finance → Transactions
2. Find an assigned levy transaction
3. Click **"Record Payment"**
4. Fill in payment details
5. Click **"Submit"**
6. ✅ **Verify:** 
   - Transaction status changes to "Paid"
   - Levy campaign progress updates

#### Step 4.7: Verify Campaign Progress
1. Navigate to Finance → Levies → Campaigns
2. Click on your test campaign
3. ✅ **Verify:**
   - Progress bar shows updated percentage
   - Collected amount increased
   - Member assignment shows "Paid" status

---

### Test 5: Edge Cases & Error Handling

#### Test 5.1: Duplicate Member Assignment
1. Go to a levy campaign
2. Try to assign a member who is already assigned
3. ✅ **Verify:** Error message appears: "Member already assigned"

#### Test 5.2: Invalid Waiver Amount
1. Try to waive more than the outstanding penalty amount
2. ✅ **Verify:** Error message appears about exceeding balance

#### Test 5.3: Delete Active Rule
1. Try to delete a penalty rule that has been applied
2. ✅ **Verify:** Rule is deactivated (soft delete) instead of hard deleted

#### Test 5.4: Campaign with Past Deadline
1. Create a campaign with a deadline in the past
2. ✅ **Verify:** Campaign still creates but may show warning

---

### Test Checklist Summary

| Feature | Test | Status |
|---------|------|--------|
| **Levies** | Create category | ⬜ |
| | Create campaign | ⬜ |
| | View campaign details | ⬜ |
| | Assign members | ⬜ |
| | Check progress | ⬜ |
| **Donations** | Create category | ⬜ |
| | Create allocation | ⬜ |
| | Record donation | ⬜ |
| | Preview receipt | ⬜ |
| | Anonymous donation | ⬜ |
| **Penalties** | Create percentage rule | ⬜ |
| | Create fixed rule | ⬜ |
| | Create compounding rule | ⬜ |
| | Toggle rule status | ⬜ |
| | Waive penalty | ⬜ |
| **Integration** | End-to-end levy flow | ⬜ |
| | Late fee application | ⬜ |
| | Payment recording | ⬜ |

---

## Complete Workflows

### Workflow 1: Levy Campaign Management

**Use Case:** Association wants to raise ₦5,000,000 for a building project by assigning ₦50,000 to each member.

#### Step 1: Create Levy Category (if not exists)
```bash
POST /api/finance/categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Building Fund Levy",
  "type": "levy",
  "amount": 50000,
  "description": "Special levy for new building construction",
  "isActive": true
}
```

#### Step 2: Create Levy Campaign
```bash
POST /api/finance/advanced/levies/campaigns
Authorization: Bearer <token>
Content-Type: application/json

{
  "categoryId": 1,
  "name": "2025 Building Fund Drive",
  "description": "Raising funds for the new community center",
  "targetAmount": 5000000,
  "amountPerMember": 50000,
  "deadline": "2025-06-30"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "2025 Building Fund Drive",
    "targetAmount": 5000000,
    "amountPerMember": 50000,
    "deadline": "2025-06-30T00:00:00.000Z",
    "status": "ACTIVE",
    "category": { "id": 1, "name": "Building Fund Levy" }
  }
}
```

#### Step 3: Assign Members to Campaign
```bash
POST /api/finance/advanced/levies/campaigns/1/assign
Authorization: Bearer <token>
Content-Type: application/json

{
  "memberIds": [1, 2, 3, 4, 5],
  "amount": 50000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "assigned": 5,
    "totalAmount": 250000,
    "assignments": [
      { "id": 1, "memberId": 1, "amount": 50000, "status": "pending" },
      { "id": 2, "memberId": 2, "amount": 50000, "status": "pending" }
    ]
  }
}
```

#### Step 4: Check Campaign Progress
```bash
GET /api/finance/advanced/levies/campaigns/1/progress
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "campaign": { "id": 1, "name": "2025 Building Fund Drive", "targetAmount": 5000000 },
    "totalAssigned": 250000,
    "totalCollected": 100000,
    "totalMembers": 5,
    "paidMembers": 2,
    "progressPercentage": 2.0
  }
}
```

#### Step 5: Member Makes Payment (via existing payment flow)
```bash
POST /api/finance/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactionId": 101,
  "amountPaid": 50000,
  "paymentMethod": "bank_transfer"
}
```

---

### Workflow 2: Donation with Receipt & Allocation

**Use Case:** Member donates ₦100,000 to the Emergency Relief Fund and needs a receipt.

#### Step 1: Create Donation Allocation
```bash
POST /api/finance/advanced/donations/allocations
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Emergency Relief Fund",
  "description": "Fund for members facing emergencies",
  "type": "emergency",
  "targetAmount": 1000000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Emergency Relief Fund",
    "type": "emergency",
    "targetAmount": 1000000,
    "isActive": true
  }
}
```

#### Step 2: Record Donation with Allocation
```bash
POST /api/finance/advanced/donations/record
Authorization: Bearer <token>
Content-Type: application/json

{
  "memberId": 5,
  "categoryId": 2,
  "amount": 100000,
  "allocationId": 1,
  "donorMessage": "In memory of my late father",
  "isAnonymous": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction": { "id": 102, "amount": 100000, "status": "paid" },
    "donationRecord": {
      "id": 1,
      "receiptNumber": "DON-2025-000001",
      "donorMessage": "In memory of my late father",
      "isAnonymous": false,
      "allocation": { "name": "Emergency Relief Fund" }
    }
  }
}
```

#### Step 3: Get Donation Receipt
```bash
GET /api/finance/advanced/donations/1/receipt
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "receiptNumber": "DON-2025-000001",
    "donorName": "John Doe",
    "amount": 100000,
    "category": "General Donations",
    "allocation": "Emergency Relief Fund",
    "donorMessage": "In memory of my late father",
    "date": "2025-12-28",
    "association": { "name": "Community Association", "logo": "..." }
  }
}
```

#### Step 4: View Donation Statistics
```bash
GET /api/finance/advanced/donations/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAmount": 500000,
    "totalCount": 15,
    "byAllocation": [
      { "name": "Emergency Relief Fund", "amount": 200000, "count": 5 },
      { "name": "General Fund", "amount": 300000, "count": 10 }
    ],
    "recentDonations": [...]
  }
}
```

---

### Workflow 3: Penalty Rules & Late Fee Automation

**Use Case:** Association wants to automatically apply 5% late fee after 7 days grace period.

#### Step 1: Create Penalty Rule
```bash
POST /api/finance/advanced/penalties/rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Standard Late Payment Fee",
  "description": "5% late fee applied after 7 days grace period",
  "triggerType": "late_payment",
  "gracePeriodDays": 7,
  "feeType": "percentage",
  "feeAmount": 5,
  "maxFeeAmount": 10000,
  "isCompounding": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Standard Late Payment Fee",
    "triggerType": "late_payment",
    "gracePeriodDays": 7,
    "feeType": "percentage",
    "feeAmount": 5,
    "maxFeeAmount": 10000,
    "isCompounding": false,
    "isActive": true
  }
}
```

#### Step 2: Create Compounding Rule (Optional)
```bash
POST /api/finance/advanced/penalties/rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Monthly Compounding Late Fee",
  "description": "₦500 fee applied every 30 days for overdue payments",
  "triggerType": "late_payment",
  "gracePeriodDays": 14,
  "feeType": "fixed",
  "feeAmount": 500,
  "isCompounding": true,
  "compoundingDays": 30
}
```

#### Step 3: Manually Apply Late Fees (Admin)
```bash
POST /api/finance/advanced/penalties/apply-late-fees
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "applied": 12,
    "totalAmount": 45000,
    "details": [
      { "transactionId": 50, "penaltyAmount": 5000, "ruleId": 1 },
      { "transactionId": 51, "penaltyAmount": 3500, "ruleId": 1 }
    ]
  }
}
```

#### Step 4: Waive a Penalty
```bash
POST /api/finance/advanced/penalties/103/waive
Authorization: Bearer <token>
Content-Type: application/json

{
  "waivedAmount": 5000,
  "reason": "First-time offender, member requested leniency"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "transactionId": 103,
    "waivedAmount": 5000,
    "reason": "First-time offender, member requested leniency",
    "waivedAt": "2025-12-28T10:30:00.000Z"
  }
}
```

#### Step 5: View Penalty Statistics
```bash
GET /api/finance/advanced/penalties/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rules": { "total": 2, "active": 2 },
    "penalties": {
      "totalApplied": 50,
      "totalAmount": 125000,
      "totalCollected": 80000,
      "totalOutstanding": 45000
    },
    "waivers": { "count": 5, "totalWaived": 15000 }
  }
}
```

---

### Workflow 4: Cron Job for Automated Processing

**Use Case:** Daily automated late fee processing and overdue status updates.

#### Manual Trigger via API (for testing)
```bash
# Apply late fees
POST /api/cron/late-fees
Authorization: Bearer <admin-token>

# Update overdue status
POST /api/cron/update-overdue
Authorization: Bearer <admin-token>
```

#### Cron Job Setup (Production)
Add to your cron scheduler (e.g., node-cron, system crontab):

```javascript
// Run daily at 2:00 AM
const cron = require('node-cron');
const { processLateFees, updateOverdueStatus } = require('./modules/cron/late-fees.cron');

// Update overdue status first
cron.schedule('0 2 * * *', async () => {
  console.log('Running daily overdue status update...');
  await updateOverdueStatus();
});

// Apply late fees 5 minutes later
cron.schedule('5 2 * * *', async () => {
  console.log('Running daily late fees processing...');
  await processLateFees();
});
```

## Features Implemented

### 1. Levy Campaign Management (TASK-ADV-001, TASK-ADV-002)

Levy campaigns allow associations to track fundraising efforts with targets and deadlines.

**API Endpoints:**
- `GET /api/finance/advanced/levies/campaigns` - List all campaigns
- `POST /api/finance/advanced/levies/campaigns` - Create campaign
- `GET /api/finance/advanced/levies/campaigns/:id` - Get campaign details
- `GET /api/finance/advanced/levies/campaigns/:id/progress` - Get progress with stats
- `POST /api/finance/advanced/levies/campaigns/:id/assign` - Assign members
- `DELETE /api/finance/advanced/levies/campaigns/:id/assignments/:assignmentId` - Remove assignment

**Campaign Statuses:** DRAFT, ACTIVE, COMPLETED, CANCELLED

### 2. Donation Management (TASK-ADV-003, TASK-ADV-004)

Enhanced donation tracking with receipt generation and fund allocation.

**API Endpoints:**
- `GET /api/finance/advanced/donations/allocations` - List allocations
- `POST /api/finance/advanced/donations/allocations` - Create allocation
- `POST /api/finance/advanced/donations/record` - Record donation with receipt
- `GET /api/finance/advanced/donations/:id/receipt` - Get donation receipt
- `GET /api/finance/advanced/donations` - List donations
- `GET /api/finance/advanced/donations/stats` - Get donation statistics

**Allocation Types:** general, project, emergency, other

### 3. Penalty & Late Fee Management (TASK-ADV-005, TASK-ADV-006, TASK-ADV-007)

Configurable penalty rules with automated late fee calculation.

**API Endpoints:**
- `GET /api/finance/advanced/penalties/rules` - List rules
- `POST /api/finance/advanced/penalties/rules` - Create rule
- `GET /api/finance/advanced/penalties/rules/:id` - Get rule details
- `PATCH /api/finance/advanced/penalties/rules/:id` - Update rule
- `DELETE /api/finance/advanced/penalties/rules/:id` - Delete rule
- `POST /api/finance/advanced/penalties/apply-late-fees` - Manual trigger
- `POST /api/finance/advanced/penalties/:id/waive` - Waive penalty
- `GET /api/finance/advanced/penalties/waivers` - List waivers
- `GET /api/finance/advanced/penalties/stats` - Get penalty statistics

**Rule Configuration:**
- Trigger Type: late_payment, missed_meeting, custom
- Fee Type: fixed amount or percentage
- Grace Period: days before penalty applies
- Compounding: optional recurring penalties

## Database Models

### LevyCampaign
```prisma
model LevyCampaign {
  id              Int
  associationId   Int
  categoryId      Int
  name            String
  description     String?
  targetAmount    Decimal
  amountPerMember Decimal?
  deadline        DateTime
  status          LevyCampaignStatus
  assignments     LevyCampaignAssignment[]
}
```

### DonationAllocation
```prisma
model DonationAllocation {
  id            Int
  associationId Int
  name          String
  description   String?
  type          String  // general, project, emergency, other
  targetAmount  Decimal?
  isActive      Boolean
  donations     DonationRecord[]
}
```

### PenaltyRule
```prisma
model PenaltyRule {
  id              Int
  associationId   Int
  categoryId      Int?
  name            String
  triggerType     String  // late_payment, missed_meeting, custom
  gracePeriodDays Int
  feeType         String  // fixed, percentage
  feeAmount       Decimal
  maxFeeAmount    Decimal?
  isCompounding   Boolean
  compoundingDays Int?
  isActive        Boolean
}
```

## Frontend Pages

### Levies Page
- **Path:** `/dashboard/finance/levies`
- **Features:** Category management, campaign creation, progress tracking

### Levy Campaign Detail
- **Path:** `/dashboard/finance/levies/[id]`
- **Features:** Progress dashboard, member assignments, contribution tracking

### Donations Page
- **Path:** `/dashboard/finance/donations`
- **Features:** Category management, allocation tracking, receipt preview

### Penalties Page
- **Path:** `/dashboard/finance/penalties`
- **Features:** Penalty types, late fee rules, waiver management

## Cron Jobs

### Late Fees Processing
- **File:** `apps/api/src/modules/cron/late-fees.cron.ts`
- **Functions:**
  - `processLateFees()` - Apply late fees to overdue transactions
  - `updateOverdueStatus()` - Mark pending transactions as overdue

### Manual Triggers
- `POST /api/cron/late-fees` - Trigger late fee processing
- `POST /api/cron/update-overdue` - Update overdue status

## Permissions Required

- `FINANCE_VIEW` - View campaigns, allocations, rules
- `FINANCE_CREATE` - Create campaigns, allocations, rules
- `FINANCE_EDIT` - Update campaigns, allocations, rules
- `FINANCE_DELETE` - Delete campaigns, allocations, rules
- `FINANCE_APPROVE` - Apply late fees, waive penalties
- `TRANSACTION_CREATE` - Assign members, record donations
- `TRANSACTION_DELETE` - Remove assignments


---

## Testing Guide

### Prerequisites
1. API server running on `http://localhost:3001`
2. Valid JWT token with admin permissions
3. At least one association with members created
4. Financial categories for levy, donation, and penalty types

### Test Setup Script

```bash
# Set your auth token
export TOKEN="your-jwt-token-here"
export API_URL="http://localhost:3001/api"

# Helper function for API calls
api() {
  curl -s -X $1 "$API_URL$2" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    ${3:+-d "$3"} | jq
}
```

---

### Test Suite 1: Levy Campaign Management

```bash
# Test 1.1: Create levy category
echo "=== Creating Levy Category ==="
api POST "/finance/categories" '{
  "name": "Test Building Levy",
  "type": "levy",
  "amount": 25000,
  "description": "Test levy for building fund",
  "isActive": true
}'

# Test 1.2: Create levy campaign
echo "=== Creating Levy Campaign ==="
api POST "/finance/advanced/levies/campaigns" '{
  "categoryId": 1,
  "name": "Test Campaign 2025",
  "description": "Test campaign for building project",
  "targetAmount": 1000000,
  "amountPerMember": 25000,
  "deadline": "2025-12-31"
}'

# Test 1.3: List campaigns
echo "=== Listing Campaigns ==="
api GET "/finance/advanced/levies/campaigns"

# Test 1.4: Get campaign details
echo "=== Getting Campaign Details ==="
api GET "/finance/advanced/levies/campaigns/1"

# Test 1.5: Assign members (replace with actual member IDs)
echo "=== Assigning Members ==="
api POST "/finance/advanced/levies/campaigns/1/assign" '{
  "memberIds": [1, 2, 3],
  "amount": 25000
}'

# Test 1.6: Get campaign progress
echo "=== Getting Campaign Progress ==="
api GET "/finance/advanced/levies/campaigns/1/progress"

# Test 1.7: Remove assignment
echo "=== Removing Assignment ==="
api DELETE "/finance/advanced/levies/campaigns/1/assignments/1"

# Test 1.8: Update campaign status
echo "=== Updating Campaign ==="
api PATCH "/finance/advanced/levies/campaigns/1" '{
  "status": "COMPLETED"
}'
```

**Expected Results:**
- ✅ Campaign created with ACTIVE status
- ✅ Members assigned with pending status
- ✅ Progress shows correct totals
- ✅ Assignment removal works for pending items

---

### Test Suite 2: Donation Management

```bash
# Test 2.1: Create donation category
echo "=== Creating Donation Category ==="
api POST "/finance/categories" '{
  "name": "General Donations",
  "type": "donation",
  "description": "General purpose donations",
  "isActive": true
}'

# Test 2.2: Create donation allocation
echo "=== Creating Allocation ==="
api POST "/finance/advanced/donations/allocations" '{
  "name": "Youth Program Fund",
  "description": "Supporting youth activities",
  "type": "project",
  "targetAmount": 500000
}'

# Test 2.3: List allocations
echo "=== Listing Allocations ==="
api GET "/finance/advanced/donations/allocations"

# Test 2.4: Record donation with allocation
echo "=== Recording Donation ==="
api POST "/finance/advanced/donations/record" '{
  "memberId": 1,
  "categoryId": 2,
  "amount": 50000,
  "allocationId": 1,
  "donorMessage": "For the youth program",
  "isAnonymous": false
}'

# Test 2.5: Record anonymous donation
echo "=== Recording Anonymous Donation ==="
api POST "/finance/advanced/donations/record" '{
  "memberId": 2,
  "categoryId": 2,
  "amount": 100000,
  "isAnonymous": true
}'

# Test 2.6: Get donation receipt
echo "=== Getting Receipt ==="
api GET "/finance/advanced/donations/1/receipt"

# Test 2.7: List all donations
echo "=== Listing Donations ==="
api GET "/finance/advanced/donations?limit=10"

# Test 2.8: Get donation statistics
echo "=== Getting Statistics ==="
api GET "/finance/advanced/donations/stats"
```

**Expected Results:**
- ✅ Allocation created with target amount
- ✅ Donation recorded with unique receipt number (DON-YYYY-XXXXXX)
- ✅ Anonymous donation hides donor info
- ✅ Receipt contains all donation details
- ✅ Statistics show correct totals by allocation

---

### Test Suite 3: Penalty Rules & Waivers

```bash
# Test 3.1: Create penalty category
echo "=== Creating Penalty Category ==="
api POST "/finance/categories" '{
  "name": "Late Payment Fine",
  "type": "penalty",
  "amount": 500,
  "description": "Fine for late payments",
  "isActive": true
}'

# Test 3.2: Create fixed penalty rule
echo "=== Creating Fixed Penalty Rule ==="
api POST "/finance/advanced/penalties/rules" '{
  "name": "Fixed Late Fee",
  "description": "₦500 late fee after 7 days",
  "triggerType": "late_payment",
  "gracePeriodDays": 7,
  "feeType": "fixed",
  "feeAmount": 500
}'

# Test 3.3: Create percentage penalty rule
echo "=== Creating Percentage Penalty Rule ==="
api POST "/finance/advanced/penalties/rules" '{
  "name": "Percentage Late Fee",
  "description": "5% late fee with ₦5000 cap",
  "triggerType": "late_payment",
  "gracePeriodDays": 14,
  "feeType": "percentage",
  "feeAmount": 5,
  "maxFeeAmount": 5000
}'

# Test 3.4: Create compounding rule
echo "=== Creating Compounding Rule ==="
api POST "/finance/advanced/penalties/rules" '{
  "name": "Monthly Compounding Fee",
  "description": "₦200 every 30 days",
  "triggerType": "late_payment",
  "gracePeriodDays": 7,
  "feeType": "fixed",
  "feeAmount": 200,
  "isCompounding": true,
  "compoundingDays": 30
}'

# Test 3.5: List all rules
echo "=== Listing Rules ==="
api GET "/finance/advanced/penalties/rules"

# Test 3.6: Get rule details
echo "=== Getting Rule Details ==="
api GET "/finance/advanced/penalties/rules/1"

# Test 3.7: Update rule
echo "=== Updating Rule ==="
api PATCH "/finance/advanced/penalties/rules/1" '{
  "gracePeriodDays": 10,
  "isActive": true
}'

# Test 3.8: Apply late fees manually
echo "=== Applying Late Fees ==="
api POST "/finance/advanced/penalties/apply-late-fees" '{}'

# Test 3.9: Waive a penalty (replace with actual transaction ID)
echo "=== Waiving Penalty ==="
api POST "/finance/advanced/penalties/100/waive" '{
  "waivedAmount": 500,
  "reason": "First offense, member requested leniency"
}'

# Test 3.10: List waivers
echo "=== Listing Waivers ==="
api GET "/finance/advanced/penalties/waivers"

# Test 3.11: Get penalty statistics
echo "=== Getting Statistics ==="
api GET "/finance/advanced/penalties/stats"

# Test 3.12: Delete rule (soft delete if has applications)
echo "=== Deleting Rule ==="
api DELETE "/finance/advanced/penalties/rules/3"
```

**Expected Results:**
- ✅ Rules created with correct fee types
- ✅ Compounding rule has compoundingDays set
- ✅ Late fees applied only to overdue transactions past grace period
- ✅ Waiver reduces outstanding amount
- ✅ Statistics show accurate totals
- ✅ Rule with applications is soft-deleted (deactivated)

---

### Test Suite 4: Cron Jobs

```bash
# Test 4.1: Update overdue status
echo "=== Updating Overdue Status ==="
api POST "/cron/update-overdue" '{}'

# Test 4.2: Process late fees
echo "=== Processing Late Fees ==="
api POST "/cron/late-fees" '{}'

# Test 4.3: Check cron status
echo "=== Checking Cron Status ==="
api GET "/cron/status"
```

**Expected Results:**
- ✅ Pending transactions past due date marked as overdue
- ✅ Late fees applied based on active rules
- ✅ Status endpoint returns job information

---

### Integration Test Scenario

**Complete End-to-End Test:**

```bash
#!/bin/bash
# Full integration test script

echo "=========================================="
echo "Phase 4 Integration Test"
echo "=========================================="

# 1. Setup: Create categories
echo "\n[1/10] Creating categories..."
LEVY_CAT=$(api POST "/finance/categories" '{"name":"Integration Levy","type":"levy","amount":10000,"isActive":true}' | jq -r '.data.id')
DONATION_CAT=$(api POST "/finance/categories" '{"name":"Integration Donation","type":"donation","isActive":true}' | jq -r '.data.id')

# 2. Create levy campaign
echo "\n[2/10] Creating levy campaign..."
CAMPAIGN=$(api POST "/finance/advanced/levies/campaigns" "{\"categoryId\":$LEVY_CAT,\"name\":\"Integration Test Campaign\",\"targetAmount\":100000,\"amountPerMember\":10000,\"deadline\":\"2025-12-31\"}" | jq -r '.data.id')

# 3. Assign members
echo "\n[3/10] Assigning members..."
api POST "/finance/advanced/levies/campaigns/$CAMPAIGN/assign" '{"memberIds":[1,2],"amount":10000}'

# 4. Check progress
echo "\n[4/10] Checking campaign progress..."
api GET "/finance/advanced/levies/campaigns/$CAMPAIGN/progress"

# 5. Create donation allocation
echo "\n[5/10] Creating donation allocation..."
ALLOCATION=$(api POST "/finance/advanced/donations/allocations" '{"name":"Integration Fund","type":"project","targetAmount":50000}' | jq -r '.data.id')

# 6. Record donation
echo "\n[6/10] Recording donation..."
DONATION=$(api POST "/finance/advanced/donations/record" "{\"memberId\":1,\"categoryId\":$DONATION_CAT,\"amount\":25000,\"allocationId\":$ALLOCATION}" | jq -r '.data.donationRecord.id')

# 7. Get receipt
echo "\n[7/10] Getting donation receipt..."
api GET "/finance/advanced/donations/$DONATION/receipt"

# 8. Create penalty rule
echo "\n[8/10] Creating penalty rule..."
RULE=$(api POST "/finance/advanced/penalties/rules" '{"name":"Integration Late Fee","triggerType":"late_payment","gracePeriodDays":0,"feeType":"fixed","feeAmount":100}' | jq -r '.data.id')

# 9. Apply late fees
echo "\n[9/10] Applying late fees..."
api POST "/finance/advanced/penalties/apply-late-fees" '{}'

# 10. Get all statistics
echo "\n[10/10] Getting statistics..."
echo "Donation Stats:"
api GET "/finance/advanced/donations/stats"
echo "Penalty Stats:"
api GET "/finance/advanced/penalties/stats"

echo "\n=========================================="
echo "Integration Test Complete!"
echo "=========================================="
```

---

### Error Handling Tests

```bash
# Test invalid category
api POST "/finance/advanced/levies/campaigns" '{
  "categoryId": 99999,
  "name": "Invalid Campaign",
  "targetAmount": 100000,
  "deadline": "2025-12-31"
}'
# Expected: 400 - "Levy category not found or inactive"

# Test duplicate member assignment
api POST "/finance/advanced/levies/campaigns/1/assign" '{"memberIds":[1]}'
api POST "/finance/advanced/levies/campaigns/1/assign" '{"memberIds":[1]}'
# Expected: 400 - "Member already assigned to this campaign"

# Test waive non-penalty transaction
api POST "/finance/advanced/penalties/1/waive" '{"waivedAmount":100,"reason":"Test"}'
# Expected: 400 - "Can only waive penalty transactions"

# Test waive more than outstanding
api POST "/finance/advanced/penalties/100/waive" '{"waivedAmount":999999,"reason":"Test"}'
# Expected: 400 - "Waived amount cannot exceed outstanding balance"

# Test invalid percentage
api POST "/finance/advanced/penalties/rules" '{
  "name": "Invalid Rule",
  "triggerType": "late_payment",
  "gracePeriodDays": 7,
  "feeType": "percentage",
  "feeAmount": 150
}'
# Expected: 400 - "Percentage must be between 0 and 100"
```

---

### Performance Considerations

1. **Levy Campaigns:** Use pagination when listing campaigns with many assignments
2. **Late Fee Processing:** Run during off-peak hours (cron at 2 AM)
3. **Donation Statistics:** Cache results for dashboard display
4. **Bulk Operations:** Assign members in batches of 50-100

### Monitoring

Monitor these metrics in production:
- Late fee processing duration
- Number of penalties applied per run
- Waiver approval rate
- Campaign completion rate
- Donation allocation distribution
