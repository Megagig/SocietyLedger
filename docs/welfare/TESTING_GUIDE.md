# Welfare & Social Funds - Manual Testing Guide

**Module:** Phase 5.5 - Welfare & Social Funds  
**Last Updated:** December 28, 2025  
**Testing Environment:** Development/Staging

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Data Setup](#test-data-setup)
3. [Test Scenarios](#test-scenarios)
   - [Welfare Fund Management](#1-welfare-fund-management)
   - [Contribution Management](#2-contribution-management)
   - [Payout Request Workflow](#3-payout-request-workflow)
   - [Eligibility Rules](#4-eligibility-rules)
   - [Dashboard & Analytics](#5-dashboard--analytics)
   - [Permission Testing](#6-permission-testing)
4. [Edge Cases](#edge-cases)
5. [Error Scenarios](#error-scenarios)
6. [API Testing with cURL](#api-testing-with-curl)

---

## Prerequisites

### Required Accounts
- **Admin Account:** Full access to all welfare features
- **Treasurer Account:** Financial management access
- **Financial Secretary Account:** Record-keeping access
- **Member Account:** Basic member access

### Environment Setup
1. Ensure the API server is running (`npm run dev` in `apps/api`)
2. Ensure the web app is running (`npm run dev` in `apps/web`)
3. Database is seeded with test data
4. At least 5-10 test members exist in the association

### Browser Requirements
- Modern browser (Chrome, Firefox, Safari, Edge)
- Developer tools available for network inspection
- Clear cookies/cache before testing if needed

---

## Test Data Setup

### Create Test Members
Ensure you have members with varying:
- Join dates (some recent, some old)
- Status (active, inactive)
- Existing contributions (some with, some without)

### Recommended Test Funds
Create these funds for comprehensive testing:

| Fund Name | Type | Min Contribution | Max Payout | Waiting Period | Min Months |
|-----------|------|------------------|------------|----------------|------------|
| General Welfare | GENERAL | ₦1,000 | ₦100,000 | 0 days | 0 |
| Bereavement Fund | BEREAVEMENT | ₦5,000 | ₦200,000 | 90 days | 3 |
| Medical Emergency | MEDICAL | ₦2,000 | ₦150,000 | 30 days | 1 |
| Education Support | EDUCATION | ₦3,000 | ₦100,000 | 60 days | 2 |
| Emergency Fund | EMERGENCY | ₦1,000 | ₦50,000 | 0 days | 0 |

---

## Test Scenarios

### 1. Welfare Fund Management

#### TC-WF-001: Create Welfare Fund (Happy Path)
**Preconditions:** Logged in as Admin

**Steps:**
1. Navigate to `/dashboard/welfare/social-funds`
2. Click "Create Fund" button
3. Fill in the form:
   - Name: "Test Bereavement Fund"
   - Description: "Support for members who lose loved ones"
   - Fund Type: BEREAVEMENT
   - Target Balance: 500000
   - Monthly Contribution: 5000
   - Is Mandatory: Yes
   - Min Contribution: 1000
   - Max Payout: 100000
   - Waiting Period: 90 days
   - Min Contribution Months: 3
4. Click "Create Fund"

**Expected Results:**
- ✅ Success toast appears
- ✅ Fund appears in the list
- ✅ Fund shows correct type badge
- ✅ Current balance shows ₦0
- ✅ Status shows "ACTIVE"

---

#### TC-WF-002: Create Fund with Duplicate Name
**Preconditions:** Fund "Test Bereavement Fund" already exists

**Steps:**
1. Navigate to `/dashboard/welfare/social-funds`
2. Click "Create Fund"
3. Enter name: "Test Bereavement Fund"
4. Fill other required fields
5. Click "Create Fund"

**Expected Results:**
- ✅ Error toast: "A welfare fund with this name already exists"
- ✅ Modal remains open
- ✅ No fund created

---

#### TC-WF-003: Update Welfare Fund
**Preconditions:** Fund exists

**Steps:**
1. Navigate to `/dashboard/welfare/social-funds`
2. Click "Edit" on an existing fund
3. Change description to "Updated description"
4. Change max payout to 150000
5. Click "Update Fund"

**Expected Results:**
- ✅ Success toast appears
- ✅ Fund details updated in the list
- ✅ Audit log entry created

---

#### TC-WF-004: Delete Fund with No Contributions
**Preconditions:** Fund exists with no confirmed contributions

**Steps:**
1. Navigate to `/dashboard/welfare/social-funds`
2. Click "Delete" on a fund with no contributions
3. Confirm deletion in the modal

**Expected Results:**
- ✅ Success toast: "Fund deleted successfully"
- ✅ Fund removed from list

---

#### TC-WF-005: Delete Fund with Confirmed Contributions
**Preconditions:** Fund has confirmed contributions

**Steps:**
1. Navigate to `/dashboard/welfare/social-funds`
2. Click "Delete" on a fund with contributions
3. Confirm deletion

**Expected Results:**
- ✅ Error toast: "Cannot delete fund with confirmed contributions"
- ✅ Fund remains in list

---

#### TC-WF-006: Suspend/Close Fund
**Preconditions:** Active fund exists

**Steps:**
1. Edit an active fund
2. Change status to "SUSPENDED"
3. Save changes

**Expected Results:**
- ✅ Fund status badge changes to "SUSPENDED"
- ✅ Fund no longer accepts new contributions
- ✅ Existing payout requests can still be processed

---

### 2. Contribution Management

#### TC-WC-001: Record Single Contribution (Happy Path)
**Preconditions:** Active fund and member exist

**Steps:**
1. Navigate to `/dashboard/welfare/contributions`
2. Click "Record Contribution"
3. Select a fund
4. Select a member
5. Enter amount: 5000
6. Select date: Today
7. Select payment method: Bank Transfer
8. Enter reference: "TRF123456"
9. Click "Record Contribution"

**Expected Results:**
- ✅ Success toast appears
- ✅ Contribution appears in list with "PENDING" status
- ✅ Fund balance NOT yet updated

---

#### TC-WC-002: Record Contribution Below Minimum
**Preconditions:** Fund has minContribution of ₦5,000

**Steps:**
1. Navigate to `/dashboard/welfare/contributions`
2. Click "Record Contribution"
3. Select the fund with min contribution
4. Enter amount: 1000 (below minimum)
5. Click "Record Contribution"

**Expected Results:**
- ✅ Error toast: "Minimum contribution is 5000"
- ✅ Contribution not created

---

#### TC-WC-003: Bulk Record Contributions
**Preconditions:** Active fund and multiple members exist

**Steps:**
1. Navigate to `/dashboard/welfare/contributions`
2. Click "Record Contribution" (or use API directly)
3. Use bulk endpoint with:
   - fundId: 1
   - memberIds: [1, 2, 3, 4, 5]
   - amount: 5000
   - paymentMethod: "cash"

**Expected Results:**
- ✅ Success message: "5 contributions recorded successfully"
- ✅ All 5 contributions appear in list
- ✅ All have "PENDING" status

---

#### TC-WC-004: Confirm Contribution
**Preconditions:** Pending contribution exists

**Steps:**
1. Navigate to `/dashboard/welfare/contributions`
2. Filter by status: PENDING
3. Click the checkmark (✓) icon on a pending contribution
4. Confirm the action

**Expected Results:**
- ✅ Contribution status changes to "CONFIRMED"
- ✅ Fund balance increases by contribution amount
- ✅ Audit log entry created

---

#### TC-WC-005: Reject Contribution
**Preconditions:** Pending contribution exists

**Steps:**
1. Navigate to `/dashboard/welfare/contributions`
2. Click the X icon on a pending contribution
3. Confirm rejection

**Expected Results:**
- ✅ Contribution status changes to "REJECTED"
- ✅ Fund balance NOT affected
- ✅ Audit log entry created

---

#### TC-WC-006: Record Contribution to Suspended Fund
**Preconditions:** Fund is in SUSPENDED status

**Steps:**
1. Try to record a contribution to a suspended fund

**Expected Results:**
- ✅ Error: "Welfare fund not found or not active"

---

### 3. Payout Request Workflow

#### TC-WP-001: Create Payout Request (Happy Path)
**Preconditions:** 
- Member is eligible for the fund
- Fund has sufficient balance

**Steps:**
1. Log in as a member
2. Navigate to `/dashboard/welfare/requests`
3. Click "Request Support"
4. Select a fund (eligibility check should pass)
5. Select type: MEDICAL
6. Enter amount: 50000
7. Enter reason: "Hospital bills for surgery - detailed explanation here"
8. Click "Submit Request"

**Expected Results:**
- ✅ Success toast appears
- ✅ Request appears in list with "PENDING" status
- ✅ Request number generated (e.g., WPR000001)
- ✅ Fund balance NOT yet affected

---

#### TC-WP-002: Create Request When Not Eligible (Waiting Period)
**Preconditions:** 
- Member joined less than 90 days ago
- Fund has 90-day waiting period

**Steps:**
1. Log in as the new member
2. Navigate to `/dashboard/welfare/requests`
3. Click "Request Support"
4. Select the fund with waiting period

**Expected Results:**
- ✅ Eligibility check shows: "Member must wait X more days"
- ✅ Submit button disabled
- ✅ Cannot create request

---

#### TC-WP-003: Create Request When Not Eligible (Min Contributions)
**Preconditions:** 
- Member has contributed for only 1 month
- Fund requires 3 months of contributions

**Steps:**
1. Log in as the member
2. Navigate to `/dashboard/welfare/requests`
3. Click "Request Support"
4. Select the fund

**Expected Results:**
- ✅ Eligibility check shows: "Member needs X more months of contributions"
- ✅ Submit button disabled

---

#### TC-WP-004: Create Request with Pending Request Exists
**Preconditions:** Member has a pending request for the same fund

**Steps:**
1. Try to create another request for the same fund

**Expected Results:**
- ✅ Error: "Member has a pending payout request"

---

#### TC-WP-005: Approve Payout Request
**Preconditions:** Pending request exists, logged in as Admin/Treasurer

**Steps:**
1. Navigate to `/dashboard/welfare/requests`
2. Filter by status: PENDING
3. Click the checkmark icon on a request
4. Or click "View Details" and use the review form
5. Enter approved amount (can be same or less than requested)
6. Click "Approve"

**Expected Results:**
- ✅ Request status changes to "APPROVED"
- ✅ Approved amount recorded
- ✅ Fund balance NOT yet affected
- ✅ Audit log entry created

---

#### TC-WP-006: Approve with Partial Amount
**Preconditions:** Request for ₦100,000 exists

**Steps:**
1. Open request details
2. Change approved amount to ₦75,000
3. Add comment: "Approved partial amount based on fund availability"
4. Click "Approve"

**Expected Results:**
- ✅ Request shows both requested (₦100,000) and approved (₦75,000) amounts
- ✅ Status is "APPROVED"

---

#### TC-WP-007: Reject Payout Request
**Preconditions:** Pending request exists

**Steps:**
1. Navigate to `/dashboard/welfare/requests`
2. Click the X icon on a request
3. Enter rejection reason: "Insufficient documentation provided"
4. Confirm rejection

**Expected Results:**
- ✅ Request status changes to "REJECTED"
- ✅ Rejection reason recorded
- ✅ Fund balance NOT affected

---

#### TC-WP-008: Reject Without Reason
**Preconditions:** Pending request exists

**Steps:**
1. Try to reject a request without providing a reason

**Expected Results:**
- ✅ Validation error: "Rejection reason is required"
- ✅ Request not rejected

---

#### TC-WP-009: Disburse Approved Payout
**Preconditions:** Approved request exists, fund has sufficient balance

**Steps:**
1. Navigate to `/dashboard/welfare/requests`
2. Filter by status: APPROVED
3. Click the cash icon on an approved request
4. Enter disbursement method: "bank_transfer"
5. Enter reference: "TRF789012"
6. Confirm disbursement

**Expected Results:**
- ✅ Request status changes to "DISBURSED"
- ✅ Fund balance decreases by approved amount
- ✅ Disbursement details recorded
- ✅ Audit log entry created

---

#### TC-WP-010: Disburse with Insufficient Fund Balance
**Preconditions:** 
- Approved request for ₦100,000
- Fund balance is ₦50,000

**Steps:**
1. Try to disburse the approved request

**Expected Results:**
- ✅ Error: "Insufficient fund balance for disbursement"
- ✅ Request remains in "APPROVED" status

---

#### TC-WP-011: Cancel Payout Request (By Member)
**Preconditions:** Member has a pending request

**Steps:**
1. Log in as the member who created the request
2. Navigate to `/dashboard/welfare/requests`
3. Click the X icon on their pending request
4. Confirm cancellation

**Expected Results:**
- ✅ Request status changes to "CANCELLED"
- ✅ Fund balance NOT affected

---

#### TC-WP-012: Cancel Already Approved Request
**Preconditions:** Request is in "APPROVED" status

**Steps:**
1. Try to cancel an approved request

**Expected Results:**
- ✅ Error: "Payout request not found or cannot be cancelled"
- ✅ Request remains in "APPROVED" status

---

#### TC-WP-013: Create Bereavement Request
**Preconditions:** Bereavement fund exists, member is eligible

**Steps:**
1. Navigate to `/dashboard/welfare/requests`
2. Click "Request Support"
3. Select bereavement fund
4. Select type: BEREAVEMENT
5. Enter amount: 100000
6. Enter reason with deceased details
7. Submit

**Expected Results:**
- ✅ Request created with type "BEREAVEMENT"
- ✅ Status may be "UNDER_REVIEW" (fast-tracked)
- ✅ Reason includes bereavement details

---

### 4. Eligibility Rules

#### TC-EL-001: Check Eligibility - All Criteria Met
**Preconditions:** 
- Member joined 120 days ago
- Member has contributed for 4 months
- No pending requests

**Steps:**
1. Call eligibility check API or use UI

**Expected Results:**
- ✅ `isEligible: true`
- ✅ `reason: null`

---

#### TC-EL-002: Check Eligibility - Waiting Period Not Met
**Preconditions:** 
- Member joined 30 days ago
- Fund requires 90-day waiting period

**Steps:**
1. Check eligibility for the fund

**Expected Results:**
- ✅ `isEligible: false`
- ✅ `reason: "Member must wait 60 more days"`

---

#### TC-EL-003: Check Eligibility - Contribution Months Not Met
**Preconditions:** 
- Member has contributed for 1 month
- Fund requires 3 months

**Steps:**
1. Check eligibility for the fund

**Expected Results:**
- ✅ `isEligible: false`
- ✅ `reason: "Member needs 2 more months of contributions"`

---

#### TC-EL-004: Check Eligibility - Pending Request Exists
**Preconditions:** Member has a pending request for the fund

**Steps:**
1. Check eligibility for the same fund

**Expected Results:**
- ✅ `isEligible: false`
- ✅ `reason: "Member has a pending payout request"`

---

### 5. Dashboard & Analytics

#### TC-DA-001: View Welfare Dashboard (Admin)
**Preconditions:** Logged in as Admin, some data exists

**Steps:**
1. Navigate to `/dashboard/welfare`

**Expected Results:**
- ✅ Total Balance displayed correctly
- ✅ Total Contributions displayed
- ✅ Total Payouts displayed
- ✅ Participation rate calculated correctly
- ✅ Pending actions alert shown if pending requests exist
- ✅ Fund summaries displayed

---

#### TC-DA-002: View Welfare Dashboard (Member)
**Preconditions:** Logged in as Member

**Steps:**
1. Navigate to `/dashboard/welfare`

**Expected Results:**
- ✅ Member profile card displayed
- ✅ Shows member's total contributions
- ✅ Shows payouts received
- ✅ Shows eligible funds count
- ✅ Shows pending requests count
- ✅ No admin-only actions visible

---

#### TC-DA-003: View Member Welfare Profile (Admin)
**Preconditions:** Logged in as Admin

**Steps:**
1. Navigate to `/dashboard/welfare/members/{memberId}/profile`
2. Or use API: GET /api/welfare/members/{memberId}/profile

**Expected Results:**
- ✅ Member's total contributions shown
- ✅ Contribution count shown
- ✅ Last contribution date shown
- ✅ Total payouts received shown
- ✅ Eligible funds listed
- ✅ Pending requests count shown

---

### 6. Permission Testing

#### TC-PM-001: Member Cannot Create Fund
**Preconditions:** Logged in as Member

**Steps:**
1. Navigate to `/dashboard/welfare/social-funds`
2. Look for "Create Fund" button

**Expected Results:**
- ✅ "Create Fund" button NOT visible
- ✅ Edit/Delete buttons NOT visible on funds

---

#### TC-PM-002: Member Cannot Record Contributions
**Preconditions:** Logged in as Member

**Steps:**
1. Navigate to `/dashboard/welfare/contributions`
2. Look for "Record Contribution" button

**Expected Results:**
- ✅ "Record Contribution" button NOT visible
- ✅ Confirm/Reject buttons NOT visible

---

#### TC-PM-003: Member Can Request Payout
**Preconditions:** Logged in as Member

**Steps:**
1. Navigate to `/dashboard/welfare/requests`
2. Click "Request Support"

**Expected Results:**
- ✅ "Request Support" button IS visible
- ✅ Can create payout request
- ✅ Cannot approve/disburse requests

---

#### TC-PM-004: Financial Secretary Permissions
**Preconditions:** Logged in as Financial Secretary

**Steps:**
1. Test all welfare pages

**Expected Results:**
- ✅ Can view dashboard
- ✅ Can view contributions
- ✅ Can record contributions
- ✅ CANNOT confirm contributions
- ✅ Can view payout requests
- ✅ Can create payout requests
- ✅ CANNOT approve/disburse payouts

---

#### TC-PM-005: Treasurer Permissions
**Preconditions:** Logged in as Treasurer

**Steps:**
1. Test all welfare pages

**Expected Results:**
- ✅ Can view dashboard
- ✅ Can create/edit/delete funds
- ✅ Can record and confirm contributions
- ✅ Can approve and disburse payouts

---

## Edge Cases

### EC-001: Create Fund with All Optional Fields Empty
**Steps:** Create fund with only required fields (name, type)

**Expected:** Fund created successfully with defaults

---

### EC-002: Very Large Contribution Amount
**Steps:** Record contribution of ₦999,999,999.99

**Expected:** Should handle large decimal values correctly

---

### EC-003: Contribution Date in the Future
**Steps:** Record contribution with date 1 year in the future

**Expected:** Should be allowed (for scheduled contributions)

---

### EC-004: Contribution Date in the Past
**Steps:** Record contribution with date 1 year ago

**Expected:** Should be allowed (for backdated entries)

---

### EC-005: Request Amount Exceeds Max Payout
**Steps:** Request ₦200,000 from fund with max payout of ₦100,000

**Expected:** Error: "Maximum payout amount is 100000"

---

### EC-006: Request Amount Exceeds Fund Balance
**Steps:** Request ₦100,000 from fund with balance of ₦50,000

**Expected:** Error: "Insufficient fund balance"

---

### EC-007: Multiple Contributions Same Day Same Member
**Steps:** Record 3 contributions for same member on same day

**Expected:** All contributions should be recorded separately

---

### EC-008: Unicode Characters in Fund Name/Description
**Steps:** Create fund with name "福利基金 🎉"

**Expected:** Should handle unicode correctly

---

### EC-009: Very Long Reason Text
**Steps:** Create payout request with 1000-character reason

**Expected:** Should be accepted (max is 1000 chars)

---

### EC-010: Concurrent Approval Attempts
**Steps:** Two admins try to approve same request simultaneously

**Expected:** Only one should succeed, other gets "already processed" error

---

## Error Scenarios

### ERR-001: Network Timeout
**Steps:** Simulate slow network, submit form

**Expected:** Loading state shown, timeout error displayed gracefully

---

### ERR-002: Session Expired
**Steps:** Let session expire, try to submit

**Expected:** Redirect to login page

---

### ERR-003: Invalid Fund ID
**Steps:** Call API with non-existent fund ID

**Expected:** 404 or "Welfare fund not found" error

---

### ERR-004: Invalid Member ID
**Steps:** Record contribution for non-existent member

**Expected:** "Member not found" error

---

### ERR-005: Validation Errors
**Steps:** Submit form with invalid data (negative amount, empty required fields)

**Expected:** Validation errors displayed inline

---

## API Testing with cURL

### Get Auth Token
```bash
# Login and get token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "password": "password123"}' \
  -c cookies.txt
```

### Dashboard
```bash
curl -X GET http://localhost:3001/api/welfare/dashboard \
  -b cookies.txt
```

### Create Fund
```bash
curl -X POST http://localhost:3001/api/welfare/funds \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Test Fund",
    "fundType": "GENERAL",
    "description": "Test description",
    "targetBalance": 100000,
    "minContribution": 1000,
    "maxPayout": 50000,
    "waitingPeriodDays": 30,
    "minContributionMonths": 1
  }'
```

### List Funds
```bash
curl -X GET "http://localhost:3001/api/welfare/funds?page=1&limit=10" \
  -b cookies.txt
```

### Record Contribution
```bash
curl -X POST http://localhost:3001/api/welfare/contributions \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "fundId": 1,
    "memberId": 1,
    "amount": 5000,
    "paymentMethod": "bank_transfer",
    "reference": "TRF123"
  }'
```

### Confirm Contribution
```bash
curl -X POST http://localhost:3001/api/welfare/contributions/1/confirm \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"status": "CONFIRMED"}'
```

### Check Eligibility
```bash
curl -X GET "http://localhost:3001/api/welfare/eligibility?fundId=1&memberId=1" \
  -b cookies.txt
```

### Create Payout Request
```bash
curl -X POST http://localhost:3001/api/welfare/payouts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "fundId": 1,
    "payoutType": "MEDICAL",
    "amount": 50000,
    "reason": "Hospital bills for surgery - need urgent support"
  }'
```

### Review Payout Request
```bash
curl -X POST http://localhost:3001/api/welfare/payouts/1/review \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "APPROVED",
    "approvedAmount": 50000,
    "comments": "Approved as requested"
  }'
```

### Disburse Payout
```bash
curl -X POST http://localhost:3001/api/welfare/payouts/1/disburse \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "disbursementMethod": "bank_transfer",
    "disbursementReference": "TRF789012"
  }'
```

---

## Test Completion Checklist

| Category | Total Tests | Passed | Failed | Blocked |
|----------|-------------|--------|--------|---------|
| Fund Management | 6 | | | |
| Contributions | 6 | | | |
| Payout Requests | 13 | | | |
| Eligibility | 4 | | | |
| Dashboard | 3 | | | |
| Permissions | 5 | | | |
| Edge Cases | 10 | | | |
| Error Scenarios | 5 | | | |
| **TOTAL** | **52** | | | |

---

## Notes

- Always test in a clean environment when possible
- Document any bugs found with screenshots and steps to reproduce
- Test both happy paths and error scenarios
- Verify audit logs are created for all significant actions
- Check browser console for JavaScript errors
- Verify mobile responsiveness on key pages
