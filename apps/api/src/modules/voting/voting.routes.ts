// ============================================
// PHASE 4.5: VOTING & ELECTIONS ROUTES
// ============================================

import { Router } from 'express';
import { votingController } from './voting.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==========================================
// DASHBOARD ROUTES
// ==========================================

/**
 * Get voting dashboard (admin view)
 * GET /api/voting/dashboard
 */
router.get(
  '/dashboard',
  requireAnyPermission([PERMISSIONS.ELECTION_VIEW, PERMISSIONS.ELECTION_MANAGE]),
  votingController.getDashboard
);

/**
 * Get active voting items (elections and polls)
 * GET /api/voting/active
 */
router.get(
  '/active',
  requirePermission(PERMISSIONS.ELECTION_VIEW),
  votingController.getActiveVotingItems
);

// ==========================================
// ELECTION ROUTES
// ==========================================

/**
 * List all elections
 * GET /api/voting/elections
 */
router.get(
  '/elections',
  requireAnyPermission([PERMISSIONS.ELECTION_VIEW, PERMISSIONS.ELECTION_MANAGE]),
  votingController.listElections
);

/**
 * Create an election (admin only)
 * POST /api/voting/elections
 */
router.post(
  '/elections',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.createElection
);

/**
 * Get a single election
 * GET /api/voting/elections/:id
 */
router.get(
  '/elections/:id',
  requireAnyPermission([PERMISSIONS.ELECTION_VIEW, PERMISSIONS.ELECTION_MANAGE]),
  votingController.getElection
);

/**
 * Update an election (admin only)
 * PUT /api/voting/elections/:id
 */
router.put(
  '/elections/:id',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.updateElection
);

/**
 * Delete an election (admin only)
 * DELETE /api/voting/elections/:id
 */
router.delete(
  '/elections/:id',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.deleteElection
);

// ==========================================
// ELECTION STATUS ROUTES
// ==========================================

/**
 * Start nominations for an election
 * POST /api/voting/elections/:id/start-nominations
 */
router.post(
  '/elections/:id/start-nominations',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.startNominations
);

/**
 * Close nominations for an election
 * POST /api/voting/elections/:id/close-nominations
 */
router.post(
  '/elections/:id/close-nominations',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.closeNominations
);

/**
 * Start voting for an election
 * POST /api/voting/elections/:id/start-voting
 */
router.post(
  '/elections/:id/start-voting',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.startVoting
);

/**
 * Close voting for an election
 * POST /api/voting/elections/:id/close-voting
 */
router.post(
  '/elections/:id/close-voting',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.closeVoting
);

/**
 * Publish election results
 * POST /api/voting/elections/:id/publish-results
 */
router.post(
  '/elections/:id/publish-results',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.publishResults
);

/**
 * Cancel an election
 * POST /api/voting/elections/:id/cancel
 */
router.post(
  '/elections/:id/cancel',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.cancelElection
);

/**
 * Get election results
 * GET /api/voting/elections/:electionId/results
 */
router.get(
  '/elections/:electionId/results',
  requirePermission(PERMISSIONS.ELECTION_VIEW),
  votingController.getElectionResults
);

// ==========================================
// POSITION ROUTES
// ==========================================

/**
 * Add a position to an election
 * POST /api/voting/elections/:electionId/positions
 */
router.post(
  '/elections/:electionId/positions',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.addPosition
);

/**
 * Update a position
 * PUT /api/voting/positions/:positionId
 */
router.put(
  '/positions/:positionId',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.updatePosition
);

/**
 * Delete a position
 * DELETE /api/voting/positions/:positionId
 */
router.delete(
  '/positions/:positionId',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.deletePosition
);

// ==========================================
// CANDIDATE ROUTES
// ==========================================

/**
 * List candidates for an election
 * GET /api/voting/elections/:electionId/candidates
 */
router.get(
  '/elections/:electionId/candidates',
  requirePermission(PERMISSIONS.ELECTION_VIEW),
  votingController.listCandidates
);

/**
 * Register a candidate (admin nominates member)
 * POST /api/voting/elections/:electionId/candidates
 */
router.post(
  '/elections/:electionId/candidates',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.registerCandidate
);

/**
 * Self-nominate for an election (member nominates themselves)
 * POST /api/voting/elections/:electionId/self-nominate
 */
router.post(
  '/elections/:electionId/self-nominate',
  requirePermission(PERMISSIONS.ELECTION_NOMINATE),
  votingController.selfNominate
);

/**
 * Approve or reject a candidate
 * POST /api/voting/candidates/:candidateId/approve
 */
