# Hybrid Super Admin Architecture - Implementation Tasks

**Document Version:** 1.1  
**Created:** January 1, 2026  
**Updated:** January 1, 2026  
**Status:** IN PROGRESS  
**Depends On:** `PLAN.md` approval

---

## 📋 Task Overview

| Phase | Tasks | Risk | Status |
|-------|-------|------|--------|
| Phase 1: Platform Association | 4 tasks | � Luow | ✅ Complete |
| Phase 2: Context Awareness | 6 tasks | 🟡 Medium | ✅ Complete |
| Phase 3: Impersonation Hardening | 4 tasks | 🟢 Low | ✅ Complete |
| Phase 4: Frontend UX | 5 tasks | 🟢 Low | ✅ Complete |
| Phase 5: Testing & Validation | 4 tasks | 🔴 Critical | ⚪ Not Started |

**Total: 23 tasks (19 complete, 4 remaining)**

---

## 🟢 Phase 1: Platform Association Setup (Low Risk)

### TASK-HSA-001: Create Platform Association Model Enhancement

**Priority:** 🔴 High  
**Risk:** 🟢 Low  
**Estimated Time:** 2 hours

**Description:**  
Add an `isPlatformAssociation` boolean field to the Association model to identify the special "Platform/System Association" that Super Admins belong to.

**Files to Modify:**
- `apps/api/prisma/schema.prisma` (ADD field, not modify existing)

**Schema Change (Additive):**
```prisma
model Association {
  // ... existing fields ...
  
  // NEW: Platform Association flag
  isPlatformAssociation Boolean @default(false) @map("is_platform_association")
}
```

**Acceptance Criteria:**
- [ ] New field added to schema
- [ ] Migration generated and applied
- [ ] Existing associations unaffected (default = false)
- [ ] No breaking changes to existing queries

**Dependencies:** None

---

### TASK-HSA-002: Create Platform Association Seed Script

**Priority:** 🔴 High  
**Risk:** 🟢 Low  
**Estimated Time:** 1 hour

**Description:**  
Create a seed script that creates the "Platform" association if it doesn't exist. This association will be the "home" for Super Admins.

**Files to Create:**
- `apps/api/prisma/seeds/platform-association.seed.ts`

**Implementation:**
```typescript
// Create Platform Association if not exists
const platformAssociation = await prisma.association.upsert({
  where: { subdomain: 'platform' },
  update: {},
  create: {
    name: 'SocietyLedger Platform',
    subdomain: 'platform',
    slug: 'platform',
    tier: 'ENTERPRISE',
    status: 'ACTIVE',
    isPlatformAssociation: true,
    // No subscription required for platform
  }
});
```

**Acceptance Criteria:**
- [ ] Seed script creates Platform Association
- [ ] Idempotent (can run multiple times safely)
- [ ] Platform Association has `isPlatformAssociation = true`
- [ ] Platform Association has `subdomain = 'platform'`

**Dependencies:** TASK-HSA-001

---

### TASK-HSA-003: Migrate Existing Super Admins to Platform Association

**Priority:** 🔴 High  
**Risk:** 🟡 Medium  
**Estimated Time:** 2 hours

**Description:**  
Create a migration script to attach existing Super Admin users (with `associationId = NULL`) to the Platform Association.

**Files to Create:**
- `apps/api/prisma/migrations/YYYYMMDD_attach_super_admins_to_platform/migration.sql`

**Implementation:**
```sql
-- First, ensure Platform Association exists
INSERT INTO associations (name, subdomain, slug, tier, status, is_platform_association, created_at, updated_at)
SELECT 'SocietyLedger Platform', 'platform', 'platform', 'ENTERPRISE', 'ACTIVE', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM associations WHERE subdomain = 'platform');

-- Get Platform Association ID
DO $$
DECLARE
  platform_id INTEGER;
BEGIN
  SELECT id INTO platform_id FROM associations WHERE subdomain = 'platform';
  
  -- Update Super Admins with NULL associationId
  UPDATE users 
  SET association_id = platform_id, updated_at = NOW()
  WHERE platform_role = 'SUPER_ADMIN' AND association_id IS NULL;
END $$;
```

**Acceptance Criteria:**
- [ ] All Super Admins with `associationId = NULL` are updated
- [ ] Super Admins now have `associationId` pointing to Platform Association
- [ ] Existing Super Admins can still login
- [ ] Existing Super Admins can still impersonate
- [ ] No data loss

**Dependencies:** TASK-HSA-001, TASK-HSA-002

