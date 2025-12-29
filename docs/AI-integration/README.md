# Phase 17: AI Integration

**Status:** ✅ Complete  
**Completion Date:** December 29, 2025

## Overview

SocietyLedger AI Integration provides intelligent assistance for association financial management using OpenRouter as the AI provider. The implementation follows strict safety guidelines ensuring AI is **read-only** and **never modifies data**.

## Core Principles

1. **AI Explains, Never Calculates** - AI only summarizes pre-calculated data from the database
2. **Read-Only Access** - AI cannot modify any database records
3. **Tenant Isolation** - AI can only access data from the requesting association
4. **Comprehensive Audit Logging** - Every AI request is logged for compliance
5. **Per-Tenant Rate Limiting** - Prevents abuse based on subscription tier

## Features Implemented

### 1. AI Financial Assistant (TASK-AI-004)
Natural language interface to explain financial data.

**Endpoint:** `POST /api/ai/financial/ask`

**Example Questions:**
- "How much was collected last month?"
- "Who hasn't paid their dues?"
- "What's our collection rate?"
- "Summarize our financial position"

### 2. Smart Reminders & Compliance Nudges (TASK-AI-006)
AI-powered reminder suggestions with optimal timing and tone.

**Endpoint:** `GET /api/ai/reminders/suggestions`

**Features:**
- Identifies members with overdue payments
- Suggests reminder timing based on patterns
- Generates personalized message tone (friendly/formal/urgent)
- Admin reviews before sending (AI never auto-sends)

### 3. Automated Report Generation (TASK-AI-005)
AI-generated financial reports and summaries.

**Endpoint:** `POST /api/ai/reports/generate`

**Report Types:**
- `monthly_summary` - Monthly financial overview
- `quarterly_review` - Quarterly performance analysis
- `annual_report` - Year-end comprehensive report
- `treasurer_handover` - Leadership transition document

### 4. Natural Language Query Interface (TASK-AI-007)
Convert natural language to safe, read-only database queries.

**Endpoint:** `POST /api/ai/query`

**Example Queries:**
- "Show me all members who joined in 2024"
- "List pending transactions from this month"
- "What's our total income this year?"

### 5. AI Safety Guards (TASK-AI-009)
Validates all AI outputs before returning to users.

**Safety Checks:**
- ❌ Rejects responses containing SQL modification keywords
- ❌ Rejects responses suggesting database changes
- ❌ Rejects cross-tenant data access attempts
- ❌ Rejects financial calculations (AI should only explain)
- ✅ Accepts explanatory responses only

### 6. AI Audit Logging (TASK-AI-010)
Comprehensive logging of all AI interactions.

**Logged Data:**
- Association ID & User ID
- Prompt type and model used
- Token usage (input/output)
- Cost in USD
- Response summary
- Success/error status

### 7. Per-Tenant Rate Limiting (TASK-AI-011)
Prevents abuse with tier-based limits.

**Rate Limits:**
| Tier | Requests/Day | Tokens/Day |
|------|--------------|------------|
| Starter | 20 | 50,000 |
| Professional | 100 | 500,000 |
| Enterprise | Unlimited | Unlimited |

### 8. AI Usage Dashboard (TASK-AI-012)
View AI usage metrics and statistics.

**Endpoint:** `GET /api/ai/usage`

**Metrics:**
- Total requests (current period)
- Requests by feature type
- Token usage and estimated cost
- Daily usage trends

## API Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/ai/status` | Check AI availability | Any authenticated |
| GET | `/api/ai/rate-limit` | Get rate limit status | Any authenticated |
| GET | `/api/ai/usage` | Get usage statistics | FINANCE_VIEW |
| POST | `/api/ai/financial/ask` | Ask financial question | FINANCE_VIEW |
| GET | `/api/ai/reminders/suggestions` | Get reminder suggestions | FINANCE_VIEW |
| POST | `/api/ai/reports/generate` | Generate AI report | REPORT_VIEW |
| POST | `/api/ai/query` | Natural language query | FINANCE_VIEW |
| POST | `/api/ai/chat` | Simple AI chat | FINANCE_VIEW |

## Configuration

### Environment Variables

```env
# OpenRouter API Key (required)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx

# Application URL (for OpenRouter headers)
APP_URL=https://societyledger.com
```

### OpenRouter Setup

