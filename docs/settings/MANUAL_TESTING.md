# Settings Module - Manual Testing Guide

## Prerequisites

1. Application running locally
2. Database seeded with test data
3. Test users with appropriate permissions
4. Browser with DevTools for network inspection

## Test Users

| Email | Role | Permissions |
|-------|------|-------------|
| admin@test.com | admin | All settings permissions |
| treasurer@test.com | treasurer | settings.view, settings.billing |
| member@test.com | member | No settings access |
| superadmin@test.com | SUPER_ADMIN | Platform settings |

---

## Test Cases

### 1. Settings Navigation

#### TC-SET-001: Settings Hub Access

**Steps:**
1. Login as admin
2. Navigate to `/dashboard/settings`

**Expected:**
- Settings hub page loads
- All settings cards visible
- Cards show correct icons and descriptions

#### TC-SET-002: Settings Sidebar Navigation

**Steps:**
1. Navigate to any settings sub-page
2. Check sidebar navigation

**Expected:**
- Sidebar shows all settings sections
- Current page highlighted
- Mobile dropdown works on small screens

#### TC-SET-003: Permission-Based Navigation

**Steps:**
1. Login as treasurer
2. Navigate to `/dashboard/settings`

**Expected:**
- Only sees settings they have permission for
- Cannot see audit logs (no audit.view)
- Can see payments (has settings.billing)

---

### 2. Association Profile

#### TC-SET-004: View Association Profile

**Steps:**
1. Login as admin
2. Navigate to `/dashboard/settings/association`

**Expected:**
- Form loads with current association data
- Name, type, contact info displayed
- Logo preview shown (if exists)

#### TC-SET-005: Update Association Profile

**Steps:**
1. Change association name
2. Change association type
3. Click "Save Changes"

**Expected:**
- Success toast appears
- Changes persisted (refresh to verify)
- Audit log created

#### TC-SET-006: Logo Upload

**Steps:**
1. Click "Upload Logo" button
2. Select valid image (< 2MB, JPEG/PNG/WebP)
3. Wait for upload

**Expected:**
- Upload progress shown
- Logo preview updates
- Success toast appears

#### TC-SET-007: Logo Upload Validation

**Steps:**
1. Try to upload file > 2MB
2. Try to upload non-image file

**Expected:**
- Error message for oversized file
- Error message for invalid type
- No upload occurs

#### TC-SET-008: Logo Delete

**Steps:**
1. Click "Remove" button next to logo
2. Confirm deletion

**Expected:**
- Logo removed
- Placeholder shown
- Success toast appears

---

### 3. Members Access Settings

#### TC-SET-009: View Members Access Settings

**Steps:**
1. Navigate to `/dashboard/settings/members-access`

**Expected:**
- All toggles show current state
- Default role dropdown populated
- Invite expiry field shows value

#### TC-SET-010: Toggle Self-Signup

**Steps:**
1. Toggle "Allow Self-Signup" on
2. Save changes
3. Toggle off and save

**Expected:**
- Toggle state persists
- Changes saved successfully
- Audit log created for each change

#### TC-SET-011: Change Default Role

**Steps:**
1. Change default role dropdown
2. Save changes

**Expected:**
- New default role saved
- New members will get this role

---

### 4. Financial Settings

#### TC-SET-012: View Financial Settings

**Steps:**
1. Navigate to `/dashboard/settings/financial`

**Expected:**
- Warning banner about prospective changes
- Currency settings displayed
- Late fee configuration shown

#### TC-SET-013: Enable Late Fees

**Steps:**
1. Toggle "Enable Late Fees" on
2. Set late fee type to "Fixed"
3. Set amount to 500
4. Save changes

**Expected:**
- Nested options appear when enabled
- Values saved correctly
- Confirmation modal appears before save

#### TC-SET-014: Confirmation Modal

**Steps:**
1. Make any change to financial settings
2. Click "Save Changes"

**Expected:**
- Confirmation modal appears
- Warning about prospective changes
- Can cancel or confirm

#### TC-SET-015: Quick Links

**Steps:**
1. Click "Manage Financial Categories" link

**Expected:**
- Navigates to `/dashboard/finance/categories`
- Categories page loads correctly

---

### 5. Payments Settings

#### TC-SET-016: View Payment Channels

**Steps:**
1. Navigate to `/dashboard/settings/payments`

**Expected:**
- Payment channels list displayed
- Enabled channels highlighted
- Default method shown

#### TC-SET-017: Toggle Payment Channel

**Steps:**
1. Enable/disable a payment channel
2. Save changes

**Expected:**
- Channel state changes
- Default method updates if needed
- Changes saved

#### TC-SET-018: Receipt Settings

**Steps:**
1. Toggle auto-generate receipts
2. Set receipt prefix
3. Save changes

**Expected:**
- Settings saved
- New receipts will use prefix

---

### 6. Notifications Settings

#### TC-SET-019: View Notification Settings

**Steps:**
1. Navigate to `/dashboard/settings/notifications`

**Expected:**
- Email/SMS toggles shown
- Reminder days displayed as chips
- Quiet hours fields visible

#### TC-SET-020: Add Reminder Day

**Steps:**
1. Enter "5" in reminder days input
2. Click "Add"

**Expected:**
- "5 days" chip appears
- Sorted with other days
- Can be removed with X button

