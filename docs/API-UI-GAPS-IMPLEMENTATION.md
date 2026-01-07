# API-UI Gaps Implementation Guide

**Date:** January 7, 2026  
**Status:** Ready to Implement  
**Priority:** 🔴 CRITICAL

---

## Executive Summary

Comprehensive codebase audit revealed **6 major gaps** where fully functional backend APIs exist without corresponding frontend UI. This represents **82 tasks** of high-value work that can be completed in **3-4 weeks** with **zero risk** to existing functionality.

---

## The Gaps

| # | Module | Backend | Frontend | Endpoints | Tasks | Priority | Time |
|---|--------|---------|----------|-----------|-------|----------|------|
| 1 | SMS/Communications | ✅ 100% | ❌ None | 10+ | 18 | 🔴 HIGH | 4-6 days |
| 2 | Nigerian Payments | ✅ 100% | ❌ None | 24+ | 22 | 🔴 CRITICAL | 5-7 days |
| 3 | Exports Management | ✅ 100% | ⚠️ Scattered | 6 | 12 | 🟡 MEDIUM | 2-3 days |
| 4 | Webhooks | ✅ 100% | ❌ None | - | 10 | 🟢 LOW | 2-3 days |
| 5 | Cron Jobs | ✅ 100% | ❌ None | - | 8 | 🟢 LOW | 2-3 days |
| 6 | Notifications Center | ✅ 100% | ⚠️ Dropdown | 6 | 10 | 🟡 MEDIUM | 2-3 days |
| **TOTAL** | - | - | - | **46+** | **82** | - | **18-25 days** |

---

## Implementation Timeline (25 Days)

### Week 1: Critical - Revenue Impact

**Days 1-7: Phase 3.6 - Nigerian Payments UI** 🔴 CRITICAL
- **Why First:** Essential for African market, 24+ endpoints unused
- **Impact:** Enable payment reconciliation, bank transfer tracking, statement import
- **Tasks:** 22 tasks (Bank accounts, transfers, reconciliation, verification)

**Days 8-13: Phase 6.6 - SMS/Communications UI** 🔴 HIGH
- **Why Second:** High-value differentiator, 10+ endpoints ready
- **Impact:** Enable bulk SMS, campaigns, templates, message tracking
- **Tasks:** 18 tasks (Dashboard, quick send, campaigns, templates, history)

### Week 2: High Value - User Experience

**Days 14-16: Phase 10.5 - Exports Management UI** 🟡 MEDIUM
- **Why Third:** Centralizes scattered export functionality
- **Impact:** Export history, re-download, custom builder
- **Tasks:** 12 tasks (Dashboard, history, quick actions, custom builder)

**Days 17-19: Phase 6.7 - Notifications Center UI** 🟡 MEDIUM
- **Why Fourth:** Enhances existing notification system
- **Impact:** Full notification page, preferences, history
- **Tasks:** 10 tasks (Center page, preferences, archive)

### Week 3: Admin Tools - Low Priority

**Days 20-22: Phase 14 - Webhooks Management UI** 🟢 LOW
- **Why Fifth:** Admin/developer monitoring tool
- **Impact:** Webhook logs, retry failed, testing
- **Tasks:** 10 tasks (Dashboard, logs, testing)

**Days 23-25: Phase 15 - Cron Jobs Management UI** 🟢 LOW
- **Why Last:** Admin monitoring tool only
- **Impact:** Job status, manual triggers, logs
- **Tasks:** 8 tasks (Dashboard, logs, configuration)

---

## Quick Start: Phase 3.6 (Nigerian Payments UI)

### Backend Ready (No Changes Needed)

**Location:** `apps/api/src/modules/nigerian-payments/`

