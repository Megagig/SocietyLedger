# SocietyLedger - API-UI Gap Implementation Tasks

**Created:** January 11, 2026  
**Purpose:** Detailed task breakdown for implementing 82 UI tasks across 6 API-UI gaps  
**Total Tasks:** 82 tasks  
**Estimated Time:** 18-25 days  
**Backend Status:** ✅ 100% Complete (all endpoints tested and working)  
**Frontend Status:** ❌ Zero UI (pure additive work)

---

## 📋 TABLE OF CONTENTS

1. [Phase 3.6: Nigerian Payments UI Module](#phase-36-nigerian-payments-ui-module) - 22 tasks
2. [Phase 6.6: SMS/Communications UI Module](#phase-66-smscommunications-ui-module) - 18 tasks
3. [Phase 10.5: Exports Management UI](#phase-105-exports-management-ui) - 12 tasks
4. [Phase 6.7: Notifications Center UI](#phase-67-notifications-center-ui) - 10 tasks
5. [Phase 14: Webhooks Management UI](#phase-14-webhooks-management-ui) - 10 tasks
6. [Phase 15: Cron Jobs Management UI](#phase-15-cron-jobs-management-ui) - 8 tasks
7. [Implementation Guidelines](#implementation-guidelines)
8. [Success Metrics](#success-metrics)

---

## Phase 3.6: Nigerian Payments UI Module

**Priority:** 🔴 CRITICAL  
**Backend Status:** ✅ 100% Complete (24+ endpoints)  
**Frontend Status:** ❌ Zero UI  
**Estimated Time:** 5-7 days  
**Location:** `apps/api/src/modules/nigerian-payments/` → `apps/web/src/app/dashboard/payments/nigerian/`

### Overview
Essential for African market operations. 24+ backend endpoints completely unused without UI. Payment reconciliation is manual without UI. Bank transfer tracking not accessible to admins.

### Backend Endpoints Available
- `GET/POST /api/payments/nigerian/bank-accounts` - Bank account management
- `GET/POST /api/payments/nigerian/bank-transfers` - Bank transfer tracking
- `POST /api/payments/nigerian/bank-transfers/:id/verify` - Verify transfers
- `POST /api/payments/nigerian/import-statement` - Import bank statements
- `GET /api/payments/nigerian/statement-entries` - List statement entries
- `POST /api/payments/nigerian/reconcile` - Reconcile payments
- `POST /api/payments/nigerian/reconciliations/:id/confirm` - Confirm reconciliation
- `POST /api/payments/nigerian/auto-match` - Run auto-matching
- `POST /api/payments/nigerian/auto-match/apply` - Apply auto-matches
- `GET/POST /api/payments/nigerian/proofs` - Payment proof management
- `POST /api/payments/nigerian/proofs/:id/verify` - Verify payment proofs
- `GET /api/payments/nigerian/unmatched-dashboard` - Unmatched payments dashboard
- `GET /api/payments/nigerian/banks` - List Nigerian banks

### Tasks Breakdown

#### Day 1-2: Payments Dashboard + Bank Accounts Management (8 tasks)

- [ ] **TASK-NIG-001:** Create Nigerian Payments Dashboard Page
  - **File:** `apps/web/src/app/dashboard/payments/nigerian/page.tsx`
  - **Description:** Main dashboard showing payment statistics, quick actions, navigation
  - **Components:** Payment stats cards, quick action buttons, recent activity
  - **Acceptance:** Dashboard loads, displays statistics correctly

- [ ] **TASK-NIG-002:** Create Bank Accounts List Page
  - **File:** `apps/web/src/app/dashboard/payments/nigerian/bank-accounts/page.tsx`
  - **Description:** List all association bank accounts with actions
  - **Features:** View accounts, add new account, edit account, delete account, set default
  - **Acceptance:** CRUD operations work, default account indicator

- [ ] **TASK-NIG-003:** Create Bank Account Form Component
  - **File:** `apps/web/src/components/payments/nigerian/BankAccountForm.tsx`
  - **Description:** Reusable form for creating/editing bank accounts
  - **Fields:** Bank name, account name, account number, bank code, description, isDefault, isActive
  - **Acceptance:** Form validates correctly, saves successfully

- [ ] **TASK-NIG-004:** Create Nigerian Banks Dropdown Component
  - **File:** `apps/web/src/components/payments/nigerian/NigerianBanksDropdown.tsx`
  - **Description:** Dropdown with all Nigerian banks (from API)
  - **Acceptance:** Loads banks from API, searchable, filters correctly

- [ ] **TASK-NIG-005:** Create Bank Account Card Component
  - **File:** `apps/web/src/components/payments/nigerian/BankAccountCard.tsx`
  - **Description:** Display bank account details in card format
  - **Acceptance:** Shows all account info, action buttons work

- [ ] **TASK-NIG-006:** Add Nigerian Payments API Client
  - **File:** `apps/web/src/lib/api/nigerian-payments.ts`
  - **Description:** API client functions for all Nigerian payments endpoints
  - **Functions:** getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount, getBanks
  - **Acceptance:** All API functions implemented and tested

- [ ] **TASK-NIG-007:** Add Nigerian Payments Route to Sidebar
  - **File:** `apps/web/src/components/layout/Sidebar.tsx` (update)
  - **Description:** Add Nigerian Payments menu item to admin sidebar
  - **Acceptance:** Menu item visible, navigates to dashboard

- [ ] **TASK-NIG-008:** Add Nigerian Payments to Constants
  - **File:** `apps/web/src/utils/constants.ts` (update)
  - **Description:** Add API route constants for Nigerian payments
  - **Acceptance:** All routes defined correctly

#### Day 3-4: Bank Transfer Tracking + Recording (5 tasks)

- [ ] **TASK-NIG-009:** Create Bank Transfers List Page
  - **File:** `apps/web/src/app/dashboard/payments/nigerian/transfers/page.tsx`
  - **Description:** List all bank transfers with filters and pagination
  - **Features:** Filter by status, date range, member, search by reference
  - **Acceptance:** List loads, filters work, pagination works

- [ ] **TASK-NIG-010:** Create Bank Transfer Form Component
  - **File:** `apps/web/src/components/payments/nigerian/BankTransferForm.tsx`
  - **Description:** Form for recording bank transfers
  - **Fields:** Sender bank, account number, account name, amount, reference, transfer date, narration, member (link), bank account (receiving)
  - **Acceptance:** Form validates, saves successfully

- [ ] **TASK-NIG-011:** Create Bank Transfer Detail Page
  - **File:** `apps/web/src/app/dashboard/payments/nigerian/transfers/[id]/page.tsx`
  - **Description:** View individual bank transfer details
  - **Features:** Full transfer details, linked transaction, verification status, proof uploads
  - **Acceptance:** Detail page loads, shows all information

- [ ] **TASK-NIG-012:** Create Transfer Status Badge Component
  - **File:** `apps/web/src/components/payments/nigerian/TransferStatusBadge.tsx`
  - **Description:** Visual badge showing transfer status (PENDING, VERIFIED, MATCHED, REJECTED)
  - **Acceptance:** Badge colors and labels match status correctly

- [ ] **TASK-NIG-013:** Create Transfer Actions Component
  - **File:** `apps/web/src/components/payments/nigerian/TransferActions.tsx`
  - **Description:** Action buttons for transfers (verify, edit, delete)
  - **Acceptance:** Actions work based on user permissions and transfer status

#### Day 5-6: Payment Reconciliation Interface (5 tasks)

- [ ] **TASK-NIG-014:** Create Reconciliation Dashboard Page
  - **File:** `apps/web/src/app/dashboard/payments/nigerian/reconciliation/page.tsx`
  - **Description:** Main reconciliation interface
  - **Features:** Unmatched payments count, auto-match button, manual reconciliation queue
  - **Acceptance:** Dashboard shows reconciliation status, auto-match works

- [ ] **TASK-NIG-015:** Create Auto-Match Preview Modal
  - **File:** `apps/web/src/components/payments/nigerian/AutoMatchPreview.tsx`
  - **Description:** Modal showing auto-match results before applying
  - **Features:** List of proposed matches, confidence scores, accept/reject per match
  - **Acceptance:** Preview loads, shows matches correctly, apply works

- [ ] **TASK-NIG-016:** Create Manual Reconciliation Modal
  - **File:** `apps/web/src/components/payments/nigerian/ManualReconciliationModal.tsx`
  - **Description:** Drag-and-drop interface for manual payment matching
  - **Features:** List of unmatched bank entries, list of unmatched payments, match button, variance display
  - **Acceptance:** Modal works, matching creates reconciliation record

- [ ] **TASK-NIG-017:** Create Reconciliation Card Component
  - **File:** `apps/web/src/components/payments/nigerian/ReconciliationCard.tsx`
  - **Description:** Card showing reconciliation details
  - **Acceptance:** Card displays reconciliation info, status, actions

- [ ] **TASK-NIG-018:** Create Reconciliation History Page
  - **File:** `apps/web/src/app/dashboard/payments/nigerian/reconciliation-history/page.tsx`
  - **Description:** List all reconciliations with filters
  - **Acceptance:** History loads, filters work, pagination works

#### Day 7: Statement Import + Verification Workflow (4 tasks)

- [ ] **TASK-NIG-019:** Create Statement Import Page
  - **File:** `apps/web/src/app/dashboard/payments/nigerian/statements/page.tsx`
  - **Description:** Import bank statements (CSV) for reconciliation
  - **Features:** File upload, CSV validation, import progress, import history
  - **Acceptance:** Upload works, validation shows errors, progress updates

- [ ] **TASK-NIG-020:** Create Statement Import Component
  - **File:** `apps/web/src/components/payments/nigerian/StatementImport.tsx`
  - **Description:** File upload component with drag-and-drop
  - **Features:** CSV format requirements, template download, file validation
  - **Acceptance:** Component validates CSV format, shows errors clearly

- [ ] **TASK-NIG-021:** Create Statement Entries List Page
  - **File:** `apps/web/src/app/dashboard/payments/nigerian/statement-entries/page.tsx`
  - **Description:** View imported statement entries
  - **Features:** Filter by match status, date range, amount range, search
  - **Acceptance:** List loads, filters work, shows match status

- [ ] **TASK-NIG-022:** Create Payment Verification Queue Page
  - **File:** `apps/web/src/app/dashboard/payments/nigerian/verification/page.tsx`
  - **Description:** Queue of payment proofs awaiting verification
  - **Features:** List pending proofs, view proof details, approve/reject buttons, rejection reason
  - **Acceptance:** Queue loads, approve/reject works, rejection reason captured

### Success Metrics
- [ ] All 24+ backend endpoints integrated
- [ ] Reconciliation reduces manual work by 80%
- [ ] Bank statement import working
- [ ] Payment verification streamlined

---

## Phase 6.6: SMS/Communications UI Module

**Priority:** 🔴 HIGH  
**Backend Status:** ✅ 100% Complete (10+ endpoints)  
**Frontend Status:** ❌ Zero UI  
**Estimated Time:** 4-6 days  
**Location:** `apps/api/src/modules/sms/` → `apps/web/src/app/dashboard/communications/`

### Overview
High-value feature that differentiates from competitors. SMS backend fully functional but inaccessible. Bulk communication is critical for associations. Marketing feature for Professional tier.

### Backend Endpoints Available
- `GET /api/sms/dashboard` - SMS statistics
- `POST /api/sms/send` - Quick SMS sending
- `GET/POST /api/sms/campaigns` - Campaign management
- `GET /api/sms/campaigns/:id` - Get campaign details
- `POST /api/sms/campaigns/:id/start` - Execute campaign
- `POST /api/sms/campaigns/:id/cancel` - Cancel campaign
- `DELETE /api/sms/campaigns/:id` - Delete draft campaign
- `GET/POST /api/sms/templates` - Template management
- `GET/PUT/DELETE /api/sms/templates/:id` - Template CRUD
- `GET /api/sms/messages` - Message history
- `GET /api/sms/messages/:id` - Message details
- `GET /api/sms/credits/balance` - Credit balance
- `POST /api/sms/credits/topup` - Top up credits
- `GET /api/sms/credits/history` - Credit transactions

### Tasks Breakdown

#### Day 8-9: Communications Dashboard + Quick Send (7 tasks)

- [ ] **TASK-SMS-001:** Create Communications Dashboard Page
  - **File:** `apps/web/src/app/dashboard/communications/page.tsx`
  - **Description:** Main communications hub with SMS balance, quick stats, navigation
  - **Components:** SMS balance card, quick stats (sent, delivered, failed), recent activity
  - **Acceptance:** Dashboard loads, displays statistics correctly

- [ ] **TASK-SMS-002:** Create Quick Send Page
  - **File:** `apps/web/src/app/dashboard/communications/quick-send/page.tsx`
  - **Description:** Single and bulk SMS sending interface
  - **Features:** Single recipient, multiple recipients, message composer, preview, send button
  - **Acceptance:** Form works, validates phone numbers, sends successfully

- [ ] **TASK-SMS-003:** Create SMS Composer Component
  - **File:** `apps/web/src/components/communications/SMSComposer.tsx`
  - **Description:** Rich text message composer with character count, template selection
  - **Features:** Message input, character counter, template dropdown, variable insertion, preview
  - **Acceptance:** Composer works, templates load, character count accurate

- [ ] **TASK-SMS-004:** Create Recipient Selector Component
  - **File:** `apps/web/src/components/communications/RecipientSelector.tsx`
  - **Description:** Select recipients by member, category, status, or custom numbers
  - **Features:** Member search, category filter, status filter, custom phone numbers input, add/remove
  - **Acceptance:** Selector works, filters correctly, validates phone numbers

- [ ] **TASK-SMS-005:** Create SMS Balance Card Component
  - **File:** `apps/web/src/components/communications/SMSBalanceCard.tsx`
  - **Description:** Display SMS credit balance with top-up button
  - **Features:** Balance display, credits used this month, top-up button, usage trend
  - **Acceptance:** Card shows balance correctly, top-up works

- [ ] **TASK-SMS-006:** Add SMS API Client
  - **File:** `apps/web/src/lib/api/sms.ts`
  - **Description:** API client functions for all SMS endpoints
  - **Functions:** getDashboard, sendSMS, getCampaigns, createCampaign, getTemplates, getMessages, getBalance, topupCredits
  - **Acceptance:** All API functions implemented and tested

- [ ] **TASK-SMS-007:** Add Communications Route to Sidebar
  - **File:** `apps/web/src/components/layout/Sidebar.tsx` (update)
  - **Description:** Add Communications menu item to admin sidebar
  - **Acceptance:** Menu item visible, navigates to dashboard

#### Day 10-11: SMS Campaigns Management (5 tasks)

- [ ] **TASK-SMS-008:** Create SMS Campaigns List Page
  - **File:** `apps/web/src/app/dashboard/communications/campaigns/page.tsx`
  - **Description:** List all SMS campaigns with filters
  - **Features:** Filter by status (draft, scheduled, in_progress, completed, cancelled, failed), date range, search
  - **Acceptance:** List loads, filters work, pagination works

- [ ] **TASK-SMS-009:** Create Campaign Builder Page
  - **File:** `apps/web/src/app/dashboard/communications/campaigns/new/page.tsx`
  - **Description:** Create new SMS campaign with scheduling
  - **Features:** Campaign name, message content, recipient selection, template selection, schedule date/time, preview
  - **Acceptance:** Builder works, validates correctly, saves campaign

- [ ] **TASK-SMS-010:** Create Campaign Detail Page
  - **File:** `apps/web/src/app/dashboard/communications/campaigns/[id]/page.tsx`
  - **Description:** View campaign details and manage execution
  - **Features:** Campaign info, recipient list, message preview, progress tracking, start/cancel/delete actions
  - **Acceptance:** Detail page loads, shows campaign status, actions work

- [ ] **TASK-SMS-011:** Create Campaign Progress Component
  - **File:** `apps/web/src/components/communications/CampaignProgress.tsx`
  - **Description:** Visual progress indicator for campaign execution
  - **Features:** Progress bar, sent count, delivered count, failed count, percentage
  - **Acceptance:** Component updates in real-time, shows correct progress

- [ ] **TASK-SMS-012:** Create Campaign Status Badge Component
  - **File:** `apps/web/src/components/communications/CampaignStatusBadge.tsx`
  - **Description:** Visual badge showing campaign status
  - **Acceptance:** Badge colors and labels match status correctly

#### Day 12: SMS Templates CRUD (3 tasks)

- [ ] **TASK-SMS-013:** Create SMS Templates List Page
  - **File:** `apps/web/src/app/dashboard/communications/templates/page.tsx`
  - **Description:** List and manage SMS templates
  - **Features:** Template list, create new, edit existing, delete, preview, usage count
  - **Acceptance:** List loads, CRUD operations work, preview shows template

- [ ] **TASK-SMS-014:** Create Template Editor Component
  - **File:** `apps/web/src/components/communications/TemplateEditor.tsx`
  - **Description:** Create/edit SMS template with variable placeholders
  - **Features:** Template name, category, message content, variable selector ({{name}}, {{amount}}, etc.), preview, save
  - **Acceptance:** Editor validates variables, saves template correctly

- [ ] **TASK-SMS-015:** Create Template Category Component
  - **File:** `apps/web/src/components/communications/TemplateCategory.tsx`
  - **Description:** Filter templates by category
  - **Categories:** General, Payment Reminder, Meeting, Dues, Levy, Welfare, Election, Custom
  - **Acceptance:** Category filter works, templates grouped correctly

#### Day 13: SMS History & Reports (3 tasks)

- [ ] **TASK-SMS-016:** Create SMS Messages History Page
  - **File:** `apps/web/src/app/dashboard/communications/history/page.tsx`
  - **Description:** View all sent SMS messages with delivery status
  - **Features:** Filter by date, recipient, status, delivery status, search, pagination
  - **Acceptance:** History loads, filters work, shows delivery status

- [ ] **TASK-SMS-017:** Create Message Detail Modal
  - **File:** `apps/web/src/components/communications/MessageDetailModal.tsx`
  - **Description:** View individual SMS message details
  - **Features:** Full message content, recipient info, delivery status, error message, sent time, delivery time, segments, cost
  - **Acceptance:** Modal shows all message details correctly

- [ ] **TASK-SMS-018:** Create SMS Usage Report Page
  - **File:** `apps/web/src/app/dashboard/communications/reports/page.tsx`
  - **Description:** SMS usage analytics and reports
  - **Features:** Usage by date, by recipient, by campaign, cost breakdown, delivery rate, segment usage
  - **Acceptance:** Reports load, charts display correctly, data accurate

### Success Metrics
- [ ] All 10+ backend endpoints integrated
- [ ] Admins can send SMS from UI
- [ ] Campaign creation works end-to-end
- [ ] Templates reduce message composition time

---

## Phase 10.5: Exports Management UI

**Priority:** 🟡 MEDIUM  
**Backend Status:** ✅ 100% Complete (6 endpoints)  
**Frontend Status:** ⚠️ Scattered across pages  
**Estimated Time:** 2-3 days  
**Location:** `apps/api/src/modules/exports/` → `apps/web/src/app/dashboard/exports/`

### Overview
Exports already work but scattered. Centralization improves UX. Export history not visible to users. No way to re-download expired exports.

### Backend Endpoints Available
- `POST /api/exports/financial-pdf` - Generate financial summary PDF
- `POST /api/exports/financial-excel` - Generate financial summary Excel
- `POST /api/exports/member-statement/:memberId` - Generate member statement PDF
- `POST /api/exports/members-excel` - Export all members with balances
- `GET /api/exports/history` - Get export history with pagination
- `GET /api/exports/download/:id` - Download export file

### Tasks Breakdown

#### Day 14: Exports Center Dashboard (3 tasks)

- [ ] **TASK-EXP-001:** Create Exports Center Dashboard Page
  - **File:** `apps/web/src/app/dashboard/exports/page.tsx`
  - **Description:** Centralized exports hub with quick actions and history
  - **Components:** Quick export cards, recent exports list, export history link
  - **Acceptance:** Dashboard loads, shows quick actions, recent exports

- [ ] **TASK-EXP-002:** Create Quick Export Modal Component
  - **File:** `apps/web/src/components/exports/QuickExportModal.tsx`
  - **Description:** Modal for quick export actions
  - **Features:** Export type selection (Financial Summary, Member Statement, All Members), date range picker, format selection (PDF/Excel), export button
  - **Acceptance:** Modal works, validates inputs, triggers export

- [ ] **TASK-EXP-003:** Create Export Type Card Component
  - **File:** `apps/web/src/components/exports/ExportTypeCard.tsx`
  - **Description:** Card for each export type with icon, description
  - **Acceptance:** Card displays correctly, clickable

#### Day 15: Export History Management (4 tasks)

- [ ] **TASK-EXP-004:** Create Export History Page
  - **File:** `apps/web/src/app/dashboard/exports/history/page.tsx`
  - **Description:** List all exports with filters and actions
  - **Features:** Filter by type, date range, status, search, pagination, re-download button, delete button
  - **Acceptance:** History loads, filters work, re-download works

- [ ] **TASK-EXP-005:** Create Export History Table Component
  - **File:** `apps/web/src/components/exports/ExportHistoryTable.tsx`
  - **Description:** Table showing export history with actions
  - **Features:** Columns: filename, type, format, created at, expires at, status, file size, actions
  - **Acceptance:** Table loads, pagination works, actions work

- [ ] **TASK-EXP-006:** Create Export Status Badge Component
  - **File:** `apps/web/src/components/exports/ExportStatusBadge.tsx`
  - **Description:** Visual badge showing export status (processing, completed, expired, failed)
  - **Acceptance:** Badge colors and labels match status correctly

- [ ] **TASK-EXP-007:** Create Expiration Countdown Component
  - **File:** `apps/web/src/components/exports/ExpirationCountdown.tsx`
  - **Description:** Countdown timer for export expiration (7 days)
  - **Acceptance:** Countdown updates in real-time, shows correct time remaining

#### Day 16: Quick Export Actions + Custom Builder (5 tasks)

- [ ] **TASK-EXP-008:** Create Custom Export Builder Page
  - **File:** `apps/web/src/app/dashboard/exports/custom/page.tsx`
  - **Description:** Build custom exports with selected fields
  - **Features:** Field selector (checkboxes), filters, date range, format selection, preview, generate button
  - **Acceptance:** Builder works, validates selections, generates export

- [ ] **TASK-EXP-009:** Create Export Field Selector Component
  - **File:** `apps/web/src/components/exports/ExportFieldSelector.tsx`
  - **Description:** Component for selecting export fields
  - **Features:** Field groups (member info, financial info, contact info), select all/deselect all, field count
  - **Acceptance:** Selector works, fields grouped correctly, count accurate

- [ ] **TASK-EXP-010:** Create Export Preview Component
  - **File:** `apps/web/src/components/exports/ExportPreview.tsx`
  - **Description:** Preview export data before generating
  - **Features:** Sample data display, field order, estimated records, download sample
  - **Acceptance:** Preview loads, shows sample data, download works

- [ ] **TASK-EXP-011:** Create Export Progress Component
  - **File:** `apps/web/src/components/exports/ExportProgress.tsx`
  - **Description:** Progress indicator for export generation
  - **Features:** Progress bar, percentage, status message, cancel button
  - **Acceptance:** Progress updates correctly, cancel works

- [ ] **TASK-EXP-012:** Add Exports API Client Functions
  - **File:** `apps/web/src/lib/api/exports.ts` (update)
  - **Description:** Add new API client functions for export history and re-download
  - **Functions:** getExportHistory, reDownloadExport, deleteExport
  - **Acceptance:** All API functions implemented and tested

### Success Metrics
- [ ] All 6 backend endpoints integrated
- [ ] Export history accessible
- [ ] One-click re-generation works
- [ ] Custom export builder functional

---

## Phase 6.7: Notifications Center UI

**Priority:** 🟡 MEDIUM  
**Backend Status:** ✅ 100% Complete (6 endpoints)  
**Frontend Status:** ⚠️ Dropdown only  
**Estimated Time:** 2-3 days  
**Location:** `apps/api/src/modules/notifications/` → `apps/web/src/app/dashboard/notifications/`

### Overview
Enhances existing notification system. Users want notification history. Preferences not configurable. Improves user engagement.

### Backend Endpoints Available
- `GET /api/notifications` - List notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id/read` - Mark as read
- `DELETE /api/notifications/:id` - Delete notification
- `POST /api/notifications/announcements` - Create announcement
- Note: Additional endpoints needed for preferences and history

### Tasks Breakdown

#### Day 17: Notifications Center Page (3 tasks)

- [ ] **TASK-NOT-001:** Create Notifications Center Page
  - **File:** `apps/web/src/app/dashboard/notifications/page.tsx`
  - **Description:** Full notifications page with pagination
  - **Features:** Filter by type, read status, date range, search, pagination, bulk actions (mark all read, delete all)
  - **Acceptance:** Page loads, filters work, pagination works, bulk actions work

- [ ] **TASK-NOT-002:** Create Notification List Component
  - **File:** `apps/web/src/components/notifications/NotificationList.tsx`
  - **Description:** List component for notifications
  - **Features:** Notification item with icon, title, message, timestamp, read status, mark read button, delete button
  - **Acceptance:** List loads, items display correctly, actions work

- [ ] **TASK-NOT-003:** Create Notification Filter Component
  - **File:** `apps/web/src/components/notifications/NotificationFilter.tsx`
  - **Description:** Filter notifications by type and status
  - **Features:** Type filter (all, payment_due, payment_received, system, announcement), status filter (all, unread, read), date range picker
  - **Acceptance:** Filters work correctly, updates list

#### Day 18: Notification Preferences (4 tasks)

- [ ] **TASK-NOT-004:** Create Notification Preferences Page
  - **File:** `apps/web/src/app/dashboard/notifications/preferences/page.tsx`
  - **Description:** Configure notification preferences by type
  - **Features:** Toggle per notification type (email, SMS, in-app), quiet hours settings
  - **Acceptance:** Page loads, preferences save correctly

- [ ] **TASK-NOT-005:** Create Notification Type Preferences Component
  - **File:** `apps/web/src/components/notifications/NotificationTypePreferences.tsx`
  - **Description:** Toggle email/SMS/in-app for each notification type
  - **Features:** Notification types as rows, email toggle, SMS toggle, in-app toggle
  - **Acceptance:** Toggles work, preferences save correctly

- [ ] **TASK-NOT-006:** Create Quiet Hours Component
  - **File:** `apps/web/src/components/notifications/QuietHours.tsx`
  - **Description:** Configure quiet hours for notifications
  - **Features:** Enable/disable quiet hours, start time, end time, timezone
  - **Acceptance:** Component works, quiet hours save correctly

- [ ] **TASK-NOT-007:** Add Notifications Preferences API Client
  - **File:** `apps/web/src/lib/api/notifications.ts` (update)
  - **Description:** API client functions for notification preferences
  - **Functions:** getPreferences, updatePreferences
  - **Acceptance:** All API functions implemented and tested

#### Day 19: Notification History & Archive (3 tasks)

- [ ] **TASK-NOT-008:** Create Notification Archive Page
  - **File:** `apps/web/src/app/dashboard/notifications/archive/page.tsx`
  - **Description:** Archived notifications (90+ days old)
  - **Features:** Filter by type, search, pagination, restore, permanent delete
  - **Acceptance:** Archive loads, filters work, restore works

- [ ] **TASK-NOT-009:** Create Notification Detail Modal
  - **File:** `apps/web/src/components/notifications/NotificationDetailModal.tsx`
  - **Description:** View full notification details
  - **Features:** Full message, metadata, timestamps, related actions
  - **Acceptance:** Modal shows all notification details

- [ ] **TASK-NOT-010:** Add Notifications Route to Sidebar
  - **File:** `apps/web/src/components/layout/Sidebar.tsx` (update)
  - **Description:** Add Notifications Center menu item to sidebar
  - **Acceptance:** Menu item visible, navigates to notifications center

### Success Metrics
- [ ] All 6 backend endpoints integrated
- [ ] Users can configure preferences
- [ ] Notification history searchable
- [ ] Reduces notification fatigue

---

## Phase 14: Webhooks Management UI

**Priority:** 🟢 LOW (Admin Tool)  
**Backend Status:** ✅ Complete (handlers + logs)  
**Frontend Status:** ❌ Zero UI  
**Estimated Time:** 2-3 days  
**Location:** `apps/api/src/modules/webhooks/` → `apps/web/src/app/admin/webhooks/`

### Overview
Admin/developer monitoring tool. Webhooks work without UI. Helpful for debugging only. Not user-facing feature.

### Backend Endpoints Available
- Webhook handlers exist in backend
- Webhook event logs exist in database
- No dedicated API endpoints yet - need to create

### Tasks Breakdown

#### Day 20: Webhooks Dashboard (3 tasks)

- [ ] **TASK-WEB-001:** Create Webhooks Dashboard Page
  - **File:** `apps/web/src/app/admin/webhooks/page.tsx`
  - **Description:** Main webhooks management interface
  - **Components:** Webhook status summary, recent events list, quick actions
  - **Acceptance:** Dashboard loads, shows webhook status

- [ ] **TASK-WEB-002:** Create Webhook Status Card Component
  - **File:** `apps/web/src/components/webhooks/WebhookStatusCard.tsx`
  - **Description:** Card showing webhook health status
  - **Features:** Success rate, failure rate, total events, last event time, status indicator
  - **Acceptance:** Card shows correct statistics

- [ ] **TASK-WEB-003:** Create Webhook Quick Actions Component
  - **File:** `apps/web/src/components/webhooks/WebhookQuickActions.tsx`
  - **Description:** Quick actions for webhook management
  - **Features:** Test webhook, retry failed, clear logs, pause/resume
  - **Acceptance:** Actions work correctly

#### Day 21: Webhook Events Log (4 tasks)

- [ ] **TASK-WEB-004:** Create Webhook Events Log Page
  - **File:** `apps/web/src/app/admin/webhooks/events/page.tsx`
  - **Description:** List all webhook event logs
  - **Features:** Filter by event type, status, date range, search, pagination
  - **Acceptance:** Log loads, filters work, pagination works

- [ ] **TASK-WEB-005:** Create Webhook Event Table Component
  - **File:** `apps/web/src/components/webhooks/WebhookEventTable.tsx`
  - **Description:** Table showing webhook events
  - **Features:** Columns: timestamp, event type, endpoint, status, response code, duration, actions
  - **Acceptance:** Table loads, shows correct data

- [ ] **TASK-WEB-006:** Create Event Payload Viewer Component
  - **File:** `apps/web/src/components/webhooks/EventPayloadViewer.tsx`
  - **Description:** JSON viewer for webhook event payloads
  - **Features:** Pretty-printed JSON, syntax highlighting, copy to clipboard, collapse/expand
  - **Acceptance:** Viewer displays JSON correctly, formatted nicely

- [ ] **TASK-WEB-007:** Create Event Status Badge Component
  - **File:** `apps/web/src/components/webhooks/EventStatusBadge.tsx`
  - **Description:** Visual badge for webhook event status
  - **Acceptance:** Badge colors and labels match status correctly

#### Day 22: Webhook Testing Interface (3 tasks)

- [ ] **TASK-WEB-008:** Create Webhook Testing Page
  - **File:** `apps/web/src/app/admin/webhooks/test/page.tsx`
  - **Description:** Test webhooks with custom payloads
  - **Features:** Select webhook, build payload, send test, view response, retry failed
  - **Acceptance:** Test page works, sends test requests, shows response

- [ ] **TASK-WEB-009:** Create Webhook Test Builder Component
  - **File:** `apps/web/src/components/webhooks/WebhookTestBuilder.tsx`
  - **Description:** Builder for webhook test payloads
  - **Features:** JSON editor with validation, payload templates, send button
  - **Acceptance:** Builder validates JSON, templates load, send works

- [ ] **TASK-WEB-010:** Create Test Response Viewer Component
  - **File:** `apps/web/src/components/webhooks/TestResponseViewer.tsx`
  - **Description:** View webhook test response
  - **Features:** Response status code, response body, response time, headers
  - **Acceptance:** Viewer shows response correctly

### Success Metrics
- [ ] Webhook logs accessible to admins
- [ ] Failed webhooks can be retried
- [ ] Webhook testing works
- [ ] Debugging time reduced

---

## Phase 15: Cron Jobs Management UI

**Priority:** 🟢 LOW (Admin Tool)  
**Backend Status:** ✅ Complete (4+ jobs running)  
**Frontend Status:** ❌ Zero UI  
**Estimated Time:** 2-3 days  
**Location:** `apps/api/src/modules/cron/` → `apps/web/src/app/admin/cron/`

### Overview
Admin monitoring tool only. Jobs run automatically without UI. Helpful for troubleshooting. Not critical for operations.

### Backend Jobs Available
- Late fees calculation (late-fees.cron.ts)
- Subscription renewal reminders (subscription-jobs.ts)
- Meeting reminders (meeting-jobs.ts)
- Additional jobs may exist

### Tasks Breakdown

#### Day 23: Cron Jobs Dashboard (3 tasks)

- [ ] **TASK-CRON-001:** Create Cron Jobs Dashboard Page
  - **File:** `apps/web/src/app/admin/cron/page.tsx`
  - **Description:** List all scheduled jobs with status
  - **Components:** Job cards with status, next run time, last run time, execution count, actions
  - **Acceptance:** Dashboard loads, shows all jobs correctly

- [ ] **TASK-CRON-002:** Create Job Card Component
  - **File:** `apps/web/src/components/cron/JobCard.tsx`
  - **Description:** Card showing job details
  - **Features:** Job name, description, schedule, status, next run, last run, success rate, manual trigger button, enable/disable toggle
  - **Acceptance:** Card displays correctly, actions work

- [ ] **TASK-CRON-003:** Create Job Status Indicator Component
  - **File:** `apps/web/src/components/cron/JobStatusIndicator.tsx`
  - **Description:** Visual indicator for job status
  - **Acceptance:** Indicator shows correct status with color coding

#### Day 24: Job Execution Logs (3 tasks)

- [ ] **TASK-CRON-004:** Create Job Execution Logs Page
  - **File:** `apps/web/src/app/admin/cron/logs/page.tsx`
  - **Description:** View job execution logs
  - **Features:** Filter by job, status, date range, search, pagination
  - **Acceptance:** Logs load, filters work, pagination works

- [ ] **TASK-CRON-005:** Create Job Log Table Component
  - **File:** `apps/web/src/components/cron/JobLogTable.tsx`
  - **Description:** Table showing job execution logs
  - **Features:** Columns: timestamp, job, status, duration, output, error message
  - **Acceptance:** Table loads, shows correct data

- [ ] **TASK-CRON-006:** Create Log Detail Modal
  - **File:** `apps/web/src/components/cron/LogDetailModal.tsx`
  - **Description:** View full job execution log details
  - **Features:** Full log output, error stack trace, duration, metadata
  - **Acceptance:** Modal shows all log details

#### Day 25: Job Configuration Interface (2 tasks)

- [ ] **TASK-CRON-007:** Create Job Configuration Page
  - **File:** `apps/web/src/app/admin/cron/config/page.tsx`
  - **Description:** Configure job schedules and settings
  - **Features:** Job selector, schedule editor (cron expression), parameters, enable/disable, test run
  - **Acceptance:** Configuration page loads, saves settings correctly

- [ ] **TASK-CRON-008:** Create Cron Expression Builder Component
  - **File:** `apps/web/src/components/cron/CronExpressionBuilder.tsx`
  - **Description:** Visual builder for cron expressions
  - **Features:** Presets (hourly, daily, weekly, monthly), custom builder, validation, preview of next runs
  - **Acceptance:** Builder validates expressions, shows correct preview

### Success Metrics
- [ ] All cron jobs visible to admins
- [ ] Manual triggers work
- [ ] Execution logs helpful for debugging
- [ ] Job health monitoring functional

---

## Implementation Guidelines

### Zero Breaking Changes Guarantee

**Critical Rules:**
1. **Pure Additive Work**: Only CREATE new pages/components, never modify existing ones
2. **Independent Routing**: New routes don't interfere with existing routes
3. **Isolated Components**: New components don't replace existing ones
4. **Backend Tested**: All backend endpoints already tested and working
5. **Permission Checks**: Always use existing RBAC permission system

### Testing Checklist (Per Phase)

**Before Starting:**
- [ ] Review existing backend endpoints and schemas
- [ ] Identify required permissions
- [ ] Map out route structure
- [ ] Create API client functions

**During Development:**
- [ ] Test each endpoint integration immediately
- [ ] Verify permission checks work
- [ ] Test with real backend data
- [ ] Check responsive design

**After Completion:**
- [ ] Full E2E testing of new module
- [ ] Verify existing features still work
- [ ] Test permission boundaries
- [ ] Document new routes/features

### File Creation Standards

**Frontend Files:**
- Use Next.js 14 App Router structure
- Follow existing component patterns in `apps/web/src/components/`
- Use Mantine UI components consistently
- Implement proper TypeScript types
- Add error handling and loading states
- Make components responsive

**API Client Files:**
- Add to `apps/web/src/lib/api/` directory
- Use Axios for HTTP requests
- Implement proper error handling
- Add TypeScript interfaces for requests/responses
- Use TanStack Query for data fetching where appropriate

### Route Structure

**Phase 3.6 (Nigerian Payments):**
```
/dashboard/payments/nigerian/
├── page.tsx                          # Main dashboard
├── bank-accounts/
│   └── page.tsx                # Bank accounts list
├── transfers/
│   ├── page.tsx                  # Transfers list
│   └── [id]/
│       └── page.tsx              # Transfer detail
├── reconciliation/
│   └── page.tsx                  # Reconciliation dashboard
├── reconciliation-history/
│   └── page.tsx                  # Reconciliation history
├── statements/
│   └── page.tsx                  # Statement import
├── statement-entries/
│   └── page.tsx                  # Statement entries
└── verification/
    └── page.tsx                  # Verification queue
```

**Phase 6.6 (SMS/Communications):**
```
/dashboard/communications/
├── page.tsx                          # Main dashboard
├── quick-send/
│   └── page.tsx                  # Quick send
├── campaigns/
│   ├── page.tsx                  # Campaigns list
│   ├── new/
│   │   └── page.tsx              # Create campaign
│   └── [id]/
│       └── page.tsx              # Campaign detail
├── templates/
│   └── page.tsx                  # Templates list
├── history/
│   └── page.tsx                  # Message history
└── reports/
    └── page.tsx                  # Usage reports
```

**Phase 10.5 (Exports):**
```
/dashboard/exports/
├── page.tsx                          # Exports center
├── history/
│   └── page.tsx                  # Export history
└── custom/
    └── page.tsx                  # Custom builder
```

**Phase 6.7 (Notifications):**
```
/dashboard/notifications/
├── page.tsx                          # Notifications center
├── preferences/
│   └── page.tsx                  # Preferences
└── archive/
    └── page.tsx                  # Archive
```

**Phase 14 (Webhooks):**
```
/admin/webhooks/
├── page.tsx                          # Dashboard
├── events/
│   └── page.tsx                  # Events log
└── test/
    └── page.tsx                  # Testing
```

**Phase 15 (Cron Jobs):**
```
/admin/cron/
├── page.tsx                          # Dashboard
├── logs/
│   └── page.tsx                  # Execution logs
└── config/
    └── page.tsx                  # Configuration
```

---

## Success Metrics

### Phase 3.6: Nigerian Payments UI
- [ ] All 24+ backend endpoints integrated
- [ ] Reconciliation reduces manual work by 80%
- [ ] Bank statement import working
- [ ] Payment verification streamlined

### Phase 6.6: SMS/Communications UI
- [ ] All 10+ backend endpoints integrated
- [ ] Admins can send SMS from UI
- [ ] Campaign creation works end-to-end
- [ ] Templates reduce message composition time

### Phase 10.5: Exports Management UI
- [ ] All 6 backend endpoints integrated
- [ ] Export history accessible
- [ ] One-click re-generation works
- [ ] Custom export builder functional

### Phase 6.7: Notifications Center UI
- [ ] All 6 backend endpoints integrated
- [ ] Users can configure preferences
- [ ] Notification history searchable
- [ ] Reduces notification fatigue

### Phase 14: Webhooks Management UI
- [ ] Webhook logs accessible to admins
- [ ] Failed webhooks can be retried
- [ ] Webhook testing works
- [ ] Debugging time reduced

### Phase 15: Cron Jobs Management UI
- [ ] All cron jobs visible to admins
- [ ] Manual triggers work
- [ ] Execution logs helpful for debugging
- [ ] Job health monitoring functional

---

**Document Version:** 1.0  
**Last Updated:** January 11, 2026  
**Total Tasks:** 82 tasks across 6 phases  
**Estimated Completion Time:** 18-25 days
