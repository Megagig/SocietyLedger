# Meetings & Attendance System Documentation

**Phase 12.5 - Completed December 28, 2025**

## Overview

The Meetings & Attendance System provides comprehensive meeting management capabilities for associations, including meeting scheduling, agenda management, attendance tracking with quorum calculation, meeting minutes recording with approval workflow, and automated reminders via email and in-app notifications.

## Features

### 1. Meeting Management (TASK-MEET-001, TASK-MEET-002)
- Create and schedule meetings with multiple types (Regular, AGM, EGM, Emergency, Committee, Special)
- Support for physical and virtual meetings (with meeting links)
- Meeting status tracking (Scheduled, In Progress, Completed, Cancelled, Postponed)
- Quorum requirement configuration
- Meeting cancellation with reason tracking

### 2. Agenda Management
- Create agenda items with ordering
- Duration estimation per agenda item
- Presenter assignment
- Reorder agenda items
- Add/update/delete agenda items

### 3. Attendance Tracking (TASK-MEET-003)
- Initialize attendance for all active members
- Mark individual or bulk attendance
- Attendance statuses: Present, Absent, Late, Apology, Pending
- Check-in and check-out time tracking
- Apology reason recording
- Real-time quorum calculation

### 4. Meeting Minutes (TASK-MEET-004)
- Record meeting minutes with rich content
- Track decisions made during meeting
- Record action items with assignments
- Schedule next meeting date
- Minutes approval workflow

### 5. Analytics & Reporting (TASK-MEET-005)
- Meeting statistics (total, scheduled, completed, cancelled)
- Member attendance history with rates
- Upcoming and recent meetings dashboard
- Attendance rate calculations

### 6. Reminders & Notifications (TASK-MEET-006)
- Automated email reminders 24 hours before meetings
- In-app notifications for meeting events
- Notifications for:
  - New meeting scheduled
  - Meeting reminder (24 hours before)
  - Meeting cancelled
  - Attendance marked

## API Endpoints

### Meeting CRUD
| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/meetings` | List meetings with pagination/filters | `meeting:view` |
| POST | `/api/meetings` | Create new meeting | `meeting:create` |
| GET | `/api/meetings/:id` | Get meeting details | `meeting:view` |
| PATCH | `/api/meetings/:id` | Update meeting | `meeting:edit` |
| POST | `/api/meetings/:id/cancel` | Cancel meeting | `meeting:delete` |
| DELETE | `/api/meetings/:id` | Delete meeting | `meeting:delete` |

### Agenda Items
| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/meetings/:id/agenda` | Add agenda item | `meeting:edit` |
| PATCH | `/api/meetings/:id/agenda/:agendaId` | Update agenda item | `meeting:edit` |
| DELETE | `/api/meetings/:id/agenda/:agendaId` | Delete agenda item | `meeting:edit` |

### Attendance
| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/meetings/:id/attendance` | Get attendance list | `meeting:view` |
| POST | `/api/meetings/:id/attendance` | Mark single attendance | `meeting:attendance` |
| POST | `/api/meetings/:id/attendance/bulk` | Bulk mark attendance | `meeting:attendance` |
| POST | `/api/meetings/:id/attendance/initialize` | Initialize attendance | `meeting:attendance` |

### Minutes
| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/meetings/:id/minutes` | Get meeting minutes | `meeting:view` |
| POST | `/api/meetings/:id/minutes` | Create minutes | `meeting:minutes` |
| PATCH | `/api/meetings/:id/minutes` | Update minutes | `meeting:minutes` |
| POST | `/api/meetings/:id/minutes/approve` | Approve minutes | `meeting:minutes` |

