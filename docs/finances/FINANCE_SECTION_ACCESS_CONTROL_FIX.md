# Finance Section Access Control Fix

## Updates (January 2, 2026)

### Issues Identified and Fixed

1. **Admin users couldn't see "My Finances"**: Admins are also association members and need to track their own finances
2. **Members couldn't see Elections and Polls**: Members need to participate in governance (voting, polls)
3. **Members couldn't access Cooperative features**: Members need "My Savings", "My Loans", "Apply for Loan", "Guarantor Requests"
4. **Members couldn't see Subscriptions**: Members need to view their subscription details

### Solution Implemented

#### 1. Removed Role Guards from Finance Section ✅
**Problem**: `roleRequired: 'admin'` was blocking the Finance section based on role alone, preventing proper permission checks.

**Fix**: Removed `roleRequired` from Finance and Accounting sections. Now visibility is based solely on permissions:
- Admin users have both `ledger.view` (for Finance section) and `ledger.view_own` (for My Finances section) → See both sections ✅
- Member users only have `ledger.view_own` → Only see My Finances section ✅

#### 2. Updated Permission Mappings ✅
**Problem**: Feature permissions were mapped to admin-only base permissions (`ledger.view`, `members.view`) instead of member-accessible `_own` variants.

**Changes Made**:
```typescript
// apps/web/src/lib/permissions.ts

// Cooperative - Members can view their own data
COOPERATIVE_VIEW: 'ledger.view_own',              // Was: 'ledger.view'
COOPERATIVE_SAVINGS_VIEW: 'ledger.view_own',      // Was: 'ledger.view'
COOPERATIVE_LOANS_VIEW: 'ledger.view_own',        // Was: 'ledger.view'
COOPERATIVE_LOANS_APPLY: 'members.view_own',      // Was: 'ledger.create'
COOPERATIVE_GUARANTOR: 'members.view_own',        // Was: 'ledger.view'

// Governance - Members can participate
MEETING_VIEW: 'members.view_own',                 // Was: 'members.view'
MEETING_ATTENDANCE: 'members.view_own',           // Was: 'members.edit'
ELECTION_VIEW: 'members.view_own',                // Was: 'members.view'
ELECTION_NOMINATE: 'members.view_own',            // Was: 'members.view'
ELECTION_VOTE: 'members.view_own',                // Was: 'members.view'
POLL_VIEW: 'members.view_own',                    // Was: 'members.view'
POLL_VOTE: 'members.view_own',                    // Was: 'members.view'

// Subscription - Members can view their subscription
SUBSCRIPTION_VIEW: 'members.view_own',            // Was: 'settings.view'
```

**Impact**: Members now have access to these sections since they all have the `members.view_own` and `ledger.view_own` permissions.

---

## Original Issue (Fixed January 2, 2026)

## Issue
Members were able to see the admin "Finance" section in the sidebar, which should only be visible to admins. Members should only see "My Finances" section.

## Root Causes
1. **Missing Role Guards**: Sidebar only checked permissions, not roles
2. **Wrong Permissions**: Member role was incorrectly assigned admin-level permissions:
   - `ledger.view` (should be `ledger.view_own`)
   - `payments.view` (should be `payments.view_own`)
   - `members.view` (should be `members.view_own`)

## Solution: Option 3 - Combined Approach

### 1. Frontend Role Guards ✅

**File**: [apps/web/src/components/layout/Sidebar.tsx](../../apps/web/src/components/layout/Sidebar.tsx)

**Changes**:
- Added `roleRequired` property to `NavItem` interface
- Updated `checkPermission` function to validate role requirements first
- Added `roleRequired: 'admin'` to Finance and Accounting sections

```typescript
interface NavItem {
  roleRequired?: 'admin' | 'treasurer' | 'financial_secretary';
  // ... other properties
}

const checkPermission = (
  permission: string | string[] | undefined, 
  roleRequired?: string
): boolean => {
  // Check role requirement first (more restrictive)
  if (roleRequired && user?.role !== roleRequired) {
    return false;
  }
  // ... permission checks
};
```

**Impact**: Members immediately cannot see Finance/Accounting sections even if they have wrong permissions.

### 2. Permission Audit & Fix ✅

**File**: [apps/api/prisma/seeds/rbac-seed.ts](../../apps/api/prisma/seeds/rbac-seed.ts)

