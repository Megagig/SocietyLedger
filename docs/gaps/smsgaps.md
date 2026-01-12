# SMS/Communications UI Module - Manual Testing Guide

## Overview
This guide provides step-by-step instructions for manually testing the SMS/Communications UI Module (Phase 6.6) implementation.

## Prerequisites
- Backend SMS API endpoints are running and accessible
- User has appropriate permissions (SMS_VIEW, SMS_SEND, SMS_CAMPAIGN_MANAGE)
- SMS credits are available for testing

## Test Scenarios

### 1. Communications Dashboard
**URL**: `/dashboard/communications`

**Test Steps**:
1. Navigate to the Communications Dashboard
2. Verify the following elements are displayed:
   - Page title "SMS Dashboard"
   - SMS Balance Card showing current credits
   - Quick Actions section with buttons
   - Recent Messages section
   - Recent Campaigns section
3. Click "Quick Send" button → Should navigate to Quick Send page
4. Click "Create Campaign" button → Should navigate to Campaign Builder page
5. Click "View Templates" button → Should navigate to Templates page
6. Click "View History" button → Should navigate to History page

**Expected Results**:
- Dashboard loads without errors
- Statistics display correctly
- Navigation buttons work as expected

---

### 2. Quick Send SMS
**URL**: `/dashboard/communications/quick-send`

**Test Steps**:
1. Navigate to Quick Send page
2. Test Recipient Selector:
   - Select "All Members" option
   - Select "By Category" and choose a category
   - Select "By Status" and choose a status
   - Select "Custom Selection" and add individual recipients
3. Test SMS Composer:
   - Type a message and verify character count updates
   - Verify segment count is calculated correctly (160 chars = 1 segment)
   - Select a template from dropdown → Message should populate
   - Click "Insert Variable" → Variable placeholder should be inserted
4. Click "Send SMS" button:
   - With recipients selected → Should send successfully
   - Without recipients → Should show validation error
   - Without message → Should show validation error
5. Verify success notification appears

**Expected Results**:
- Recipient selection works for all modes
- Character/segment count updates in real-time
- Template selection populates message field
- Variables are inserted correctly
- Validation errors display appropriately
- Success notification appears on successful send

---

### 3. SMS Campaigns List
**URL**: `/dashboard/communications/campaigns`

**Test Steps**:
1. Navigate to Campaigns List page
2. Verify table columns: Campaign Name, Status, Recipients, Sent, Delivered, Scheduled For, Created
3. Test filters:
   - Search by campaign name
   - Filter by status (Draft, Scheduled, In Progress, Completed, Cancelled, Failed)
4. Test pagination:
   - Navigate between pages
   - Verify correct number of campaigns per page
5. Test campaign actions menu:
   - Click "View Details" → Should navigate to campaign detail page
   - For draft campaigns: Click "Start Campaign" → Should start the campaign
   - For draft/scheduled/in-progress campaigns: Click "Cancel Campaign" → Should cancel the campaign
   - For draft/cancelled/failed campaigns: Click "Delete" → Should delete after confirmation

**Expected Results**:
- Campaigns list loads correctly
- Filters work as expected
- Pagination functions properly
- Campaign status badges display correct colors
- Action buttons appear/disappear based on campaign status

---

### 4. Create New Campaign
**URL**: `/dashboard/communications/campaigns/new`

**Test Steps**:
1. Navigate to Campaign Builder page
2. Fill in campaign details:
   - Campaign Name: "Test Campaign"
   - Recipient Type: Select "Custom Selection"
   - Add recipients using Recipient Selector
   - Compose message using SMS Composer
3. Test scheduling:
   - Leave "Schedule For" empty → Campaign should be created as draft
   - Select a future date/time → Campaign should be scheduled
4. Click "Create Campaign" button:
   - With all required fields → Should create successfully
   - Without campaign name → Should show validation error
   - Without recipients → Should show validation error
   - Without message → Should show validation error
5. Verify success notification and navigation to campaigns list

**Expected Results**:
- Campaign form validates correctly
- Campaign is created with proper status
- Success notification appears
- Redirects to campaigns list after creation

---

### 5. Campaign Detail Page
**URL**: `/dashboard/communications/campaigns/[id]`

**Test Steps**:
1. Navigate to Campaign Detail page for an existing campaign
2. Verify campaign information displays:
   - Campaign name and status badge
   - Created date/time
   - Scheduled For (if applicable)
   - Started At (if applicable)
   - Completed At (if applicable)
   - Message content
   - Recipient, Sent, Delivered, Failed counts
3. Test campaign actions:
   - For draft campaigns: Click "Start Campaign" → Should start and update status
   - For draft/scheduled/in-progress: Click "Cancel Campaign" → Should cancel and update status
   - For draft/cancelled/failed: Click "Delete" → Should delete after confirmation
