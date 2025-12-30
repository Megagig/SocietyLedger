# Dashboard Real-Data Integration - Manual Testing Guide

**Phase:** 20  
**Last Updated:** December 30, 2025

This guide covers manual testing procedures for verifying the dashboard real-data integration, including tenant isolation and RBAC compliance.

---

## Prerequisites

Before testing, ensure:

1. **Backend Running:** `npm run dev` in `apps/api` (port 4000)
2. **Frontend Running:** `npm run dev` in `apps/web` (port 3000)
3. **Database Seeded:** At least 2 associations with different data
4. **Test Accounts:** Users in different associations with various roles

### Recommended Test Data Setup

```sql
-- Verify you have multiple associations
SELECT id, name, subdomain FROM "Association" LIMIT 5;

-- Verify members exist in different associations
SELECT a.name, COUNT(m.id) as member_count 
FROM "Association" a 
LEFT JOIN "Member" m ON m."associationId" = a.id 
GROUP BY a.id;

-- Verify transactions exist
SELECT a.name, COUNT(t.id) as transaction_count 
FROM "Association" a 
LEFT JOIN "Transaction" t ON t."associationId" = a.id 
GROUP BY a.id;
```

---

## Test Case 1: Tenant Isolation (TASK-DASH-016)

### Objective
Verify that the dashboard only displays data belonging to the authenticated user's association.

### Test Steps

#### 1.1 Login to Association A

1. Navigate to `http://association-a.localhost:3000/login`
2. Login with a user from Association A
3. Navigate to `/dashboard`
4. **Record the following values:**
   - Total Members count
   - Total Revenue amount
   - Pending Payments count
   - Overdue Payments count
   - Recent transactions (member names)

#### 1.2 Login to Association B

1. Open a new incognito/private browser window
2. Navigate to `http://association-b.localhost:3000/login`
3. Login with a user from Association B
4. Navigate to `/dashboard`
5. **Record the following values:**
   - Total Members count
   - Total Revenue amount
   - Pending Payments count
   - Overdue Payments count
   - Recent transactions (member names)

#### 1.3 Verify Isolation

| Check | Expected Result | Pass/Fail |
|-------|-----------------|-----------|
| Member counts differ between associations | ✅ Different values | |
| Revenue amounts differ | ✅ Different values | |
| Recent transactions show different members | ✅ No overlap in member names | |
| No Association B data visible in Association A | ✅ Complete isolation | |

#### 1.4 API-Level Verification

Using browser DevTools or Postman:

```bash
# Get token from Association A user
curl -X GET http://localhost:4000/api/dashboard/overview \
  -H "Authorization: Bearer <ASSOCIATION_A_TOKEN>" \
  -H "Content-Type: application/json"

# Get token from Association B user  
curl -X GET http://localhost:4000/api/dashboard/overview \
  -H "Authorization: Bearer <ASSOCIATION_B_TOKEN>" \
  -H "Content-Type: application/json"
```

**Expected:** Different data in each response, matching the respective association.

#### 1.5 Cross-Tenant Attack Test

1. Copy the JWT token from Association A
2. Try to access Association B's subdomain with Association A's token
3. **Expected:** Request should be rejected with 403 Forbidden

```bash
curl -X GET http://localhost:4000/api/dashboard/overview \
  -H "Authorization: Bearer <ASSOCIATION_A_TOKEN>" \
  -H "X-Tenant: association-b" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Access denied for this association"
}
```

---

## Test Case 2: RBAC Compliance (TASK-DASH-017)

### Objective
Verify that dashboard data respects user role permissions.

### Test Steps

#### 2.1 Admin User Access

1. Login as an Admin user
2. Navigate to `/dashboard`
3. **Verify:**
   - All stat cards visible (Members, Revenue, Pending, Overdue)
   - Revenue chart displays data
   - Payment methods chart displays data
   - Recent transactions table shows all transactions
   - Quick stats section visible

| Component | Expected for Admin | Pass/Fail |
|-----------|-------------------|-----------|
| Member Stats Card | ✅ Visible with data | |
| Revenue Stats Card | ✅ Visible with data | |
| Pending Payments Card | ✅ Visible with data | |
| Overdue Payments Card | ✅ Visible with data | |
| Revenue Analytics Chart | ✅ Visible with data | |
| Payment Methods Chart | ✅ Visible with data | |
| Recent Transactions | ✅ Visible with all transactions | |
| Quick Stats | ✅ Visible with percentages | |

#### 2.2 Treasurer User Access

1. Login as a Treasurer user
2. Navigate to `/dashboard`
3. **Verify:** Same access as Admin (Treasurers have full financial visibility)

#### 2.3 Financial Secretary Access

1. Login as a Financial Secretary user
2. Navigate to `/dashboard`
3. **Verify:** Same access as Admin (Financial Secretaries have full financial visibility)

#### 2.4 Regular Member Access

1. Login as a regular Member user
2. Navigate to `/dashboard`
3. **Verify:**
   - Dashboard loads without errors
   - Data displayed is association-wide (not member-specific)
   - No sensitive admin-only data exposed

**Note:** Current implementation shows the same dashboard to all authenticated users. If role-based dashboard filtering is required in the future, this test case should be updated.

