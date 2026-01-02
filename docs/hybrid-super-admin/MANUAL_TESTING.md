# Hybrid Super Admin - Manual Testing Guide

**Version:** 1.0  
**Created:** January 1, 2026  
**Test Environment:** Development/Staging  

---

## 🎯 Testing Overview

This guide provides step-by-step manual testing procedures to validate the Hybrid Super Admin Architecture implementation. Tests are organized by functionality and include expected results for verification.

### Test Categories
1. **Platform Association Setup** - Verify platform association creation and migration
2. **Authentication & Login** - Test login flows for Super Admins
3. **Context Detection** - Validate context modes and middleware
4. **Impersonation Flow** - Test complete impersonation lifecycle
5. **Frontend UX** - Verify visual indicators and user experience
6. **Audit & Security** - Validate logging and security measures
7. **Regression Testing** - Ensure existing functionality is preserved

---

## 🧪 Test Environment Setup

### Prerequisites
- ✅ Fresh database with schema applied (`npx prisma db push`)
- ✅ Seed data loaded (`npm run seed`)
- ✅ At least 2 associations created (1 platform + 1 regular)
- ✅ Super Admin user exists
- ✅ Regular admin and member users exist

### Test Data Requirements
```sql
-- Verify test data exists
SELECT 'Platform Association' as type, COUNT(*) as count 
FROM associations WHERE is_platform_association = true
UNION ALL
SELECT 'Regular Associations', COUNT(*) 
FROM associations WHERE is_platform_association = false
UNION ALL
SELECT 'Super Admins', COUNT(*) 
FROM users WHERE platform_role = 'SUPER_ADMIN'
UNION ALL
SELECT 'Regular Admins', COUNT(*) 
FROM users WHERE role = 'admin' AND platform_role IS NULL;
```

**Expected Results:**
- Platform Association: 1
- Regular Associations: ≥1
- Super Admins: ≥1
- Regular Admins: ≥1

---

## 📋 Test Cases

## 1. Platform Association Setup Tests

### TEST-HSA-001: Verify Platform Association Creation
**Objective:** Confirm Platform Association exists with correct properties

**Steps:**
1. Connect to database
2. Execute query:
   ```sql
   SELECT id, name, subdomain, slug, is_platform_association, tier, status
   FROM associations 
   WHERE is_platform_association = true;
   ```

**Expected Results:**
- ✅ Exactly 1 record returned
- ✅ `name` = "SocietyLedger Platform"
- ✅ `subdomain` = "platform"
- ✅ `slug` = "platform"
- ✅ `is_platform_association` = true
- ✅ `tier` = "ENTERPRISE"
- ✅ `status` = "ACTIVE"

---

### TEST-HSA-002: Verify Super Admin Migration
**Objective:** Confirm existing Super Admins are attached to Platform Association

**Steps:**
1. Execute query:
   ```sql
   SELECT u.id, u.email, u.platform_role, u.association_id, a.name as association_name
   FROM users u
   LEFT JOIN associations a ON u.association_id = a.id
   WHERE u.platform_role = 'SUPER_ADMIN';
   ```

**Expected Results:**
- ✅ All Super Admins have `association_id` (not NULL)
- ✅ All Super Admins belong to Platform Association
- ✅ `association_name` = "SocietyLedger Platform"

---

## 2. Authentication & Login Tests

### TEST-HSA-003: Super Admin Login via Platform Subdomain (Primary Method)
**Objective:** Verify Super Admin can login via platform.societyledger.com

**Steps:**
1. Navigate to `http://platform.localhost:3000/auth/login` (dev) or `https://platform.societyledger.com/auth/login` (prod)
2. Enter Super Admin credentials
3. Click "Login"
4. Check browser network tab for login request
5. Verify redirect to dashboard

**Expected Results:**
- ✅ Login successful (200 response)
- ✅ Token received in response
- ✅ Redirected to `/dashboard`
- ✅ No error messages displayed
- ✅ Platform Association context established

---

### TEST-HSA-004: Super Admin Login via Root Domain (Legacy Compatibility)
**Objective:** Verify backward compatibility - Super Admin can login via root domain