4. Verify progress bars (for in-progress/completed campaigns):
   - Sent progress bar
   - Delivered progress bar
   - Failed progress bar
5. Click "Refresh" button → Should reload campaign data

**Expected Results**:
- Campaign details display correctly
- Status badge shows correct color
- Progress bars reflect current campaign state
- Action buttons work based on campaign status
- Refresh reloads data without page reload

---

### 6. SMS Templates List
**URL**: `/dashboard/communications/templates`

**Test Steps**:
1. Navigate to Templates List page
2. Verify table columns: Template Name, Category, Message, Usage, Created
3. Test Template Category filter:
   - Select different categories
   - Verify template list filters correctly
4. Test search:
   - Search by template name or message content
5. Test template actions:
   - Click "Create Template" → Should open template editor with empty form
   - Click "Edit" on a template → Should open template editor with template data
   - Click "Delete" → Should delete after confirmation
6. Test pagination if multiple templates exist

**Expected Results**:
- Templates list loads correctly
- Category filter works
- Search functions properly
- Category counts display correctly
- Template CRUD operations work as expected

---

### 7. Template Editor (Create/Edit)
**URL**: Opens as modal from Templates page

**Test Steps**:
1. Open template editor:
   - For create: Should have empty form
   - For edit: Should have template data pre-filled
2. Fill in template details:
   - Template Name: "Test Template"
   - Category: Select a category (e.g., "Dues Reminder")
   - Message: Type a message with variables like `{{name}}, your dues of {{amount}} are due on {{due_date}}`
3. Click "Save Template":
   - With all fields → Should create/update successfully
   - Without name → Should show validation error
   - Without message → Should show validation error
4. Click "Cancel" → Should close editor without saving

**Expected Results**:
- Form validates correctly
- Template is created or updated
- Success notification appears
- Editor closes after successful save
- Cancel closes without saving

---

### 8. SMS History
**URL**: `/dashboard/communications/history`

**Test Steps**:
1. Navigate to SMS History page
2. Verify table columns: Recipient, Status, Message, Segments, Cost, Sent At, Delivered At
3. Test filters:
   - Search by recipient or message content
   - Filter by status (Delivered, Sent, Failed, Pending)
4. Verify status badges:
   - Delivered: Green badge
   - Sent: Blue badge
   - Failed: Red badge
   - Pending: Yellow badge
5. Click "View Details" on a message → Should open message detail modal
6. Test pagination if many messages exist

**Expected Results**:
- Message history loads correctly
- Filters work as expected
- Status badges display correct colors
- Message detail modal opens with correct data

---

### 9. Message Detail Modal
**Trigger**: Click "View Details" on a message in History page

**Test Steps**:
1. Open message detail modal
2. Verify all information displays:
   - Status badge with icon
   - Recipient name and phone number
   - Copy button for phone number
   - Message content
   - Segments count
   - Cost in credits
   - Sent At timestamp
   - Delivered At timestamp (if delivered)
   - Campaign ID (if applicable)
   - Template ID (if applicable)
3. Test copy button:
   - Click copy button → Should copy phone number
   - Button text should change to "Copied" temporarily
4. For failed messages: Verify error message displays
5. Click "Close" → Should close modal

**Expected Results**:
- All message details display correctly
- Status badge shows correct color and icon
- Copy button works as expected
- Error messages display for failed messages
- Modal closes properly

---

### 10. SMS Reports
**URL**: `/dashboard/communications/reports`

**Test Steps**:
1. Navigate to SMS Reports page
2. Verify Quick Stats cards:
   - Total Credits
   - Credits Used
   - Credits Remaining
   - This Month Usage
   - This Month Purchased
3. Click "Top Up" button on balance card → Should set top-up amount to 1000
4. Test Top Up form:
   - Enter amount: 500
   - Select payment method: "Paystack (Card)" or "Bank Transfer"
   - Click "Top Up" without amount → Should show validation error
   - Click "Top Up" with valid amount → Should initiate top-up
   - Click "Cancel" → Should clear form
5. Verify Credit Transactions section:
   - Transaction list displays
   - Purchase transactions: Green background
   - Usage transactions: Red background
   - Transaction type, date, amount, and description display
6. Click "Refresh" button → Should reload balance and transactions

**Expected Results**:
- Stats cards display correct values
- Balance card shows current credits
- Top-up form validates correctly
- Transaction history loads correctly
- Transactions are color-coded by type
- Refresh reloads all data

---

### 11. SMS Balance Card Component
**Location**: Dashboard and Reports pages

**Test Steps**:
1. Locate SMS Balance Card
2. Verify display:
   - Total credits count
   - Credits used count
   - Credits remaining count
   - Usage percentage
   - "Top Up" button
