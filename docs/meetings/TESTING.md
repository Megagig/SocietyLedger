# Meetings & Attendance - Manual Testing Guide

**Last Updated:** December 28, 2025

This guide provides step-by-step instructions for manually testing all features of the Meetings & Attendance module.

---

## Prerequisites

### 1. Start Development Servers

```bash
# Terminal 1 - API Server
cd apps/api
npm run dev

# Terminal 2 - Web App
cd apps/web
npm run dev
```

### 2. Login Requirements
- Login as an **admin user** with meeting permissions
- Ensure the association has **Professional or Enterprise** subscription tier
- Have at least 5-10 active members in the association for attendance testing

### 3. Verify Permissions
The logged-in user should have these permissions:
- `meeting:view` - View meetings
- `meeting:create` - Create meetings
- `meeting:edit` - Edit meetings
- `meeting:delete` - Cancel/delete meetings
- `meeting:attendance` - Mark attendance
- `meeting:minutes` - Record minutes

---

## Test Cases

### Test 1: Access Meetings Module

**Objective:** Verify navigation and access to the meetings module

**Steps:**
1. Login to the dashboard
2. Look for "Governance" section in the sidebar
3. Click on "Meetings" submenu item

**Expected Results:**
- ✅ Governance section is visible in sidebar
- ✅ Meetings link is clickable (not marked as "Coming Soon")
- ✅ Navigates to `/dashboard/governance/meetings`
- ✅ Meetings dashboard loads without errors

**Edge Cases:**
- ❌ User without `meeting:view` permission should see access denied
- ❌ Starter plan users should see upgrade prompt

---

### Test 2: Create a Meeting (Basic)

**Objective:** Create a simple meeting with minimal information

**Steps:**
1. Navigate to `/dashboard/governance/meetings`
2. Click "Schedule Meeting" or "New Meeting" button
3. Fill in required fields:
   - Title: `Test Meeting - Basic`
   - Start Time: Tomorrow at 10:00 AM
4. Click "Create Meeting"

**Expected Results:**
- ✅ Meeting is created successfully
- ✅ Success toast notification appears
- ✅ Redirects to meeting list or detail page
- ✅ Meeting appears in the list with status "SCHEDULED"
- ✅ In-app notification is created for all members
- ✅ (Check server logs) Meeting scheduled notification triggered

**Validation Tests:**
| Test | Input | Expected |
|------|-------|----------|
| Empty title | Leave title blank | Validation error: "Meeting title is required" |
| Past date | Set start time to yesterday | Validation error or warning |
| Title too long | Enter 250+ characters | Validation error: max 200 characters |

---

### Test 3: Create a Meeting (Full Details)

**Objective:** Create a meeting with all fields populated

**Steps:**
1. Navigate to `/dashboard/governance/meetings/create`
2. Fill in all fields:
   - Title: `Annual General Meeting 2025`
   - Description: `Annual meeting to review the year's activities and elect new officers`
   - Meeting Type: `AGM`
   - Location: `Community Hall, Block A, 123 Main Street`
   - Virtual Link: `https://zoom.us/j/123456789`
   - Start Time: `2025-02-15 10:00 AM`
   - End Time: `2025-02-15 02:00 PM`
   - Quorum Required: `25`
3. Add Agenda Items:
   - Item 1: "Opening Prayer" (5 min)
   - Item 2: "Reading of Previous Minutes" (10 min, Presenter: Secretary)
   - Item 3: "Chairman's Address" (15 min, Presenter: Chairman)
   - Item 4: "Financial Report" (20 min, Presenter: Treasurer)
   - Item 5: "Election of Officers" (30 min)
   - Item 6: "Any Other Business" (20 min)
   - Item 7: "Closing" (5 min)
4. Click "Create Meeting"

**Expected Results:**
- ✅ Meeting created with all details saved
- ✅ All 7 agenda items are saved with correct order
- ✅ Meeting type shows as "AGM"
- ✅ Both location and virtual link are displayed
- ✅ Quorum requirement is set to 25

