# Communications Module - Manual Testing Guide

This guide provides comprehensive manual testing procedures for the SMS Communication module, including edge cases and expected behaviors.

## Prerequisites

### 1. Environment Setup
```bash
# Ensure API is running
cd apps/api && npm run dev

# Ensure Web is running
cd apps/web && npm run dev
```

### 2. Required Configuration
Verify `.env` has Termii credentials:
```env
TERMII_API_KEY=your_api_key
TERMII_SENDER_ID=SocLedger
TERMII_BASE_URL=https://api.ng.termii.com/api
TERMII_CHANNEL=generic
```

### 3. Test User Requirements
- User with `ADMIN` or `SUPER_ADMIN` role
- User must belong to an association
- Association must have SMS credits (or add via top-up)

### 4. Test Data Setup
```bash
# Top up SMS credits for testing (via API or UI)
curl -X POST http://localhost:4000/api/sms/credits/topup \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "description": "Test credits"}'
```

---

## Test Cases

## 1. SMS Dashboard Tests

### TC-1.1: Dashboard Loading
**Steps:**
1. Navigate to `/dashboard/communication/sms`
2. Wait for page to load

**Expected:**
- Statistics cards display (Messages Sent, Delivery Rate, Campaigns, Credits)
- Quick Actions section visible
- Recent Messages section visible
- Recent Campaigns section visible (if any exist)

**Edge Cases:**
- New association with no SMS history → All stats should show 0
- Low credit balance (<100) → Warning banner should appear

### TC-1.2: Dashboard Refresh
**Steps:**
1. On SMS Dashboard, click the refresh icon
2. Observe loading state

**Expected:**
- Data refreshes without full page reload
- Loading indicator appears briefly
- Updated data displays

---

## 2. Quick SMS Tests

### TC-2.1: Send Single SMS
**Steps:**
1. Click "Quick SMS" button
2. Enter single phone number: `08012345678`
3. Enter message: `Test message from SocietyLedger`
4. Click "Send SMS"

**Expected:**
- Success message: "Sent to 1 recipients"
- Credits deducted by 1 (for single segment)
- Message appears in history

### TC-2.2: Send Multiple SMS
**Steps:**
1. Click "Quick SMS" button
2. Enter multiple numbers (comma-separated): `08012345678, 08098765432`
3. Enter message: `Bulk test message`
4. Click "Send SMS"

**Expected:**
- Success message shows count of sent messages
- Credits deducted appropriately
- All messages appear in history

### TC-2.3: Send SMS with Template
**Steps:**
1. Create a template first (see TC-4.1)
2. Click "Quick SMS" button
3. Select template from dropdown
4. Verify message content populates
5. Enter recipient
6. Click "Send SMS"

**Expected:**
- Template content loads into message field
- Template usage count increments
- SMS sends successfully

### TC-2.4: Invalid Phone Number
**Steps:**
1. Click "Quick SMS" button
2. Enter invalid number: `12345`
3. Enter message
4. Click "Send SMS"

**Expected:**
- Error message about invalid phone format
- No credits deducted
- No message in history

### TC-2.5: Empty Recipients
**Steps:**
1. Click "Quick SMS" button
2. Leave recipients empty
3. Enter message
4. Click "Send SMS"

**Expected:**
- Validation error: "Please enter recipients and message"
- Send button should be disabled if both fields empty

### TC-2.6: Empty Message
**Steps:**
1. Click "Quick SMS" button
2. Enter valid recipient
3. Leave message empty
4. Click "Send SMS"

**Expected:**
- Validation error
- Send button should be disabled

### TC-2.7: Long Message (Multi-segment)
**Steps:**
1. Click "Quick SMS" button
2. Enter recipient
3. Enter message > 160 characters (e.g., 320 characters)
4. Observe segment counter
5. Click "Send SMS"

**Expected:**
- Segment counter shows "2 SMS segment(s)"
- Credits deducted = recipients × segments
- Message sends successfully

### TC-2.8: Insufficient Credits
**Steps:**
1. Ensure credit balance is 0 or very low
2. Try to send SMS to multiple recipients

**Expected:**
- Error: "Insufficient SMS credits. Required: X, Available: Y"
- No messages sent
- No credits deducted

### TC-2.9: Phone Number Formats
Test various Nigerian phone formats:

| Input | Expected Formatted |
|-------|-------------------|
| `08012345678` | `2348012345678` |
| `8012345678` | `2348012345678` |
| `+2348012345678` | `2348012345678` |
| `2348012345678` | `2348012345678` |
| `080-1234-5678` | `2348012345678` |

### TC-2.10: Newline-Separated Recipients
**Steps:**
1. Click "Quick SMS"
2. Enter recipients on separate lines:
   ```
   08012345678
   08098765432
   08011111111
   ```
