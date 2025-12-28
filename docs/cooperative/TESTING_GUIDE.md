# Cooperatives & Loans Module - Testing Guide

This document provides comprehensive testing procedures for the Cooperatives & Loans module, including all UI flows and edge cases.

## Prerequisites

Before testing, ensure:
1. Backend API is running (`npm run dev` in `apps/api`)
2. Frontend is running (`npm run dev` in `apps/web`)
3. Database is migrated with cooperative models
4. You have a user account with appropriate permissions (FINANCE_VIEW, FINANCE_CREATE, FINANCE_APPROVE)
5. At least 3-5 test members exist in the system

---

## Test Scenarios

### 1. Dashboard Tests

#### 1.1 Dashboard Loading
**Steps:**
1. Navigate to `/dashboard/cooperatives`
2. Verify page loads without errors

**Expected Results:**
- Dashboard displays with all stat cards
- "Total Savings" shows ₦0 or actual balance
- "Outstanding Loans" shows ₦0 or actual amount
- "Overdue" section displays correctly
- "Default Rate" shows percentage
- Quick actions are clickable
- Recent applications section loads

#### 1.2 Pending Actions Alert
**Precondition:** Have pending loan applications or guarantor requests

**Steps:**
1. Navigate to dashboard
2. Observe pending actions alert

**Expected Results:**
- Yellow alert banner appears when pending items exist
- Shows count of pending applications, guarantor requests, overdue repayments
- "Review" button navigates to applications page

#### 1.3 Empty State
**Precondition:** No cooperative data exists

**Steps:**
1. Navigate to dashboard with fresh association

**Expected Results:**
- All stats show ₦0 or 0
- "No recent applications" message displays
- Quick actions still functional

---

### 2. Savings Account Tests

#### 2.1 Create Savings Account - Happy Path
**Steps:**
1. Navigate to `/dashboard/cooperatives/savings`
2. Click "Open Account" button
3. Select a member from dropdown
4. Select account type "Regular Savings"
5. Click "Create Account"

**Expected Results:**
- Modal opens with member dropdown
- Account created successfully
- Toast notification appears
- New account appears in list
- Account number is auto-generated

#### 2.2 Create Target Savings Account
**Steps:**
1. Click "Open Account"
2. Select member
3. Select "Target Savings" type
4. Enter target amount (e.g., ₦500,000)
5. Enter monthly contribution (e.g., ₦50,000)
6. Click "Create Account"

**Expected Results:**
- Target amount and monthly contribution fields appear
- Account created with target settings
- Account shows in list with "Target Savings" type

#### 2.3 Create Account - Validation Errors
**Steps:**
1. Click "Open Account"
2. Leave member unselected
3. Click "Create Account"

**Expected Results:**
- Error toast: "Please select a member"
- Modal stays open
- No account created

#### 2.4 Process Deposit
**Steps:**
1. Find an active savings account
2. Click deposit button (green down arrow)
3. Enter amount: ₦10,000
4. Select payment method: "Cash"
5. Enter reference (optional)
6. Click "Record Deposit"

**Expected Results:**
- Modal shows account details and current balance
- Deposit processed successfully
- Account balance increases by ₦10,000
- Toast notification confirms deposit

#### 2.5 Process Withdrawal
**Steps:**
1. Find account with balance > ₦5,000
2. Click withdrawal button (red up arrow)
3. Enter amount: ₦5,000
4. Select payment method
5. Click "Process Withdrawal"

**Expected Results:**
- Withdrawal processed
- Balance decreases by ₦5,000
- Toast confirms withdrawal

#### 2.6 Withdrawal - Insufficient Balance
**Steps:**
1. Find account with balance ₦1,000
2. Try to withdraw ₦5,000

**Expected Results:**
- Error: "Insufficient balance"
- Withdrawal not processed
- Balance unchanged

#### 2.7 Search and Filter
**Steps:**
1. Enter member name in search box
2. Press Enter or click Search
3. Change status filter to "Active"
4. Change type filter to "Regular"

**Expected Results:**
- Results filter correctly
- Pagination updates
- Clear filters shows all accounts

---

### 3. Loan Products Tests

#### 3.1 Create Loan Product - Happy Path
**Steps:**
1. Navigate to `/dashboard/cooperatives/loan-products`
2. Click "Add Product"
3. Fill in:
   - Name: "Emergency Loan"
   - Min Amount: ₦10,000
   - Max Amount: ₦500,000
   - Interest Rate: 5%
   - Interest Type: Flat Rate
   - Min Tenure: 1 month
   - Max Tenure: 12 months
4. Click "Create Product"

**Expected Results:**
- Product created successfully
- Appears in product grid
- Shows "Active" badge
- All details display correctly

#### 3.2 Create Product with Guarantor Requirement
**Steps:**
1. Click "Add Product"
2. Fill basic details
3. Toggle "Requires Guarantor" ON
4. Set "Minimum Guarantors" to 2
5. Create product

