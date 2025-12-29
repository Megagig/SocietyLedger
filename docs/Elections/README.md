# Phase 4.5: Voting & Elections

## Overview

The Voting & Elections module provides comprehensive digital voting capabilities for associations, including elections with positions and candidates, polls for quick member feedback, and detailed analytics.

## Features

### Elections
- **Election Types**: General elections, by-elections, and referendums
- **Position Management**: Create multiple positions per election (President, Secretary, etc.)
- **Candidate Management**: Admin nominations and self-nominations with approval workflow
- **Voting**: Anonymous or tracked voting with abstain option
- **Results**: Automatic vote counting and result publication

### Polls
- **Poll Types**: Single choice, multiple choice, ranked choice, and yes/no
- **Quick Setup**: Create polls with options in minutes
- **Real-time Results**: View results as responses come in
- **Anonymous Responses**: Option for anonymous polling

## Database Models

### Election
```prisma
model Election {
  id                   Int              @id @default(autoincrement())
  associationId        Int
  title                String
  description          String?
  electionType         ElectionType     @default(GENERAL)
  status               ElectionStatus   @default(DRAFT)
  nominationStartDate  DateTime?
  nominationEndDate    DateTime?
  votingStartDate      DateTime?
  votingEndDate        DateTime?
  resultsPublishedAt   DateTime?
  isAnonymous          Boolean          @default(true)
  allowAbstain         Boolean          @default(true)
  minVotesRequired     Int?
  createdById          Int
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt
}
```

### ElectionPosition
```prisma
model ElectionPosition {
  id            Int       @id @default(autoincrement())
  electionId    Int
  title         String
  description   String?
  maxCandidates Int       @default(1)
  minCandidates Int       @default(1)
  displayOrder  Int       @default(0)
}
```

### Candidate
```prisma
model Candidate {
  id             Int             @id @default(autoincrement())
  positionId     Int
  memberId       Int
  nominatedById  Int?
  manifesto      String?
  status         CandidateStatus @default(PENDING)
  approvedAt     DateTime?
  rejectedReason String?
  createdAt      DateTime        @default(now())
}
```

### Vote
```prisma
model Vote {
  id          Int      @id @default(autoincrement())
  electionId  Int
  positionId  Int
  candidateId Int?
  memberId    Int
  isAbstain   Boolean  @default(false)
  votedAt     DateTime @default(now())
}
```

### Poll
```prisma
model Poll {
  id                     Int        @id @default(autoincrement())
  associationId          Int
  title                  String
  description            String?
  pollType               PollType   @default(SINGLE_CHOICE)
  status                 PollStatus @default(DRAFT)
  startDate              DateTime?
  endDate                DateTime?
  isAnonymous            Boolean    @default(true)
  allowMultipleResponses Boolean    @default(false)
  maxSelections          Int?
  createdById            Int
  createdAt              DateTime   @default(now())
  updatedAt              DateTime   @updatedAt
}
```

## API Endpoints

### Dashboard
- `GET /api/voting/dashboard` - Get voting dashboard statistics
- `GET /api/voting/active` - Get active elections and polls

### Elections
- `GET /api/voting/elections` - List elections with filters
- `POST /api/voting/elections` - Create new election
- `GET /api/voting/elections/:id` - Get election details
- `PUT /api/voting/elections/:id` - Update election
- `DELETE /api/voting/elections/:id` - Delete election (draft only)

### Election Status Actions
- `POST /api/voting/elections/:id/start-nominations` - Open nominations
- `POST /api/voting/elections/:id/close-nominations` - Close nominations
- `POST /api/voting/elections/:id/start-voting` - Start voting
- `POST /api/voting/elections/:id/close-voting` - Close voting
- `POST /api/voting/elections/:id/publish-results` - Publish results
- `POST /api/voting/elections/:id/cancel` - Cancel election
- `GET /api/voting/elections/:id/results` - Get election results

### Positions
- `POST /api/voting/elections/:electionId/positions` - Add position
- `PUT /api/voting/positions/:positionId` - Update position
- `DELETE /api/voting/positions/:positionId` - Delete position

### Candidates
- `GET /api/voting/elections/:electionId/candidates` - List candidates
- `POST /api/voting/elections/:electionId/candidates` - Register candidate (admin)
- `POST /api/voting/elections/:electionId/self-nominate` - Self-nominate
- `POST /api/voting/candidates/:candidateId/approve` - Approve/reject candidate
- `POST /api/voting/candidates/:candidateId/withdraw` - Withdraw candidacy

### Voting
- `POST /api/voting/elections/:electionId/vote` - Cast vote
- `POST /api/voting/elections/:electionId/vote/bulk` - Cast multiple votes
- `GET /api/voting/elections/:electionId/voter-status` - Get voter status