**Steps:**
1. Navigate to `http://localhost:3000/auth/login` (dev) or `https://societyledger.com/auth/login` (prod)
2. Enter Super Admin credentials
3. Click "Login"
4. Verify successful login

**Expected Results:**
- ✅ Login successful
- ✅ Token received
- ✅ Access granted (backward compatibility maintained)
- ✅ Auth controller fallback logic works

---

### TEST-HSA-004b: Super Admin Login via Regular Association Subdomain
**Objective:** Verify Super Admin can still login via any association subdomain

**Steps:**
1. Navigate to `http://testassoc.localhost:3000/auth/login` (dev) or `https://testassoc.societyledger.com/auth/login` (prod)
2. Enter Super Admin credentials
3. Click "Login"
4. Verify successful login

**Expected Results:**
- ✅ Login successful
- ✅ Token received
- ✅ Access granted (backward compatibility maintained)

---

### TEST-HSA-005: Regular User Login (Regression)
**Objective:** Ensure regular users can still login normally

**Steps:**
1. Navigate to regular association subdomain
2. Login with regular admin/member credentials
3. Verify normal functionality

**Expected Results:**
- ✅ Login successful
- ✅ Normal dashboard access
- ✅ No impersonation indicators visible
- ✅ Standard functionality works

---

## 3. Context Detection Tests

### TEST-HSA-006: Context Middleware Integration
**Objective:** Verify context middleware is properly integrated

**Steps:**
1. Login as Super Admin
2. Open browser developer tools → Network tab
3. Navigate to `/admin/associations`
4. Check request headers and response

**Expected Results:**
- ✅ Request processed successfully
- ✅ No middleware errors in console
- ✅ Context information available in request (check server logs if `LOG_CONTEXT=true`)

---

### TEST-HSA-007: System Context Detection
**Objective:** Verify system context is detected for admin routes

**Steps:**
1. Login as Super Admin
2. Navigate to `/admin/stats`
3. Check server logs (if `LOG_CONTEXT=true`)

**Expected Results:**
- ✅ Context mode: SYSTEM
- ✅ Admin routes accessible
- ✅ Platform admin functionality works

---

## 4. Impersonation Flow Tests

### TEST-HSA-008: Start Impersonation
**Objective:** Test complete impersonation initiation flow

**Steps:**
1. Login as Super Admin
2. Navigate to `/admin/associations`
3. Click on any association to view details
4. Click "👤 Impersonate" button
5. Observe page behavior and UI changes

**Expected Results:**
- ✅ Success toast message appears
- ✅ Redirected to `/dashboard`
- ✅ Amber impersonation banner appears at top
- ✅ Banner shows association name being impersonated
- ✅ "End Impersonation" button visible in banner

---

### TEST-HSA-009: Impersonation Token Validation
**Objective:** Verify impersonation token contains correct tracking data

**Steps:**
1. Complete TEST-HSA-008 (start impersonation)
2. Open browser developer tools → Application → Local Storage
3. Find `auth-storage` key
4. Decode the stored data

**Expected Results:**
- ✅ `isImpersonating` = true
- ✅ `impersonatedAssociation` contains target association details
- ✅ `originalAssociationId` contains Platform Association ID
- ✅ Token updated with impersonation data

---

### TEST-HSA-010: Impersonation Context Functionality
**Objective:** Verify functionality works correctly during impersonation

**Steps:**
1. While impersonating (from TEST-HSA-008)
2. Navigate to `/dashboard/members`
3. Try to view/edit member data
4. Navigate to `/dashboard/transactions`
5. Verify data belongs to impersonated association

**Expected Results:**
- ✅ Member data belongs to impersonated association
- ✅ Transaction data belongs to impersonated association
- ✅ No access to other associations' data
- ✅ All functionality works normally within impersonated context

---

### TEST-HSA-011: End Impersonation via Button
**Objective:** Test ending impersonation using the UI button

**Steps:**
1. While impersonating (from TEST-HSA-008)
2. Click "End Impersonation" button in amber banner
3. Observe page behavior and UI changes

