# Webhooks & Cron Jobs Management UI - Complete Guide

**Implementation Status:** ✅ **COMPLETED**
- **Phase 14:** Webhooks Management UI (10 tasks) - ✅ COMPLETED
- **Phase 15:** Cron Jobs Management UI (8 tasks) - ✅ COMPLETED

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Phase 14: Webhooks Management UI](#phase-14-webhooks-management-ui)
3. [Phase 15: Cron Jobs Management UI](#phase-15-cron-jobs-management-ui)
4. [Authentication & Access Control](#authentication--access-control)
5. [Manual Testing Guide](#manual-testing-guide)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

Both Webhooks and Cron Jobs Management are **Super Admin only** features that provide platform-wide monitoring and control capabilities. These interfaces allow Super Admins to:

- **Monitor system health** across all associations
- **View execution logs** and debug issues
- **Manually trigger operations** for testing
- **Configure schedules and parameters**
- **Manage platform-wide operations**

### Key Features
- ✅ **Super Admin Authentication** - Platform role-based access control
- ✅ **Dark Mode Compatible** - Consistent styling across all pages
- ✅ **Real-time Logging** - Comprehensive execution tracking
- ✅ **Manual Testing** - Trigger operations on-demand
- ✅ **Configuration Management** - Schedule and parameter control
- ✅ **Filtering & Pagination** - Efficient data browsing

---

## 🔗 Phase 14: Webhooks Management UI

### 📍 **Routes & Navigation**
```
/admin/webhooks/          - Main dashboard
/admin/webhooks/events/   - Event logs viewer
/admin/webhooks/test/     - Testing interface
```

### 🎛️ **Dashboard Features** (`/admin/webhooks/`)

#### **Webhook Status Summary**
- **Success Rate** - Platform-wide webhook delivery statistics
- **Failure Rate** - Failed webhook attempts tracking
- **Total Events** - Cumulative event count across all associations
- **Last Event Time** - Most recent webhook activity timestamp

#### **Recent Events List**
- **Event Type** - Payment, subscription, member events
- **Status** - Success, failed, pending, retrying
- **Timestamp** - When the event occurred
- **Source** - Paystack, custom, internal events
- **Quick Actions** - View details, retry failed events

#### **Quick Actions Panel**
- **Test Webhook** - Manual webhook testing
- **Retry Failed** - Bulk retry failed events
- **Clear Logs** - Clean up old event logs
- **Pause/Resume** - Control webhook processing

### 📊 **Event Logs Viewer** (`/admin/webhooks/events/`)

#### **Advanced Filtering**
```typescript
// Available filters
{
  eventType: string,     // payment_received, subscription_created, etc.
  status: string,        // success, failed, pending, retrying
  startDate: Date,       // Filter by date range
  endDate: Date,         // Filter by date range
  search: string,        // Search in payload/response
  associationId: string  // Filter by specific association (optional)
}
```

#### **Event Details Modal**
- **Full Payload** - Complete webhook event data
- **Response Details** - HTTP status, response body, headers
- **Retry History** - Previous retry attempts and results
- **Timing Information** - Duration, timestamps, retry intervals
- **Error Messages** - Detailed error information for failed events

### 🧪 **Testing Interface** (`/admin/webhooks/test/`)

#### **Webhook Test Builder**
- **Event Type Selection** - Choose from available webhook events
- **Payload Editor** - JSON editor with syntax validation
- **Endpoint Configuration** - Target URL and headers
- **Test Execution** - Send test webhook and view response

#### **Response Viewer**
- **Status Code** - HTTP response status
- **Response Body** - Full response content
- **Response Time** - Request duration
- **Headers** - Response headers inspection

---

## ⏰ Phase 15: Cron Jobs Management UI

### 📍 **Routes & Navigation**
```
/admin/cron-jobs/         - Main dashboard
/admin/cron-jobs/logs/    - Execution logs
/admin/cron-jobs/config/  - Job configuration
```

### 🎛️ **Dashboard Features** (`/admin/cron-jobs/`)

#### **System Status Panel**
- **Jobs Running** - Active/Inactive status indicator
- **Last Checked** - System health check timestamp
- **Subscription Statistics** - Platform-wide subscription counts by status

#### **Available Cron Jobs**
1. **Trial Expiry Check**
   - **Schedule:** Daily at midnight (0 0 * * *)
   - **Function:** Checks trials expiring within 3 days
   - **Manual Trigger:** ✅ Available

2. **Renewal Reminders**
   - **Schedule:** Daily at 9 AM (0 9 * * *)
   - **Function:** Sends reminders 7 days before renewal
   - **Manual Trigger:** ✅ Available

3. **Late Fees Processing**
   - **Schedule:** Daily at 1 AM (0 1 * * *)
   - **Function:** Applies late fees to overdue payments
   - **Manual Trigger:** ✅ Available

4. **Update Overdue Status**
   - **Schedule:** Every 6 hours (0 */6 * * *)
   - **Function:** Updates overdue flags for payments
   - **Manual Trigger:** ✅ Available

#### **Job Cards Interface**
- **Job Status** - Active, disabled, running, failed indicators
- **Last Execution** - Timestamp and result of last run
- **Success Rate** - Execution success percentage
- **Manual Trigger** - Run job immediately for testing

### 📋 **Execution Logs** (`/admin/cron-jobs/logs/`)

#### **Log Filtering & Search**
```typescript
// Available filters
{
  page: number,          // Pagination
  limit: number,         // Results per page (default: 20)
  jobId: string,         // Filter by specific job
  status: string,        // success, failed, running
  startDate: string,     // Date range filtering
  endDate: string,       // Date range filtering
  search: string         // Search in job output
}
```

#### **Log Table Columns**
- **Timestamp** - When the job was executed
- **Job Name** - Human-readable job identifier
- **Status** - Success/Failed/Running with color-coded badges
- **Duration** - Execution time in seconds
- **Actions** - View detailed logs button

#### **Log Detail Modal**
- **Execution Summary** - Job name, status, duration
- **Full Output** - Complete job execution output (JSON formatted)
- **Error Messages** - Stack traces and error details for failed jobs
- **Metadata** - Execution context and parameters

### ⚙️ **Job Configuration** (`/admin/cron-jobs/config/`)

#### **Job Selection**
- **Dropdown Menu** - Select from available cron jobs
- **Job Information** - Description and current configuration display

#### **Schedule Configuration**
- **Cron Expression Builder** - Visual cron expression editor
- **Preset Schedules** - Common schedule templates
- **Custom Builder** - Manual cron expression creation
- **Schedule Preview** - Next 3 scheduled runs display

#### **Cron Expression Presets**
```
0 * * * *       - Hourly (every hour)
0 0 * * *       - Daily (at midnight)
0 9 * * *       - Daily (at 9 AM)
0 0 * * 0       - Weekly (Sunday midnight)
0 0 1 * *       - Monthly (1st of month)
0 0,12 * * *    - Twice daily (midnight & noon)
0 */6 * * *     - Every 6 hours
0 0 * * 1-5     - Weekdays (midnight)
```

#### **Job Parameters**
- **JSON Editor** - Configure job-specific parameters
- **Parameter Validation** - Real-time JSON syntax checking
- **Default Values** - Pre-populated with sensible defaults
- **Parameter Documentation** - Inline help for each parameter

#### **Job Control**
- **Enable/Disable** - Toggle job execution
- **Test Run** - Execute job immediately
- **Save Configuration** - Persist changes to job settings

---

## 🔐 Authentication & Access Control

### **Super Admin Only Access**
Both Webhooks and Cron Jobs management require **Super Admin** platform role:

```typescript
// Authentication check pattern
if (user?.platformRole !== 'SUPER_ADMIN') {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-gray-600 mt-2">Super admin access required.</p>
      </div>
    </div>
  );
}
```

### **Backend Authentication**
- **Route Level:** `requirePlatformRole([PlatformRole.SUPER_ADMIN])`
- **No Tenant Context:** Operations are platform-wide
- **Token-based:** Uses Bearer token authentication
- **Route Mounting:** Placed before tenant middleware in server.ts

---

## 🧪 Manual Testing Guide

### **Prerequisites**
1. ✅ **Super Admin Account** - Must have `platformRole: 'SUPER_ADMIN'`
2. ✅ **Backend Running** - API server on `http://localhost:4000`
3. ✅ **Frontend Running** - Web app on `http://localhost:3000`
4. ✅ **Authentication** - Logged in as Super Admin user

### **Phase 14: Webhooks Testing**

#### **Test 1: Dashboard Access**
```bash
# Navigate to webhooks dashboard
URL: http://localhost:3000/admin/webhooks

# Expected Results:
✅ Page loads without authentication errors
✅ Webhook statistics display (may show 0 if no events)
✅ Recent events list (may be empty initially)
✅ Quick actions panel visible
✅ Navigation links to events and test pages work
```

#### **Test 2: Event Logs Viewer**
```bash
# Navigate to events page
URL: http://localhost:3000/admin/webhooks/events

# Expected Results:
✅ Events table loads (may be empty)
✅ Filter controls work (date picker, dropdowns)
✅ Pagination controls display
✅ "No events found" message if empty
✅ Search functionality works
```

#### **Test 3: Webhook Testing Interface**
```bash
# Navigate to test page
URL: http://localhost:3000/admin/webhooks/test

# Test Steps:
1. Select event type from dropdown
2. Enter test payload in JSON editor
3. Click "Send Test" button
4. View response in response viewer

# Expected Results:
✅ Event type dropdown populates
✅ JSON editor validates syntax
✅ Test execution works
✅ Response displays status code and body
```

### **Phase 15: Cron Jobs Testing**

#### **Test 1: Dashboard Access & Manual Triggers**
```bash
# Navigate to cron jobs dashboard
URL: http://localhost:3000/admin/cron-jobs

# Test Steps:
1. Verify page loads and shows system status
2. Check all 4 job cards are visible
3. Click "Run Now" on "Trial Expiry Check"
4. Wait for completion and check result

# Expected Results:
✅ System status shows "Active" or "Inactive"
✅ All 4 job cards display correctly
✅ Manual trigger works without errors
✅ Job result appears in card after execution
✅ Navigation cards work (Dashboard, Logs, Config)
```

#### **Test 2: Execution Logs**
```bash
# Navigate to logs page
URL: http://localhost:3000/admin/cron-jobs/logs

# Test Steps:
1. Verify logs table loads
2. Test filtering by job type
3. Test date range filtering
4. Click "View Details" on a log entry

# Expected Results:
✅ Logs table displays execution history
✅ Filters work correctly
✅ Log detail modal shows full information
✅ Pagination works if multiple pages
```

#### **Test 3: Job Configuration**
```bash
# Navigate to config page
URL: http://localhost:3000/admin/cron-jobs/config

# Test Steps:
1. Select "Trial Expiry Check" from dropdown
2. Modify cron expression using presets
3. Update job parameters in JSON editor
4. Click "Save Config"
5. Test job with "Test Run" button

# Expected Results:
✅ Job selection loads configuration
✅ Cron expression builder works
✅ JSON editor validates parameters
✅ Configuration saves successfully
✅ Test run executes with new config
```

### **Test 4: Dark Mode Compatibility**
```bash
# Test dark mode across all pages
1. Toggle dark mode in browser/app
2. Visit all webhook and cron job pages
3. Verify no light elements appear

# Expected Results:
✅ All inputs have dark backgrounds
✅ All text is properly colored
✅ All cards use dark theme
✅ No white/light elements visible
```

---

## 📡 API Endpoints Reference

### **Webhooks Management API**
```typescript
// Base URL: http://localhost:4000/api/webhooks

GET    /stats                    // Get webhook statistics
GET    /events                   // Get webhook events (paginated)
GET    /events/:id               // Get single webhook event
POST   /events/:id/retry         // Retry specific webhook event
POST   /events/retry-failed      // Retry all failed webhooks
DELETE /logs/clear               // Clear webhook logs
POST   /test                     // Test webhook
GET    /event-types              // Get available event types
```

### **Cron Jobs Management API**
```typescript
// Base URL: http://localhost:4000/api/cron

GET    /status                   // Get cron job status
POST   /trial-expiry             // Trigger trial expiry check
POST   /renewal-reminders        // Trigger renewal reminders
POST   /late-fees                // Trigger late fees processing
POST   /update-overdue           // Trigger overdue status update
GET    /logs                     // Get job execution logs (paginated)
GET    /logs/:id                 // Get single job log
GET    /jobs/:jobId/config       // Get job configuration
PUT    /jobs/:jobId/config       // Update job configuration
PATCH  /jobs/:jobId/toggle       // Enable/disable job
```

### **Authentication Headers**
```typescript
// All requests require Super Admin authentication
{
  'Authorization': 'Bearer <token>',
  'Content-Type': 'application/json'
}
```

---

## 🔧 Troubleshooting

### **Common Issues & Solutions**

#### **Issue 1: 401 Unauthorized Errors**
```bash
# Symptoms:
- "Authentication required" errors
- "Access Denied" messages
- API calls failing with 401 status

# Solutions:
✅ Verify user has platformRole: 'SUPER_ADMIN'
✅ Check authentication token is valid
✅ Ensure backend routes are before tenant middleware
✅ Restart backend server after route changes
```

#### **Issue 2: Dark Mode Light Elements**
```bash
# Symptoms:
- White backgrounds in dark mode
- Light text on light backgrounds
- Inconsistent styling

# Solutions:
✅ Check component styles use CSS variables
✅ Verify Card components have bg="var(--mantine-color-dark-7)"
✅ Ensure input styles include dark mode overrides
✅ Test all form components individually
```

#### **Issue 3: Cron Job Manual Triggers Failing**
```bash
# Symptoms:
- "Backend Configuration Required" alerts
- Association context errors
- 400 Bad Request responses

# Solutions:
✅ Verify cron routes use Super Admin authentication
✅ Check routes are mounted before tenant middleware
✅ Ensure API client uses proper headers
✅ Test with platform context, not tenant context
```

#### **Issue 4: Webhook Statistics Not Loading**
```bash
# Symptoms:
- "Failed to fetch webhook statistics" errors
- Empty dashboard with loading states
- Network errors in browser console

# Solutions:
✅ Check webhook service functions support platform-wide queries
✅ Verify webhook routes use Super Admin authentication
✅ Test API endpoints directly with curl/Postman
✅ Check database permissions for cross-association queries
```

### **Debug Commands**
```bash
# Check backend server logs
tail -f apps/api/logs/server.log

# Test API endpoints directly
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/cron/status
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/webhooks/stats

# Check frontend network requests
# Open browser DevTools > Network tab
# Filter by "webhooks" or "cron" to see API calls
```

---

## 🎉 Implementation Summary

### **Completed Features**
- ✅ **18 Total Tasks** (10 Webhooks + 8 Cron Jobs)
- ✅ **Super Admin Authentication** across all endpoints
- ✅ **Dark Mode Compatibility** for all UI components
- ✅ **Real-time Logging** with comprehensive tracking
- ✅ **Manual Testing Interfaces** for both systems
- ✅ **Configuration Management** with visual editors
- ✅ **Filtering & Pagination** for efficient data browsing
- ✅ **Error Handling** with user-friendly messages

### **Technical Achievements**
- ✅ **Platform-wide Operations** without tenant context dependency
- ✅ **Consistent API Patterns** across both management systems
- ✅ **Comprehensive Logging** with execution tracking and error capture
- ✅ **Visual Configuration Tools** including cron expression builder
- ✅ **Responsive Design** with mobile-friendly interfaces

Both Webhooks and Cron Jobs Management UI are now **production-ready** and provide Super Admins with powerful tools for monitoring and managing platform-wide operations.

---

**Last Updated:** January 13, 2026  
**Implementation Status:** ✅ **COMPLETED**  
**Total Tasks:** 18/18 (100%)