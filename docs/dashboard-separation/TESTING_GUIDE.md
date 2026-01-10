# Phase 23: Dashboard Separation - Testing Guide

**Status:** Implementation Complete  
**Date:** January 10, 2026

---

## Testing Overview

This document outlines the testing strategy for the dashboard separation implementation. While automated tests are not yet written, this guide provides comprehensive test cases for manual and future automated testing.

---

## 1. Unit Tests for Sidebar Components

### MemberSidebar Component Tests

**Test File:** `__tests__/components/layout/MemberSidebar.test.tsx`

#### Test Cases:

1. **Rendering Tests**
   - [ ] Should render all navigation items for regular members
   - [ ] Should show expandable sections (My Finances, Governance, Cooperatives, Welfare, Help & Support)
   - [ ] Should display "Member Portal" label in header
   - [ ] Should show user email and "Member" role badge

2. **Navigation Tests**
   - [ ] Should highlight active route correctly
   - [ ] Should expand/collapse sections on click
   - [ ] Should navigate to correct routes on item click
   - [ ] Should close mobile menu after navigation

3. **Permission Tests**
   - [ ] Should show Cooperatives section only if enabled (Enterprise tier)
   - [ ] Should hide items user doesn't have permission for
   - [ ] Should handle missing permissions gracefully

4. **Mobile Responsiveness**
   - [ ] Should show hamburger menu on mobile
   - [ ] Should show/hide sidebar on mobile menu toggle
   - [ ] Should show overlay when mobile menu is open

### AdminSidebar Component Tests

**Test File:** `__tests__/components/layout/AdminSidebar.test.tsx`

#### Test Cases:

1. **Dual-Section Rendering**
   - [ ] Should render "MY MEMBER AREA" section with blue divider
   - [ ] Should render "ADMINISTRATION" section with purple divider
   - [ ] Should show all member items in first section
   - [ ] Should show all admin items in second section

2. **Permission-Based Visibility**
   - [ ] Should show items based on user permissions
   - [ ] Should hide items user doesn't have permission for
   - [ ] Should show all items for Super Admin (except hideForSuperAdmin items)
   - [ ] Should respect roleRequired checks (admin, treasurer, financial_secretary)

3. **Navigation Preservation**
   - [ ] Should include ALL items from original Sidebar.tsx
   - [ ] Should maintain same route structure
   - [ ] Should preserve all nested menu items
   - [ ] Should show correct badges (Enterprise, Beta, Pro, Soon)

4. **Expandable Menus**
   - [ ] Should expand/collapse parent items correctly
   - [ ] Should show chevron icon rotation on expand/collapse
   - [ ] Should maintain expanded state during navigation
   - [ ] Should highlight active nested items

### SectionDivider Component Tests

**Test File:** `__tests__/components/layout/SectionDivider.test.tsx`

#### Test Cases:

1. **Rendering**
   - [ ] Should render icon and title
   - [ ] Should apply correct color classes (blue, purple, teal, green)
   - [ ] Should display uppercase title with tracking

2. **Styling**
   - [ ] Should have correct padding and margins
   - [ ] Should apply color-specific background and text colors

---

## 2. Integration Tests for Dashboard Routes

### Route Redirect Tests

**Test File:** `__tests__/dashboard/routing.test.ts`

#### Test Cases:

1. **Smart Dashboard Redirect**
   - [ ] Super Admin → Should redirect to `/admin`
   - [ ] Admin → Should stay on `/dashboard` (shows admin dashboard)
   - [ ] Treasurer → Should stay on `/dashboard` (shows admin dashboard)
   - [ ] Financial Secretary → Should stay on `/dashboard` (shows admin dashboard)
   - [ ] Regular Member → Should redirect to `/dashboard/member`

2. **Route Access Control**
   - [ ] Members can access `/dashboard/member/*` routes
   - [ ] Admins can access `/dashboard/admin/*` routes
   - [ ] Admins can access `/dashboard/member/*` routes (dual access)
   - [ ] Members cannot access `/dashboard/admin/*` routes
   - [ ] Super Admins can access `/admin/*` routes

3. **Sidebar Rendering by Route**
   - [ ] `/dashboard/member/*` → Renders MemberSidebar
   - [ ] `/dashboard/admin/*` → Renders AdminSidebar
   - [ ] `/dashboard/*` (admin user) → Renders AdminSidebar
   - [ ] `/dashboard/*` (member user) → Renders MemberSidebar
   - [ ] `/admin/*` → Renders original Sidebar (Super Admin)