**Expected Results:**
- ✅ Success toast message appears
- ✅ Amber banner disappears
- ✅ Redirected to `/admin` (Super Admin dashboard)
- ✅ Back to Platform Association context
- ✅ Local storage updated (impersonation flags cleared)

---

### TEST-HSA-012: End Impersonation via API
**Objective:** Test ending impersonation via direct API call

**Steps:**
1. Start impersonation (TEST-HSA-008)
2. Open browser developer tools → Console
3. Execute:
   ```javascript
   fetch('/api/admin/end-impersonation', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${localStorage.getItem('auth-storage') && JSON.parse(localStorage.getItem('auth-storage')).state.token}`,
       'Content-Type': 'application/json'
     },
     credentials: 'include'
   }).then(r => r.json()).then(console.log);
   ```

**Expected Results:**
- ✅ Response: `success: true`
- ✅ New token returned in response
- ✅ Duration information included
- ✅ Association details included

---

### TEST-HSA-013: Impersonation Token Expiry
**Objective:** Verify impersonation tokens expire correctly

**Steps:**
1. Set `IMPERSONATION_TOKEN_EXPIRY=1m` in environment
2. Restart server
3. Start impersonation
4. Wait 2 minutes
5. Try to access any protected route

**Expected Results:**
- ✅ Token expires after 1 minute
- ✅ 401 Unauthorized response
- ✅ User redirected to login
- ✅ Impersonation state cleared

**Cleanup:** Reset `IMPERSONATION_TOKEN_EXPIRY` to default value

---

## 5. Frontend UX Tests

### TEST-HSA-014: Context Indicator Visibility
**Objective:** Verify context indicator shows only for Super Admins

**Steps:**
1. Login as Super Admin → Check for indicator
2. Login as regular admin → Check for indicator
3. Login as member → Check for indicator

**Expected Results:**
- ✅ Super Admin: Context indicator present (subtle or hidden when not impersonating)
- ✅ Regular admin: No context indicator
- ✅ Member: No context indicator

---

### TEST-HSA-015: Impersonation Banner Styling
**Objective:** Verify impersonation banner is visually prominent

**Steps:**
1. Start impersonation
2. Check banner appearance and styling
3. Verify banner is clearly visible

**Expected Results:**
- ✅ Amber/orange background color
- ✅ White text for contrast
- ✅ Warning icon (⚠️) visible
- ✅ Association name prominently displayed
- ✅ "End Impersonation" button clearly visible
- ✅ Banner spans full width of page

---

### TEST-HSA-016: Responsive Design
**Objective:** Verify impersonation banner works on mobile devices

**Steps:**
1. Start impersonation
2. Open browser developer tools
3. Switch to mobile view (iPhone/Android simulation)
4. Verify banner layout

**Expected Results:**
- ✅ Banner remains visible on mobile
- ✅ Text remains readable
- ✅ "End Impersonation" button accessible
- ✅ No layout overflow issues

---

### TEST-HSA-017: State Persistence
**Objective:** Verify impersonation state persists across page reloads

**Steps:**
1. Start impersonation
2. Refresh the page (F5)
3. Navigate to different pages
4. Close and reopen browser tab

**Expected Results:**
- ✅ Impersonation banner remains after refresh
- ✅ State persists across navigation
- ✅ State persists across browser tab close/reopen
- ✅ Functionality continues to work correctly

---

## 6. Audit & Security Tests

### TEST-HSA-018: Impersonation Audit Logging
**Objective:** Verify all impersonation actions are properly logged

**Steps:**
1. Start impersonation (note timestamp)
2. Perform some actions (create member, transaction, etc.)
3. End impersonation (note timestamp)
4. Check audit logs:
   ```sql
   SELECT created_at, action, new_values, user_id
   FROM audit_logs 
   WHERE action IN ('IMPERSONATE', 'END_IMPERSONATION')
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

**Expected Results:**
- ✅ `IMPERSONATE` action logged with target association details
- ✅ `END_IMPERSONATION` action logged with duration
- ✅ All actions during impersonation include context metadata
- ✅ Timestamps match test execution times

---