**Verification:**
- Navigate to meeting detail page
- Verify all information is displayed correctly
- Check that agenda items are in correct order

---

### Test 4: View Meeting Details

**Objective:** Verify meeting detail page displays all information

**Steps:**
1. Navigate to `/dashboard/governance/meetings`
2. Click on a meeting to view details
3. Review all tabs/sections

**Expected Results:**
- ✅ **Details Tab:**
  - Title, description, type, status displayed
  - Location and virtual link shown
  - Start/end time formatted correctly
  - Quorum requirement shown
  - Creator information displayed
- ✅ **Agenda Tab:**
  - All agenda items listed in order
  - Duration and presenter shown for each
- ✅ **Attendance Tab:**
  - Attendance statistics displayed
  - Member list with attendance status
  - Quorum status indicator
- ✅ **Minutes Tab:**
  - Minutes content (if recorded)
  - Approval status

---

### Test 5: Update Meeting Details

**Objective:** Modify an existing meeting

**Steps:**
1. Navigate to a scheduled meeting's detail page
2. Click "Edit" button
3. Modify the following:
   - Change title to `Updated: Annual General Meeting 2025`
   - Change location to `New Venue - Conference Center`
   - Update start time by 1 hour
4. Save changes

**Expected Results:**
- ✅ Changes are saved successfully
- ✅ Success notification appears
- ✅ Meeting detail page shows updated information
- ✅ Audit log entry created (check database)

**Edge Cases:**
| Scenario | Expected Behavior |
|----------|-------------------|
| Edit completed meeting | Should be restricted or show warning |
| Edit cancelled meeting | Should be restricted |
| Change to past date | Validation error |

---

### Test 6: Manage Agenda Items

**Objective:** Add, update, and delete agenda items

**Steps:**

**6a. Add Agenda Item:**
1. Open meeting detail page
2. Navigate to Agenda section
3. Click "Add Agenda Item"
4. Enter: Title: "New Business Item", Duration: 15, Presenter: "Vice Chairman"
5. Save

**Expected Results:**
- ✅ New item appears in the agenda list
- ✅ Order number is assigned correctly

**6b. Update Agenda Item:**
1. Click edit on an existing agenda item
2. Change the title and duration
3. Save

**Expected Results:**
- ✅ Changes are reflected immediately
- ✅ Other items remain unchanged

**6c. Delete Agenda Item:**
1. Click delete on an agenda item
2. Confirm deletion

**Expected Results:**
- ✅ Item is removed from the list
- ✅ Remaining items maintain correct order

**6d. Reorder Agenda Items:**
1. Drag and drop agenda items (if supported)
2. Or manually change order numbers

**Expected Results:**
- ✅ Items are reordered correctly
- ✅ Order persists after page refresh

---

### Test 7: Initialize Attendance

**Objective:** Set up attendance tracking for a meeting

**Steps:**
1. Navigate to a scheduled meeting
2. Go to Attendance tab
3. Click "Initialize Attendance" button

**Expected Results:**
- ✅ Attendance records created for all active members
- ✅ All members show status "PENDING"
- ✅ Total member count matches active members
- ✅ Success message shows count of records created

**Edge Cases:**
| Scenario | Expected Behavior |
|----------|-------------------|
| Initialize twice | Should skip duplicates, show appropriate message |
| No active members | Should show warning or empty state |

---

### Test 8: Mark Individual Attendance

**Objective:** Mark attendance for individual members

**Steps:**
1. Navigate to meeting attendance tab
2. Find a member in the list
3. Change their status from "PENDING" to "PRESENT"
4. For another member, mark as "ABSENT"
5. For another member, mark as "LATE" with check-in time
6. For another member, mark as "APOLOGY" with reason

**Expected Results:**
- ✅ Each status change is saved immediately
- ✅ Attendance statistics update in real-time
- ✅ Quorum indicator updates based on present + late count
- ✅ Individual notification sent to member when attendance is marked

