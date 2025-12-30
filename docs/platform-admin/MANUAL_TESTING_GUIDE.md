# Super Admin Platform Controls - Manual Testing Guide

**Version:** 1.0  
**Last Updated:** December 30, 2025  
**Module:** Phase 19 - SaaS Owner / Super Admin Platform Controls

---

## Prerequisites

Before testing, ensure:

1. **API Server Running** - `npm run dev` in `apps/api`
2. **Web Server Running** - `npm run dev` in `apps/web`
3. **Database Seeded** - Platform modules and features are seeded
4. **Super Admin Account** - Login as `superadmin@societyledger.com`
5. **Test Tenant Available** - At least one tenant (association) exists

---

## Test Environment Setup

### Login as Super Admin

1. Navigate to `http://localhost:3000/login`
2. Enter credentials:
   - Email: `superadmin@societyledger.com`
   - Password: (your super admin password)
3. Verify redirect to `/admin` dashboard

---

## Test Cases

### Section 1: Admin Dashboard

#### TC-1.1: Dashboard Access
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as Super Admin | Redirected to `/admin` |
| 2 | Verify sidebar shows "Super Admin" section | Super Admin menu visible |
| 3 | Check dashboard stats | Shows tenant count, user count, etc. |

#### TC-1.2: Navigation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Tenant Management" in sidebar | Navigate to `/admin/tenants` |
| 2 | Click "Modules & Features" in sidebar | Navigate to `/admin/modules` |
| 3 | Click "Action Logs" in sidebar | Navigate to `/admin/action-logs` |
| 4 | Click "Settings" in sidebar | Navigate to `/admin/settings` |

---

### Section 2: Tenant List Page (`/admin/tenants`)

#### TC-2.1: View Tenant List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/tenants` | Page loads with tenant table |
| 2 | Verify table columns | Shows: Tenant, Tier, Status, Users, Members, Subscription, Actions |
| 3 | Check loading state | Spinner shows while loading |

#### TC-2.2: Search Tenants
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter tenant name in search box | List filters to matching tenants |
| 2 | Enter subdomain in search box | List filters to matching tenants |
| 3 | Clear search | All tenants shown again |

#### TC-2.3: Filter by Status
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select "Active" from status dropdown | Only active tenants shown |
| 2 | Select "Suspended" from status dropdown | Only suspended tenants shown |
| 3 | Select "All Status" | All tenants shown |

#### TC-2.4: Filter by Tier
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select "Starter" from tier dropdown | Only starter tier tenants shown |
| 2 | Select "Professional" | Only professional tier tenants shown |
| 3 | Select "Enterprise" | Only enterprise tier tenants shown |

#### TC-2.5: Show Deleted Tenants
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check "Show Deleted" checkbox | Deleted tenants appear (grayed out) |
| 2 | Uncheck "Show Deleted" | Deleted tenants hidden |

#### TC-2.6: Quick Actions from List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "View" on a tenant | Navigate to tenant detail page |
| 2 | Click "Suspend" on active tenant | Prompt for reason, then suspend |
| 3 | Click "Reactivate" on suspended tenant | Tenant reactivated |
| 4 | Click "Logout All" | Prompt for reason, force logout all users |
| 5 | Click "Delete" | Prompt for reason, soft delete tenant |

---

### Section 3: Tenant Detail Page (`/admin/tenants/[id]`)

#### TC-3.1: Page Load
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "View" on a tenant | Page loads with loading spinner |
| 2 | Wait for data load | Page shows tenant details (~3 seconds) |
| 3 | Verify breadcrumb | Shows: Dashboard / Tenants / [Tenant Name] |
| 4 | Verify header | Shows tenant name, status badge, subdomain |

#### TC-3.2: Stats Cards
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check stats row | Shows 4 cards: Users, Members, Tier, Status |
| 2 | Verify user count | Matches actual user count |
| 3 | Verify member count | Matches actual member count |

#### TC-3.3: Tab Navigation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Overview" tab | Overview content shown |
| 2 | Click "Modules" tab | Modules list shown |
| 3 | Click "Features" tab | Features list shown |
| 4 | Click "Billing" tab | Billing actions shown |
| 5 | Click "Security" tab | Security settings shown |

---

### Section 4: Overview Tab

#### TC-4.1: Tenant Details Card
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View Tenant Details card | Shows ID, Subdomain, Tier, Created date |
| 2 | If deleted, verify deletion info | Shows Deleted At, Deletion Reason |