### TEST-HSA-019: Enhanced Audit Context
**Objective:** Verify audit logs include context information

**Steps:**
1. While impersonating, create a new member
2. Check the audit log for member creation:
   ```sql
   SELECT new_values
   FROM audit_logs 
   WHERE action = 'MEMBER_CREATED'
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

**Expected Results:**
- ✅ `new_values` contains `_auditContext` object
- ✅ Context includes `isImpersonating: true`
- ✅ Context includes `originalAssociationId`
- ✅ Context includes `impersonatedAssociationId`

---

### TEST-HSA-020: Security Isolation
**Objective:** Verify impersonation doesn't leak data between associations

**Steps:**
1. Note current association's member count
2. Start impersonating different association
3. Navigate to `/dashboard/members`
4. Count members displayed
5. End impersonation
6. Navigate to `/dashboard/members` again

**Expected Results:**
- ✅ Member count during impersonation matches target association
- ✅ Member count after ending matches original association
- ✅ No data leakage between associations
- ✅ Proper tenant isolation maintained

---

## 7. Regression Tests

### TEST-HSA-021: Regular Admin Functionality
**Objective:** Ensure regular admins are unaffected by changes

**Steps:**
1. Login as regular association admin
2. Test core functionality:
   - View dashboard
   - Manage members
   - Process transactions
   - Generate reports

**Expected Results:**
- ✅ All functionality works as before
- ✅ No impersonation indicators visible
- ✅ No access to platform admin features
- ✅ Performance unchanged

---

### TEST-HSA-022: Member Functionality
**Objective:** Ensure members are unaffected by changes

**Steps:**
1. Login as regular member
2. Test member functionality:
   - View profile
   - View transactions
   - Make payments (if applicable)

**Expected Results:**
- ✅ All functionality works as before
- ✅ No admin features visible
- ✅ No impersonation indicators
- ✅ Performance unchanged

---

### TEST-HSA-023: API Backward Compatibility
**Objective:** Verify existing API endpoints still work

**Steps:**
1. Test existing API endpoints with regular users:
   ```bash
   # Test member endpoints
   curl -H "Authorization: Bearer <member_token>" \
        http://localhost:4000/api/members
   
   # Test admin endpoints
   curl -H "Authorization: Bearer <admin_token>" \
        http://localhost:4000/api/transactions
   ```

**Expected Results:**
- ✅ All existing endpoints return expected data
- ✅ Response formats unchanged
- ✅ No breaking changes introduced

---

## 8. Performance Tests

### TEST-HSA-024: Context Middleware Performance
**Objective:** Verify context middleware doesn't impact performance

**Steps:**
1. Use browser developer tools → Network tab
2. Login and navigate through several pages
3. Measure request response times
4. Compare with baseline (if available)

**Expected Results:**
- ✅ Response times within acceptable range (<100ms overhead)
- ✅ No noticeable performance degradation
- ✅ Memory usage stable

---

### TEST-HSA-025: Token Size Impact
**Objective:** Verify JWT token size increase is minimal

**Steps:**
1. Login as Super Admin (normal token)
2. Decode JWT and measure size
3. Start impersonation (enhanced token)
4. Decode JWT and measure size
5. Calculate difference

**Expected Results:**
- ✅ Token size increase <200 bytes
- ✅ No HTTP header size limits exceeded
- ✅ Token parsing performance acceptable

---

## 🚨 Error Scenarios

### TEST-HSA-026: Invalid Impersonation Target
**Objective:** Test error handling for invalid association ID

**Steps:**
1. Login as Super Admin
2. Manually call impersonation API with invalid ID:
   ```javascript
   fetch('/api/admin/impersonate/99999', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` }
   })
   ```

**Expected Results:**
- ✅ 404 error returned
- ✅ Error message: "Association not found"
- ✅ No impersonation state created
- ✅ User remains in original context

---

### TEST-HSA-027: End Impersonation Without Active Session
**Objective:** Test error handling when not impersonating

**Steps:**
1. Login as Super Admin (don't start impersonation)
2. Call end impersonation API:
   ```javascript
   fetch('/api/admin/end-impersonation', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` }
   })
   ```

**Expected Results:**
- ✅ 400 error returned
- ✅ Error message: "Not currently impersonating any association"
- ✅ No state changes

---

### TEST-HSA-028: Expired Impersonation Token
**Objective:** Test behavior with expired impersonation token

**Steps:**
1. Set very short expiry (`IMPERSONATION_TOKEN_EXPIRY=1s`)
2. Start impersonation
3. Wait for token to expire
4. Try to access protected route

**Expected Results:**
- ✅ 401 Unauthorized response
- ✅ Redirect to login page
- ✅ Impersonation state cleared from frontend
- ✅ Appropriate error message displayed

---

## 📊 Test Results Template

### Test Execution Summary

**Test Date:** ___________  
**Tester:** ___________  
**Environment:** ___________  
**Browser:** ___________  

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| HSA-001 | Platform Association Creation | ⚪ | |
| HSA-002 | Super Admin Migration | ⚪ | |
| HSA-003 | Platform Subdomain Login | ⚪ | |
| HSA-004 | Regular Subdomain Login | ⚪ | |
| HSA-005 | Regular User Login | ⚪ | |
| HSA-006 | Context Middleware | ⚪ | |
| HSA-007 | System Context Detection | ⚪ | |
| HSA-008 | Start Impersonation | ⚪ | |
| HSA-009 | Impersonation Token | ⚪ | |
| HSA-010 | Impersonation Functionality | ⚪ | |
| HSA-011 | End Impersonation (Button) | ⚪ | |
| HSA-012 | End Impersonation (API) | ⚪ | |
| HSA-013 | Token Expiry | ⚪ | |
| HSA-014 | Context Indicator Visibility | ⚪ | |
| HSA-015 | Banner Styling | ⚪ | |
| HSA-016 | Responsive Design | ⚪ | |
| HSA-017 | State Persistence | ⚪ | |
| HSA-018 | Audit Logging | ⚪ | |
| HSA-019 | Enhanced Audit Context | ⚪ | |
| HSA-020 | Security Isolation | ⚪ | |
| HSA-021 | Regular Admin Regression | ⚪ | |
| HSA-022 | Member Regression | ⚪ | |
| HSA-023 | API Backward Compatibility | ⚪ | |
| HSA-024 | Performance Impact | ⚪ | |
| HSA-025 | Token Size Impact | ⚪ | |
| HSA-026 | Invalid Impersonation | ⚪ | |
| HSA-027 | End Without Session | ⚪ | |
| HSA-028 | Expired Token | ⚪ | |

**Legend:**
- ✅ Pass
- ❌ Fail  
- ⚠️ Pass with Issues
- ⚪ Not Tested

### Overall Results
- **Total Tests:** 28
- **Passed:** ___
- **Failed:** ___
- **Issues:** ___

### Critical Issues Found
_List any critical issues that block deployment_

### Non-Critical Issues Found
_List any minor issues or improvements needed_

### Recommendations
_Testing team recommendations for deployment_

---

## 🔧 Troubleshooting Guide

### Common Test Failures

#### "Platform Association not found"
**Cause:** Seed script not run or failed  
**Solution:** Run `npm run seed` and verify database

#### "Context indicator not showing"
**Cause:** Component not imported or auth store issue  
**Solution:** Check browser console for errors, verify auth store state

#### "Impersonation token invalid"
**Cause:** Token expiry or malformed token  
**Solution:** Check token expiry settings, verify JWT secret

#### "Audit logs missing context"
**Cause:** Context middleware not registered  
**Solution:** Verify middleware order in server.ts

---

## 📝 Test Data Cleanup

After testing, clean up test data:

```sql
-- Remove test impersonation audit logs
DELETE FROM audit_logs 
WHERE action IN ('IMPERSONATE', 'END_IMPERSONATION')
AND created_at > '2026-01-01';

-- Reset any test associations if needed
-- (Be careful not to delete production data)
```

---

**Testing Team:** ___________  
**Review Date:** ___________  
**Approval:** ___________  

---

*This testing guide should be executed before any deployment of the Hybrid Super Admin Architecture to production environments.*