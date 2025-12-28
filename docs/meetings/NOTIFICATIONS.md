# Meeting Notifications System

**Last Updated:** December 28, 2025

This document details the notification system for the Meetings & Attendance module, including email reminders and in-app notifications.

---

## Overview

The meeting notification system provides automated and event-driven notifications to keep members informed about meeting activities. It uses two channels:

1. **Email Notifications** - Sent via Resend email service
2. **In-App Notifications** - Stored in database and displayed in the app

---

## Notification Types

### 1. Meeting Scheduled Notification

**Trigger:** When a new meeting is created

**Recipients:** All active users in the association

**Channels:**
- ✅ In-App Notification
- ❌ Email (not sent immediately, reminder sent 24h before)

**Notification Content:**
```
Title: 📅 New Meeting Scheduled: {meeting.title}
Message: A new {meetingType} meeting "{title}" has been scheduled for 
         {date} at {time}. {location if provided}
```

**Code Location:** `apps/api/src/jobs/meeting-jobs.ts` → `notifyMeetingScheduled()`

---

### 2. Meeting Reminder (24 Hours Before)

**Trigger:** Cron job running every hour checks for meetings starting within 24 hours

**Recipients:** All active users in the association

**Channels:**
- ✅ In-App Notification
- ✅ Email

**Cron Schedule:** `0 * * * *` (every hour at minute 0)

**Notification Content:**
```
Title: 📅 Meeting Reminder: {meeting.title}
Message: Reminder: "{title}" is scheduled for {date} at {time}. 
         Location: {location}
```

**Email Template:** `meeting-reminder`

**Email Content:**
- Meeting title
- Date and time
- Meeting type
- Location (physical)
- Virtual link (if provided)
- Link to view meeting details

**Code Location:** `apps/api/src/jobs/meeting-jobs.ts` → `checkMeetingReminders` cron job

**Database Flag:** `Meeting.reminderSent` - Set to `true` after reminder is sent to prevent duplicates

---

### 3. Meeting Cancelled Notification

**Trigger:** When a meeting is cancelled via the cancel endpoint

**Recipients:** All active users in the association

**Channels:**
- ✅ In-App Notification
- ✅ Email

**Notification Content:**
```
Title: ❌ Meeting Cancelled: {meeting.title}
Message: The meeting "{title}" scheduled for {date} has been cancelled.
         Reason: {cancellationReason}
```

**Email Template:** `meeting-cancelled`

**Email Content:**
- Meeting title
- Originally scheduled date
- Cancellation reason
- Link to view other meetings

**Code Location:** `apps/api/src/jobs/meeting-jobs.ts` → `notifyMeetingCancelled()`

---

### 4. Attendance Marked Notification

**Trigger:** When attendance is marked for a member

**Recipients:** The specific member whose attendance was marked

**Channels:**
- ✅ In-App Notification
- ❌ Email

**Notification Content:**
```
Title: ✅ Attendance Recorded
Message: Your attendance for "{meeting.title}" has been marked as {status}.
```

**Status Text Mapping:**
| Status | Display Text |
|--------|--------------|
| PRESENT | present |
| ABSENT | absent |
| LATE | late |
| APOLOGY | excused (apology) |

**Code Location:** `apps/api/src/jobs/meeting-jobs.ts` → `notifyAttendanceMarked()`

---

## Technical Implementation

### File Structure

```
apps/api/src/
├── jobs/
│   └── meeting-jobs.ts          # Cron jobs and notification functions
├── lib/
│   └── email.ts                 # Email templates
└── modules/meetings/
    └── meetings.controller.ts   # Triggers notifications
```

### Cron Job Configuration

```typescript
// apps/api/src/jobs/meeting-jobs.ts

import cron from 'node-cron';

// Runs every hour at minute 0
export const checkMeetingReminders = cron.schedule('0 * * * *', async () => {
  // Find meetings starting in next 24 hours
  // Send reminders for meetings where reminderSent = false
  // Mark reminderSent = true after sending
});
```

### Starting/Stopping Jobs

```typescript
// apps/api/src/server.ts

import { startMeetingJobs, stopMeetingJobs } from './jobs/meeting-jobs';

// On server start
startMeetingJobs();

// On graceful shutdown
process.on('SIGTERM', () => {
  stopMeetingJobs();
});
```

### Notification Creation Helper