**Test Data:**
| Member | Status | Additional Info |
|--------|--------|-----------------|
| Member 1 | PRESENT | Check-in: 10:00 AM |
| Member 2 | PRESENT | Check-in: 10:02 AM |
| Member 3 | LATE | Check-in: 10:35 AM |
| Member 4 | ABSENT | - |
| Member 5 | APOLOGY | Reason: "Out of town for work" |

---

### Test 9: Bulk Mark Attendance

**Objective:** Mark attendance for multiple members at once

**Steps:**
1. Navigate to meeting attendance tab
2. Select multiple members using checkboxes
3. Choose bulk action: "Mark as Present"
4. Confirm the action

**Expected Results:**
- ✅ All selected members are marked as PRESENT
- ✅ Statistics update to reflect changes
- ✅ Success message shows count of updated records

**Alternative Test:**
1. Select all pending members
2. Mark all as ABSENT
3. Then individually update those who attended

---

### Test 10: Quorum Calculation

**Objective:** Verify quorum tracking works correctly

**Setup:**
- Create a meeting with quorum required = 10
- Initialize attendance for 20 members

**Steps:**
1. Mark 5 members as PRESENT
2. Check quorum status

**Expected Results:**
- ✅ Quorum status shows "Not Met" (5/10)
- ✅ Visual indicator shows red/warning

3. Mark 3 more members as PRESENT
4. Mark 2 members as LATE

**Expected Results:**
- ✅ Quorum status shows "Met" (10/10)
- ✅ Late members count towards quorum
- ✅ Visual indicator shows green/success

**Edge Cases:**
| Present | Late | Absent | Apology | Quorum (10) | Status |
|---------|------|--------|---------|-------------|--------|
| 5 | 0 | 10 | 5 | 5/10 | Not Met |
| 8 | 2 | 5 | 5 | 10/10 | Met |
| 10 | 5 | 3 | 2 | 15/10 | Met |
| 0 | 10 | 10 | 0 | 10/10 | Met |

---

### Test 11: Create Meeting Minutes

**Objective:** Record minutes for a completed meeting

**Steps:**
1. Navigate to a meeting (preferably completed)
2. Go to Minutes tab
3. Click "Create Minutes" or "Record Minutes"
4. Fill in:
   - Content: Full meeting minutes text
   - Decisions: List of decisions made
   - Action Items: List of action items with assignees
   - Next Meeting Date: Select a future date
5. Save minutes

**Expected Results:**
- ✅ Minutes are saved successfully
- ✅ Recorded by and timestamp are captured
- ✅ Minutes appear in the Minutes tab
- ✅ Status shows as "Draft" or "Pending Approval"

**Sample Content:**
```
Content:
The meeting was called to order at 10:05 AM by the Chairman.
Present: 25 members (quorum met)
Apologies: 5 members

1. Opening Prayer
   - The meeting opened with a prayer led by Member A.

2. Reading of Previous Minutes
   - Minutes of the last meeting were read and adopted.
   - Moved by Member B, seconded by Member C.

3. Financial Report
   - Treasurer presented the Q4 financial report.
   - Total income: ₦2,500,000
   - Total expenses: ₦1,800,000
   - Balance: ₦700,000

Decisions:
1. Approved the Q4 financial report
2. Approved budget of ₦500,000 for community project
3. Elected Member D as new Secretary

Action Items:
1. Secretary to circulate meeting minutes within 7 days
2. Treasurer to prepare Q1 budget proposal
3. Project Committee to submit project timeline by Jan 30
```

---

### Test 12: Update Meeting Minutes

**Objective:** Edit existing minutes

**Steps:**
1. Navigate to meeting with existing minutes
2. Click "Edit Minutes"
3. Add additional content or corrections
4. Save changes

**Expected Results:**
- ✅ Changes are saved
- ✅ Updated timestamp is recorded
- ✅ Original recorder information preserved

---

### Test 13: Approve Meeting Minutes

**Objective:** Test the minutes approval workflow

**Steps:**
1. Navigate to meeting with draft minutes
2. Click "Approve Minutes" button
3. Confirm approval

**Expected Results:**
- ✅ Minutes status changes to "Approved"
- ✅ Approved by and approval timestamp recorded
- ✅ Minutes can no longer be edited (or shows warning)

