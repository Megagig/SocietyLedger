# Database-Driven RBAC - Manual Testing Guide

## Prerequisites

1. Application running locally
2. Database seeded with RBAC data
3. Test users with different roles
4. API testing tool (Postman, curl, or browser DevTools)

## Test Users Setup

Create these test users for comprehensive testing:

| Email | Role | Association |
|-------|------|-------------|
| admin@test.com | admin | Test Association |
| treasurer@test.com | treasurer | Test Association |
| secretary@test.com | secretary | Test Association |
| member@test.com | member | Test Association |
| superadmin@test.com | SUPER_ADMIN | Platform |

## Test Cases

### 1. Authentication & Permission Loading

#### TC-RBAC-001: Login Returns Permissions

**Steps:**
1. POST `/api/auth/login` with admin credentials
2. Check response body

**Expected:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "admin@test.com",
      "permissions": ["member.view", "member.create", "finance.view", ...]
    },
    "token": "..."
  }
}
```

**Verify:**
- [ ] `permissions` array is present
- [ ] Array contains expected permissions for admin role
- [ ] No duplicate permissions

#### TC-RBAC-002: Auth/Me Returns Permissions

**Steps:**
1. GET `/api/auth/me` with valid token
2. Check response body

**Expected:**
- Same permissions array as login response

---

### 2. Permission Enforcement

#### TC-RBAC-003: Admin Can Access All Routes

**Steps:**
1. Login as admin
2. Access each protected route:
   - GET `/api/members`
   - GET `/api/finance/overview`
   - GET `/api/settings/association/profile`
   - GET `/api/admin/audit-logs`

**Expected:**
- All routes return 200 OK

#### TC-RBAC-004: Member Cannot Access Admin Routes

**Steps:**
1. Login as member
2. Try to access:
   - GET `/api/finance/overview`
   - POST `/api/members`
   - GET `/api/settings/financial`

**Expected:**
```json
{
  "success": false,
  "message": "Permission denied",
  "requiredPermission": "finance.view"
}
```
- Status: 403 Forbidden

#### TC-RBAC-005: Treasurer Can Access Finance Only

**Steps:**
1. Login as treasurer
2. Access finance routes: ✓
3. Try to access member management: ✗

**Expected:**
- Finance routes: 200 OK
- Member create: 403 Forbidden

---

### 3. Role Management

#### TC-RBAC-006: List Roles

**Steps:**
1. Login as admin
2. GET `/api/rbac/roles`

**Expected:**
```json
{
  "success": true,
  "data": {
    "roles": [
      { "id": 1, "name": "admin", "isSystem": true, "permissionCount": 50 },
      { "id": 2, "name": "treasurer", "isSystem": true, "permissionCount": 15 }
    ]
  }
}
```

#### TC-RBAC-007: Create Custom Role

**Steps:**
1. Login as admin
2. POST `/api/rbac/roles`
```json
{
  "name": "auditor",
  "description": "Read-only access to financial data"
}
```

**Expected:**
- Status: 201 Created
- Role created with `isSystem: false`

#### TC-RBAC-008: Cannot Delete System Role

**Steps:**
1. Login as admin
2. DELETE `/api/rbac/roles/1` (admin role)

**Expected:**
```json
{
  "success": false,
  "message": "Cannot delete system role"
}
```
- Status: 400 Bad Request

#### TC-RBAC-009: Assign Permissions to Role

**Steps:**
1. Login as admin
2. POST `/api/rbac/roles/:roleId/permissions`
```json
{
  "permissionIds": [1, 2, 3]
}
```

**Expected:**
- Status: 200 OK
- Permissions assigned

**Verify:**
- GET role details shows new permissions

---

### 4. User Role Assignment

#### TC-RBAC-010: Assign Role to User

**Steps:**
1. Login as admin
2. POST `/api/rbac/users/:userId/roles`
```json
{
  "roleId": 2
}
```

**Expected:**
- Status: 200 OK
- User now has role

**Verify:**
1. User logs in again
2. Permissions array includes new role's permissions

#### TC-RBAC-011: Remove Role from User

**Steps:**
1. Login as admin
2. DELETE `/api/rbac/users/:userId/roles/:roleId`

**Expected:**
- Status: 200 OK
- Role removed

**Verify:**
- User's permissions no longer include that role's permissions

#### TC-RBAC-012: User Can Have Multiple Roles

**Steps:**
1. Assign both `treasurer` and `secretary` roles to user
2. User logs in

**Expected:**
- Permissions array contains union of both roles' permissions
- No duplicate permissions

---

### 5. Super Admin Bypass

#### TC-RBAC-013: Super Admin Bypasses All Checks

**Steps:**
1. Login as SUPER_ADMIN
2. Access any protected route without specific permission

**Expected:**
- All routes return 200 OK
- No permission denied errors

#### TC-RBAC-014: Super Admin Can Access All Associations

**Steps:**
1. Login as SUPER_ADMIN
2. Access data from different associations

**Expected:**
- Can view/modify any association's data

---

### 6. Frontend Permission Checks

#### TC-RBAC-015: Sidebar Shows Correct Items

**Steps:**
1. Login as member
2. Check sidebar navigation

**Expected:**
- Only shows items user has permission for
- Finance section hidden (no finance.view)
- Settings section hidden (no settings.view)

#### TC-RBAC-016: Can Component Hides Unauthorized Content

**Steps:**
1. Login as member
2. Navigate to dashboard
3. Check for "Create Member" button

**Expected:**
- Button not visible (wrapped in `<Can permission="member.create">`)

#### TC-RBAC-017: Permission Check on Page Load

**Steps:**
1. Login as member
2. Directly navigate to `/dashboard/finance/overview`

**Expected:**
- Redirected or shown "Access Denied" message
- Not shown finance data

---

### 7. Cache Behavior

#### TC-RBAC-018: Permission Changes Take Effect

**Steps:**
1. Login as user with `member` role
2. Admin adds `finance.view` permission to member role
3. User refreshes page or re-authenticates

**Expected:**
- User now has `finance.view` permission
- Can access finance routes

#### TC-RBAC-019: Role Removal Takes Effect

**Steps:**
1. User has `treasurer` role
2. Admin removes role from user
3. User refreshes/re-authenticates

**Expected:**
- User no longer has treasurer permissions
- Finance routes return 403

---

### 8. Audit Logging

#### TC-RBAC-020: Permission Checks Are Logged

**Prerequisites:**
- `RBAC_AUDIT_ENABLED=true` in environment

**Steps:**
1. Make several API requests with different users
2. Check audit logs: GET `/api/admin/audit-logs`

**Expected:**
- Logs show permission check entries
- Each entry has: userId, permission, result, route, timestamp

---

### 9. Edge Cases

#### TC-RBAC-021: User With No Roles

**Steps:**
1. Create user without assigning any roles
2. User logs in

**Expected:**
- Empty permissions array
- All protected routes return 403

#### TC-RBAC-022: Invalid Permission Name

**Steps:**
1. Try to check non-existent permission
2. Middleware handles gracefully

**Expected:**
- Returns 403 (permission not found = not granted)
- No server error

#### TC-RBAC-023: Association Isolation

**Steps:**
1. User in Association A tries to access Association B data
2. Even with correct permission

**Expected:**
- 403 Forbidden or 404 Not Found
- Cannot access other association's data

---

## Regression Test Checklist

Run these tests after any RBAC changes:

- [ ] Login returns permissions
- [ ] Admin can access all routes
- [ ] Member restricted appropriately
- [ ] Role CRUD operations work
- [ ] Permission assignment works
- [ ] User role assignment works
- [ ] Super admin bypass works
- [ ] Frontend hides unauthorized content
- [ ] Cache invalidation works
- [ ] Audit logging works

## Performance Testing

### Load Test Scenarios

1. **Concurrent Permission Checks**
   - 100 concurrent requests to protected routes
   - Expected: < 100ms response time

2. **Cache Effectiveness**
   - First request: May be slower (cache miss)
   - Subsequent requests: < 50ms (cache hit)

3. **Large Permission Sets**
   - User with 100+ permissions
   - Login should complete < 500ms

## Troubleshooting Test Failures

| Symptom | Possible Cause | Solution |
|---------|---------------|----------|
| Empty permissions array | RBAC not seeded | Run `npx prisma db seed` |
| Always 403 | User has no roles | Assign role to user |
| Cache not updating | Cache TTL | Wait 5 minutes or restart server |
| Frontend shows wrong items | Stale user data | Clear localStorage, re-login |