```typescript
// apps/api/src/jobs/meeting-jobs.ts

async function createMeetingNotifications(
  associationId: number,
  title: string,
  message: string,
  type: 'system' | 'announcement' = 'system'
) {
  // Get all active users
  const users = await prisma.user.findMany({
    where: { associationId, isActive: true },
    select: { id: true },
  });

  // Create notifications for all users
  await prisma.notification.createMany({
    data: users.map(user => ({
      associationId,
      userId: user.id,
      title,
      message,
      type,
    })),
  });
}
```

---

## Email Templates

### meeting-reminder

**Location:** `apps/api/src/lib/email.ts`

**Template Variables:**
| Variable | Description |
|----------|-------------|
| `associationName` | Name of the association |
| `meetingTitle` | Title of the meeting |
| `meetingDate` | Formatted date (e.g., "Monday, January 15, 2025") |
| `meetingTime` | Formatted time (e.g., "10:00 AM") |
| `meetingType` | Type of meeting (REGULAR, AGM, etc.) |
| `location` | Physical location or "To be announced" |
| `virtualLink` | Virtual meeting URL (optional) |

**Sample Email:**
```html
Subject: 📅 Meeting Reminder: Monthly General Meeting - Tomorrow

Hello!

This is a friendly reminder about an upcoming meeting for ABC Association.

Meeting Details:
- Title: Monthly General Meeting
- Date: Monday, January 15, 2025
- Time: 10:00 AM
- Type: REGULAR
- Location: Community Hall, Block A
- Virtual Link: https://zoom.us/j/123456789

Please make sure to attend on time. Your participation is important!

[View Meeting Details]
```

### meeting-cancelled

**Location:** `apps/api/src/lib/email.ts`

**Template Variables:**
| Variable | Description |
|----------|-------------|
| `associationName` | Name of the association |
| `meetingTitle` | Title of the meeting |
| `meetingDate` | Originally scheduled date |
| `cancellationReason` | Reason for cancellation |

**Sample Email:**
```html
Subject: ❌ Meeting Cancelled: Monthly General Meeting

Hello!

We regret to inform you that the following meeting for ABC Association 
has been cancelled.

Cancelled Meeting Details:
- Title: Monthly General Meeting
- Originally Scheduled: Monday, January 15, 2025
- Reason: Venue unavailable due to maintenance

We apologize for any inconvenience this may cause. 
A new meeting may be scheduled soon.

[View Upcoming Meetings]
```

### meeting-scheduled

**Location:** `apps/api/src/lib/email.ts`

**Template Variables:**
| Variable | Description |
|----------|-------------|
| `associationName` | Name of the association |
| `meetingTitle` | Title of the meeting |
| `meetingDate` | Formatted date |
| `meetingTime` | Formatted time |
| `meetingType` | Type of meeting |
| `location` | Physical location |
| `virtualLink` | Virtual meeting URL (optional) |

---

## Controller Integration

### Meeting Creation

```typescript
// apps/api/src/modules/meetings/meetings.controller.ts

async createMeeting(req: Request, res: Response) {
  // ... create meeting logic ...

  // Send notifications (non-blocking)
  notifyMeetingScheduled(associationId, {
    id: meeting.id,
    title: meeting.title,
    startTime: meeting.startTime,
    location: meeting.location,
    virtualLink: meeting.virtualLink,
    meetingType: meeting.meetingType,
  }).catch(err => console.error('Failed to send notification:', err));

  return res.status(201).json({ success: true, data: meeting });
}
```

### Meeting Cancellation

```typescript
async cancelMeeting(req: Request, res: Response) {
  // ... cancel meeting logic ...

  // Send cancellation notifications (non-blocking)
  notifyMeetingCancelled(associationId, {
    id: meeting.id,
    title: meeting.title,
    startTime: meeting.startTime,
    cancellationReason: meeting.cancellationReason,
  }).catch(err => console.error('Failed to send notification:', err));

  return res.status(200).json({ success: true, data: meeting });
}
```

### Attendance Marking

```typescript
async markAttendance(req: Request, res: Response) {
  // ... mark attendance logic ...

  // Get member's user ID
  const member = await prisma.member.findUnique({
    where: { id: validatedData.memberId },
    select: { userId: true },
  });

  if (member?.userId) {
    notifyAttendanceMarked(
      member.userId,
      associationId,
      { id: meetingId, title: meeting.title },
      validatedData.status
    ).catch(err => console.error('Failed to send notification:', err));
  }

  return res.status(200).json({ success: true, data: attendance });
}
```

---

## Database Schema

### Notification Model

```prisma
model Notification {
  id            Int      @id @default(autoincrement())
  associationId Int
  userId        Int
  title         String
  message       String
  type          String   // 'system', 'announcement', 'payment_due', etc.
  isRead        Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  association   Association @relation(fields: [associationId], references: [id])
  user          User        @relation(fields: [userId], references: [id])
}
```