**Expected Results:**
- Product shows "2 required" for guarantors
- Applications will require 2 guarantors

#### 3.3 Create Product - Validation
**Steps:**
1. Click "Add Product"
2. Leave name empty
3. Click "Create Product"

**Expected Results:**
- Error: "Please fill in all required fields"
- Product not created

#### 3.4 Create Product - Invalid Amount Range
**Steps:**
1. Set Min Amount: ₦100,000
2. Set Max Amount: ₦50,000 (less than min)

**Expected Results:**
- Backend validation error
- Product not created

---

### 4. Loan Application Tests

#### 4.1 Submit Application - Happy Path
**Steps:**
1. Navigate to `/dashboard/cooperatives/applications`
2. Click "New Application"
3. Select loan product
4. Enter amount within product limits
5. Enter tenure within limits
6. Enter purpose
7. Click "Submit Application"

**Expected Results:**
- Application created with "PENDING_REVIEW" status
- Application number generated
- Appears in applications list
- Calculated repayment amounts shown

#### 4.2 Submit Application with Guarantors
**Precondition:** Loan product requires 2 guarantors

**Steps:**
1. Click "New Application"
2. Select product requiring guarantors
3. Fill loan details
4. Select 2 members as guarantors
5. Submit application

**Expected Results:**
- Application created
- Guarantor requests sent to selected members
- Status may show "PENDING_GUARANTORS"

#### 4.3 Submit Application - Insufficient Guarantors
**Steps:**
1. Select product requiring 2 guarantors
2. Select only 1 guarantor
3. Try to submit

**Expected Results:**
- Error: "This loan requires at least 2 guarantor(s)"
- Application not submitted

#### 4.4 Submit Application - Amount Out of Range
**Steps:**
1. Select product with max ₦500,000
2. Enter amount ₦1,000,000
3. Try to submit

**Expected Results:**
- Validation error
- Amount field shows error state

#### 4.5 View Application Details
**Steps:**
1. Click on any application in list
2. Or click eye icon

**Expected Results:**
- Detail page loads
- Shows all loan calculations
- Shows applicant info
- Shows guarantor status (if any)
- Shows appropriate action buttons based on status

#### 4.6 Approve Application
**Precondition:** Application in "PENDING_REVIEW" status

**Steps:**
1. Open application detail
2. Click "Approve" button
3. Add optional comments
4. Confirm approval

**Expected Results:**
- Status changes to "APPROVED"
- "Disburse Loan" button appears
- Review info section shows reviewer

#### 4.7 Reject Application
**Steps:**
1. Open pending application
2. Click "Reject" button
3. Enter rejection reason (required)
4. Confirm rejection

**Expected Results:**
- Status changes to "REJECTED"
- Rejection reason displayed
- No further actions available

#### 4.8 Reject Without Reason
**Steps:**
1. Click "Reject"
2. Leave reason empty
3. Try to confirm

**Expected Results:**
- Error: "Please provide a rejection reason"
- Rejection not processed

#### 4.9 Disburse Loan
**Precondition:** Application is "APPROVED"

**Steps:**
1. Open approved application
2. Click "Disburse Loan"
3. Select disbursement method
4. Enter reference (optional)
5. Confirm disbursement

**Expected Results:**
- Status changes to "DISBURSED"
- Loan record created
- Repayment schedule generated
- Loan appears in Loans page


---

### 5. Guarantor Tests

#### 5.1 View Pending Requests
**Precondition:** Current user's member has been requested as guarantor

**Steps:**
1. Navigate to `/dashboard/cooperatives/guarantors`

**Expected Results:**
- List of pending guarantor requests
- Shows applicant name, loan product, amounts
- Shows guarantee amount for this guarantor
- Accept/Decline buttons visible

#### 5.2 Accept Guarantor Request
**Steps:**
1. Find pending request
2. Click "Accept" button
3. Read confirmation message
4. Confirm acceptance

**Expected Results:**
- Request status changes to "ACCEPTED"
- Request removed from pending list
- Loan application can proceed

#### 5.3 Decline Guarantor Request
**Steps:**
1. Find pending request
2. Click "Decline" button
3. Enter decline reason
4. Confirm decline

**Expected Results:**
- Request status changes to "DECLINED"
- Request removed from pending list
- Applicant notified (if notifications enabled)

#### 5.4 Decline Without Reason
**Steps:**
1. Click "Decline"
2. Leave reason empty
3. Try to confirm

**Expected Results:**
- Error: "Please provide a reason for declining"
- Request not declined

#### 5.5 Empty State
**Precondition:** No pending guarantor requests

**Steps:**
1. Navigate to guarantors page

**Expected Results:**
- "No Pending Requests" message
- Helpful description text
- No error displayed

---

### 6. Active Loans Tests

#### 6.1 View Loans List
**Steps:**
1. Navigate to `/dashboard/cooperatives/loans`

