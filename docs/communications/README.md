# Communications Module Documentation

## Overview

The Communications module provides SMS messaging capabilities for cooperative associations, enabling them to communicate with members through bulk SMS campaigns, quick messages, and automated notifications. The system integrates with **Termii** as the SMS gateway provider.

## Table of Contents

1. [Architecture](#architecture)
2. [Features](#features)
3. [API Reference](#api-reference)
4. [Database Schema](#database-schema)
5. [Configuration](#configuration)
6. [Frontend Components](#frontend-components)
7. [Testing Guide](#testing-guide)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  SMS Dashboard │ Campaigns │ Templates │ History │ Credits      │
└────────────────────────────┬────────────────────────────────────┘
                             │ API Calls (with tenant headers)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (Express)                       │
├─────────────────────────────────────────────────────────────────┤
│  Routes → Controller → Service → Termii Integration             │
│                           │                                      │
│                           ▼                                      │
│                    Prisma ORM → PostgreSQL                       │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Termii SMS Gateway                            │
│              https://api.ng.termii.com/api                       │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
apps/
├── api/src/
│   ├── lib/
│   │   └── sms.ts                    # Termii integration layer
│   └── modules/sms/
│       ├── index.ts                  # Module exports
│       ├── sms.routes.ts             # API route definitions
│       ├── sms.controller.ts         # Request handlers
│       ├── sms.service.ts            # Business logic
│       ├── sms.types.ts              # TypeScript types
│       └── sms.validation.ts         # Zod validation schemas
│
└── web/src/
    ├── lib/api/
    │   └── communication.ts          # API client functions
    └── app/dashboard/communication/sms/
        ├── page.tsx                  # SMS Dashboard
        ├── campaigns/page.tsx        # Campaign management
        ├── templates/page.tsx        # Template management
        └── history/page.tsx          # Message history
```

---

## Features

### 1. Quick SMS
Send immediate SMS messages to one or more recipients.

- Single or multiple recipients
- Template support with placeholder substitution
- Phone number validation (Nigerian format)
- Credit balance checking
- Delivery tracking

### 2. SMS Campaigns
Create and manage bulk SMS campaigns.

- Multiple recipient targeting options:
  - All members
  - Selected members
  - By member category
  - Custom phone numbers
  - Owing members (with outstanding balance)
  - Paid members (no outstanding balance)
- Campaign scheduling
- Progress tracking (sent/delivered/failed counts)
- Campaign lifecycle management (draft → scheduled → in_progress → completed)

### 3. SMS Templates
Create reusable message templates.

- Categories: General, Payment Reminder, Meeting, Dues, Levy, Welfare, Election, Custom
- Placeholder support: `{{name}}`, `{{amount}}`, `{{dueDate}}`, etc.
- Usage tracking
- Active/inactive status

### 4. Credit Management
Track and manage SMS credits.

- Balance tracking per association
- Credit top-up functionality
- Transaction history
- Usage deduction per message segment

### 5. Message History
View and filter sent messages.

- Status filtering (Pending, Sent, Delivered, Failed, Rejected)
- Campaign association
- Date range filtering
- Delivery status tracking

---

## API Reference

### Base URL
```
/api/sms
```

### Authentication
All endpoints require:
- Valid JWT token in `Authorization: Bearer <token>` header
- Association context via `X-Tenant` header or subdomain

### Permissions

| Permission | Description |
|------------|-------------|
| `SMS_VIEW` | View SMS dashboard, messages, campaigns |
| `SMS_SEND` | Send quick SMS messages |
| `SMS_CAMPAIGN_MANAGE` | Create, start, cancel campaigns |
| `SMS_TEMPLATE_MANAGE` | Create, edit, delete templates |
| `SMS_CREDIT_MANAGE` | Top up credits |

### Endpoints

#### Dashboard
```
GET /api/sms/dashboard
```
Returns SMS statistics including message counts, delivery rates, credit balance, and recent activity.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalMessagesSent": 150,
    "totalMessagesDelivered": 142,
    "totalMessagesFailed": 8,
    "deliveryRate": 94.67,
    "totalCampaigns": 5,
    "activeCampaigns": 1,
    "totalTemplates": 8,
    "creditBalance": 500,
    "recentMessages": [...],
    "recentCampaigns": [...],
    "messagesByDay": [...]
  }
}
```

#### Quick SMS
```
POST /api/sms/send
```
Send SMS to one or more recipients.

**Request Body:**
```json
{
  "recipients": ["08012345678", "08098765432"],
  "message": "Hello {{name}}, your dues of ₦{{amount}} is due.",
  "useTemplate": false,
  "templateId": null,
  "templateData": { "name": "John", "amount": "5000" }
}
```

**Response:**
```json
{
  "success": true,
  "message": "SMS sent to 2 recipients",
  "data": {
    "totalSent": 2,
    "totalFailed": 0,
    "messages": [
      { "phone": "2348012345678", "success": true, "messageId": "msg_123" },
      { "phone": "2348098765432", "success": true, "messageId": "msg_124" }
    ],
    "creditsUsed": 2,
    "remainingCredits": 498
  }
}
```

#### Campaigns

**List Campaigns:**
```
GET /api/sms/campaigns?page=1&limit=10&status=DRAFT
```

**Create Campaign:**
```
POST /api/sms/campaigns
```
```json
{
  "name": "January Dues Reminder",
  "message": "Dear member, your January dues of ₦5,000 is due.",
  "recipientType": "OWING_MEMBERS",
  "recipientFilter": { "owingMinAmount": 1000 },
  "scheduledAt": "2025-01-15T09:00:00Z"
}
```

**Start Campaign:**
```
POST /api/sms/campaigns/:id/start
```

**Cancel Campaign:**
```
POST /api/sms/campaigns/:id/cancel
```

**Delete Campaign (draft only):**
```
DELETE /api/sms/campaigns/:id
```

#### Templates

**List Templates:**
```
GET /api/sms/templates?page=1&limit=20&category=PAYMENT_REMINDER
```

**Create Template:**
```
POST /api/sms/templates
```
```json
{
  "name": "Monthly Dues Reminder",
  "content": "Dear {{name}}, your {{month}} dues of ₦{{amount}} is due on {{dueDate}}. Please pay promptly.",
  "category": "PAYMENT_REMINDER",
  "placeholders": ["name", "month", "amount", "dueDate"]
}
```

**Update Template:**
```
PUT /api/sms/templates/:id
```

**Delete Template:**
```
DELETE /api/sms/templates/:id
```

#### Messages

**List Messages:**
```
GET /api/sms/messages?page=1&limit=20&status=DELIVERED&startDate=2025-01-01
```

**Get Message:**
```
GET /api/sms/messages/:id
```

#### Credits

**Get Balance:**
```
GET /api/sms/credits/balance
```

**Top Up Credits:**
```
POST /api/sms/credits/topup
```
```json
{
  "amount": 1000,
  "reference": "PAY-12345",
  "description": "Credit purchase via Paystack"
}
```

**Get Transaction History:**
```
GET /api/sms/credits/history?page=1&limit=20
```

---

## Database Schema

### SMS Message
```prisma
model SMSMessage {
  id              Int              @id @default(autoincrement())
  associationId   Int
  campaignId      Int?
  recipientPhone  String
  recipientName   String?
  memberId        Int?
  message         String
  messageType     SMSMessageType   @default(SINGLE)
  status          SMSStatus        @default(PENDING)
  termiiMessageId String?
  segments        Int              @default(1)
  cost            Decimal?
  errorMessage    String?
  sentAt          DateTime?
  deliveredAt     DateTime?
  createdAt       DateTime
  updatedAt       DateTime
}
```

### SMS Campaign
```prisma
model SMSCampaign {
  id              Int
  associationId   Int
  name            String
  message         String
  templateId      Int?
  recipientType   SMSRecipientType
  recipientFilter Json?
  totalRecipients Int
  sentCount       Int
  deliveredCount  Int
  failedCount     Int
  status          SMSCampaignStatus
  scheduledAt     DateTime?
  startedAt       DateTime?
  completedAt     DateTime?
  createdBy       Int
  createdAt       DateTime
  updatedAt       DateTime
}
```

### SMS Template
```prisma
model SMSTemplate {
  id            Int
  associationId Int
  name          String
  content       String
  category      SMSTemplateCategory
  placeholders  String[]
  isActive      Boolean
  usageCount    Int
  createdBy     Int
  createdAt     DateTime
  updatedAt     DateTime
}
```

### Enums

```prisma
enum SMSMessageType {
  SINGLE      // Single recipient
  BULK        // Part of bulk campaign
  AUTOMATED   // Automated reminder/notification
}

enum SMSStatus {
  PENDING     // Queued for sending
  SENT        // Sent to provider
  DELIVERED   // Confirmed delivered
  FAILED      // Failed to send
  REJECTED    // Rejected by provider
}

enum SMSCampaignStatus {
  DRAFT       // Being created
  SCHEDULED   // Scheduled for future
  IN_PROGRESS // Currently sending
  COMPLETED   // All messages sent
  CANCELLED   // Cancelled before completion
  FAILED      // Failed to complete
}

enum SMSRecipientType {
  ALL_MEMBERS       // All active members
  SELECTED_MEMBERS  // Specific members selected
  MEMBER_CATEGORY   // Members by category
  CUSTOM_NUMBERS    // Custom phone numbers
  OWING_MEMBERS     // Members with outstanding dues
  PAID_MEMBERS      // Members who are paid up
}

enum SMSTemplateCategory {
  GENERAL
  PAYMENT_REMINDER
  MEETING
  DUES
  LEVY
  WELFARE
  ELECTION
  CUSTOM
}
```

---

## Configuration

### Environment Variables

```env
# Termii SMS Configuration
TERMII_API_KEY=your_termii_api_key
TERMII_SENDER_ID=SocLedger
TERMII_BASE_URL=https://api.ng.termii.com/api
TERMII_CHANNEL=generic
```

### Termii Channels

| Channel | Description |
|---------|-------------|
| `generic` | Promotional messages (non-DND numbers) |
| `dnd` | Transactional messages (bypasses DND) |
| `whatsapp` | WhatsApp messaging |

### Phone Number Format

The system automatically formats Nigerian phone numbers:
- `08012345678` → `2348012345678`
- `8012345678` → `2348012345678`
- `2348012345678` → `2348012345678` (unchanged)

---

## Frontend Components

### SMS Dashboard (`/dashboard/communication/sms`)
- Statistics cards (messages sent, delivery rate, campaigns, credits)
- Quick SMS modal
- Recent messages list
- Recent campaigns table
- Quick action buttons

### Campaigns Page (`/dashboard/communication/sms/campaigns`)
- Campaign list with filtering
- Create campaign modal
- Campaign actions (start, cancel, delete)
- Progress tracking

### Templates Page (`/dashboard/communication/sms/templates`)
- Template grid view
- Create/edit template modal
- Category filtering
- Active/inactive toggle

### History Page (`/dashboard/communication/sms/history`)
- Message table with pagination
- Status filtering
- Delivery status display
- Error message display

---

## Testing Guide

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for comprehensive manual testing instructions.