### Meeting Model (Reminder Flag)

```prisma
model Meeting {
  // ... other fields ...
  reminderSent  Boolean  @default(false)  // Prevents duplicate reminders
}
```

---

## Configuration

### Environment Variables

```env
# Email Configuration (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=SocietyLedger <admin@megagigsolution.com>
EMAIL_REPLY_TO=admin@megagigsolution.com

# App URL (for email links)
APP_URL=https://societyledger.com
```

### Cron Job Timing

| Job | Schedule | Description |
|-----|----------|-------------|
| Meeting Reminders | `0 * * * *` | Every hour at minute 0 |

To change the reminder timing (e.g., 48 hours instead of 24):

```typescript
// apps/api/src/jobs/meeting-jobs.ts

const now = new Date();
const reminderWindow = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
```

---

## Monitoring & Debugging

### Server Logs

The notification system logs all activities:

```
[CRON] Running meeting reminder check...
[CRON] Found 3 meetings needing reminders
[CRON] Sent reminders for meeting "Monthly Meeting" (ID: 5): 25 notifications, 23 emails
[CRON] Meeting reminder check complete. Processed: 3
```

```
[MEETING-JOBS] Meeting scheduled notification sent: 25 users
[MEETING-JOBS] Meeting cancelled notification sent: 25 notifications, 23 emails
[MEETING-JOBS] Attendance notification sent to user 15
```

### Checking Reminder Status

```sql
-- Check if reminder was sent for a meeting
SELECT id, title, start_time, reminder_sent 
FROM meetings 
WHERE id = 5;

-- Find meetings that should have received reminders
SELECT id, title, start_time, reminder_sent
FROM meetings
WHERE status = 'SCHEDULED'
  AND start_time BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
  AND reminder_sent = false;
```

### Checking Notifications

```sql
-- Get recent meeting notifications
SELECT n.*, u.email
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.title LIKE '%Meeting%'
ORDER BY n.created_at DESC
LIMIT 20;
```

---

## Error Handling

### Email Failures

Email sending is wrapped in try-catch to prevent failures from blocking the notification process:

```typescript
for (const user of users) {
  if (user.email) {
    try {
      await sendEmail({ ... });
      emailsSent++;
    } catch (emailError) {
      console.error(`Failed to send email to ${user.email}:`, emailError);
      // Continue with next user
    }
  }
}
```

### Non-Blocking Notifications

Controller notification calls use `.catch()` to prevent API response delays:

```typescript
notifyMeetingScheduled(associationId, meeting)
  .catch(err => console.error('Notification failed:', err));

// API response is not blocked by notification
return res.status(201).json({ success: true });
```

---

## Future Enhancements

### Planned Features

1. **SMS Notifications** (Phase 6.5)
   - Send SMS reminders via Termii/BulkSMSNigeria
   - Configurable per user preference

2. **WhatsApp Notifications** (Phase 6.5)
   - Send WhatsApp messages via Twilio
   - Rich message formatting

3. **Notification Preferences**
   - Allow users to opt-in/out of specific notification types
   - Choose preferred channels (email, SMS, in-app)

4. **Reminder Timing Configuration**
   - Admin-configurable reminder timing (24h, 48h, 1 week)
   - Multiple reminders (1 week, 1 day, 1 hour before)

5. **Attendance Confirmation Requests**
   - Send RSVP requests before meetings
   - Track expected attendance

---

## Troubleshooting

### Reminders Not Being Sent

1. **Check cron job is running:**
   ```bash
   # Server logs should show:
   [CRON] Running meeting reminder check...
   ```

2. **Check meeting criteria:**
   - Status must be `SCHEDULED`
   - `reminderSent` must be `false`
   - `startTime` must be within 24 hours

3. **Check for errors in logs:**
   ```bash
   grep "MEETING-JOBS" server.log
   grep "Error" server.log
   ```

### Emails Not Received

1. **Check Resend API key is configured**
2. **Check email address is valid**
3. **Check spam folder**
4. **Verify Resend dashboard for delivery status**

### Notifications Not Appearing

1. **Check user is active:** `isActive = true`
2. **Check association ID matches**
3. **Check notification was created:**
   ```sql
   SELECT * FROM notifications 
   WHERE user_id = X 
   ORDER BY created_at DESC;
   ```

---

## Related Documentation

- [Meetings README](./README.md)
- [Testing Guide](./TESTING.md)