1. Create account at [openrouter.ai](https://openrouter.ai)
2. Generate API key
3. Add to `.env` file
4. Restart server

## Database Models

### AIAuditLog
Tracks all AI requests for compliance and debugging.

```prisma
model AIAuditLog {
  id            Int
  associationId Int
  userId        Int
  promptType    String    // financial_assistant, reminder_suggestions, etc.
  modelUsed     String
  tokensInput   Int
  tokensOutput  Int
  costUsd       Decimal
  outputSummary String?
  status        String    // success, error, rate_limited
  errorMessage  String?
  createdAt     DateTime
}
```

### DocumentEmbedding (Future - RAG)
For document Q&A feature using vector embeddings.

```prisma
model DocumentEmbedding {
  id            Int
  associationId Int
  documentType  String    // constitution, bylaw, policy, minutes
  filename      String
  content       String
  chunkIndex    Int
  embeddingJson String?   // Vector stored as JSON (pgvector in production)
  metadata      Json?
  isProcessed   Boolean
}
```

## Security Architecture

### Input Validation
- All user inputs validated with Zod schemas
- Prompt injection detection
- Maximum input length enforcement

### Output Validation
- Forbidden pattern detection (SQL, shell commands)
- Calculation pattern detection
- Cross-tenant access prevention
- Automatic sanitization of unsafe content

### Rate Limiting
- In-memory cache with database fallback
- Per-association daily limits
- Automatic reset at midnight

## File Structure

```
apps/api/src/modules/ai/
├── ai.types.ts           # TypeScript type definitions
├── ai.validation.ts      # Zod validation schemas
├── ai.service.ts         # Core AI business logic
├── ai.controller.ts      # Express route handlers
├── ai.routes.ts          # Route definitions
└── tools/
    ├── safety-guards.ts  # AI output validation
    └── rate-limiter.ts   # Per-tenant rate limiting

apps/api/src/lib/
└── openrouter.ts         # OpenRouter client & prompts

apps/web/src/app/dashboard/ai/
├── assistant/page.tsx    # AI Financial Assistant chat interface
├── reports/page.tsx      # AI Smart Reports generation
├── reminders/page.tsx    # Smart Reminders suggestions
├── query/page.tsx        # Natural Language Query interface
└── usage/page.tsx        # AI Usage & Statistics dashboard

apps/web/src/lib/api/
└── ai.ts                 # AI API client with types and methods
```

## Frontend Pages

### 1. AI Financial Assistant (`/dashboard/ai/assistant`)
Interactive chat interface for asking financial questions.

**Features:**
- Real-time chat with AI
- Conversation history
- Quick question suggestions
- Rate limit status display
- Nigerian Naira (₦) currency formatting

### 2. Smart Reports (`/dashboard/ai/reports`)
Generate AI-powered financial reports.

**Features:**
- Report type selection (Monthly, Quarterly, Annual, Treasurer Handover)
- Date range picker
- Include/exclude recommendations toggle
- Generated report preview
- Copy to clipboard functionality

### 3. Smart Reminders (`/dashboard/ai/reminders`)
AI-suggested payment reminders for overdue members.

**Features:**
- List of members with overdue payments
- AI-suggested message tone (friendly/formal/urgent)
- Suggested timing for reminders
- Confidence score for each suggestion
- Admin review before sending

### 4. Data Query (`/dashboard/ai/query`)
Natural language interface to query association data.

**Features:**
- Natural language input
- Query type detection (members, transactions, financial)
- Results display with explanation
- Safe, read-only queries only

### 5. Usage & Stats (`/dashboard/ai/usage`)
Monitor AI usage and costs.

**Features:**
- Current rate limit status
- Requests used vs remaining
- Token usage tracking
- Daily usage trends chart
- Cost estimation in USD

## Permissions

| Role | AI Permissions |
|------|----------------|
| Admin | Full access (all AI features + usage stats) |
| Treasurer | Full access (all AI features + usage stats) |
| Financial Secretary | View, Financial Assistant, Reports |
| Member | View only |

## Sidebar Navigation

The AI Assistant section appears in the sidebar under "AI Assistant" with a Beta badge:

- **Financial Assistant** - Chat interface for financial questions
- **Smart Reports** - Generate AI-powered reports
- **Smart Reminders** - AI-suggested payment reminders
- **Data Query** - Natural language data queries
- **Usage & Stats** - Monitor AI usage and costs

## Currency

All AI responses use **Nigerian Naira (₦)** for currency formatting.

## Future Enhancements

1. **Document Q&A (RAG)** - Upload constitution/bylaws, ask questions
2. **Predictive Late Payment Detection** - ML-based payment prediction
3. **AI Chat Interface UI** - Frontend chat components
4. **Background Workers** - BullMQ for async AI tasks
5. **pgvector Integration** - Native vector search for embeddings