---

## Test Case 3: Loading States

### Objective
Verify smooth loading experience with skeleton loaders.

### Test Steps

1. Open browser DevTools → Network tab
2. Enable "Slow 3G" throttling
3. Navigate to `/dashboard`
4. **Verify:**
   - Skeleton loaders appear immediately
   - All 4 stat card skeletons visible
   - Chart area skeletons visible
   - Table skeleton visible
   - No layout shift when data loads

| Component | Skeleton Visible | No Layout Shift | Pass/Fail |
|-----------|-----------------|-----------------|-----------|
| Header | ✅ | ✅ | |
| Stat Cards (4) | ✅ | ✅ | |
| Revenue Chart | ✅ | ✅ | |
| Payment Methods Chart | ✅ | ✅ | |
| Quick Stats | ✅ | ✅ | |
| Recent Transactions | ✅ | ✅ | |

---

## Test Case 4: Empty States

### Objective
Verify helpful empty states for new associations.

### Test Steps

1. Create a new association with no members or transactions
2. Login to the new association
3. Navigate to `/dashboard`
4. **Verify:**
   - Welcome message displayed
   - "Add Members" button visible and functional
   - "Set Up Finance" button visible and functional
   - No errors or broken UI

| Component | Expected | Pass/Fail |
|-----------|----------|-----------|
| Welcome message | "Welcome to your Dashboard" | |
| Add Members button | Links to /dashboard/members | |
| Set Up Finance button | Links to /dashboard/finance | |
| No console errors | ✅ | |

---

## Test Case 5: Error Handling

### Objective
Verify graceful error handling when API fails.

### Test Steps

1. Stop the backend server (`Ctrl+C` in apps/api terminal)
2. Navigate to `/dashboard` (or refresh if already there)
3. **Verify:**
   - Error message displayed
   - "Try Again" button visible
   - No unhandled exceptions in console

4. Restart the backend server
5. Click "Try Again" button
6. **Verify:** Dashboard loads successfully

| Scenario | Expected | Pass/Fail |
|----------|----------|-----------|
| API unavailable | Error message shown | |
| Retry button visible | ✅ | |
| Retry works after API restored | ✅ | |
| No console exceptions | ✅ | |

---

## Test Case 6: Data Accuracy

### Objective
Verify dashboard data matches database records.

### Test Steps

1. Query the database directly:

```sql
-- Get member counts for your test association
SELECT status, COUNT(*) 
FROM "Member" 
WHERE "associationId" = <YOUR_ASSOCIATION_ID>
GROUP BY status;

-- Get total payments
SELECT SUM("amountPaid") as total_inflow
FROM "Payment" p
JOIN "Transaction" t ON p."transactionId" = t.id
WHERE t."associationId" = <YOUR_ASSOCIATION_ID>;

-- Get pending/overdue counts
SELECT status, COUNT(*)
FROM "Transaction"
WHERE "associationId" = <YOUR_ASSOCIATION_ID>
AND status IN ('pending', 'partial', 'overdue')
GROUP BY status;
```

2. Compare with dashboard values

| Metric | Database Value | Dashboard Value | Match | Pass/Fail |
|--------|---------------|-----------------|-------|-----------|
| Total Members | | | | |
| Active Members | | | | |
| Total Inflow | | | | |
| Pending Payments | | | | |
| Overdue Payments | | | | |

---

## Test Case 7: Chart Functionality

### Objective
Verify charts render correctly and are interactive.

### Test Steps

1. Navigate to `/dashboard`
2. **Revenue Analytics Chart:**
   - Hover over data points → Tooltip appears with formatted currency
   - Chart shows last 6 months
   - Y-axis shows currency values (₦Xk format)

3. **Payment Methods Chart:**
   - Hover over pie segments → Tooltip shows percentage
   - Legend displays all payment methods
   - Colors match the legend

| Chart | Renders | Tooltips Work | Legend Correct | Pass/Fail |
|-------|---------|---------------|----------------|-----------|
| Revenue Analytics | ✅ | ✅ | N/A | |
| Payment Methods | ✅ | ✅ | ✅ | |

---

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Tenant Isolation | | |
| 2. RBAC Compliance | | |
| 3. Loading States | | |
| 4. Empty States | | |
| 5. Error Handling | | |
| 6. Data Accuracy | | |
| 7. Chart Functionality | | |

**Tested By:** _______________  
**Date:** _______________  
**Environment:** _______________

---

## Known Issues / Limitations

1. **Collection Rate Calculation:** Based on transactions created in the period, not due dates
2. **Revenue Trend:** May show duplicate payments if transaction spans multiple months
3. **No Role-Based Filtering:** All authenticated users see the same dashboard data

---

## Troubleshooting

### Dashboard shows no data but database has records

1. Check JWT token contains correct `associationId`
2. Verify tenant middleware is extracting subdomain correctly
3. Check browser console for API errors

### Charts not rendering

1. Verify Recharts is installed: `npm list recharts`
2. Check for JavaScript errors in console
3. Ensure data arrays are not empty

### Slow dashboard load

1. Check database connection (Neon cold start can take 2-3s)
2. Verify no N+1 queries in service (should use Promise.all)
3. Check network tab for API response time