3. Send SMS

**Expected:**
- All 3 recipients receive SMS
- Proper parsing of newline-separated numbers

---

## 3. Campaign Tests

### TC-3.1: Create Draft Campaign
**Steps:**
1. Navigate to `/dashboard/communication/sms/campaigns`
2. Click "New Campaign"
3. Fill form:
   - Name: "Test Campaign"
   - Recipient Type: "All Members"
   - Message: "Test campaign message"
4. Click "Create Campaign"

**Expected:**
- Campaign created with DRAFT status
- Appears in campaign list
- Shows recipient count

### TC-3.2: Create Scheduled Campaign
**Steps:**
1. Click "New Campaign"
2. Fill form with future schedule date
3. Create campaign

**Expected:**
- Campaign created with SCHEDULED status
- scheduledAt field populated

### TC-3.3: Start Campaign
**Steps:**
1. Create a draft campaign
2. Click the play button to start
3. Confirm the action

**Expected:**
- Confirmation dialog appears
- Campaign status changes to IN_PROGRESS then COMPLETED
- Messages sent to all recipients
- sentCount, deliveredCount, failedCount updated
- Credits deducted

### TC-3.4: Cancel Campaign
**Steps:**
1. Create a draft or scheduled campaign
2. Click cancel button
3. Confirm

**Expected:**
- Campaign status changes to CANCELLED
- No messages sent (if not started)

### TC-3.5: Delete Draft Campaign
**Steps:**
1. Create a draft campaign
2. Click delete button
3. Confirm

**Expected:**
- Campaign removed from list
- Success message displayed

### TC-3.6: Cannot Delete Non-Draft Campaign
**Steps:**
1. Start a campaign (let it complete)
2. Try to delete it

**Expected:**
- Delete button not visible for completed campaigns
- API returns error if attempted directly

### TC-3.7: Campaign with Owing Members Filter
**Steps:**
1. Ensure some members have outstanding transactions
2. Create campaign with "Owing Members" recipient type
3. Set minimum owing amount filter
4. Start campaign

**Expected:**
- Only members with balance >= minimum receive SMS
- Correct recipient count shown

### TC-3.8: Campaign with Custom Numbers
**Steps:**
1. Create campaign with "Custom Numbers" recipient type
2. Enter custom phone numbers in filter
3. Start campaign

**Expected:**
- SMS sent only to specified numbers
- Numbers not required to be members

### TC-3.9: Campaign with No Recipients
**Steps:**
1. Create campaign targeting a category with no members
2. Try to start campaign

**Expected:**
- Error: "No recipients found for this campaign"
- Campaign remains in DRAFT status

### TC-3.10: Campaign Insufficient Credits
**Steps:**
1. Create campaign targeting many recipients
2. Ensure credit balance is less than required
3. Try to start campaign

**Expected:**
- Error: "Insufficient credits. Required: X, Available: Y"
- Campaign not started

---

## 4. Template Tests

### TC-4.1: Create Template
**Steps:**
1. Navigate to `/dashboard/communication/sms/templates`
2. Click "New Template"
3. Fill form:
   - Name: "Payment Reminder"
   - Category: "Payment Reminder"
   - Content: "Dear {{name}}, your payment of ₦{{amount}} is due on {{dueDate}}."
   - Placeholders: "name, amount, dueDate"
4. Click "Create"

**Expected:**
- Template created and appears in list
- Placeholders displayed as tags
- Category badge shown

### TC-4.2: Edit Template
**Steps:**
1. Click edit button on existing template
2. Modify content
3. Save changes

**Expected:**
- Template updated
- Changes reflected in list

### TC-4.3: Delete Template
**Steps:**
1. Click delete button on template
2. Confirm deletion

**Expected:**
- Template removed from list
- Success message shown

### TC-4.4: Toggle Template Active Status
**Steps:**
1. Click the check/x icon on a template
2. Observe status change

**Expected:**
- Template isActive toggles
- Visual indicator changes (opacity for inactive)
- Inactive templates not shown in Quick SMS dropdown

### TC-4.5: Duplicate Template Name
**Steps:**
1. Create template with name "Test Template"
2. Try to create another with same name

**Expected:**
- Error: unique constraint violation
- Template not created

### TC-4.6: Template Category Filter
**Steps:**
1. Create templates in different categories
2. Use category dropdown filter

**Expected:**
- Only templates of selected category shown
- "All Categories" shows all templates

### TC-4.7: Template with Long Content
**Steps:**
1. Create template with content > 160 characters
2. Save template

**Expected:**
- Template saved successfully
- Character count shown
- Segment count displayed