router.post(
  '/candidates/:candidateId/approve',
  requirePermission(PERMISSIONS.ELECTION_MANAGE),
  votingController.approveCandidate
);

/**
 * Withdraw candidacy (candidate withdraws themselves)
 * POST /api/voting/candidates/:candidateId/withdraw
 */
router.post(
  '/candidates/:candidateId/withdraw',
  requirePermission(PERMISSIONS.ELECTION_NOMINATE),
  votingController.withdrawCandidate
);

// ==========================================
// VOTING ROUTES
// ==========================================

/**
 * Cast a vote in an election
 * POST /api/voting/elections/:electionId/vote
 */
router.post(
  '/elections/:electionId/vote',
  requirePermission(PERMISSIONS.ELECTION_VOTE),
  votingController.castVote
);

/**
 * Cast multiple votes at once (for multi-position elections)
 * POST /api/voting/elections/:electionId/vote/bulk
 */
router.post(
  '/elections/:electionId/vote/bulk',
  requirePermission(PERMISSIONS.ELECTION_VOTE),
  votingController.bulkCastVotes
);

/**
 * Get voter status (which positions voted for)
 * GET /api/voting/elections/:electionId/voter-status
 */
router.get(
  '/elections/:electionId/voter-status',
  requirePermission(PERMISSIONS.ELECTION_VOTE),
  votingController.getVoterStatus
);

// ==========================================
// POLL ROUTES
// ==========================================

/**
 * List all polls
 * GET /api/voting/polls
 */
router.get(
  '/polls',
  requireAnyPermission([PERMISSIONS.POLL_VIEW, PERMISSIONS.POLL_MANAGE]),
  votingController.listPolls
);

/**
 * Create a poll (admin only)
 * POST /api/voting/polls
 */
router.post(
  '/polls',
  requirePermission(PERMISSIONS.POLL_MANAGE),
  votingController.createPoll
);

/**
 * Get a single poll
 * GET /api/voting/polls/:id
 */
router.get(
  '/polls/:id',
  requireAnyPermission([PERMISSIONS.POLL_VIEW, PERMISSIONS.POLL_MANAGE]),
  votingController.getPoll
);

/**
 * Update a poll (admin only)
 * PUT /api/voting/polls/:id
 */
router.put(
  '/polls/:id',
  requirePermission(PERMISSIONS.POLL_MANAGE),
  votingController.updatePoll
);

/**
 * Delete a poll (admin only)
 * DELETE /api/voting/polls/:id
 */
router.delete(
  '/polls/:id',
  requirePermission(PERMISSIONS.POLL_MANAGE),
  votingController.deletePoll
);

// ==========================================
// POLL STATUS ROUTES
// ==========================================

/**
 * Start a poll
 * POST /api/voting/polls/:id/start
 */
router.post(
  '/polls/:id/start',
  requirePermission(PERMISSIONS.POLL_MANAGE),
  votingController.startPoll
);

/**
 * Close a poll
 * POST /api/voting/polls/:id/close
 */
router.post(
  '/polls/:id/close',
  requirePermission(PERMISSIONS.POLL_MANAGE),
  votingController.closePoll
);

/**
 * Cancel a poll
 * POST /api/voting/polls/:id/cancel
 */
router.post(
  '/polls/:id/cancel',
  requirePermission(PERMISSIONS.POLL_MANAGE),
  votingController.cancelPoll
);

// ==========================================
// POLL OPTION ROUTES
// ==========================================

/**
 * Add an option to a poll
 * POST /api/voting/polls/:pollId/options
 */
router.post(
  '/polls/:pollId/options',
  requirePermission(PERMISSIONS.POLL_MANAGE),
  votingController.addPollOption
);

/**
 * Delete a poll option
 * DELETE /api/voting/options/:optionId
 */
router.delete(
  '/options/:optionId',
  requirePermission(PERMISSIONS.POLL_MANAGE),
  votingController.deletePollOption
);

// ==========================================
// POLL RESPONSE ROUTES
// ==========================================

/**
 * Submit a response to a poll
 * POST /api/voting/polls/:pollId/respond
 */
router.post(
  '/polls/:pollId/respond',
  requirePermission(PERMISSIONS.POLL_VOTE),
  votingController.submitPollResponse
);

/**
 * Get poll results
 * GET /api/voting/polls/:pollId/results
 */
router.get(
  '/polls/:pollId/results',
  requirePermission(PERMISSIONS.POLL_VIEW),
  votingController.getPollResults
);

export default router;
