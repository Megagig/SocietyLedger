# Voting & Elections - Manual Testing Guide

## Prerequisites

1. Running API server (`npm run dev` in `apps/api`)
2. Running web app (`npm run dev` in `apps/web`)
3. At least one association with members
4. Admin user account for management operations
5. Member user accounts for voting operations

## Test Scenarios

### 1. Election Management (Admin)

#### 1.1 Create Election
1. Navigate to `/dashboard/governance/voting`
2. Click "New Election"
3. Fill in election details:
   - Title: "2025 Executive Committee Election"
   - Description: "Annual election for executive positions"
   - Type: General Election
   - Nomination dates (optional)
   - Voting dates (optional)
   - Check "Anonymous voting"
   - Check "Allow abstaining"
4. Click "Continue to Positions"
5. Add positions:
   - Position 1: "President" (Max winners: 1)
   - Position 2: "Vice President" (Max winners: 1)
   - Position 3: "Secretary" (Max winners: 1)
6. Click "Save Positions"

**Expected**: Election created in DRAFT status with 3 positions

#### 1.2 Election Workflow
1. From election detail page, click "Open Nominations"
   - **Expected**: Status changes to NOMINATIONS_OPEN
2. Add candidates (see section 2)
3. Click "Close Nominations"
   - **Expected**: Status changes to NOMINATIONS_CLOSED
4. Click "Start Voting"
   - **Expected**: Status changes to VOTING_OPEN
5. Cast votes (see section 3)
6. Click "Close Voting"
   - **Expected**: Status changes to VOTING_CLOSED
7. Click "Publish Results"
   - **Expected**: Status changes to RESULTS_PUBLISHED

#### 1.3 Cancel Election
1. Create a new election in DRAFT status
2. Click "Cancel" button
3. Confirm cancellation

**Expected**: Election status changes to CANCELLED

### 2. Candidate Management

#### 2.1 Admin Nominates Candidate
1. Open an election with NOMINATIONS_OPEN status
2. Click "Add Candidate"
3. Select a position
4. Select a member
5. Add manifesto (optional)
6. Submit

**Expected**: Candidate added with PENDING status

#### 2.2 Self-Nomination (Member)
1. Log in as a regular member
2. Navigate to election detail page
3. Click "Nominate Yourself" for a position
4. Add manifesto
5. Submit

**Expected**: Candidate added with PENDING status

#### 2.3 Approve/Reject Candidate (Admin)
1. Log in as admin
2. Navigate to election with pending candidates
3. Click on a pending candidate
4. Click "Approve" or "Reject"
5. If rejecting, provide reason

**Expected**: Candidate status changes to APPROVED or REJECTED

#### 2.4 Withdraw Candidacy
1. Log in as a candidate
2. Navigate to election detail page
3. Click "Withdraw" on your candidacy
4. Confirm withdrawal

**Expected**: Candidate status changes to WITHDRAWN

### 3. Voting

#### 3.1 Cast Single Vote
1. Log in as a member
2. Navigate to election with VOTING_OPEN status
3. Select a candidate for a position
4. Click "Submit Vote"

**Expected**: Vote recorded, position marked as voted

#### 3.2 Cast Abstain Vote
1. Navigate to election with VOTING_OPEN status
2. Select "Abstain" for a position
3. Click "Submit Vote"

**Expected**: Abstain vote recorded

#### 3.3 Vote for Multiple Positions
1. Navigate to election with multiple positions
2. Vote for each position (candidate or abstain)
3. Submit each vote

**Expected**: All votes recorded, voter status shows all positions voted

#### 3.4 Prevent Double Voting
1. After voting for a position
2. Try to vote again for the same position

**Expected**: Error message "You have already voted for this position"

### 4. Election Results

#### 4.1 View Results (After Publishing)
1. Navigate to election with RESULTS_PUBLISHED status
2. Click "View Results"

**Expected**: Results page shows:
- Vote counts per candidate
- Percentage of votes
- Winner highlighted
- Total voter turnout

#### 4.2 Results Before Publishing
1. Navigate to election with VOTING_CLOSED status (not published)
2. Try to access results

**Expected**: Results visible to admin only, not to regular members

### 5. Poll Management

#### 5.1 Create Single Choice Poll
1. Navigate to `/dashboard/governance/polls`
2. Click "New Poll"
3. Fill in:
   - Question: "Should we increase monthly dues?"
   - Type: Single Choice
   - Options: "Yes, increase to ₦7,500", "No, keep at ₦5,000", "Abstain"
   - End date: 1 week from now
   - Check "Anonymous responses"
4. Click "Create Poll"

**Expected**: Poll created in DRAFT status

#### 5.2 Create Multiple Choice Poll
1. Create new poll
2. Select "Multiple Choice" type
3. Set max selections to 3
4. Add 5 options
5. Create poll

**Expected**: Poll created with multiple choice settings

#### 5.3 Create Yes/No Poll
1. Create new poll
2. Select "Yes/No" type

**Expected**: Options auto-populated with "Yes" and "No"

#### 5.4 Poll Workflow
1. From poll detail page, click "Start Poll"
   - **Expected**: Status changes to ACTIVE