#### TC-4.2: Subscription Card
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View Subscription card | Shows Plan, Status, Billing cycle, Period end |
| 2 | If no subscription | Shows "No active subscription" |

#### TC-4.3: Header Actions
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Suspend" (if active) | Prompt for reason, tenant suspended |
| 2 | Click "Reactivate" (if suspended) | Tenant reactivated |
| 3 | Click "Force Logout" | Prompt for reason, all users logged out |
| 4 | Click "Restore" (if deleted) | Tenant restored |

---

### Section 5: Modules Tab

#### TC-5.1: View Modules List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Modules" tab | List of all platform modules shown |
| 2 | Verify module info | Shows name, code, source, core badge |
| 3 | Check toggle state | Toggle reflects current enabled state |

#### TC-5.2: Toggle Module (Quick)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click toggle on non-core module | Module state changes |
| 2 | Toast notification | Shows success message |
| 3 | Verify toggle state | Reflects new state |

#### TC-5.3: Configure Module (Modal)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Configure" on a module | Modal opens |
| 2 | Verify modal title | Shows "Configure Module: [Name]" |
| 3 | Toggle enable/disable | Toggle changes state |
| 4 | Enter reason | Text entered in reason field |
| 5 | Set expiration date (optional) | Date picker works |
| 6 | Click "Save Override" | Modal closes, module updated |
| 7 | Verify "Override" badge | Badge appears on module |

#### TC-5.4: Remove Module Override
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find module with "Override" badge | Module has override |
| 2 | Click "Remove Override" | Confirmation prompt |
| 3 | Confirm removal | Override removed, reverts to plan default |
| 4 | Verify badge removed | "Override" badge no longer shown |

#### TC-5.5: Core Module Protection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find a core module (e.g., "members") | Has "Core" badge |
| 2 | Try to click toggle | Toggle is disabled |
| 3 | Try to click "Configure" | Button is disabled |

---

### Section 6: Features Tab

#### TC-6.1: View Features List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Features" tab | Features grouped by module |
| 2 | Verify grouping | Features under module headers |
| 3 | Check feature info | Shows name, code, source |

#### TC-6.2: Toggle Feature (Quick)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click toggle on a feature | Feature state changes |
| 2 | Toast notification | Shows success message |

#### TC-6.3: Configure Feature (Modal)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Configure" on a feature | Modal opens |
| 2 | Verify modal shows module name | Shows "Module: [module code]" |
| 3 | Enter reason and save | Feature override created |

#### TC-6.4: Remove Feature Override
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find feature with override | Has "Override" badge |
| 2 | Click "Remove Override" | Confirmation prompt |
| 3 | Confirm | Override removed |

---

### Section 7: Billing Tab

#### TC-7.1: View Billing Actions
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Billing" tab | 6 action cards shown |
| 2 | Verify cards | Extend Trial, Apply Credit, Bypass Billing, Apply Discount, Grace Period, Pause Billing |

#### TC-7.2: Extend Trial
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Extend Trial" card | Modal opens |
| 2 | Enter days (e.g., 14) | Number input works |
| 3 | Enter reason | Reason field filled |
| 4 | Click "Apply" | Modal closes, success toast |
| 5 | Check Active Overrides | New override appears |

#### TC-7.3: Apply Credit
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Apply Credit" card | Modal opens |
| 2 | Enter amount (e.g., 5000) | Amount input works |
| 3 | Enter reason | Reason field filled |
| 4 | Click "Apply" | Success toast shown |

#### TC-7.4: Bypass Billing
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Bypass Billing" card | Modal opens |
| 2 | Set end date (optional) | Date picker works |
| 3 | Enter reason | Reason required |
| 4 | Click "Apply" | Billing bypass created |

#### TC-7.5: Apply Discount
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Apply Discount" card | Modal opens |
| 2 | Enter discount percentage | Percentage input works |
| 3 | Set end date | Date picker works |
| 4 | Enter reason | Reason filled |
| 5 | Click "Apply" | Discount applied |

#### TC-7.6: Grace Period
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Grace Period" card | Modal opens |
| 2 | Enter days | Days input works |
| 3 | Enter reason | Reason filled |
| 4 | Click "Apply" | Grace period set |