3. Click "Top Up" button → Should set top-up amount (in Reports page)

**Expected Results**:
- Balance displays correctly
- Visual progress indicator shows usage
- Top-up button triggers top-up flow

---

### 12. Recipient Selector Component
**Location**: Quick Send and Campaign Builder pages

**Test Steps**:
1. Test "All Members" option:
   - Select → All members should be selected
2. Test "By Category" option:
   - Select → Category dropdown should appear
   - Select a category → Members in that category should be selected
3. Test "By Status" option:
   - Select → Status dropdown should appear
   - Select a status → Members with that status should be selected
4. Test "Custom Selection" option:
   - Select → Member search should appear
   - Search for a member → Member list should filter
   - Click member → Member should be added to selected list
   - Click "Add Phone Number" → Phone input should appear
   - Enter phone number → Phone should be added to list
   - Click "Remove" on selected recipient → Should remove from list
   - Click "Clear All" → All recipients should be removed

**Expected Results**:
- All selection modes work correctly
- Member search filters properly
- Phone numbers can be added/removed
- Selected recipients list updates in real-time
- Recipient count displays correctly

---

### 13. SMS Composer Component
**Location**: Quick Send and Campaign Builder pages

**Test Steps**:
1. Type a message → Character count should update
2. Test character counting:
   - Type 160 characters → Should show 1 segment
   - Type 320 characters → Should show 2 segments
   - Type special characters → Should calculate UCS-2 segments (70 chars each)
3. Test template selection:
   - Click template dropdown → Templates list should appear
   - Select a template → Message should populate with template content
4. Test variable insertion:
   - Click "Insert Variable" → Variable dropdown should appear
   - Select a variable → Variable placeholder should be inserted at cursor position
5. Verify cost calculation:
   - Check if cost displays correctly based on segments

**Expected Results**:
- Character/segment count updates in real-time
- Template selection populates message
- Variables insert correctly
- Cost calculation is accurate

---

### 14. Campaign Status Badge Component
**Location**: Campaigns list and Campaign detail pages

**Test Steps**:
1. Verify badges display for all campaign statuses:
   - Draft: Gray badge
   - Scheduled: Blue badge
   - In Progress: Yellow badge
   - Completed: Green badge
   - Cancelled: Orange badge
   - Failed: Red badge
2. Verify badge text and icon

**Expected Results**:
- All status badges display correctly
- Colors match status
- Icons display appropriately

---

### 15. Campaign Progress Component
**Location**: Campaign detail page

**Test Steps**:
1. Navigate to a completed/in-progress campaign
2. Verify progress bars display:
   - Sent progress (blue)
   - Delivered progress (green)
   - Failed progress (red)
3. Verify percentages calculate correctly based on counts

**Expected Results**:
- Progress bars display correctly
- Percentages are accurate
- Colors match the metric type

---

### 16. Template Category Component
**Location**: Templates list page

**Test Steps**:
1. Click on a category → Should filter templates
2. Verify category counts display next to each category
3. Click "All Categories" → Should show all templates

**Expected Results**:
- Category filtering works correctly
- Category counts are accurate
- "All Categories" shows all templates

---

## Common Issues to Check

### Permission Issues
- Verify user has `SMS_VIEW` permission for dashboard/history/reports
- Verify user has `SMS_SEND` permission for quick send/campaigns
- Verify user has `SMS_CAMPAIGN_MANAGE` permission for campaign management

### API Errors
- Check browser console for API errors
- Verify API base URL is correct
- Verify authentication token is valid

### UI Issues
- Check for responsive design on mobile devices
- Verify loading states display during API calls
- Check for proper error handling and user feedback

### Data Issues
- Verify SMS credits are available for testing
- Check that recipient data exists for selection
- Verify templates exist for testing

## Testing Checklist

Use this checklist to track testing progress:

- [ ] Communications Dashboard loads and displays correctly
- [ ] Quick Send SMS works with all recipient types
- [ ] SMS Composer calculates segments correctly
- [ ] Campaigns list displays and filters work
- [ ] Create new campaign validates and creates correctly
- [ ] Campaign detail page shows all information
- [ ] Campaign actions (start/cancel/delete) work properly
- [ ] Templates list displays and filters work
- [ ] Template editor creates and updates templates
- [ ] SMS history displays and filters work
- [ ] Message detail modal shows all information
- [ ] SMS reports display correct statistics
- [ ] Top up credits flow works correctly
- [ ] All notifications display appropriately
- [ ] No TypeScript errors in console
- [ ] No runtime errors in console
- [ ] Responsive design works on mobile

## Notes
- Test with different user roles (admin, treasurer, member)
- Test with different permission levels
- Verify all features work with empty data states
- Test with large datasets (pagination performance)
- Verify error messages are clear and helpful