### Layout Integration Tests

**Test File:** `__tests__/dashboard/layout-integration.test.ts`

#### Test Cases:

1. **AuthenticatedLayout**
   - [ ] Should render correct sidebar based on route
   - [ ] Should show Breadcrumbs component
   - [ ] Should show RoleIndicator for admins
   - [ ] Should show NotificationBell in top bar
   - [ ] Should render mobile BottomNav

2. **Component Integration**
   - [ ] Breadcrumbs should update based on current route
   - [ ] RoleIndicator should show "Member View" on member routes
   - [ ] RoleIndicator should show "Admin View" on admin routes
   - [ ] Mobile BottomNav should navigate to correct routes based on role

---

## 3. Member-Admin Dual Role Testing

### TASK-DASH-023: Test Member-Admin Dual Role Scenario

#### Critical Test Cases:

1. **Admin Personal Finance Access**
   ```
   Given: User with admin role
   When: Admin navigates to "My Finances" in Member Area section
   Then: Should see their personal financial data (dues, payments, balance)
   And: Should NOT see other members' data
   ```

2. **Admin Association Finance Access**
   ```
   Given: User with admin role
   When: Admin navigates to "Finance" in Administration section
   Then: Should see association-wide financial data
   And: Should see all members' transactions
   And: Should have management capabilities
   ```

3. **Admin Can Pay Own Dues**
   ```
   Given: User with admin role
   When: Admin navigates to "My Finances" → "Make Payment"
   Then: Should see their own outstanding dues
   And: Should be able to pay their own dues
   And: Payment should be recorded in their member ledger
   ```

4. **Admin Can Manage Other Members' Finances**
   ```
   Given: User with admin role
   When: Admin navigates to "Finance" → "Transactions"
   Then: Should see all members' transactions
   And: Should be able to create transactions for any member
   And: Should be able to record payments for any member
   ```

5. **Admin Attendance Tracking**
   ```
   Given: User with admin role
   When: Admin navigates to "My Meetings" in Member Area
   Then: Should see their personal attendance history
   And: Should be able to RSVP to meetings
   
   When: Admin navigates to "Governance" → "Meetings" in Administration
   Then: Should see all meetings and all members' attendance
   And: Should be able to manage meetings and mark attendance
   ```

6. **Admin Cooperative Access**
   ```
   Given: User with admin role and Cooperatives enabled
   When: Admin navigates to "My Cooperatives" in Member Area
   Then: Should see their personal savings and loans
   And: Should be able to apply for loans
   
   When: Admin navigates to "Cooperatives" in Administration
   Then: Should see all members' savings and loans
   And: Should be able to approve/reject loan applications
   ```

### Dual Role Workflow Tests

1. **Context Switching**
   - [ ] Admin can switch between member and admin contexts seamlessly
   - [ ] RoleIndicator updates correctly when switching contexts
   - [ ] Breadcrumbs reflect current context
   - [ ] No data leakage between contexts

2. **Permission Boundaries**
   - [ ] Admin member actions respect member permissions
   - [ ] Admin management actions respect admin permissions
   - [ ] No privilege escalation vulnerabilities

---

## 4. Manual Testing Checklist

### Pre-Deployment Testing

#### As Regular Member:
- [ ] Login as member
- [ ] Verify redirect to `/dashboard/member`
- [ ] Verify MemberSidebar is displayed
- [ ] Navigate through all member sections
- [ ] Verify "My Finances" shows personal data only
- [ ] Verify cannot access admin routes
- [ ] Test mobile navigation
- [ ] Test breadcrumbs navigation

#### As Admin:
- [ ] Login as admin
- [ ] Verify stays on `/dashboard` (admin dashboard)
- [ ] Verify AdminSidebar with dual sections is displayed
- [ ] Navigate through "MY MEMBER AREA" section
- [ ] Verify personal data in member section
- [ ] Navigate through "ADMINISTRATION" section
- [ ] Verify association-wide data in admin section
- [ ] Test context switching between member and admin views
- [ ] Verify RoleIndicator shows correct context
- [ ] Test mobile navigation
- [ ] Test breadcrumbs navigation