**Edge Cases:**
| Scenario | Expected Behavior |
|----------|-------------------|
| Approve own minutes | May be allowed or restricted based on policy |
| Approve already approved | Should show error or be disabled |
| Edit after approval | Should be restricted or require re-approval |

---

### Test 14: Cancel a Meeting

**Objective:** Cancel a scheduled meeting

**Steps:**
1. Navigate to a scheduled meeting
2. Click "Cancel Meeting" button
3. Enter cancellation reason: "Venue unavailable due to maintenance"
4. Confirm cancellation

**Expected Results:**
- ✅ Meeting status changes to "CANCELLED"
- ✅ Cancellation reason is saved
- ✅ Cancelled by and timestamp recorded
- ✅ In-app notifications sent to all members
- ✅ Cancellation emails sent to all members
- ✅ Meeting no longer appears in "upcoming" list

**Verification:**
- Check that cancelled meeting shows cancellation details
- Verify notifications were created (check notifications page)
- Check server logs for email sending

---

### Test 15: Delete a Meeting

**Objective:** Permanently delete a meeting

**Steps:**
1. Navigate to a meeting (preferably cancelled or old)
2. Click "Delete Meeting" button
3. Confirm deletion

**Expected Results:**
- ✅ Meeting is removed from the list
- ✅ Associated agenda items are deleted
- ✅ Associated attendance records are deleted
- ✅ Associated minutes are deleted (cascade)

**Edge Cases:**
| Scenario | Expected Behavior |
|----------|-------------------|
| Delete scheduled meeting | Should require confirmation or cancellation first |
| Delete completed meeting | Should warn about data loss |
| Delete meeting with minutes | Should warn about losing minutes |

---

### Test 16: Meeting Statistics Dashboard

**Objective:** Verify statistics are calculated correctly

**Steps:**
1. Navigate to `/dashboard/governance/meetings`
2. Review the statistics cards/widgets

**Expected Results:**
- ✅ Total Meetings count is accurate
- ✅ Scheduled Meetings shows only future scheduled meetings
- ✅ Completed Meetings count is accurate
- ✅ Cancelled Meetings count is accurate
- ✅ Meetings This Month is accurate
- ✅ Meetings This Year is accurate

**Verification:**
- Manually count meetings in each category
- Compare with displayed statistics

---

### Test 17: Upcoming Meetings List

**Objective:** Verify upcoming meetings display correctly

**Steps:**
1. Navigate to meetings dashboard
2. Find "Upcoming Meetings" section
3. Review the list

**Expected Results:**
- ✅ Only future scheduled meetings are shown
- ✅ Meetings are sorted by start time (nearest first)
- ✅ Shows meeting title, date, time, location
- ✅ Limited to 5 items (or configurable)

---

### Test 18: Recent Meetings List

**Objective:** Verify recent/past meetings display correctly

**Steps:**
1. Navigate to meetings dashboard
2. Find "Recent Meetings" section
3. Review the list

**Expected Results:**
- ✅ Only completed meetings are shown
- ✅ Meetings are sorted by date (most recent first)
- ✅ Shows meeting title, date, attendance count
- ✅ Limited to 5 items (or configurable)

---

### Test 19: Attendance History Analytics

**Objective:** View member attendance patterns

**Steps:**
1. Navigate to `/dashboard/governance/attendance`
2. Review the attendance history table

**Expected Results:**
- ✅ All members are listed
- ✅ For each member shows:
  - Total meetings
  - Attended count
  - Absent count
  - Apologies count
  - Late count
  - Attendance rate (percentage)
- ✅ Sorted by attendance rate (highest first)

**Filter Test:**
1. Filter by specific member
2. Verify only that member's data is shown

---

### Test 20: Meeting Reminders (Cron Job)

**Objective:** Verify automated reminders are sent

**Setup:**
- Create a meeting scheduled for 20-24 hours from now
- Ensure `reminderSent` is `false` in database

**Steps:**
1. Wait for the cron job to run (runs every hour)
2. Or manually trigger: Check server logs