**Expected Results:**
- List of all loans
- Shows loan number, member, product
- Shows principal and outstanding amounts
- Status badges (Active, Overdue, etc.)

#### 6.2 Filter by Status
**Steps:**
1. Select "Overdue" from status filter
2. Click Search

**Expected Results:**
- Only overdue loans displayed
- Count matches filter

#### 6.3 Record Repayment
**Steps:**
1. Find active loan
2. Click repayment button (₦ icon)
3. Enter amount: ₦10,000
4. Select payment method
5. Click "Record Repayment"

**Expected Results:**
- Repayment processed
- Outstanding balance decreases
- Toast confirms repayment
- Loan status may change if fully paid

#### 6.4 Repayment - Overpayment
**Steps:**
1. Loan has outstanding ₦50,000
2. Try to pay ₦100,000

**Expected Results:**
- Either: Error preventing overpayment
- Or: Excess applied to principal/future payments
- (Depends on business rules implementation)

#### 6.5 View Loan Details
**Steps:**
1. Click eye icon on loan row

**Expected Results:**
- Loan detail page loads
- Shows full repayment schedule
- Shows payment history
- Shows guarantor information

---

### 7. Edge Cases & Error Handling

#### 7.1 Network Error Handling
**Steps:**
1. Disconnect network
2. Try any action (create, submit, etc.)

**Expected Results:**
- Error toast displayed
- UI doesn't break
- Can retry after reconnecting

#### 7.2 Session Expiry
**Steps:**
1. Let session expire
2. Try to perform action

**Expected Results:**
- Redirected to login
- Or: Error message about authentication

#### 7.3 Permission Denied
**Steps:**
1. Login as user without FINANCE_APPROVE
2. Try to approve loan application

**Expected Results:**
- Approve button may be hidden
- Or: Error if button visible but action denied

#### 7.4 Concurrent Modification
**Steps:**
1. Open same application in two tabs
2. Approve in tab 1
3. Try to approve in tab 2

**Expected Results:**
- Tab 2 shows error or stale data warning
- Application not double-processed

#### 7.5 Large Data Sets
**Steps:**
1. Create 100+ savings accounts
2. Navigate to savings page

**Expected Results:**
- Pagination works correctly
- Page loads in reasonable time
- Search/filter still functional

#### 7.6 Special Characters in Input
**Steps:**
1. Create loan product with name: "Test <script>alert('xss')</script>"
2. Enter purpose with special chars: "Buy equipment & supplies"

**Expected Results:**
- Data saved correctly
- No XSS vulnerability
- Special characters displayed properly

#### 7.7 Decimal Precision
**Steps:**
1. Create deposit of ₦10,000.50
2. Withdraw ₦5,000.25

**Expected Results:**
- Balance shows ₦5,000.25
- No floating point errors
- Currency formatted correctly

---

### 8. Integration Tests

#### 8.1 Full Loan Lifecycle
**Steps:**
1. Create loan product
2. Create savings account for member
3. Deposit funds to savings
4. Submit loan application
5. (If required) Accept guarantor requests
6. Approve application
7. Disburse loan
8. Make multiple repayments
9. Pay off loan completely

**Expected Results:**
- Each step completes successfully
- Data consistent across all views
- Dashboard stats update correctly
- Loan status changes to "PAID_OFF"

#### 8.2 Multiple Guarantors Flow
**Steps:**
1. Create product requiring 3 guarantors
2. Submit application with 3 guarantors
3. Have 2 accept, 1 decline
4. Verify application status

**Expected Results:**
- Application may be blocked until all accept
- Or: Shows partial guarantor status
- Business rules enforced correctly

#### 8.3 Savings-to-Loan Ratio
**Precondition:** Product has maxLoanToSavingsRatio of 2.0

**Steps:**
1. Member has ₦100,000 in savings
2. Apply for ₦250,000 loan (2.5x savings)

**Expected Results:**
- Application rejected or warning shown
- Ratio limit enforced

---

## Test Data Recommendations

### Minimum Test Data Set

1. **Members**: At least 5 members
   - Member A: Will have savings and loans
   - Member B: Will be guarantor
   - Member C: Will be guarantor
   - Member D: Will have overdue loan
   - Member E: New member, no history

2. **Loan Products**: At least 3 products
   - Emergency Loan: No guarantor, low amount
   - Personal Loan: 1 guarantor, medium amount
   - Business Loan: 2 guarantors, high amount

3. **Savings Accounts**: Various states
   - Active with balance
   - Active with zero balance
   - Dormant account
   - Target savings in progress

4. **Loan Applications**: Various statuses
   - Pending review
   - Approved (not disbursed)
   - Rejected
   - Disbursed (active loan)

5. **Loans**: Various states
   - Active, current
   - Active, overdue
   - Fully paid

---

## Reporting Issues

When reporting bugs, include:
1. Steps to reproduce
2. Expected vs actual behavior
3. Screenshots if UI issue
4. Browser/device information
5. Console errors (if any)
6. Network request/response (for API issues)