#### As Super Admin:
- [ ] Login as super admin
- [ ] Verify redirect to `/admin`
- [ ] Verify original Sidebar is displayed
- [ ] Verify no breaking changes to super admin functionality
- [ ] Test platform-wide features

### Cross-Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

### Responsive Testing
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] Mobile (414x896)

---

## 5. Performance Testing

### Sidebar Performance
- [ ] Sidebar renders in < 100ms
- [ ] Expandable sections animate smoothly
- [ ] No layout shift during hydration
- [ ] Permission checks don't block rendering

### Route Navigation
- [ ] Route transitions are smooth
- [ ] No flash of wrong sidebar during navigation
- [ ] Breadcrumbs update without delay
- [ ] RoleIndicator updates instantly

---

## 6. Accessibility Testing

### Keyboard Navigation
- [ ] All sidebar items accessible via Tab key
- [ ] Expandable sections toggle with Enter/Space
- [ ] Focus visible on all interactive elements
- [ ] Logical tab order maintained

### Screen Reader Testing
- [ ] Sidebar sections announced correctly
- [ ] Active route announced
- [ ] Expandable state announced (expanded/collapsed)
- [ ] Role context announced (Member View/Admin View)

### ARIA Attributes
- [ ] Proper ARIA labels on navigation items
- [ ] ARIA-expanded on expandable sections
- [ ] ARIA-current on active routes
- [ ] Proper heading hierarchy

---

## 7. Regression Testing

### Existing Features
- [ ] All existing routes still work
- [ ] No broken links
- [ ] All existing pages render correctly
- [ ] Permissions still enforced correctly
- [ ] Mobile navigation still works
- [ ] Notifications still work
- [ ] Theme toggle still works
- [ ] Logout still works

### Data Integrity
- [ ] Member data not exposed to wrong users
- [ ] Admin actions properly logged
- [ ] Permissions properly checked on backend
- [ ] No data leakage between contexts

---

## 8. Edge Cases

### Authentication Edge Cases
- [ ] Unauthenticated user redirected to login
- [ ] Session expiry handled gracefully
- [ ] Token refresh doesn't break navigation
- [ ] Multiple tabs stay in sync

### Permission Edge Cases
- [ ] User with no permissions sees minimal sidebar
- [ ] Permission changes reflected immediately
- [ ] Role changes handled correctly
- [ ] Tier changes (Starter → Professional → Enterprise) update sidebar

### Data Edge Cases
- [ ] Empty state handling (no dues, no meetings, etc.)
- [ ] Large datasets don't break UI
- [ ] Long association names don't break layout
- [ ] Special characters in names handled correctly

---

## 9. Security Testing

### Authorization
- [ ] Members cannot access admin routes (backend check)
- [ ] URL manipulation doesn't bypass permissions
- [ ] API endpoints enforce permissions
- [ ] No sensitive data in client-side code

### XSS Prevention
- [ ] User input properly sanitized
- [ ] No inline scripts in navigation items
- [ ] External links properly validated

---

## 10. Test Automation Recommendations

### Unit Test Framework
- **Framework:** Jest + React Testing Library
- **Coverage Target:** 80%+ for sidebar components
- **Mock Strategy:** Mock useAuthStore, usePathname, useRouter

### Integration Test Framework
- **Framework:** Playwright or Cypress
- **Coverage:** All critical user flows
- **Test Data:** Seed database with test users (member, admin, super admin)

### E2E Test Framework
- **Framework:** Playwright
- **Coverage:** Complete user journeys
- **Environments:** Staging environment with test data

---

## Test Execution Summary

| Test Category | Status | Priority |
|---------------|--------|----------|
| Unit Tests | 📝 Documented | HIGH |
| Integration Tests | 📝 Documented | HIGH |
| Dual Role Tests | 📝 Documented | CRITICAL |
| Manual Tests | ⏳ Pending | HIGH |
| Performance Tests | ⏳ Pending | MEDIUM |
| Accessibility Tests | ⏳ Pending | HIGH |
| Security Tests | ⏳ Pending | CRITICAL |

---

## Next Steps

1. **Immediate:** Manual testing by QA team
2. **Short-term:** Write automated unit tests
3. **Medium-term:** Set up integration test suite
4. **Long-term:** Implement E2E test automation

---

**Document Version:** 1.0  
**Last Updated:** January 10, 2026  
**Maintained By:** Development Team