**Changes**: Updated `ROLE_PERMISSION_MAPPING.member` to remove admin permissions:

```typescript
member: [
  "members.view_own",    // ✅ Own profile only
  "members.edit_own",    // ✅ Edit own profile
  "ledger.view_own",     // ✅ Personal ledger (was: ledger.view)
  "payments.view_own",   // ✅ Personal payments (was: payments.view)
  "reports.generate",    // ✅ Generate reports
  // ❌ Removed: members.view, ledger.view, payments.view
],
```

**Impact**: New members created after reseed will have correct permissions.

### 3. Database Migration Script ✅

**File**: [apps/api/scripts/fix-member-permissions.ts](../../apps/api/scripts/fix-member-permissions.ts)

**Purpose**: Fix existing members who already have wrong permissions in database.

**What it does**:
1. Finds all users with `role: 'member'`
2. Removes admin-level permissions from their role:
   - `ledger.view` → removed
   - `payments.view` → removed
   - `members.view` → removed
3. Ensures they have correct own-view permissions:
   - `ledger.view_own` ✅
   - `payments.view_own` ✅
   - `members.view_own` ✅
   - `members.edit_own` ✅
   - `reports.generate` ✅

## Running the Fix

### Step 1: Test Frontend Guards
Frontend guards are already active. Test in browser:

```bash
# Login as member user
# Check sidebar - should NOT see "Finance" or "Accounting" sections
# Should only see "My Finances"
```

### Step 2: Run Migration Script

```bash
cd apps/api
npx tsx scripts/fix-member-permissions.ts
```

**Expected Output**:
```
🔧 Starting Member Permissions Fix...

📊 Found X members to audit

❌ Permissions to remove from members:
   - ledger.view
   - payments.view
   - members.view

✅ Permissions members should keep:
   - ledger.view_own
   - payments.view_own
   - members.view_own
   - members.edit_own
   - reports.generate

🔄 Fixing user@example.com...
   Current permissions: members.view, ledger.view, payments.view, ...
   ❌ Removed: ledger.view
   ❌ Removed: payments.view
   ❌ Removed: members.view
   ✅ Fixed!

📈 Summary:
   Total members audited: X
   Members fixed: Y
   Already correct: Z

✨ Member permissions fix completed successfully!
```

### Step 3: Verify in Database

```sql
-- Check member role permissions
SELECT r.name, p.key, rp.canRead, rp.canUpdate
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'member'
ORDER BY p.key;
```

**Expected**: Should only see `_own` permissions, no admin-level permissions.

## Testing Checklist

### As Member User:
- [ ] Login to dashboard
- [ ] Check sidebar navigation
- [ ] Should see "My Finances" section ✅
- [ ] Should NOT see "Finance" section ❌
- [ ] Should NOT see "Accounting" section ❌
- [ ] Can access personal ledger at `/dashboard/member-finance`
- [ ] Can view own payment history
- [ ] Cannot access `/dashboard/finances` (should get 403 or redirect)

### As Admin User:
- [ ] Login to dashboard
- [ ] Check sidebar navigation
- [ ] Should see both "My Finances" AND "Finance" sections ✅
- [ ] Should see "Accounting" section ✅
- [ ] Can access full ledger at `/dashboard/finances`
- [ ] Can view all payments
- [ ] Can manage members

## Permission Model

### Member Permissions (Correct)
```typescript
{
  "ledger.view_own": true,      // Personal ledger only
  "payments.view_own": true,    // Personal payments only
  "members.view_own": true,     // Own profile only
  "members.edit_own": true,     // Edit own profile
  "reports.generate": true      // Generate reports
}
```

### Admin Permissions (For Comparison)
```typescript
{
  "ledger.view": true,           // Full ledger access
  "ledger.create": true,
  "ledger.edit": true,
  "payments.view": true,         // Full payment access
  "payments.create": true,
  "members.view": true,          // Full member list
  "members.create": true,
  "members.edit": true,
  // ... all other permissions
}
```

## Files Modified

1. ✅ [apps/web/src/components/layout/Sidebar.tsx](../../apps/web/src/components/layout/Sidebar.tsx)
   - Added `roleRequired` property to NavItem
   - Updated `checkPermission` function
   - Added role guards to Finance/Accounting sections

2. ✅ [apps/api/prisma/seeds/rbac-seed.ts](../../apps/api/prisma/seeds/rbac-seed.ts)
   - Fixed member role permissions
   - Removed admin-level permissions
   - Kept only `_own` variants