**24+ Endpoints Available:**
```
Bank Accounts:
GET    /api/nigerian-payments/bank-accounts
POST   /api/nigerian-payments/bank-accounts
GET    /api/nigerian-payments/bank-accounts/:id
PUT    /api/nigerian-payments/bank-accounts/:id
DELETE /api/nigerian-payments/bank-accounts/:id

Bank Transfers:
POST   /api/nigerian-payments/bank-transfers
GET    /api/nigerian-payments/bank-transfers
GET    /api/nigerian-payments/bank-transfers/:id

Reconciliation:
POST   /api/nigerian-payments/reconciliation/match
POST   /api/nigerian-payments/reconciliation/auto-match
GET    /api/nigerian-payments/reconciliation/unmatched

Import & Verification:
POST   /api/nigerian-payments/statement-import
POST   /api/nigerian-payments/payment-proof
GET    /api/nigerian-payments/payment-proof/:id
POST   /api/nigerian-payments/verify/:id

Dashboard:
GET    /api/nigerian-payments/dashboard
```

### Frontend Structure to Create

```
apps/web/src/app/dashboard/payments/
├── page.tsx                    # Payments Dashboard (4 tasks)
├── bank-accounts/
│   └── page.tsx               # Bank Accounts CRUD (4 tasks)
├── bank-transfers/
│   ├── page.tsx               # Transfers List (3 tasks)
│   └── new/
│       └── page.tsx           # Record Transfer Form (2 tasks)
├── reconciliation/
│   └── page.tsx               # Reconciliation Interface (5 tasks)
├── import/
│   └── page.tsx               # CSV Import (2 tasks)
└── verification/
    └── page.tsx               # Verification Queue (2 tasks)
```

### Step 1: Create API Client (Day 1 Morning)

**File:** `apps/web/src/lib/api/nigerian-payments.ts`

```typescript
import { apiGet, apiPost, apiPut, apiDelete } from './client';

export const nigerianPaymentsApi = {
  // Bank Accounts
  getBankAccounts: () => apiGet('/api/nigerian-payments/bank-accounts'),
  createBankAccount: (data: any) => apiPost('/api/nigerian-payments/bank-accounts', data),
  updateBankAccount: (id: string, data: any) => apiPut(`/api/nigerian-payments/bank-accounts/${id}`, data),
  deleteBankAccount: (id: string) => apiDelete(`/api/nigerian-payments/bank-accounts/${id}`),

  // Bank Transfers
  getBankTransfers: (params?: any) => apiGet('/api/nigerian-payments/bank-transfers', params),
  createBankTransfer: (data: any) => apiPost('/api/nigerian-payments/bank-transfers', data),
  getBankTransferDetails: (id: string) => apiGet(`/api/nigerian-payments/bank-transfers/${id}`),

  // Reconciliation
  getUnmatchedPayments: () => apiGet('/api/nigerian-payments/reconciliation/unmatched'),
  autoMatch: () => apiPost('/api/nigerian-payments/reconciliation/auto-match'),
  manualMatch: (data: any) => apiPost('/api/nigerian-payments/reconciliation/match', data),

  // Import & Verification
  importStatement: (data: FormData) => apiPost('/api/nigerian-payments/statement-import', data),
  uploadPaymentProof: (data: FormData) => apiPost('/api/nigerian-payments/payment-proof', data),
  verifyPayment: (id: string, data: any) => apiPost(`/api/nigerian-payments/verify/${id}`, data),

  // Dashboard
  getDashboard: () => apiGet('/api/nigerian-payments/dashboard'),
};
```

### Step 2: Create Dashboard Page (Day 1 Afternoon)

**File:** `apps/web/src/app/dashboard/payments/page.tsx`

**Features:**
- Pending verification count card
- Unmatched transfers count card
- Today's payments summary
- Bank account balances
- Recent payment activity table
- Quick action buttons

**Permission:** `PAYMENT_RECORD`, `PAYMENT_VERIFY`

### Step 3-7: Continue with Other Pages (Days 2-7)

Follow the task breakdown in `task.md` Phase 3.6 section.

---

## Safety Checklist

### Before Starting Any Phase

- [ ] Review backend endpoints and test in Postman/Thunder Client
- [ ] Identify required RBAC permissions
- [ ] Map out route structure
- [ ] Create API client functions first
- [ ] Test backend responses with real data

### During Development

- [ ] Use existing UI components (Mantine)
- [ ] Follow existing patterns (Can component for permissions)
- [ ] Test each endpoint integration immediately
- [ ] Never modify existing pages/components
- [ ] Keep routes isolated and independent

### After Each Phase