**Expected Results:**
- ✅ Server log shows: `[CRON] Running meeting reminder check...`
- ✅ Server log shows: `Found X meetings needing reminders`
- ✅ In-app notifications created for all members
- ✅ Email reminders sent to all members with email
- ✅ Meeting's `reminderSent` flag set to `true`
- ✅ Server log shows: `Sent reminders for meeting "Title"`

**Verification:**
- Check database: `SELECT reminder_sent FROM meetings WHERE id = X`
- Check notifications table for new entries
- Check email inbox (if using real email service)

**Edge Cases:**
| Scenario | Expected Behavior |
|----------|-------------------|
| Meeting < 24 hours away | Should send reminder |
| Meeting > 24 hours away | Should not send reminder yet |
| Reminder already sent | Should skip (reminderSent = true) |
| Cancelled meeting | Should not send reminder |

---

### Test 21: Search and Filter Meetings

**Objective:** Test search and filtering capabilities

**Steps:**

**21a. Search by Title:**
1. Enter search term in search box
2. Press Enter or click Search

**Expected Results:**
- ✅ Only meetings matching the search term are shown
- ✅ Search is case-insensitive

**21b. Filter by Status:**
1. Select status filter: "SCHEDULED"
2. Apply filter

**Expected Results:**
- ✅ Only scheduled meetings are shown

**21c. Filter by Meeting Type:**
1. Select type filter: "AGM"
2. Apply filter

**Expected Results:**
- ✅ Only AGM meetings are shown

**21d. Filter by Date Range:**
1. Set start date and end date
2. Apply filter

**Expected Results:**
- ✅ Only meetings within the date range are shown

**21e. Combined Filters:**
1. Apply multiple filters simultaneously
2. Verify results match all criteria

---

### Test 22: Pagination

**Objective:** Test pagination for large datasets

**Setup:**
- Ensure there are more than 10 meetings in the system

**Steps:**
1. Navigate to meetings list
2. Verify pagination controls are visible
3. Click "Next" or page number
4. Navigate through pages

**Expected Results:**
- ✅ Default page size is 10 items
- ✅ Pagination shows correct total pages
- ✅ Navigation between pages works
- ✅ Current page is highlighted

---

### Test 23: Error Handling

**Objective:** Verify proper error handling

**Test Cases:**

| Test | Action | Expected Error |
|------|--------|----------------|
| Create without title | Submit empty form | "Meeting title is required" |
| Invalid virtual link | Enter "not-a-url" | "Invalid virtual meeting link" |
| Mark attendance for non-existent member | API call with invalid memberId | "Member not found" |
| Access non-existent meeting | Navigate to `/meetings/99999` | "Meeting not found" |
| Create minutes twice | Try to create minutes for meeting that has them | "Minutes already exist" |
| Negative quorum | Enter -5 for quorum | Validation error |

---

### Test 24: Permission-Based Access Control

**Objective:** Verify role-based access

**Test as Regular Member (meeting:view only):**
1. Login as regular member
2. Navigate to meetings

**Expected Results:**
- ✅ Can view meetings list
- ✅ Can view meeting details
- ✅ Cannot see "Create Meeting" button
- ✅ Cannot see "Edit" button
- ✅ Cannot mark attendance
- ✅ Cannot record minutes

**Test as Secretary (meeting:view, meeting:create, meeting:edit, meeting:attendance, meeting:minutes):**
1. Login as secretary
2. Navigate to meetings

**Expected Results:**
- ✅ Can create meetings
- ✅ Can edit meetings
- ✅ Can mark attendance
- ✅ Can record minutes
- ✅ Cannot delete meetings (if not admin)

---

### Test 25: Mobile Responsiveness

**Objective:** Verify UI works on mobile devices

**Steps:**
1. Open browser developer tools
2. Enable mobile view (iPhone, Android)
3. Navigate through all meeting pages

**Expected Results:**
- ✅ Meetings list is readable and scrollable
- ✅ Create meeting form is usable
- ✅ Meeting details tabs work
- ✅ Attendance marking works
- ✅ All buttons are tappable
- ✅ No horizontal scrolling required