#### TC-SET-021: Remove Reminder Day

**Steps:**
1. Click X on a reminder day chip

**Expected:**
- Chip removed
- "Unsaved changes" indicator appears

#### TC-SET-022: Templates Quick Link

**Steps:**
1. Click "SMS Templates" link

**Expected:**
- Navigates to `/dashboard/communication/sms/templates`
- Templates page loads

---

### 7. Integrations Settings

#### TC-SET-023: View Integrations

**Steps:**
1. Navigate to `/dashboard/settings/integrations`

**Expected:**
- Payment gateways section shown
- SMS provider dropdown visible
- API access toggle shown

#### TC-SET-024: Enable Paystack

**Steps:**
1. Toggle Paystack on
2. Enter public key
3. Save changes

**Expected:**
- Key field appears when enabled
- Key can be shown/hidden
- Settings saved

#### TC-SET-025: API Access Warning

**Steps:**
1. Toggle "Enable API Access" on

**Expected:**
- Enterprise feature warning appears
- Explains contact support

---

### 8. Data & Privacy Settings

#### TC-SET-026: View Data Privacy Settings

**Steps:**
1. Navigate to `/dashboard/settings/data-privacy`

**Expected:**
- Data retention dropdown shown
- Soft delete toggle visible
- GDPR compliance toggle shown

#### TC-SET-027: Export Settings

**Steps:**
1. Click "Export All Settings" button
2. Wait for download

**Expected:**
- JSON file downloads
- Contains all settings categories
- Filename includes date

#### TC-SET-028: Change Retention Period

**Steps:**
1. Change data retention to "5 Years"
2. Save changes

**Expected:**
- Info banner explains prospective nature
- Settings saved
- Existing data unaffected

---

### 9. Audit Logs

#### TC-SET-029: View Audit Logs

**Steps:**
1. Navigate to `/dashboard/settings/audit-logs`

**Expected:**
- Table of recent activities
- Filters for date, action, user
- Pagination works

#### TC-SET-030: Filter Audit Logs

**Steps:**
1. Select date range
2. Select action type
3. Apply filters

**Expected:**
- Results filtered correctly
- Can clear filters
- Export filtered results

#### TC-SET-031: View Log Details

**Steps:**
1. Click on an audit log entry

**Expected:**
- Modal shows full details
- Old and new values displayed
- User and timestamp shown

---

### 10. Platform Settings (Super Admin)

#### TC-SET-032: Access Platform Settings

**Steps:**
1. Login as SUPER_ADMIN
2. Navigate to `/admin/settings/platform`

**Expected:**
- Platform settings page loads
- Stats cards show counts
- All toggles visible

#### TC-SET-033: Non-Admin Cannot Access

**Steps:**
1. Login as regular admin
2. Try to navigate to `/admin/settings/platform`

**Expected:**
- Redirected to dashboard
- Cannot access platform settings

#### TC-SET-034: Toggle Maintenance Mode

**Steps:**
1. Toggle "Maintenance Mode" on
2. Enter maintenance message
3. Save changes

**Expected:**
- Settings saved
- Regular users see maintenance page
- Super admin can still access

#### TC-SET-035: View Platform Stats

**Steps:**
1. Check stats cards on platform settings

**Expected:**
- Total associations count
- Total users count
- Pending approvals count
- All numbers accurate

---

### 11. Permission Enforcement

#### TC-SET-036: Member Cannot Access Settings

**Steps:**
1. Login as member
2. Try to navigate to `/dashboard/settings`

**Expected:**
- Redirected or access denied
- Settings not visible in sidebar

#### TC-SET-037: Treasurer Limited Access

**Steps:**
1. Login as treasurer
2. Navigate to settings

**Expected:**
- Can access payments settings
- Cannot access other settings
- Appropriate error for unauthorized pages

---

### 12. Error Handling

#### TC-SET-038: Network Error

**Steps:**
1. Disconnect network
2. Try to save settings

**Expected:**
- Error toast appears
- Form state preserved
- Can retry when connected

#### TC-SET-039: Validation Error

**Steps:**
1. Enter invalid data (e.g., negative grace period)
2. Try to save

**Expected:**
- Validation error shown
- Form not submitted
- User can correct and retry

#### TC-SET-040: Session Expired

**Steps:**
1. Let session expire
2. Try to save settings

**Expected:**
- Redirected to login
- Or error message shown
- Can re-authenticate and retry

---

## Regression Test Checklist

Run after any settings changes:

- [ ] Settings hub loads correctly
- [ ] All settings pages accessible
- [ ] Permission checks work
- [ ] Save/load cycle works for each category
- [ ] Logo upload/delete works
- [ ] Audit logs capture changes
- [ ] Platform settings (super admin) work
- [ ] Error handling works
- [ ] Mobile responsive layout works

## Performance Testing

### Load Times

| Page | Expected Load Time |
|------|-------------------|
| Settings Hub | < 500ms |
| Any Settings Page | < 1s |
| Audit Logs (paginated) | < 1s |
| Logo Upload | < 3s |

### Concurrent Users

- 10 concurrent settings saves should complete without errors
- No race conditions on same setting

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari
- [ ] Mobile Chrome

## Accessibility Testing

- [ ] All form fields have labels
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast sufficient
- [ ] Focus indicators visible