- [ ] Full E2E testing of new module
- [ ] Verify existing features still work (smoke test)
- [ ] Test permission boundaries
- [ ] Check responsive design (mobile)
- [ ] Add navigation links to sidebar
- [ ] Update documentation

---

## Integration Points

### Add to Navigation Sidebar

**File:** `apps/web/src/components/Sidebar.tsx` (or equivalent)

```typescript
// Add to navigation items
{
  label: 'Communications',
  href: '/dashboard/communications',
  icon: MessageSquare,
  permission: 'SMS_SEND',
},
{
  label: 'Payments',
  href: '/dashboard/payments',
  icon: CreditCard,
  permission: 'PAYMENT_RECORD',
},
{
  label: 'Exports',
  href: '/dashboard/exports',
  icon: Download,
  permission: 'EXPORT_FINANCIAL',
},
```

### Link from Existing Pages

1. **Finance > Transactions** → Show payment method details, link to Payments module
2. **Members > List** → Add "Send SMS" bulk action
3. **Reports > List** → Add "Export" button linking to Exports center
4. **Settings** → Add Webhooks and Cron Jobs (admin only)

---

## Permissions Required

### Existing Permissions to Use

**Phase 3.6 (Nigerian Payments):**
- `PAYMENT_RECORD` - Record payments
- `PAYMENT_VERIFY` - Verify payments
- `FINANCIAL_VIEW` - View financial data

**Phase 6.6 (SMS/Communications):**
- `SMS_SEND` - Send SMS
- `SMS_MANAGE_CAMPAIGNS` - Manage campaigns
- `SMS_VIEW_HISTORY` - View message history

**Phase 10.5 (Exports):**
- `EXPORT_FINANCIAL` - Export financial reports
- `EXPORT_MEMBERS` - Export member data

**Phase 14-15 (Admin Tools):**
- `SUPER_ADMIN` - Full access to webhooks and cron jobs

---

## Testing Strategy

### Manual Testing Checklist (Per Module)

1. **Navigation**
   - [ ] Sidebar link appears with correct permission
   - [ ] Route navigation works
   - [ ] Breadcrumbs display correctly

2. **Data Fetching**
   - [ ] Dashboard loads real data
   - [ ] Lists paginate correctly
   - [ ] Filters and search work
   - [ ] Loading states display

3. **Forms**
   - [ ] Validation works
   - [ ] Success messages appear
   - [ ] Error handling works
   - [ ] Form resets after submit

4. **Permissions**
   - [ ] Protected routes require correct permission
   - [ ] UI elements hide without permission
   - [ ] API calls respect permissions
   - [ ] Can component checks work

5. **Integration**
   - [ ] Links to/from existing pages work
   - [ ] Data syncs with other modules
   - [ ] No breaking changes to existing features

---

## Success Metrics

### Phase 3.6 (Nigerian Payments)
- [ ] Reconciliation time reduced by 80%
- [ ] Bank statement import working
- [ ] Payment verification streamlined
- [ ] All 24+ endpoints integrated

### Phase 6.6 (SMS/Communications)
- [ ] Admins can send SMS from UI
- [ ] Campaign creation works end-to-end
- [ ] Message delivery tracked
- [ ] All 10+ endpoints integrated

### Phase 10.5 (Exports)
- [ ] Export history accessible
- [ ] One-click re-download works
- [ ] Custom exports functional
- [ ] All 6 endpoints integrated

### Overall
- [ ] 82 tasks completed
- [ ] Zero breaking changes
- [ ] All backend endpoints integrated
- [ ] User satisfaction increased

---

## Next Steps

1. **Review this document** and task.md Phase 3.6 details
2. **Set up development environment** (ensure backend is running)
3. **Test backend endpoints** in Postman to understand responses
4. **Start with API client** (`nigerian-payments.ts`)
5. **Build dashboard page first** (gives overview of entire module)
6. **Proceed with sub-pages** following the task order

---

## Questions?

Refer to:
- `task.md` - Detailed task breakdown for all 6 phases
- `plan.md` - Implementation timeline and dependencies
- Backend code in `apps/api/src/modules/` - Endpoint details and schemas

**Remember:** All backend work is done. This is pure UI development with zero risk to existing functionality!