---

## API Testing with cURL

For developers who want to test the API directly:

```bash
# Set your auth token
TOKEN="your-jwt-token"
BASE_URL="http://localhost:4000/api"

# List meetings
curl "$BASE_URL/meetings" \
  -H "Authorization: Bearer $TOKEN"

# Create meeting
curl -X POST "$BASE_URL/meetings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Test Meeting",
    "startTime": "2025-01-20T10:00:00Z",
    "meetingType": "REGULAR",
    "quorumRequired": 10
  }'

# Get meeting details
curl "$BASE_URL/meetings/1" \
  -H "Authorization: Bearer $TOKEN"

# Initialize attendance
curl -X POST "$BASE_URL/meetings/1/attendance/initialize" \
  -H "Authorization: Bearer $TOKEN"

# Mark attendance
curl -X POST "$BASE_URL/meetings/1/attendance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": 1,
    "status": "PRESENT",
    "checkInTime": "2025-01-20T10:05:00Z"
  }'

# Bulk mark attendance
curl -X POST "$BASE_URL/meetings/1/attendance/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attendances": [
      {"memberId": 1, "status": "PRESENT"},
      {"memberId": 2, "status": "PRESENT"},
      {"memberId": 3, "status": "ABSENT"}
    ]
  }'

# Get attendance
curl "$BASE_URL/meetings/1/attendance" \
  -H "Authorization: Bearer $TOKEN"

# Create minutes
curl -X POST "$BASE_URL/meetings/1/minutes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Meeting minutes content...",
    "decisions": "Decision 1, Decision 2",
    "actionItems": "Action 1, Action 2"
  }'

# Approve minutes
curl -X POST "$BASE_URL/meetings/1/minutes/approve" \
  -H "Authorization: Bearer $TOKEN"

# Cancel meeting
curl -X POST "$BASE_URL/meetings/1/cancel" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Venue unavailable"}'

# Get statistics
curl "$BASE_URL/meetings/stats" \
  -H "Authorization: Bearer $TOKEN"

# Get upcoming meetings
curl "$BASE_URL/meetings/upcoming?limit=5" \
  -H "Authorization: Bearer $TOKEN"

# Get attendance history
curl "$BASE_URL/meetings/attendance-history" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Test Completion Checklist

| # | Test | Status | Tester | Date | Notes |
|---|------|--------|--------|------|-------|
| 1 | Access Meetings Module | ⬜ | | | |
| 2 | Create Meeting (Basic) | ⬜ | | | |
| 3 | Create Meeting (Full) | ⬜ | | | |
| 4 | View Meeting Details | ⬜ | | | |
| 5 | Update Meeting | ⬜ | | | |
| 6 | Manage Agenda Items | ⬜ | | | |
| 7 | Initialize Attendance | ⬜ | | | |
| 8 | Mark Individual Attendance | ⬜ | | | |
| 9 | Bulk Mark Attendance | ⬜ | | | |
| 10 | Quorum Calculation | ⬜ | | | |
| 11 | Create Minutes | ⬜ | | | |
| 12 | Update Minutes | ⬜ | | | |
| 13 | Approve Minutes | ⬜ | | | |
| 14 | Cancel Meeting | ⬜ | | | |
| 15 | Delete Meeting | ⬜ | | | |
| 16 | Statistics Dashboard | ⬜ | | | |
| 17 | Upcoming Meetings | ⬜ | | | |
| 18 | Recent Meetings | ⬜ | | | |
| 19 | Attendance History | ⬜ | | | |
| 20 | Meeting Reminders | ⬜ | | | |
| 21 | Search and Filter | ⬜ | | | |
| 22 | Pagination | ⬜ | | | |
| 23 | Error Handling | ⬜ | | | |
| 24 | Permission Access | ⬜ | | | |
| 25 | Mobile Responsiveness | ⬜ | | | |

---

**Tester Name:** _________________  
**Test Date:** _________________  
**Environment:** Development / Staging / Production  
**Browser:** _________________  
**Overall Result:** Pass / Fail  
**Notes:** _________________