### TC-4.8: Template Placeholder Validation
**Steps:**
1. Create template with placeholders in content: `{{name}}`
2. List placeholders: `name`
3. Use template in Quick SMS

**Expected:**
- Placeholders highlighted in template display
- When used, placeholders can be substituted

---

## 5. Message History Tests

### TC-5.1: View Message History
**Steps:**
1. Navigate to `/dashboard/communication/sms/history`
2. Observe message list

**Expected:**
- Messages displayed in table format
- Columns: Recipient, Message, Type, Status, Sent At
- Pagination if > 20 messages

### TC-5.2: Filter by Status
**Steps:**
1. On history page, select "Delivered" from status filter
2. Observe filtered results

**Expected:**
- Only DELIVERED messages shown
- Count updates

### TC-5.3: Pagination
**Steps:**
1. Ensure > 20 messages exist
2. Navigate through pages

**Expected:**
- 20 messages per page
- Previous/Next buttons work
- Page indicator accurate

### TC-5.4: Message with Error
**Steps:**
1. Send SMS to invalid number (will fail)
2. View in history

**Expected:**
- Status shows FAILED
- Error message displayed below status

### TC-5.5: Campaign Messages
**Steps:**
1. Start a campaign
2. View history
3. Observe campaign association

**Expected:**
- Messages show campaign name
- Type shows "BULK"

---

## 6. Credit Management Tests

### TC-6.1: View Credit Balance
**Steps:**
1. Navigate to SMS Dashboard
2. Observe credit balance card

**Expected:**
- Current balance displayed
- Low balance warning if < 100

### TC-6.2: Top Up Credits
**Steps:**
1. Navigate to credits page (or use API)
2. Enter top-up amount: 500
3. Submit

**Expected:**
- Balance increases by 500
- Transaction recorded in history
- lastTopUpAt updated

### TC-6.3: Credit Deduction on Send
**Steps:**
1. Note current balance
2. Send SMS (1 segment, 1 recipient)
3. Check balance

**Expected:**
- Balance decreased by 1
- Transaction recorded with type "USAGE"

### TC-6.4: Credit History
**Steps:**
1. View credit transaction history
2. Observe entries

**Expected:**
- PURCHASE entries for top-ups (positive amounts)
- USAGE entries for sends (negative amounts)
- Timestamps accurate

---

## 7. Permission Tests

### TC-7.1: User Without SMS_SEND Permission
**Steps:**
1. Login as user without SMS_SEND permission
2. Navigate to SMS Dashboard

**Expected:**
- "Quick SMS" button not visible
- Cannot access send endpoint

### TC-7.2: User Without SMS_CAMPAIGN_MANAGE Permission
**Steps:**
1. Login as user without SMS_CAMPAIGN_MANAGE permission
2. Navigate to Campaigns page

**Expected:**
- "New Campaign" button not visible
- Cannot start/cancel/delete campaigns
- Can view campaigns (if has SMS_VIEW)

### TC-7.3: User Without SMS_TEMPLATE_MANAGE Permission
**Steps:**
1. Login as user without SMS_TEMPLATE_MANAGE permission
2. Navigate to Templates page

**Expected:**
- "New Template" button not visible
- Edit/Delete buttons not visible
- Can view templates (if has SMS_VIEW)

### TC-7.4: Super Admin Without Association
**Steps:**
1. Login as SUPER_ADMIN without association context
2. Navigate to SMS Dashboard

**Expected:**
- Error: "Association not found"
- Must select/switch to an association first

---

## 8. Edge Cases & Error Handling

### TC-8.1: Network Timeout
**Steps:**
1. Simulate slow network (browser dev tools)
2. Send SMS

**Expected:**
- Retry mechanism activates (up to 3 retries)
- Appropriate error message if all retries fail

### TC-8.2: Invalid API Key
**Steps:**
1. Set invalid TERMII_API_KEY in .env
2. Restart API
3. Try to send SMS

**Expected:**
- Error from Termii API
- Message status: FAILED
- Error message logged

### TC-8.3: Rate Limiting
**Steps:**
1. Send bulk SMS to 100+ recipients rapidly

**Expected:**
- System batches requests (10 per batch)
- 500ms delay between batches
- All messages eventually sent

### TC-8.4: Special Characters in Message
**Steps:**
1. Send SMS with special characters: `₦`, `€`, emojis
2. Check delivery

**Expected:**
- Message sent successfully
- Special characters may affect segment count (Unicode)

### TC-8.5: Very Long Recipient List
**Steps:**
1. Try Quick SMS with 1000+ recipients

**Expected:**
- Validation error: "Maximum 1000 recipients allowed"
- For campaigns, no limit but credit check applies

