# Automatic Onboarding Redirect on First Login - Implementation Plan

## Overview
Implement automatic redirect to the onboarding wizard on first successful login after admin approval, with proper role and tenant awareness.

## Current State Analysis
- **OnboardingProgress model** exists with `onboardingComplete` flag at association level
- **User model** has `role`, `platformRole`, `isActive`, and approval status
- **Login flow** redirects to `/dashboard` after successful login
- **Onboarding** is accessible via `/onboarding` and visible in sidebar for admins
- **RBAC** is implemented with `requireAssociationRole` middleware

## Implementation Strategy

### Phase 1: Backend Changes

#### 1.1 Modify Login Response to Include Onboarding Status
**File:** `apps/api/src/modules/auth/auth.controller.ts`

Add onboarding status to login response for association admins:
- Query `OnboardingProgress` for the user's association
- Include `requiresOnboarding` flag in response
- Only apply to association admins (role === 'admin'), not super admins

#### 1.2 Modify `/auth/me` Endpoint
**File:** `apps/api/src/modules/auth/auth.controller.ts`

Include onboarding status in the `/me` response so the frontend can check on page load.

### Phase 2: Frontend Changes

#### 2.1 Update Auth Store
**File:** `apps/web/src/store/authStore.ts`

- Add `requiresOnboarding` to the auth state
- Update login action to capture onboarding status from response
- Update checkAuth to include onboarding status

#### 2.2 Update Login Page Redirect Logic
**File:** `apps/web/src/app/auth/login/page.tsx`

After successful login:
- Check if user is association admin AND `requiresOnboarding` is true
- Redirect to `/onboarding` instead of `/dashboard`

#### 2.3 Update AuthenticatedLayout
**File:** `apps/web/src/components/layout/AuthenticatedLayout.tsx`

Add onboarding redirect check:
- On initial auth check, if user is admin and onboarding not complete, redirect to `/onboarding`
- Skip redirect if already on `/onboarding` path
- Skip redirect for super admins and non-admin users

#### 2.4 Update Sidebar Visibility
**File:** `apps/web/src/components/layout/Sidebar.tsx`

The "Setup Wizard" link is already visible to admins via `PERMISSIONS.SETTINGS_VIEW`. No changes needed.

### Phase 3: Type Updates

#### 3.1 Update User Type
**File:** `apps/web/src/types/index.ts` (or wherever User type is defined)

Add `requiresOnboarding?: boolean` to the User interface.

## Detailed Implementation

### Backend: auth.controller.ts - Login Method

```typescript
// After successful authentication, before generating token:
let requiresOnboarding = false;

// Only check onboarding for association admins (not super admins)
if (user.role === 'admin' && tenantId && !user.platformRole) {
  const onboardingProgress = await prisma.onboardingProgress.findUnique({
    where: { associationId: tenantId },
  });
  
  // Requires onboarding if no progress record exists or onboarding not complete
  requiresOnboarding = !onboardingProgress?.onboardingComplete;
}

// Include in response:
res.status(200).json({
  success: true,
  data: {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      member: user.member,
      association: tenant,
      platformRole: user.platformRole,
      requiresOnboarding, // NEW
    },
    token,
  },
  message: 'Login successful',
});
```

### Backend: auth.controller.ts - Me Method

```typescript
// Add onboarding check for admins
let requiresOnboarding = false;

if (user.role === 'admin' && user.associationId && !user.platformRole) {
  const onboardingProgress = await prisma.onboardingProgress.findUnique({
    where: { associationId: user.associationId },
  });
  requiresOnboarding = !onboardingProgress?.onboardingComplete;
}

res.status(200).json({
  success: true,
  data: { 
    user: {
      ...user,
      requiresOnboarding,
    }
  },
});
```

### Frontend: authStore.ts

```typescript
interface User {
  // ... existing fields
  requiresOnboarding?: boolean;
}

// In login action, after successful response:
set({
  user: {
    ...data.data.user,
    requiresOnboarding: data.data.user.requiresOnboarding,
  },
  // ...
});
```

### Frontend: Login Page

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  // ... existing code
  
  if (success) {
    const { user } = useAuthStore.getState();
    
    // Redirect to onboarding if required
    if (user?.requiresOnboarding && user?.role === 'admin') {
      router.push('/onboarding');
    } else {
      router.push('/dashboard');
    }
  }
};
```

### Frontend: AuthenticatedLayout.tsx

```typescript
useEffect(() => {
  const verifyAuth = async () => {
    await checkAuth();
    setIsChecking(false);
  };

  verifyAuth();
}, [checkAuth]);

// Add onboarding redirect effect
useEffect(() => {
  if (!isChecking && isAuthenticated && user) {
    // Skip if already on onboarding pages
    if (pathname.startsWith('/onboarding')) return;
    
    // Redirect admins who haven't completed onboarding
    if (user.role === 'admin' && user.requiresOnboarding && !user.platformRole) {
      router.push('/onboarding');
    }
  }
}, [isChecking, isAuthenticated, user, pathname, router]);
```

## Acceptance Criteria Verification

| Criteria | Implementation |
|----------|----------------|
| ✅ Approved admin logs in → redirected to onboarding (first time only) | Login checks `requiresOnboarding` flag |
| ✅ Onboarding completion disables future auto-redirects | `onboardingComplete` flag in DB |
| ✅ Onboarding remains available in sidebar (admin-only) | Already implemented via RBAC |
| ✅ No impact on non-admin users or platform super admins | Role checks exclude them |
| ✅ Works across all tenants without leakage | Tenant-scoped queries |

## Files to Modify

1. `apps/api/src/modules/auth/auth.controller.ts` - Add onboarding status to login and me responses
2. `apps/web/src/store/authStore.ts` - Add requiresOnboarding to state
3. `apps/web/src/app/auth/login/page.tsx` - Update redirect logic
4. `apps/web/src/components/layout/AuthenticatedLayout.tsx` - Add onboarding redirect guard
5. `apps/web/src/types/index.ts` - Update User type (if needed)

## Testing Scenarios

1. **New association admin first login** → Should redirect to `/onboarding`
2. **Admin revisits after completing onboarding** → Should go to `/dashboard`
3. **Admin skips onboarding** → Should go to `/dashboard` (skip sets `onboardingComplete`)
4. **Regular member login** → Should go to `/dashboard` (no onboarding check)
5. **Super admin login** → Should go to `/dashboard` (no onboarding check)
6. **Admin manually navigates to onboarding** → Should work anytime