**⚠️ REQUIRES MANUAL REVIEW:** Before running, verify count of affected users.

---

### TASK-HSA-004: Update Auth Controller for Platform Association Login

**Priority:** 🔴 High  
**Risk:** 🟢 Low  
**Estimated Time:** 1 hour

**Description:**  
Enhance the login flow to handle Super Admins logging in via the Platform Association subdomain.

**Files to Modify:**
- `apps/api/src/modules/auth/auth.controller.ts` (ENHANCE, not replace)

**Implementation (Additive):**
```typescript
// In login method, after existing user lookup:

// If no user found in tenant, check for platform admin
if (!user) {
  // Check if this is the platform subdomain
  const isPlatformSubdomain = tenant?.subdomain === 'platform' || 
                               req.headers['x-tenant'] === 'platform';
  
  if (isPlatformSubdomain) {
    user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase(), 
        platformRole: 'SUPER_ADMIN',
        association: { isPlatformAssociation: true }
      },
      include: { /* existing includes */ }
    });
  }
}
```

**Acceptance Criteria:**
- [ ] Super Admins can login via `platform.societyledger.com`
- [ ] Super Admins can still login via any subdomain (existing behavior)
- [ ] Regular users unaffected
- [ ] Token includes correct `associationId` (Platform Association ID)

**Dependencies:** TASK-HSA-003

---

## 🟡 Phase 2: Context Awareness Enhancement (Medium Risk)

### TASK-HSA-005: Create Context Types Definition

**Priority:** 🔴 High  
**Risk:** 🟢 Low  
**Estimated Time:** 1 hour

**Description:**  
Define TypeScript types for the three context modes: Tenant, System, and Impersonation.

**Files to Create:**
- `apps/api/src/types/context.types.ts`

**Implementation:**
```typescript
import { PlatformRole } from '@prisma/client';

export enum ContextMode {
  TENANT = 'TENANT',           // Normal tenant operations
  SYSTEM = 'SYSTEM',           // Platform admin operations
  IMPERSONATION = 'IMPERSONATION' // Acting as another tenant
}

export interface ExecutionContext {
  mode: ContextMode;
  userId: number;
  
  // Tenant context (always present for hybrid model)
  homeAssociationId: number;      // User's actual association
  
  // Current operating context
  currentAssociationId: number | null;  // Where user is currently operating
  
  // Impersonation tracking
  isImpersonating: boolean;
  impersonatedAssociationId?: number;
  impersonationStartedAt?: Date;
  
  // Platform context
  platformRole: PlatformRole | null;
  isSystemContext: boolean;
}

export interface EnhancedTokenPayload {
  id: number;
  email: string;
  role: string;
  memberId?: number;
  
  // Association context
  associationId: number;           // Home association (always set)
  currentAssociationId?: number;   // Operating association (if different)
  
  // Platform context
  platformRole?: PlatformRole;
  
  // Impersonation tracking (NEW)
  isImpersonating?: boolean;
  originalAssociationId?: number;  // Home association during impersonation
  impersonationTimestamp?: number; // When impersonation started
}
```