### TC-8.6: Concurrent Campaign Starts
**Steps:**
1. Open two browser tabs
2. Try to start same campaign simultaneously

**Expected:**
- Only one succeeds
- Second gets error about campaign status

### TC-8.7: Member Without Phone Number
**Steps:**
1. Create member without phone number
2. Create campaign targeting "All Members"
3. Start campaign

**Expected:**
- Member without phone is skipped
- No error, just not included in recipient count

### TC-8.8: Duplicate Phone Numbers in Recipients
**Steps:**
1. Quick SMS with duplicate numbers: `08012345678, 08012345678`

**Expected:**
- Both processed (no deduplication)
- Two messages sent, two credits used

---

## 9. API Testing with cURL

### Get Dashboard
```bash
curl -X GET http://localhost:4000/api/sms/dashboard \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>"
```

### Send Quick SMS
```bash
curl -X POST http://localhost:4000/api/sms/send \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["08012345678"],
    "message": "Test message from API"
  }'
```

### Create Campaign
```bash
curl -X POST http://localhost:4000/api/sms/campaigns \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Campaign",
    "message": "Test campaign message",
    "recipientType": "ALL_MEMBERS"
  }'
```

### Start Campaign
```bash
curl -X POST http://localhost:4000/api/sms/campaigns/1/start \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>"
```

### Create Template
```bash
curl -X POST http://localhost:4000/api/sms/templates \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Template",
    "content": "Hello {{name}}, this is a test.",
    "category": "GENERAL",
    "placeholders": ["name"]
  }'
```

### Top Up Credits
```bash
curl -X POST http://localhost:4000/api/sms/credits/topup \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "reference": "TEST-001",
    "description": "Test top-up"
  }'
```

### Get Credit Balance
```bash
curl -X GET http://localhost:4000/api/sms/credits/balance \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>"
```

### List Messages
```bash
curl -X GET "http://localhost:4000/api/sms/messages?page=1&limit=20&status=DELIVERED" \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>"
```

---

## 10. Validation Rules Reference

### Phone Number
- Minimum 10 digits
- Maximum 15 digits
- Only digits and `+` allowed
- Auto-formatted to Nigerian international format

### Message
- Minimum 1 character
- Maximum 918 characters (6 segments)
- Segment calculation: 160 chars for single, 153 chars per segment for multi-part

### Campaign Name
- Minimum 1 character
- Maximum 100 characters

### Template Name
- Minimum 1 character
- Maximum 100 characters
- Unique per association

### Recipients (Quick SMS)
- Minimum 1 recipient
- Maximum 1000 recipients

### Credit Amount
- Must be positive number

---

## 11. Common Issues & Troubleshooting

### Issue: "Association not found" Error
**Cause:** Missing tenant context
**Solution:** Ensure `X-Tenant` header is set or access via subdomain

### Issue: SMS Not Sending
**Causes:**
1. Invalid TERMII_API_KEY
2. Insufficient credits
3. Invalid phone number format
4. Network issues

**Solution:** Check API logs, verify credentials, check credit balance

### Issue: Campaign Shows 0 Recipients
**Cause:** No members match the filter criteria
**Solution:** Verify members exist with phone numbers and match filter

### Issue: Template Placeholders Not Replaced
**Cause:** Placeholder names don't match templateData keys
**Solution:** Ensure exact match between `{{placeholder}}` and data keys

### Issue: High Failure Rate
**Causes:**
1. Invalid phone numbers in database
2. DND (Do Not Disturb) numbers with generic channel
3. Termii account issues

**Solution:** Validate phone numbers, use `dnd` channel for transactional messages

---

## 12. Test Data Cleanup

After testing, clean up test data:

```sql
-- Delete test messages
DELETE FROM sms_messages WHERE message LIKE '%Test%';

-- Delete test campaigns
DELETE FROM sms_campaigns WHERE name LIKE '%Test%';

-- Delete test templates
DELETE FROM sms_templates WHERE name LIKE '%Test%';

-- Reset credit balance (optional)
UPDATE sms_credit_balances SET balance = 0, total_used = 0 WHERE association_id = <id>;
```

---

## Summary Checklist

- [ ] Dashboard loads correctly
- [ ] Quick SMS sends successfully
- [ ] Phone number validation works
- [ ] Multi-segment messages calculated correctly
- [ ] Templates CRUD operations work
- [ ] Campaigns CRUD operations work
- [ ] Campaign execution sends to correct recipients
- [ ] Credit balance updates correctly
- [ ] Credit deduction accurate
- [ ] Message history displays correctly
- [ ] Filters work on all list pages
- [ ] Pagination works correctly
- [ ] Permissions enforced properly
- [ ] Error messages are user-friendly
- [ ] Audit logs created for actions
