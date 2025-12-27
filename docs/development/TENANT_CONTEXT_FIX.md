# Tenant Context Fix - Subscription Pages

**Date:** December 26, 2025  
**Status:** ✅ Fixed  
**Issue:** Subscription API calls failing with 400 Bad Request

---

## Problem

The subscription pages were throwing errors:
```
Error: Association not found. Provide a valid subdomain or tenant header.
Failed to load resource: the server responded with a status of 400 (Bad Request)
```

### Root Cause

The frontend subscription pages were making API calls without including the tenant context headers (`x-tenant`). The backend tenant middleware requires this header to identify which association the request belongs to in the multi-tenant architecture.

---

## Solution

Added `getTenantHeaders()` utility to all subscription API calls to automatically include tenant context.

### Files Modified

1. **apps/web/src/app/dashboard/subscription/page.tsx**
   - Added import: `import { getTenantHeaders } from '@/utils/tenant'`
   - Updated `fetchSubscription()` to include headers
   - Updated `handleCancelSubscription()` to include headers
   - Updated `handleReactivateSubscription()` to include headers

2. **apps/web/src/app/dashboard/subscription/plans/page.tsx**
   - Added import: `import { getTenantHeaders } from '@/utils/tenant'`
   - Updated `fetchPlans()` to include headers
   - Updated `handleSelectPlan()` to include headers

3. **apps/web/src/types/subscription.ts**
   - Exported `BillingCycle` type (was imported but not re-exported)
   - Added `payments?: any[]` to `SubscriptionWithPlan` interface

---

## Implementation Pattern

### Before (Broken)
```typescript
const response = await fetch(`${API_URL}/api/subscriptions/current`, {
  credentials: 'include',
});
```

### After (Fixed)
```typescript
import { getTenantHeaders } from '@/utils/tenant';

const response = await fetch(`${API_URL}/api/subscriptions/current`, {
  credentials: 'include',
  headers: getTenantHeaders(),
});
```

### For POST Requests with JSON Body
```typescript
const response = await fetch(`${API_URL}/api/subscriptions/initialize`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...getTenantHeaders(),
  },
  credentials: 'include',
  body: JSON.stringify(data),
});
```

---

## How Tenant Context Works

### Frontend (getTenantHeaders)
Located at `apps/web/src/utils/tenant.ts`:

```typescript
export function getTenantHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  
  const subdomain = extractSubdomain(window.location.hostname);
  
  return subdomain ? { 'x-tenant': subdomain } : {};
}
```

**Subdomain Extraction:**
- Development: `demo.localhost:3000` → `demo`
- Production: `demo.societyledger.com` → `demo`
- No subdomain: `localhost:3000` → `{}` (empty headers)

### Backend (Tenant Middleware)
Located at `apps/api/src/middleware/tenant.middleware.ts`:

1. Reads `x-tenant` or `x-tenant-id` header
2. Falls back to subdomain from `Host` header
3. Queries database for association by subdomain/slug/id
4. Validates association status (not suspended/cancelled)
5. Attaches `req.tenant` and `req.tenantId` to request
6. Returns 400 if tenant not found

**Whitelisted Routes (No Tenant Required):**
- `/health`
- `/api/associations/check-subdomain`
- `/api/associations/signup`
- `/api/auth/*` (login, register, me, logout)

---

## Multi-Tenant Architecture

### Why Tenant Context is Required

SocietyLedger is a multi-tenant SaaS where each association (tenant) has:
- Isolated data (members, transactions, payments)
- Separate subscriptions
- Unique subdomain (e.g., `demo.societyledger.com`)

The tenant middleware ensures:
- Data isolation between associations
- Proper subscription validation
- Correct association context for all operations

### URL Structure

**Development:**
```
http://demo.localhost:3000/dashboard/subscription
                ↓
        Tenant: "demo"
```

**Production:**
```
https://demo.societyledger.com/dashboard/subscription
                 ↓
         Tenant: "demo"
```

---

## Testing

### Verify Tenant Headers are Sent

1. Open browser DevTools → Network tab
2. Navigate to subscription page
3. Check API request headers
4. Should see: `x-tenant: demo` (or your subdomain)

### Test Without Subdomain

If accessing via `localhost:3000` (no subdomain):
- Tenant headers will be empty
- Backend will return 400 error
- This is expected behavior

**Solution:** Always use subdomain in development:
```bash
# Add to /etc/hosts (Linux/Mac) or C:\Windows\System32\drivers\etc\hosts (Windows)
127.0.0.1 demo.localhost
```

Then access: `http://demo.localhost:3000`

---

## Common Issues

### Issue 1: Still Getting 400 Errors
**Cause:** Not using subdomain in URL  
**Solution:** Use `demo.localhost:3000` instead of `localhost:3000`

### Issue 2: Tenant Not Found
**Cause:** Association doesn't exist in database  
**Solution:** Create association via signup or seed data

### Issue 3: Headers Not Sent
**Cause:** Forgot to import/use `getTenantHeaders()`  
**Solution:** Add to all API calls that require tenant context

---

## Best Practices

### 1. Always Use getTenantHeaders()
For any API endpoint that requires tenant context:
```typescript
import { getTenantHeaders } from '@/utils/tenant';

fetch(url, {
  headers: getTenantHeaders(),
  credentials: 'include',
});
```

### 2. Check Tenant Middleware Routes
Before adding new API endpoints, check if they need tenant context:
- User-specific data → Requires tenant
- Association-specific data → Requires tenant
- Public data (plans, features) → May not require tenant

### 3. Handle Missing Tenant Gracefully
```typescript
const headers = getTenantHeaders();
if (Object.keys(headers).length === 0) {
  // No tenant context - redirect to login or show error
  router.push('/login');
  return;
}
```

---

## Related Files

**Frontend:**
- `apps/web/src/utils/tenant.ts` - Tenant utilities
- `apps/web/src/lib/tenant.ts` - Server-side tenant resolution
- `apps/web/src/app/dashboard/subscription/page.tsx` - Subscription details
- `apps/web/src/app/dashboard/subscription/plans/page.tsx` - Plan selection

**Backend:**
- `apps/api/src/middleware/tenant.middleware.ts` - Tenant validation
- `apps/api/src/lib/tenant.ts` - Tenant utilities
- `apps/api/src/modules/subscription/subscription.routes.ts` - Subscription routes

---

## Summary

The subscription pages were failing because they weren't sending tenant context to the backend. By adding `getTenantHeaders()` to all API calls, the backend can now properly identify which association the request belongs to, enabling proper multi-tenant data isolation and subscription management.

**Key Takeaway:** In a multi-tenant architecture, always include tenant context headers in API requests to protected endpoints.

---

**Status:** ✅ Fixed and tested  
**Next Steps:** Apply same pattern to any other pages with similar issues