2. Submit responses (see section 6)
3. Click "Close Poll"
   - **Expected**: Status changes to CLOSED

### 6. Poll Responses

#### 6.1 Submit Single Choice Response
1. Navigate to active poll (single choice)
2. Select one option
3. Click "Submit Vote"

**Expected**: Response recorded, results updated

#### 6.2 Submit Multiple Choice Response
1. Navigate to active poll (multiple choice)
2. Select multiple options (within max limit)
3. Click "Submit Vote"

**Expected**: Response recorded with all selected options

#### 6.3 Exceed Max Selections
1. Navigate to multiple choice poll with max selections = 2
2. Try to select 3 options

**Expected**: Error message "You can only select up to 2 options"

#### 6.4 View Poll Results
1. Navigate to active or closed poll
2. View results section

**Expected**: Results show:
- Response count per option
- Percentage breakdown
- Total responses

### 7. Dashboard

#### 7.1 Voting Dashboard
1. Navigate to `/dashboard/governance/voting`

**Expected**: Dashboard shows:
- Total elections count
- Active elections count
- Total polls count
- Active polls count
- List of active elections
- List of active polls
- Quick action cards

### 8. Edge Cases

#### 8.1 Election with No Candidates
1. Create election with positions
2. Start voting without adding candidates

**Expected**: Error "Cannot start voting without approved candidates"

#### 8.2 Election with Insufficient Candidates
1. Create position with minCandidates = 2
2. Approve only 1 candidate
3. Try to start voting

**Expected**: Warning about insufficient candidates

#### 8.3 Voting After End Date
1. Create election with past voting end date
2. Try to cast vote

**Expected**: Error "Voting period has ended"

#### 8.4 Poll Response After End Date
1. Create poll with past end date
2. Try to submit response

**Expected**: Error "Poll has ended"

#### 8.5 Delete Election with Votes
1. Try to delete election that has votes

**Expected**: Error "Cannot delete election with existing votes"

### 9. Permission Tests

#### 9.1 Member Cannot Manage Elections
1. Log in as regular member
2. Try to access election management endpoints

**Expected**: 403 Forbidden

#### 9.2 Member Can Vote
1. Log in as regular member
2. Navigate to active election
3. Cast vote

**Expected**: Vote recorded successfully

#### 9.3 Member Can Self-Nominate
1. Log in as regular member
2. Navigate to election with open nominations
3. Self-nominate

**Expected**: Nomination submitted successfully

### 10. API Testing (curl/Postman)

#### 10.1 Get Voting Dashboard
```bash
curl -X GET http://localhost:4000/api/voting/dashboard \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>"
```

#### 10.2 Create Election
```bash
curl -X POST http://localhost:4000/api/voting/elections \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Election",
    "electionType": "GENERAL",
    "isAnonymous": true,
    "allowAbstain": true
  }'
```

#### 10.3 Cast Vote
```bash
curl -X POST http://localhost:4000/api/voting/elections/1/vote \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>" \
  -H "Content-Type: application/json" \
  -d '{
    "positionId": 1,
    "candidateId": 5
  }'
```

#### 10.4 Create Poll
```bash
curl -X POST http://localhost:4000/api/voting/polls \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant: <subdomain>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Poll",
    "pollType": "YES_NO",
    "isAnonymous": true,
    "options": ["Yes", "No"]
  }'
```

## Troubleshooting

### Common Issues

1. **"Election not found"**
   - Verify election ID exists
   - Check tenant context (X-Tenant header)

2. **"Permission denied"**
   - Verify user role has required permission
   - Check if user is authenticated

3. **"Cannot vote - election not in voting phase"**
   - Verify election status is VOTING_OPEN
   - Check voting dates

4. **"Already voted for this position"**
   - User has already cast a vote
   - Check voter status endpoint

5. **"Invalid candidate for position"**
   - Candidate must be approved
   - Candidate must belong to the specified position

## Test Data Cleanup

After testing, clean up test data:

```sql
-- Delete test votes
DELETE FROM "Vote" WHERE "electionId" IN (SELECT id FROM "Election" WHERE title LIKE 'Test%');

-- Delete test candidates
DELETE FROM "Candidate" WHERE "positionId" IN (
  SELECT id FROM "ElectionPosition" WHERE "electionId" IN (
    SELECT id FROM "Election" WHERE title LIKE 'Test%'
  )
);

-- Delete test positions
DELETE FROM "ElectionPosition" WHERE "electionId" IN (
  SELECT id FROM "Election" WHERE title LIKE 'Test%'
);

-- Delete test elections
DELETE FROM "Election" WHERE title LIKE 'Test%';

-- Delete test poll responses
DELETE FROM "PollResponse" WHERE "pollId" IN (SELECT id FROM "Poll" WHERE title LIKE 'Test%');

-- Delete test poll options
DELETE FROM "PollOption" WHERE "pollId" IN (SELECT id FROM "Poll" WHERE title LIKE 'Test%');

-- Delete test polls
DELETE FROM "Poll" WHERE title LIKE 'Test%';
```