#### TC-7.7: Pause Billing
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Pause Billing" card | Modal opens |
| 2 | Set end date (optional) | Date picker works |
| 3 | Enter reason | Reason filled |
| 4 | Click "Apply" | Billing paused |

#### TC-7.8: View Active Overrides
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check "Active Billing Overrides" section | Shows active overrides |
| 2 | Verify override info | Shows type, value, reason, dates |
| 3 | If no overrides | Shows "No active billing overrides" |

#### TC-7.9: Revoke Override
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find active override | Has "Revoke" button |
| 2 | Click "Revoke" | Prompt for reason |
| 3 | Enter reason and confirm | Override revoked |
| 4 | Check history table | Override shows as "Expired" |

#### TC-7.10: View Override History
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check "Billing Override History" table | Shows all overrides |
| 2 | Verify columns | Type, Value, Reason, Start, End, Status |
| 3 | Check status badges | Active (green), Expired (gray) |

---

### Section 8: Security Tab

#### TC-8.1: View Security Settings
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Security" tab | Security settings shown |
| 2 | Verify fields | Force 2FA, Password Policy, Session Timeout, IP Restrictions |

#### TC-8.2: Update Security Settings
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Update Settings" | Prompts for 2FA confirmation |
| 2 | Confirm/deny 2FA | Prompts for session timeout |
| 3 | Enter timeout value | Settings updated |
| 4 | Toast notification | Shows success message |

---

### Section 9: Platform Modules Page (`/admin/modules`)

#### TC-9.1: View All Modules
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/modules` | Page loads |
| 2 | Verify module list | Shows all platform modules |
| 3 | Check module info | Name, code, description, core status |

---

### Section 10: Action Logs Page (`/admin/action-logs`)

#### TC-10.1: View Action Logs
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/action-logs` | Page loads |
| 2 | Verify log table | Shows recent actions |
| 3 | Check columns | Actor, Action, Target, Timestamp |

#### TC-10.2: Filter Logs
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Filter by action type | Logs filtered |
| 2 | Filter by date range | Logs filtered |
| 3 | Search by actor | Logs filtered |

---

### Section 11: Error Handling

#### TC-11.1: Invalid Tenant ID
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/tenants/99999` | Error message shown |
| 2 | Verify error UI | Shows "Tenant Not Found" |
| 3 | Click "Back to Tenants" | Returns to tenant list |

#### TC-11.2: Network Error
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Stop API server | Server offline |
| 2 | Try to load tenant page | Error message shown |
| 3 | Click "Retry" | Attempts to reload |

#### TC-11.3: Unauthorized Access
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as non-super-admin | Regular user logged in |
| 2 | Navigate to `/admin/tenants` | Redirected to dashboard |

---

### Section 12: Performance

#### TC-12.1: Page Load Time
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to tenant detail page | Loading spinner shows |
| 2 | Time until content appears | Should be < 5 seconds |
| 3 | Check Network tab | 3 API calls complete |

#### TC-12.2: Module Toggle Response
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Toggle a module | Response within 1 second |
| 2 | Toast notification | Appears immediately |

---

## Test Data Checklist

Before testing, verify:

- [ ] At least 2 tenants exist (one active, one for testing)
- [ ] Platform modules are seeded (14 modules)
- [ ] Platform features are seeded
- [ ] Plan-module assignments exist
- [ ] Super admin account has `platformRole: SUPER_ADMIN`

---

## Known Issues / Limitations

1. **TypeScript Errors** - Some Prisma type errors may show in IDE but don't affect runtime
2. **Session Timeout** - Security settings update uses browser prompts (could be improved with proper form)
3. **IP Restrictions** - UI for managing IP restrictions is basic

---

## Test Results Template

| Test Case | Status | Notes | Tester | Date |
|-----------|--------|-------|--------|------|
| TC-1.1 | ⬜ Pass / ⬜ Fail | | | |
| TC-1.2 | ⬜ Pass / ⬜ Fail | | | |
| TC-2.1 | ⬜ Pass / ⬜ Fail | | | |
| ... | | | | |

---

## Regression Testing

After any changes to the platform admin module, re-run:

1. TC-3.1 (Page Load) - Verify no performance regression
2. TC-5.2 (Toggle Module) - Verify module toggles work
3. TC-7.2 (Extend Trial) - Verify billing actions work
4. TC-11.3 (Unauthorized Access) - Verify security still works

---

**End of Manual Testing Guide**