### Analytics & Dashboard
| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/meetings/stats` | Get meeting statistics | `meeting:view` |
| GET | `/api/meetings/upcoming` | Get upcoming meetings | `meeting:view` |
| GET | `/api/meetings/recent` | Get recent meetings | `meeting:view` |
| GET | `/api/meetings/attendance-history` | Get attendance history | `meeting:view` |

## Database Schema

### Models

#### Meeting
```prisma
model Meeting {
  id                Int                 @id @default(autoincrement())
  associationId     Int
  title             String
  description       String?
  meetingType       MeetingType         @default(REGULAR)
  status            MeetingStatus       @default(SCHEDULED)
  location          String?
  virtualLink       String?
  startTime         DateTime
  endTime           DateTime?
  quorumRequired    Int?
  reminderSent      Boolean             @default(false)
  createdBy         Int
  cancelledBy       Int?
  cancelledAt       DateTime?
  cancellationReason String?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
}
```

#### MeetingAgenda
```prisma
model MeetingAgenda {
  id          Int      @id @default(autoincrement())
  meetingId   Int
  orderNumber Int
  title       String
  description String?
  duration    Int?     // in minutes
  presenter   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### MeetingAttendance
```prisma
model MeetingAttendance {
  id            Int              @id @default(autoincrement())
  meetingId     Int
  memberId      Int
  status        AttendanceStatus @default(PENDING)
  checkInTime   DateTime?
  checkOutTime  DateTime?
  apologyReason String?
  notes         String?
  markedBy      Int?
  markedAt      DateTime?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  
  @@unique([meetingId, memberId])
}
```

#### MeetingMinutes
```prisma
model MeetingMinutes {
  id              Int      @id @default(autoincrement())
  meetingId       Int      @unique
  content         String
  decisions       String?
  actionItems     String?
  nextMeetingDate DateTime?
  recordedBy      Int
  approvedBy      Int?
  approvedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Enums
```prisma
enum MeetingType {
  REGULAR    // Regular scheduled meeting
  EMERGENCY  // Emergency meeting
  AGM        // Annual General Meeting
  EGM        // Extraordinary General Meeting
  COMMITTEE  // Committee meeting
  SPECIAL    // Special purpose meeting
}

enum MeetingStatus {
  SCHEDULED    // Meeting is scheduled
  IN_PROGRESS  // Meeting is ongoing
  COMPLETED    // Meeting has ended
  CANCELLED    // Meeting was cancelled
  POSTPONED    // Meeting was postponed
}

enum AttendanceStatus {
  PENDING  // Not yet marked
  PRESENT  // Member attended
  ABSENT   // Member did not attend
  APOLOGY  // Member sent apology
  LATE     // Member arrived late
}
```

## Frontend Pages

| Page | Path | Description |
|------|------|-------------|
| Meetings Dashboard | `/dashboard/governance/meetings` | List all meetings with filters |
| Meeting Details | `/dashboard/governance/meetings/[id]` | View meeting with tabs (Details, Attendance, Minutes) |
| Create Meeting | `/dashboard/governance/meetings/create` | Create new meeting with agenda |
| Attendance History | `/dashboard/governance/attendance` | View member attendance analytics |

## Permissions

| Permission | Description | Roles |
|------------|-------------|-------|
| `meeting:view` | View meetings and attendance | All members |
| `meeting:create` | Create/schedule meetings | Admin, Secretary |
| `meeting:edit` | Edit meeting details and agenda | Admin, Secretary |
| `meeting:delete` | Cancel/delete meetings | Admin |
| `meeting:attendance` | Mark attendance | Admin, Secretary |
| `meeting:minutes` | Record/approve minutes | Admin, Secretary |

## Notification System

### Cron Job Configuration
The meeting reminder job runs every hour to check for meetings starting within 24 hours:

```typescript
// apps/api/src/jobs/meeting-jobs.ts
cron.schedule('0 * * * *', async () => {
  // Check for meetings needing reminders
});
```

### Email Templates
- `meeting-reminder` - Sent 24 hours before meeting
- `meeting-cancelled` - Sent when meeting is cancelled
- `meeting-scheduled` - Sent when new meeting is created

### In-App Notifications
Created for all active users in the association when:
- New meeting is scheduled
- Meeting reminder (24 hours before)
- Meeting is cancelled
- Attendance is marked (individual notification)

## File Structure

```
apps/api/src/modules/meetings/
├── meetings.types.ts        # Type definitions
├── meetings.validation.ts   # Zod schemas
├── meetings.service.ts      # Business logic
├── meetings.controller.ts   # Request handlers
└── meetings.routes.ts       # Route definitions

apps/api/src/jobs/
└── meeting-jobs.ts          # Cron jobs and notification functions

apps/web/src/app/dashboard/governance/
├── meetings/
│   ├── page.tsx             # Meetings list
│   ├── create/
│   │   └── page.tsx         # Create meeting
│   └── [id]/
│       └── page.tsx         # Meeting details
└── attendance/
    └── page.tsx             # Attendance history

apps/web/src/lib/api/
└── meetings.ts              # API client
```

## Usage Examples

### Create a Meeting
```typescript
POST /api/meetings
{
  "title": "Monthly General Meeting",
  "description": "Regular monthly meeting to discuss association matters",
  "meetingType": "REGULAR",
  "location": "Community Hall, Block A",
  "virtualLink": "https://zoom.us/j/123456789",
  "startTime": "2025-01-15T10:00:00Z",
  "endTime": "2025-01-15T12:00:00Z",
  "quorumRequired": 25,
  "agendaItems": [
    {
      "orderNumber": 1,
      "title": "Opening Prayer",
      "duration": 5
    },
    {
      "orderNumber": 2,
      "title": "Reading of Previous Minutes",
      "duration": 10,
      "presenter": "Secretary"
    },
    {
      "orderNumber": 3,
      "title": "Financial Report",
      "duration": 20,
      "presenter": "Treasurer"
    }
  ]
}
```

### Mark Attendance
```typescript
POST /api/meetings/1/attendance
{
  "memberId": 5,
  "status": "PRESENT",
  "checkInTime": "2025-01-15T10:05:00Z"
}
```

### Bulk Mark Attendance
```typescript
POST /api/meetings/1/attendance/bulk
{
  "attendances": [
    { "memberId": 1, "status": "PRESENT" },
    { "memberId": 2, "status": "PRESENT" },
    { "memberId": 3, "status": "ABSENT" },
    { "memberId": 4, "status": "APOLOGY", "apologyReason": "Out of town" },
    { "memberId": 5, "status": "LATE", "checkInTime": "2025-01-15T10:30:00Z" }
  ]
}
```

### Create Meeting Minutes
```typescript
POST /api/meetings/1/minutes
{
  "content": "The meeting was called to order at 10:00 AM...",
  "decisions": "1. Approved budget for Q1\n2. Elected new committee members",
  "actionItems": "1. Secretary to send meeting summary\n2. Treasurer to prepare Q1 report",
  "nextMeetingDate": "2025-02-15T10:00:00Z"
}
```

### Get Meeting Statistics
```typescript
GET /api/meetings/stats

Response:
{
  "success": true,
  "data": {
    "totalMeetings": 24,
    "scheduledMeetings": 3,
    "completedMeetings": 18,
    "cancelledMeetings": 3,
    "meetingsThisMonth": 2,
    "meetingsThisYear": 24
  }
}
```

### Get Attendance History
```typescript
GET /api/meetings/attendance-history?memberId=5

Response:
{
  "success": true,
  "data": [
    {
      "memberId": 5,
      "memberName": "John Doe",
      "totalMeetings": 20,
      "attended": 18,
      "absent": 1,
      "apologies": 1,
      "late": 2,
      "attendanceRate": 90
    }
  ]
}
```

## Subscription Tier

The Meetings & Attendance system is available on:
- ✅ **Professional Plan** - Full access
- ✅ **Enterprise Plan** - Full access
- ❌ **Starter Plan** - Not available

---

## Related Documentation

- [Manual Testing Guide](./TESTING.md)
- [Notification System](./NOTIFICATIONS.md)