### Polls
- `GET /api/voting/polls` - List polls with filters
- `POST /api/voting/polls` - Create new poll
- `GET /api/voting/polls/:id` - Get poll details
- `PUT /api/voting/polls/:id` - Update poll
- `DELETE /api/voting/polls/:id` - Delete poll (draft only)

### Poll Status Actions
- `POST /api/voting/polls/:id/start` - Start poll
- `POST /api/voting/polls/:id/close` - Close poll
- `POST /api/voting/polls/:id/cancel` - Cancel poll

### Poll Options
- `POST /api/voting/polls/:pollId/options` - Add option
- `DELETE /api/voting/options/:optionId` - Delete option

### Poll Responses
- `POST /api/voting/polls/:pollId/respond` - Submit response
- `GET /api/voting/polls/:pollId/results` - Get poll results

## Permissions

| Permission | Description | Roles |
|------------|-------------|-------|
| `election:view` | View elections and results | admin, treasurer, financial_secretary, member |
| `election:manage` | Create, edit, manage elections | admin |
| `election:nominate` | Nominate self or others | admin, treasurer, financial_secretary, member |
| `election:vote` | Cast votes in elections | admin, treasurer, financial_secretary, member |
| `poll:view` | View polls and results | admin, treasurer, financial_secretary, member |
| `poll:manage` | Create, edit, manage polls | admin |
| `poll:vote` | Respond to polls | admin, treasurer, financial_secretary, member |

## Election Workflow

```
DRAFT → NOMINATIONS_OPEN → NOMINATIONS_CLOSED → VOTING_OPEN → VOTING_CLOSED → RESULTS_PUBLISHED
                                                                    ↓
                                                              CANCELLED (from any state)
```

1. **DRAFT**: Election created, positions can be added/edited
2. **NOMINATIONS_OPEN**: Members can nominate themselves or be nominated
3. **NOMINATIONS_CLOSED**: No more nominations, candidates can be approved/rejected
4. **VOTING_OPEN**: Members can cast votes
5. **VOTING_CLOSED**: Voting ended, results being calculated
6. **RESULTS_PUBLISHED**: Results visible to all members

## Poll Workflow

```
DRAFT → ACTIVE → CLOSED
           ↓
      CANCELLED
```

1. **DRAFT**: Poll created, options can be added/edited
2. **ACTIVE**: Members can submit responses
3. **CLOSED**: Poll ended, final results available

## Frontend Pages

- `/dashboard/governance/voting` - Voting dashboard
- `/dashboard/governance/elections` - Elections list
- `/dashboard/governance/elections/new` - Create election
- `/dashboard/governance/elections/[id]` - Election details & voting
- `/dashboard/governance/elections/[id]/results` - Election results
- `/dashboard/governance/polls` - Polls list
- `/dashboard/governance/polls/new` - Create poll
- `/dashboard/governance/polls/[id]` - Poll details & voting

## Usage Examples

### Creating an Election

```typescript
const election = await createElection({
  title: '2025 Executive Committee Election',
  description: 'Annual election for executive positions',
  electionType: 'GENERAL',
  nominationStartDate: '2025-01-15T09:00:00Z',
  nominationEndDate: '2025-01-22T17:00:00Z',
  votingStartDate: '2025-01-25T09:00:00Z',
  votingEndDate: '2025-01-27T17:00:00Z',
  isAnonymous: true,
  allowAbstain: true,
});

// Add positions
await addPosition(election.id, {
  title: 'President',
  description: 'Lead the association',
  maxCandidates: 1,
});
```

### Creating a Poll

```typescript
const poll = await createPoll({
  title: 'Should we increase monthly dues?',
  description: 'Vote on proposed dues increase from ₦5,000 to ₦7,500',
  pollType: 'YES_NO',
  endDate: '2025-01-20T17:00:00Z',
  isAnonymous: true,
  options: ['Yes', 'No'],
});
```

### Casting a Vote

```typescript
// Single vote
await castVote(electionId, {
  positionId: 1,
  candidateId: 5,
});

// Abstain
await castVote(electionId, {
  positionId: 1,
  isAbstain: true,
});

// Bulk vote (multiple positions)
await bulkCastVotes(electionId, [
  { positionId: 1, candidateId: 5 },
  { positionId: 2, candidateId: 8 },
  { positionId: 3, isAbstain: true },
]);
```

## Security Considerations

1. **Vote Integrity**: Each member can only vote once per position
2. **Anonymous Voting**: When enabled, votes cannot be traced back to voters
3. **Audit Trail**: All actions are logged for accountability
4. **Permission-based Access**: Role-based access control for all operations
5. **Tenant Isolation**: All data is scoped to the association