**Acceptance Criteria:**
- [ ] Types defined and exported
- [ ] Types are additive (extend existing, don't replace)
- [ ] Types are well-documented with JSDoc comments

**Dependencies:** None

---

### TASK-HSA-006: Create Context Service

**Priority:** 🔴 High  
**Risk:** 🟢 Low  
**Estimated Time:** 2 hours

**Description:**  
Create a service to determine and manage execution context based on request state.

**Files to Create:**
- `apps/api/src/services/context.service.ts`

**Implementation:**
```typescript
import { Request } from 'express';
import { PlatformRole } from '@prisma/client';
import { ContextMode, ExecutionContext } from '../types/context.types';
import { AuthRequest } from '../middleware/auth.middleware';

export class ContextService {
  /**
   * Determine execution context from request
   * This is READ-ONLY - does not modify request
   */
  static determineContext(req: AuthRequest): ExecutionContext {
    const user = req.user;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const isPlatformAdmin = user.platformRole === PlatformRole.SUPER_ADMIN;
    const isImpersonating = !!user.isImpersonating;
    const homeAssociationId = user.originalAssociationId || user.associationId;
    const currentAssociationId = user.associationId;
    
    // Determine context mode
    let mode: ContextMode;
    
    if (isImpersonating) {
      mode = ContextMode.IMPERSONATION;
    } else if (isPlatformAdmin && req.path.startsWith('/api/admin')) {
      mode = ContextMode.SYSTEM;
    } else {
      mode = ContextMode.TENANT;
    }
    
    return {
      mode,
      userId: user.id,
      homeAssociationId: homeAssociationId!,
      currentAssociationId: currentAssociationId ?? null,
      isImpersonating,
      impersonatedAssociationId: isImpersonating ? currentAssociationId : undefined,
      platformRole: user.platformRole ?? null,
      isSystemContext: mode === ContextMode.SYSTEM
    };
  }
  
  /**
   * Check if user is in system context
   */
  static isSystemContext(req: AuthRequest): boolean {
    return req.user?.platformRole === PlatformRole.SUPER_ADMIN && 
           req.path.startsWith('/api/admin');
  }
  
  /**
   * Check if user is impersonating
   */
  static isImpersonating(req: AuthRequest): boolean {
    return !!req.user?.isImpersonating;
  }
  
  /**
   * Get home association ID (original, not impersonated)
   */
  static getHomeAssociationId(req: AuthRequest): number | null {
    if (req.user?.isImpersonating) {
      return req.user.originalAssociationId ?? null;
    }
    return req.user?.associationId ?? null;
  }
}
```

**Acceptance Criteria:**
- [ ] Service correctly determines context mode
- [ ] Service is read-only (no side effects)
- [ ] Service handles all edge cases
- [ ] Unit tests pass

**Dependencies:** TASK-HSA-005

---

### TASK-HSA-007: Extend Token Payload for Context Tracking

**Priority:** 🔴 High  
**Risk:** 🟡 Medium  
**Estimated Time:** 1 hour

**Description:**  
Extend the JWT token payload to include impersonation tracking fields. This is ADDITIVE - existing fields remain unchanged.

**Files to Modify:**
- `apps/api/src/lib/auth.ts` (EXTEND TokenPayload interface)

**Implementation (Additive):**
```typescript
export interface TokenPayload {
  id: number;
  email: string;
  role: string;
  associationId?: number | null;
  platformRole?: PlatformRole;
  memberId?: number;
  
  // NEW: Impersonation tracking (optional for backward compatibility)
  isImpersonating?: boolean;
  originalAssociationId?: number;  // Home association during impersonation
  impersonationTimestamp?: number; // Unix timestamp when impersonation started
}
```

**Acceptance Criteria:**
- [ ] New fields are optional (backward compatible)
- [ ] Existing token generation still works
- [ ] Existing token verification still works
- [ ] New fields are included when impersonating

**Dependencies:** TASK-HSA-005

---

### TASK-HSA-008: Create Context Detection Middleware

**Priority:** 🔴 High  
**Risk:** 🟡 Medium  
**Estimated Time:** 2 hours

**Description:**  
Create middleware that detects and attaches execution context to requests. This middleware is LAYERED on top of existing middleware, not replacing it.

**Files to Create:**
- `apps/api/src/middleware/context.middleware.ts`

**Implementation:**
```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ContextService } from '../services/context.service';
import { ExecutionContext } from '../types/context.types';

// Extend AuthRequest to include context
export interface ContextAwareRequest extends AuthRequest {
  executionContext?: ExecutionContext;
}

/**
 * Context Detection Middleware
 * 
 * IMPORTANT: This middleware is ADDITIVE and NON-BLOCKING.
 * It attaches context information but does NOT enforce any rules.
 * Enforcement is handled by existing RBAC middleware.
 */
export async function contextMiddleware(
  req: ContextAwareRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Only process if user is authenticated
    if (req.user) {
      req.executionContext = ContextService.determineContext(req);
      
      // Log context for debugging (optional)
      if (process.env.LOG_CONTEXT === 'true') {
        console.log(`[Context] Mode: ${req.executionContext.mode}, ` +
                    `User: ${req.user.id}, ` +
                    `Association: ${req.executionContext.currentAssociationId}`);
      }
    }
    
    next();
  } catch (error) {
    // Non-blocking - log error but continue
    console.error('[Context Middleware] Error:', error);
    next();
  }
}
```

**Acceptance Criteria:**
- [ ] Middleware attaches context to request
- [ ] Middleware is non-blocking (errors don't stop request)
- [ ] Middleware works with existing auth middleware
- [ ] No changes to existing request flow

**Dependencies:** TASK-HSA-006, TASK-HSA-007

---

### TASK-HSA-009: Integrate Context Middleware into Server

**Priority:** 🔴 High  
**Risk:** 🟢 Low  
**Estimated Time:** 30 minutes

**Description:**  
Add the context middleware to the Express server middleware stack, AFTER auth middleware.

**Files to Modify:**
- `apps/api/src/server.ts` or `apps/api/src/app.ts` (wherever middleware is registered)

**Implementation (Additive):**
```typescript
import { contextMiddleware } from './middleware/context.middleware';

// ... existing middleware ...

// Add context middleware AFTER auth middleware
app.use(contextMiddleware);

// ... existing routes ...
```

**Acceptance Criteria:**
- [ ] Context middleware runs after auth middleware
- [ ] Existing middleware order preserved
- [ ] No breaking changes to existing routes

**Dependencies:** TASK-HSA-008

---

### TASK-HSA-010: Add Context Logging to Audit Service

**Priority:** 🟡 Medium  
**Risk:** 🟢 Low  
**Estimated Time:** 1 hour

**Description:**  
Enhance audit logging to include execution context information for better traceability.

**Files to Modify:**
- Audit log creation points (additive metadata)

**Implementation:**
```typescript
// When creating audit logs, include context if available
await prisma.auditLog.create({
  data: {
    // ... existing fields ...
    
    // Enhanced context (stored in newValues JSON)
    newValues: {
      ...existingNewValues,
      _context: {
        mode: req.executionContext?.mode,
        isImpersonating: req.executionContext?.isImpersonating,
        homeAssociationId: req.executionContext?.homeAssociationId,
        currentAssociationId: req.executionContext?.currentAssociationId,
      }
    }
  }
});
```

**Acceptance Criteria:**
- [ ] Audit logs include context metadata
- [ ] Existing audit log structure preserved
- [ ] Context stored in JSON field (flexible)

**Dependencies:** TASK-HSA-008

---

## 🟢 Phase 3: Impersonation Hardening (Low Risk)

### TASK-HSA-011: Enhance Impersonation Token Generation

**Priority:** 🔴 High  
**Risk:** 🟢 Low  
**Estimated Time:** 1 hour

**Description:**  
Enhance the impersonate endpoint to include tracking fields in the generated token. This is ADDITIVE to existing logic.

**Files to Modify:**
- `apps/api/src/modules/admin/admin.controller.ts` (ENHANCE impersonate method)

**Current Implementation (DO NOT REMOVE):**
```typescript
const payload: TokenPayload = {
  id: superAdmin.id,
  email: superAdmin.email,
  role: 'admin',
  associationId: targetAssociationId,
  platformRole: superAdmin.platformRole,
};
```

**Enhanced Implementation (ADDITIVE):**
```typescript
const payload: TokenPayload = {
  id: superAdmin.id,
  email: superAdmin.email,
  role: 'admin',
  associationId: targetAssociationId,
  platformRole: superAdmin.platformRole,
  
  // NEW: Impersonation tracking
  isImpersonating: true,
  originalAssociationId: superAdmin.associationId, // Home association
  impersonationTimestamp: Date.now(),
};
```

**Acceptance Criteria:**
- [ ] Token includes `isImpersonating: true`
- [ ] Token includes `originalAssociationId`
- [ ] Token includes `impersonationTimestamp`
- [ ] Existing impersonation flow unchanged
- [ ] Existing audit logging preserved

**Dependencies:** TASK-HSA-007

---

### TASK-HSA-012: Create End Impersonation Endpoint

**Priority:** 🟡 Medium  
**Risk:** 🟢 Low  
**Estimated Time:** 1 hour

**Description:**  
Create an endpoint to explicitly end impersonation and return to the Super Admin's home association.

**Files to Modify:**
- `apps/api/src/modules/admin/admin.controller.ts` (ADD new method)
- `apps/api/src/modules/admin/admin.routes.ts` (ADD new route)

**Implementation:**
```typescript
// In admin.controller.ts
async endImpersonation(req: AuthRequest, res: Response) {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    if (!user.isImpersonating) {
      return res.status(400).json({ 
        success: false, 
        message: 'Not currently impersonating' 
      });
    }
    
    // Log end of impersonation
    await prisma.auditLog.create({
      data: {
        associationId: user.associationId,
        userId: user.id,
        action: 'END_IMPERSONATION',
        tableName: 'associations',
        recordId: user.associationId,
        newValues: { 
          endedBy: user.email,
          originalAssociationId: user.originalAssociationId,
          duration: Date.now() - (user.impersonationTimestamp || 0)
        },
      },
    });
    
    // Generate new token for home association
    const payload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: 'admin',
      associationId: user.originalAssociationId,
      platformRole: user.platformRole,
      // No impersonation flags
    };
    
    const token = generateToken(payload);
    
    return res.json({
      success: true,
      data: { token },
      message: 'Impersonation ended. Returned to home association.',
    });
  } catch (error) {
    console.error('End impersonation error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// In admin.routes.ts
router.post('/end-impersonation', (req, res) => ctrl.endImpersonation(req as any, res));
```

**Acceptance Criteria:**
- [ ] Endpoint returns token for home association
- [ ] Impersonation end is logged
- [ ] Duration of impersonation is tracked
- [ ] Error handling for non-impersonating users

**Dependencies:** TASK-HSA-011

---

### TASK-HSA-013: Enhance Impersonation Audit Logging

**Priority:** 🟡 Medium  
**Risk:** 🟢 Low  
**Estimated Time:** 1 hour

**Description:**  
Enhance all audit logs created during impersonation to include impersonation metadata.

**Files to Create:**
- `apps/api/src/utils/audit-helpers.ts`

**Implementation:**
```typescript
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

export interface AuditContext {
  isImpersonating: boolean;
  performedByUserId: number;
  originalAssociationId?: number;
  impersonatedAssociationId?: number;
}

export function getAuditContext(req: AuthRequest): AuditContext {
  return {
    isImpersonating: !!req.user?.isImpersonating,
    performedByUserId: req.user?.id || 0,
    originalAssociationId: req.user?.originalAssociationId,
    impersonatedAssociationId: req.user?.isImpersonating ? req.user?.associationId : undefined,
  };
}

export async function createAuditLogWithContext(
  req: AuthRequest,
  data: {
    associationId: number | null;
    action: string;
    tableName: string;
    recordId: number | null;
    oldValues?: any;
    newValues?: any;
  }
) {
  const context = getAuditContext(req);
  
  return prisma.auditLog.create({
    data: {
      ...data,
      userId: req.user?.id,
      newValues: {
        ...(data.newValues || {}),
        _auditContext: context,
      },
    },
  });
}
```

**Acceptance Criteria:**
- [ ] Helper function extracts audit context
- [ ] Audit logs include impersonation metadata
- [ ] Existing audit log creation unaffected
- [ ] Context stored in JSON field

**Dependencies:** TASK-HSA-011

---

### TASK-HSA-014: Add Impersonation Duration Limit (Optional)

**Priority:** 🟢 Low  
**Risk:** 🟢 Low  
**Estimated Time:** 1 hour

**Description:**  
Add optional configuration for impersonation token expiry (shorter than normal tokens).

**Files to Modify:**
- `apps/api/src/modules/admin/admin.controller.ts` (ENHANCE impersonate method)

**Implementation:**
```typescript
// In impersonate method
const IMPERSONATION_EXPIRY = process.env.IMPERSONATION_EXPIRY || '4h'; // Default 4 hours

const token = jwt.sign(payload, JWT_SECRET, { 
  expiresIn: IMPERSONATION_EXPIRY 
});
```

**Acceptance Criteria:**
- [ ] Impersonation tokens have configurable expiry
- [ ] Default expiry is reasonable (4 hours)
- [ ] Environment variable override available
- [ ] Existing token generation unaffected

**Dependencies:** TASK-HSA-011

---

## 🟢 Phase 4: Frontend UX Enhancement (Low Risk)

### TASK-HSA-015: Create Context Indicator Component

**Priority:** 🟡 Medium  
**Risk:** 🟢 Low  
**Estimated Time:** 2 hours

**Description:**  
Create a visual indicator component that shows the current execution context (Tenant, System, or Impersonation mode).

**Files to Create:**
- `apps/web/src/components/layout/ContextIndicator.tsx`

**Implementation:**
```typescript
'use client';

import { useAuthStore } from '@/store/authStore';

export function ContextIndicator() {
  const { user, isImpersonating, impersonatedAssociation } = useAuthStore();
  
  // Only show for Super Admins
  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }
  
  if (isImpersonating && impersonatedAssociation) {
    return (
      <div className="bg-amber-500 text-white px-4 py-2 text-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="animate-pulse">⚠️</span>
          <span>
            Impersonating: <strong>{impersonatedAssociation.name}</strong>
          </span>
        </div>
        <button
          onClick={() => {/* End impersonation */}}
          className="bg-amber-600 hover:bg-amber-700 px-3 py-1 rounded text-xs font-medium"
        >
          End Impersonation
        </button>
      </div>
    );
  }
  
  // System context indicator (optional, subtle)
  return (
    <div className="bg-blue-600 text-white px-4 py-1 text-xs flex items-center gap-2">
      <span>🔧</span>
      <span>Platform Admin Mode</span>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Component shows impersonation warning (amber)
- [ ] Component shows platform admin indicator (blue)
- [ ] "End Impersonation" button visible during impersonation
- [ ] Only visible to Super Admins
- [ ] Responsive design

**Dependencies:** TASK-HSA-016

---

### TASK-HSA-016: Extend Auth Store for Context State

**Priority:** 🔴 High  
**Risk:** 🟢 Low  
**Estimated Time:** 1 hour

**Description:**  
Extend the Zustand auth store to track impersonation state and context.

**Files to Modify:**
- `apps/web/src/store/authStore.ts` (EXTEND, not replace)

**Implementation (Additive):**
```typescript
interface AuthState {
  // ... existing state ...
  
  // NEW: Context tracking
  isImpersonating: boolean;
  impersonatedAssociation: { id: number; name: string; subdomain: string } | null;
  originalAssociationId: number | null;
  
  // NEW: Actions
  setImpersonation: (association: { id: number; name: string; subdomain: string }) => void;
  endImpersonation: () => Promise<void>;
}

// In store implementation
isImpersonating: false,
impersonatedAssociation: null,
originalAssociationId: null,

setImpersonation: (association) => {
  set({
    isImpersonating: true,
    impersonatedAssociation: association,
    originalAssociationId: get().user?.associationId || null,
  });
},

endImpersonation: async () => {
  const token = get().token;
  if (!token) return;
  
  try {
    const response = await fetch(API_ROUTES.ADMIN.END_IMPERSONATION, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    
    const data = await response.json();
    if (data.success) {
      set({
        token: data.data.token,
        isImpersonating: false,
        impersonatedAssociation: null,
        originalAssociationId: null,
      });
    }
  } catch (error) {
    console.error('Failed to end impersonation:', error);
  }
},
```

**Acceptance Criteria:**
- [ ] Store tracks impersonation state
- [ ] Store tracks impersonated association details
- [ ] `endImpersonation` action calls API and updates state
- [ ] Existing store functionality preserved

**Dependencies:** TASK-HSA-012

---

### TASK-HSA-017: Add API Route Constant for End Impersonation

**Priority:** 🟢 Low  
**Risk:** 🟢 Low  
**Estimated Time:** 15 minutes

**Description:**  
Add the new end impersonation endpoint to the API routes constants.

**Files to Modify:**
- `apps/web/src/utils/constants.ts` (ADD new constant)

**Implementation:**
```typescript
export const API_ROUTES = {
  // ... existing routes ...
  
  ADMIN: {
    // ... existing admin routes ...
    END_IMPERSONATION: `${API_BASE_URL}/admin/end-impersonation`,
  },
};
```

**Acceptance Criteria:**
- [ ] New constant added
- [ ] Existing constants unchanged

**Dependencies:** TASK-HSA-012

---

### TASK-HSA-018: Integrate Context Indicator into Layout

**Priority:** 🟡 Medium  
**Risk:** 🟢 Low  
**Estimated Time:** 30 minutes

**Description:**  
Add the ContextIndicator component to the authenticated layout.

**Files to Modify:**
- `apps/web/src/components/layout/AuthenticatedLayout.tsx` (ADD component)

**Implementation:**
```typescript
import { ContextIndicator } from './ContextIndicator';

export function AuthenticatedLayout({ children }) {
  return (
    <div>
      <ContextIndicator />
      {/* ... existing layout ... */}
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Context indicator appears at top of layout
- [ ] Indicator visible on all authenticated pages
- [ ] Layout structure unchanged

**Dependencies:** TASK-HSA-015

---

### TASK-HSA-019: Update Impersonation Flow in Admin UI

**Priority:** 🟡 Medium  
**Risk:** 🟢 Low  
**Estimated Time:** 1 hour

**Description:**  
Update the admin associations page to use the new auth store impersonation tracking.

**Files to Modify:**
- `apps/web/src/app/admin/associations/page.tsx` (ENHANCE impersonate handler)

**Implementation:**
```typescript
const handleImpersonate = async (associationId: number, associationName: string, subdomain: string) => {
  try {
    const response = await fetch(`${API_ROUTES.ADMIN.IMPERSONATE}/${associationId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    
    const data = await response.json();
    if (data.success) {
      // Update auth store with new token
      setToken(data.data.token);
      
      // Track impersonation state
      setImpersonation({
        id: associationId,
        name: associationName,
        subdomain: subdomain,
      });
      
      // Redirect to dashboard
      router.push('/dashboard');
    }
  } catch (error) {
    console.error('Impersonation failed:', error);
  }
};
```

**Acceptance Criteria:**
- [ ] Impersonation updates auth store
- [ ] Context indicator shows after impersonation
- [ ] Redirect to dashboard works
- [ ] Existing impersonation flow preserved

**Dependencies:** TASK-HSA-016

---

## 🔴 Phase 5: Testing & Validation (Critical)

### TASK-HSA-020: Create Regression Test Suite

**Priority:** 🔴 Critical  
**Risk:** 🔴 High  
**Estimated Time:** 3 hours

**Description:**  
Create comprehensive tests to verify existing functionality is unchanged.

**Files to Create:**
- `apps/api/src/__tests__/hybrid-super-admin/regression.test.ts`

**Test Cases:**
```typescript
describe('Hybrid Super Admin - Regression Tests', () => {
  describe('Existing User Behavior', () => {
    it('Regular members can login and access their association', async () => {});
    it('Association admins can manage their association', async () => {});
    it('Tenant isolation prevents cross-association access', async () => {});
    it('RBAC permissions are enforced for regular users', async () => {});
  });
  
  describe('Existing Impersonation Behavior', () => {
    it('Super Admin can impersonate any association', async () => {});
    it('Impersonation generates valid token', async () => {});
    it('Impersonation is logged to audit log', async () => {});
    it('Impersonated token has correct associationId', async () => {});
  });
  
  describe('Existing Admin Routes', () => {
    it('Super Admin can access /api/admin routes', async () => {});
    it('Regular users cannot access /api/admin routes', async () => {});
    it('Admin stats endpoint returns correct data', async () => {});
  });
});
```

**Acceptance Criteria:**
- [ ] All regression tests pass
- [ ] Tests cover critical user flows
- [ ] Tests verify tenant isolation
- [ ] Tests verify RBAC enforcement

**Dependencies:** All previous tasks

---

### TASK-HSA-021: Create New Feature Test Suite

**Priority:** 🔴 Critical  
**Risk:** 🟡 Medium  
**Estimated Time:** 2 hours

**Description:**  
Create tests for new hybrid super admin features.

**Files to Create:**
- `apps/api/src/__tests__/hybrid-super-admin/new-features.test.ts`

**Test Cases:**
```typescript
describe('Hybrid Super Admin - New Features', () => {
  describe('Platform Association', () => {
    it('Platform Association exists with isPlatformAssociation=true', async () => {});
    it('Super Admins have associationId pointing to Platform Association', async () => {});
    it('Super Admin can login via platform subdomain', async () => {});
  });
  
  describe('Context Detection', () => {
    it('Context middleware attaches context to request', async () => {});
    it('System context detected for /api/admin routes', async () => {});
    it('Tenant context detected for regular routes', async () => {});
    it('Impersonation context detected when impersonating', async () => {});
  });
  
  describe('Enhanced Impersonation', () => {
    it('Impersonation token includes isImpersonating flag', async () => {});
    it('Impersonation token includes originalAssociationId', async () => {});
    it('End impersonation returns to home association', async () => {});
    it('End impersonation is logged', async () => {});
  });
});
```

**Acceptance Criteria:**
- [ ] All new feature tests pass
- [ ] Tests cover context detection
- [ ] Tests cover enhanced impersonation
- [ ] Tests cover Platform Association

**Dependencies:** All previous tasks

---

### TASK-HSA-022: Manual Testing Checklist

**Priority:** 🔴 Critical  
**Risk:** 🟢 Low  
**Estimated Time:** 2 hours

**Description:**  
Create and execute manual testing checklist for end-to-end validation.

**Files to Create:**
- `docs/hybrid-super-admin/TESTING_CHECKLIST.md`

**Checklist:**
```markdown
## Manual Testing Checklist

### Regular User Flows (Must Pass)
- [ ] Regular member can login via association subdomain
- [ ] Regular member can view their dashboard
- [ ] Regular member cannot access other associations
- [ ] Association admin can manage members
- [ ] Association admin can manage finances
- [ ] RBAC permissions work correctly

### Super Admin Flows (Must Pass)
- [ ] Super Admin can login via platform subdomain
- [ ] Super Admin can access Platform Dashboard
- [ ] Super Admin can view all associations
- [ ] Super Admin can impersonate an association
- [ ] Context indicator shows during impersonation
- [ ] Super Admin can end impersonation
- [ ] Super Admin returns to Platform Association after ending impersonation
- [ ] All impersonation actions are logged

### Edge Cases (Must Pass)
- [ ] Super Admin impersonating cannot access other associations
- [ ] Super Admin impersonating has tenant RBAC applied
- [ ] Token expiry works correctly
- [ ] Invalid tokens are rejected
- [ ] Concurrent impersonation sessions work correctly
```

**Acceptance Criteria:**
- [ ] Checklist created
- [ ] All items tested and passing
- [ ] Issues documented and resolved

**Dependencies:** All previous tasks

---

### TASK-HSA-023: Documentation Update

**Priority:** 🟡 Medium  
**Risk:** 🟢 Low  
**Estimated Time:** 1 hour

**Description:**  
Create comprehensive documentation for the hybrid super admin architecture.

**Files to Create:**
- `docs/hybrid-super-admin/ARCHITECTURE.md`

**Content:**
```markdown
# Hybrid Super Admin Architecture

## Overview
[Explain the hybrid model]

## Context Modes
[Explain Tenant, System, Impersonation modes]

## Security Boundaries
[Explain access control matrix]

## Impersonation Flow
[Explain impersonation with diagrams]

## Audit Trail
[Explain what is logged and where]

## Troubleshooting
[Common issues and solutions]
```

**Acceptance Criteria:**
- [ ] Architecture documented
- [ ] Context modes explained
- [ ] Security boundaries clear
- [ ] Troubleshooting guide included

**Dependencies:** All previous tasks

---

## 📊 Task Summary

| Task ID | Name | Phase | Priority | Risk | Est. Time |
|---------|------|-------|----------|------|-----------|
| HSA-001 | Platform Association Model | 1 | 🔴 High | 🟢 Low | 2h |
| HSA-002 | Platform Association Seed | 1 | 🔴 High | 🟢 Low | 1h |
| HSA-003 | Migrate Super Admins | 1 | 🔴 High | 🟡 Med | 2h |
| HSA-004 | Auth Controller Update | 1 | 🔴 High | 🟢 Low | 1h |
| HSA-005 | Context Types | 2 | 🔴 High | 🟢 Low | 1h |
| HSA-006 | Context Service | 2 | 🔴 High | 🟢 Low | 2h |
| HSA-007 | Token Payload Extension | 2 | 🔴 High | 🟡 Med | 1h |
| HSA-008 | Context Middleware | 2 | 🔴 High | 🟡 Med | 2h |
| HSA-009 | Middleware Integration | 2 | 🔴 High | 🟢 Low | 0.5h |
| HSA-010 | Audit Context Logging | 2 | 🟡 Med | 🟢 Low | 1h |
| HSA-011 | Enhanced Impersonation Token | 3 | 🔴 High | 🟢 Low | 1h |
| HSA-012 | End Impersonation Endpoint | 3 | 🟡 Med | 🟢 Low | 1h |
| HSA-013 | Impersonation Audit Helpers | 3 | 🟡 Med | 🟢 Low | 1h |
| HSA-014 | Impersonation Duration Limit | 3 | 🟢 Low | 🟢 Low | 1h |
| HSA-015 | Context Indicator Component | 4 | 🟡 Med | 🟢 Low | 2h |
| HSA-016 | Auth Store Extension | 4 | 🔴 High | 🟢 Low | 1h |
| HSA-017 | API Route Constant | 4 | 🟢 Low | 🟢 Low | 0.25h |
| HSA-018 | Layout Integration | 4 | 🟡 Med | 🟢 Low | 0.5h |
| HSA-019 | Admin UI Update | 4 | 🟡 Med | 🟢 Low | 1h |
| HSA-020 | Regression Tests | 5 | 🔴 Crit | 🔴 High | 3h |
| HSA-021 | New Feature Tests | 5 | 🔴 Crit | 🟡 Med | 2h |
| HSA-022 | Manual Testing | 5 | 🔴 Crit | 🟢 Low | 2h |
| HSA-023 | Documentation | 5 | 🟡 Med | 🟢 Low | 1h |

**Total Estimated Time: ~29 hours (~4-5 days)**

---

## ✅ Approval Checklist

Before implementation begins, please confirm:

- [ ] Plan reviewed and approved
- [ ] Clarification questions answered
- [ ] Risk assessment accepted
- [ ] Timeline accepted
- [ ] No concerns about backward compatibility

---

**Document Status:** PENDING APPROVAL  
**Next Step:** Await approval, then begin Phase 1 implementation