3. ✅ [apps/api/scripts/fix-member-permissions.ts](../../apps/api/scripts/fix-member-permissions.ts)
   - Created migration script
   - Updates existing member permissions

## Next Steps

1. ✅ Frontend guards implemented
2. ✅ RBAC seed fixed
3. ✅ Migration script created
4. 🔲 Run migration script to fix existing members
5. 🔲 Test with member and admin users
6. 🔲 Verify backend API endpoints also check permissions correctly

## Additional Recommendations

### Backend API Protection
Ensure backend endpoints also validate permissions:

```typescript
// Example: Finance endpoints should check for admin role
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'treasurer', 'financial_secretary')
@Get('finances/ledger')
async getFullLedger() {
  // ...
}
```

### Future Improvements
1. Add permission middleware to API routes
2. Create admin audit log for permission changes
3. Add UI indicators for role-specific features
4. Consider feature flags for gradual permission rollout

## Related Documentation

- [RBAC Migration](../dynamic_rbac/README.md)
- [Financial Management](./PHASE3_FINANCIAL_MANAGEMENT_COMPLETE.md)
- [Manual Testing Guide](../hybrid-super-admin/MANUAL_TESTING.md)

---

## Summary of Changes (January 2, 2026)

### Files Modified
1. ✅ [apps/web/src/components/layout/Sidebar.tsx](../../apps/web/src/components/layout/Sidebar.tsx)
   - Removed `roleRequired: 'admin'` from Finance section
   - Removed `roleRequired: 'admin'` from Accounting section
   - Updated Governance section to include `PERMISSIONS.POLL_VIEW` in parent permission array

2. ✅ [apps/web/src/lib/permissions.ts](../../apps/web/src/lib/permissions.ts)
   - Updated `COOPERATIVE_*` permissions to use `ledger.view_own` and `members.view_own`
   - Updated `MEETING_*` permissions to use `members.view_own`
   - Updated `ELECTION_*` and `POLL_*` permissions to use `members.view_own`
   - Updated `SUBSCRIPTION_VIEW` to use `members.view_own`

### Member Access Now Includes
✅ **My Finances** - Personal financial ledger, payments, dues, levies, donations, penalties  
✅ **Cooperatives** - My Savings, My Loans, Apply for Loan, Guarantor Requests  
✅ **Governance** - View Meetings, Elections, Polls (participate/vote)  
✅ **Subscription** - View subscription details and status  

### Admin Access Includes
✅ **My Finances** - Track their own finances (they are members too)  
✅ **Finance** - Full association financial management  
✅ **Accounting** - Full accounting features  
✅ **Cooperatives** - All cooperative features (view all savings, manage loans, loan products)  
✅ **Governance** - Full governance features (create/manage elections, polls, meetings)  
✅ **Subscription** - Full subscription management  

### Testing Checklist

#### As Member User:
- [ ] Can see and access "My Finances" section
- [ ] Can see and access "Cooperatives" → "My Savings", "My Loans", "Apply for Loan", "Guarantor Requests"
- [ ] Can see and access "Governance" → "Elections", "Polls" (to participate/vote)
- [ ] Can see and access "Subscription"
- [ ] **Cannot** see "Finance" section (admin-only)
- [ ] **Cannot** see "Accounting" section (admin-only)
- [ ] **Cannot** see admin-only cooperative features (All Savings, All Loans, Loan Products, Applications)

#### As Admin User:
- [ ] Can see and access **both** "My Finances" AND "Finance" sections
- [ ] Can see and access "Accounting" section
- [ ] Can see and access all "Cooperatives" features (member + admin views)
- [ ] Can see and access all "Governance" features (create/manage + participate)
- [ ] Can see and access "Subscription" with management capabilities

### Design Rationale

**Why use `_own` variants?**
- Maintains security: Members can only access their own data
- Simplifies permission system: No need for separate feature-specific permissions
- Reuses existing RBAC structure: All members already have `members.view_own` and `ledger.view_own`
- Follows principle of least privilege: Members get exactly what they need, nothing more

**Why remove `roleRequired`?**
- Allows proper permission-based access control
- Enables admins to see both admin AND member views (they are members too)
- More flexible: Can add treasurer/financial_secretary roles to Finance section via permissions
- Permission system is sufficient: `ledger.view` vs `ledger.view_own` already separates admin from member access
