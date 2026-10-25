// ============================================
// PHASE 4.5: VOTING & ELECTIONS CONTROLLER
// ============================================

import { Request, Response } from 'express';
import { z } from 'zod';
import { votingService } from './voting.service';
import {
  createElectionSchema,
  updateElectionSchema,
  electionQuerySchema,
  addPositionSchema,
  updatePositionSchema,
  registerCandidateSchema,
  selfNominateSchema,
  approveCandidateSchema,
  withdrawCandidateSchema,
  castVoteSchema,
  bulkCastVoteSchema,
  createPollSchema,
  updatePollSchema,
  pollQuerySchema,
  submitPollResponseSchema,
  addPollOptionSchema,
} from './voting.validation';
import { prisma } from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { RBACService } from '../../services/rbac.service';
import { eligibilityService } from './eligibility.service';
import { PERMISSIONS } from '../../lib/permissions';

/** Whether the caller holds a permission, so the same screen can show a committee member more than an ordinary member. */
async function can(req: Request, permission: string): Promise<boolean> {
  const context = { userId: req.user!.id, associationId: req.user?.associationId ?? null, platformRole: req.user?.platformRole ?? null };
  return RBACService.hasPermission(context, permission);
}

/** A rule the committee broke answers with its own status and code; a missing record is a 404; anything else is a 500. */
function votingFailure(res: Response, error: unknown, fallback: string) {
  if (error instanceof RuleError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  const message = error instanceof Error ? error.message : fallback;
  if (/not found$/i.test(message)) {
    return res.status(404).json({ success: false, message });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message });
}

export const votingController = {
  // ==========================================
  // ELECTION ENDPOINTS
  // ==========================================

  async createElection(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = createElectionSchema.parse(req.body);
      const election = await votingService.createElection(associationId, userId, validatedData);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CREATE',
          tableName: 'elections',
          recordId: election.id,
          newValues: election,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Election created successfully',
        data: election,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating election:', error);
      return votingFailure(res, error, 'Failed to create election');
    }
  },

  async updateElection(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = updateElectionSchema.parse(req.body);
      const election = await votingService.updateElection(associationId, parseInt(id), validatedData);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'elections',
          recordId: election.id,
          newValues: election,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Election updated successfully',
        data: election,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating election:', error);
      return votingFailure(res, error, 'Failed to update election');
    }
  },

  async getElection(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const election = await votingService.getElection(associationId, parseInt(id), await can(req, PERMISSIONS.ELECTION_RESULTS_VIEW));

      return res.status(200).json({
        success: true,
        data: election,
      });
    } catch (error) {
      console.error('Error fetching election:', error);
      return votingFailure(res, error, 'Failed to fetch election');
    }
  },

  async listElections(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = electionQuerySchema.parse(req.query);
      const result = await votingService.listElections(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        status: queryParams.status,
        electionType: queryParams.electionType,
        search: queryParams.search,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing elections:', error);
      return res.status(500).json({ success: false, message: 'Failed to list elections' });
    }
  },

  async deleteElection(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      await votingService.deleteElection(associationId, parseInt(id));

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'DELETE',
          tableName: 'elections',
          recordId: parseInt(id),
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Election deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting election:', error);
      return votingFailure(res, error, 'Failed to delete election');
    }
  },

  // ==========================================
  // ELECTION STATUS ENDPOINTS
  // ==========================================

  async startNominations(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const election = await votingService.startNominations(associationId, parseInt(id), userId);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'elections',
          recordId: parseInt(id),
          newValues: { status: 'NOMINATIONS_OPEN' },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Nominations opened successfully',
        data: election,
      });
    } catch (error) {
      console.error('Error starting nominations:', error);
      return votingFailure(res, error, 'Failed to start nominations');
    }
  },

  async closeNominations(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const election = await votingService.closeNominations(associationId, parseInt(id), userId);

      return res.status(200).json({
        success: true,
        message: 'Nominations closed successfully',
        data: election,
      });
    } catch (error) {
      console.error('Error closing nominations:', error);
      return votingFailure(res, error, 'Failed to close nominations');
    }
  },

  async startVoting(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const election = await votingService.startVoting(associationId, parseInt(id), userId);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'elections',
          recordId: parseInt(id),
          newValues: { status: 'VOTING_OPEN' },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Voting started successfully',
        data: election,
      });
    } catch (error) {
      console.error('Error starting voting:', error);
      return votingFailure(res, error, 'Failed to start voting');
    }
  },

  async closeVoting(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const election = await votingService.closeVoting(associationId, parseInt(id), userId);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'elections',
          recordId: parseInt(id),
          newValues: { status: 'VOTING_CLOSED' },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Voting closed successfully',
        data: election,
      });
    } catch (error) {
      console.error('Error closing voting:', error);
      return votingFailure(res, error, 'Failed to close voting');
    }
  },

  async publishResults(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const election = await votingService.publishResults(associationId, parseInt(id), userId);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'elections',
          recordId: parseInt(id),
          newValues: { status: 'RESULTS_PUBLISHED' },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Results published successfully',
        data: election,
      });
    } catch (error) {
      console.error('Error publishing results:', error);
      return votingFailure(res, error, 'Failed to publish results');
    }
  },

  async cancelElection(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      if (!reason) {
        return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
      }

      const election = await votingService.cancelElection(associationId, parseInt(id), userId, reason);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'elections',
          recordId: parseInt(id),
          newValues: { status: 'CANCELLED', reason },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Election cancelled successfully',
        data: election,
      });
    } catch (error) {
      console.error('Error cancelling election:', error);
      return votingFailure(res, error, 'Failed to cancel election');
    }
  },

  // ==========================================
  // POSITION ENDPOINTS
  // ==========================================

  async addPosition(req: Request, res: Response) {
    try {
      const { electionId } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = addPositionSchema.parse(req.body);
      const position = await votingService.addPosition(associationId, parseInt(electionId), validatedData);

      return res.status(201).json({
        success: true,
        message: 'Position added successfully',
        data: position,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error adding position:', error);
      return votingFailure(res, error, 'Failed to add position');
    }
  },

  async updatePosition(req: Request, res: Response) {
    try {
      const { positionId } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = updatePositionSchema.parse(req.body);
      const position = await votingService.updatePosition(associationId, parseInt(positionId), validatedData);

      return res.status(200).json({
        success: true,
        message: 'Position updated successfully',
        data: position,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating position:', error);
      return votingFailure(res, error, 'Failed to update position');
    }
  },

  async deletePosition(req: Request, res: Response) {
    try {
      const { positionId } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      await votingService.deletePosition(associationId, parseInt(positionId));

      return res.status(200).json({
        success: true,
        message: 'Position deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting position:', error);
      return votingFailure(res, error, 'Failed to delete position');
    }
  },

  // ==========================================
  // CANDIDATE ENDPOINTS
  // ==========================================

  async registerCandidate(req: Request, res: Response) {
    try {
      const { electionId } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = registerCandidateSchema.parse(req.body);
      const candidate = await votingService.registerCandidate(
        associationId,
        parseInt(electionId),
        userId,
        validatedData
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CREATE',
          tableName: 'candidates',
          recordId: candidate.id,
          newValues: candidate,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Candidate registered successfully',
        data: candidate,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error registering candidate:', error);
      return votingFailure(res, error, 'Failed to register candidate');
    }
  },

  async selfNominate(req: Request, res: Response) {
    try {
      const { electionId } = req.params;
      const associationId = req.user?.associationId;
      const memberId = req.user?.memberId;

      if (!associationId || !memberId) {
        return res.status(400).json({ success: false, message: 'Association and member ID required' });
      }

      const validatedData = selfNominateSchema.parse(req.body);
      const candidate = await votingService.selfNominate(
        associationId,
        parseInt(electionId),
        memberId,
        validatedData
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user?.id || 0,
          action: 'CREATE',
          tableName: 'candidates',
          recordId: candidate.id,
          newValues: { ...candidate, selfNominated: true },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Self-nomination submitted successfully',
        data: candidate,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error self-nominating:', error);
      return votingFailure(res, error, 'Failed to submit nomination');
    }
  },

  async approveCandidate(req: Request, res: Response) {
    try {
      const { candidateId } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = approveCandidateSchema.parse(req.body);
      const candidate = await votingService.approveCandidate(
        associationId,
        parseInt(candidateId),
        userId,
        validatedData
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'candidates',
          recordId: parseInt(candidateId),
          newValues: { status: validatedData.status },
        },
      });

      return res.status(200).json({
        success: true,
        message: `Candidate ${validatedData.status.toLowerCase()} successfully`,
        data: candidate,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error approving candidate:', error);
      return votingFailure(res, error, 'Failed to process candidate');
    }
  },

  async withdrawCandidate(req: Request, res: Response) {
    try {
      const { candidateId } = req.params;
      const associationId = req.user?.associationId;
      const memberId = req.user?.memberId;

      if (!associationId || !memberId) {
        return res.status(400).json({ success: false, message: 'Association and member ID required' });
      }

      const validatedData = withdrawCandidateSchema.parse(req.body);
      const candidate = await votingService.withdrawCandidate(
        associationId,
        parseInt(candidateId),
        memberId,
        validatedData
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user?.id || 0,
          action: 'UPDATE',
          tableName: 'candidates',
          recordId: parseInt(candidateId),
          newValues: { status: 'WITHDRAWN' },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Candidacy withdrawn successfully',
        data: candidate,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error withdrawing candidate:', error);
      return votingFailure(res, error, 'Failed to withdraw candidacy');
    }
  },

  async listCandidates(req: Request, res: Response) {
    try {
      const { electionId } = req.params;
      const { positionId, status } = req.query;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const candidates = await votingService.listCandidates(associationId, parseInt(electionId), {
        positionId: positionId ? parseInt(positionId as string) : undefined,
        status: status as string | undefined,
      }, await can(req, PERMISSIONS.ELECTION_RESULTS_VIEW));

      return res.status(200).json({
        success: true,
        data: candidates,
      });
    } catch (error) {
      console.error('Error listing candidates:', error);
      return votingFailure(res, error, 'Failed to list candidates');
    }
  },


  // ==========================================
  // VOTING ENDPOINTS
  // ==========================================

  async castVote(req: Request, res: Response) {
    try {
      const { electionId } = req.params;
      const associationId = req.user?.associationId;
      const memberId = req.user?.memberId;

      if (!associationId || !memberId) {
        return res.status(400).json({ success: false, message: 'Association and member ID required' });
      }

      const validatedData = castVoteSchema.parse(req.body);
      const result = await votingService.castVote(
        associationId,
        parseInt(electionId),
        memberId,
        validatedData
      );

      // Note: We don't log individual votes to maintain anonymity
      // Only log that a vote was cast

      return res.status(200).json({
        success: true,
        message: result.message,
        data: { voteHash: result.voteHash },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error casting vote:', error);
      return votingFailure(res, error, 'Failed to cast vote');
    }
  },

  async bulkCastVotes(req: Request, res: Response) {
    try {
      const { electionId } = req.params;
      const associationId = req.user?.associationId;
      const memberId = req.user?.memberId;

      if (!associationId || !memberId) {
        return res.status(400).json({ success: false, message: 'Association and member ID required' });
      }

      const validatedData = bulkCastVoteSchema.parse(req.body);
      const results = await votingService.bulkCastVotes(
        associationId,
        parseInt(electionId),
        memberId,
        validatedData
      );

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      return res.status(200).json({
        success: true,
        message: `${successCount} votes cast successfully${failCount > 0 ? `, ${failCount} failed` : ''}`,
        data: results,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error casting bulk votes:', error);
      return votingFailure(res, error, 'Failed to cast votes');
    }
  },

  async getVoterStatus(req: Request, res: Response) {
    try {
      const { electionId } = req.params;
      const associationId = req.user?.associationId;
      const memberId = req.user?.memberId;

      if (!associationId || !memberId) {
        return res.status(400).json({ success: false, message: 'Association and member ID required' });
      }

      const status = await votingService.getVoterStatus(associationId, parseInt(electionId), memberId);

      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Error getting voter status:', error);
      return votingFailure(res, error, 'Failed to get voter status');
    }
  },

  async searchCandidateMembers(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const members = await votingService.searchCandidateMembers(
        associationId,
        typeof req.query.search === 'string' ? req.query.search : undefined,
        parseInt(req.query.limit as string) || 20,
      );

      return res.status(200).json({ success: true, data: members });
    } catch (error) {
      return votingFailure(res, error, 'Failed to search members');
    }
  },

  // ==========================================
  // WHO CAN VOTE AND WHO CAN STAND
  // ==========================================

  async getMyEligibility(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = req.user?.memberId;

      if (!associationId || !memberId) {
        return res.status(400).json({ success: false, message: 'Association and member ID required' });
      }

      const data = await eligibilityService.myEligibility(associationId, parseInt(req.params.electionId), memberId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return votingFailure(res, error, 'Failed to check eligibility');
    }
  },

  async getEligibility(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });

      const data = await eligibilityService.getForElection(associationId, parseInt(req.params.electionId));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return votingFailure(res, error, 'Failed to get the rules');
    }
  },

  async setEligibility(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) return res.status(400).json({ success: false, message: 'Association ID is required' });

      const electionId = parseInt(req.params.electionId);
      const data = await eligibilityService.setForElection(associationId, electionId, req.body?.rules);

      await prisma.auditLog.create({
        data: { associationId, userId, action: 'UPDATE', tableName: 'elections', recordId: electionId, newValues: { eligibilityRules: data.rules } as any },
      });
      return res.status(200).json({ success: true, message: 'Rules saved', data });
    } catch (error) {
      return votingFailure(res, error, 'Failed to save the rules');
    }
  },

  async addEligibilityException(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) return res.status(400).json({ success: false, message: 'Association ID is required' });

      const body = z
        .object({ memberId: z.number().int().positive(), scope: z.enum(['VOTE', 'STAND']), kind: z.enum(['ALLOW', 'BAR']), reason: z.string().trim().min(3, 'Say why — the reason stays on record').max(500) })
        .parse(req.body);
      const electionId = parseInt(req.params.electionId);
      const exception = await eligibilityService.addException(associationId, electionId, userId, body);

      await prisma.auditLog.create({
        data: { associationId, userId, action: 'CREATE', tableName: 'election_eligibility_exceptions', recordId: exception.id, newValues: { electionId, ...body } as any },
      });
      return res.status(201).json({ success: true, data: exception });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.errors[0]?.message ?? 'Validation error', errors: error.errors });
      }
      return votingFailure(res, error, 'Failed to save the exception');
    }
  },

  async removeEligibilityException(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) return res.status(400).json({ success: false, message: 'Association ID is required' });

      const exceptionId = parseInt(req.params.exceptionId);
      await eligibilityService.removeException(associationId, exceptionId);

      await prisma.auditLog.create({
        data: { associationId, userId, action: 'DELETE', tableName: 'election_eligibility_exceptions', recordId: exceptionId },
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      return votingFailure(res, error, 'Failed to remove the exception');
    }
  },

  async previewEligibility(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });

      const data = await eligibilityService.preview(associationId, req.body?.rules);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return votingFailure(res, error, 'Failed to preview the rules');
    }
  },

  async getEligibilityTemplate(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });

      return res.status(200).json({ success: true, data: { rules: await eligibilityService.getTemplate(associationId) } });
    } catch (error) {
      return votingFailure(res, error, 'Failed to get the template');
    }
  },

  async setEligibilityTemplate(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) return res.status(400).json({ success: false, message: 'Association ID is required' });

      const rules = await eligibilityService.setTemplate(associationId, userId, req.body?.rules);

      await prisma.auditLog.create({
        data: { associationId, userId, action: 'UPDATE', tableName: 'settings', newValues: { electionEligibilityTemplate: rules } as any },
      });
      return res.status(200).json({ success: true, message: 'Template saved', data: { rules } });
    } catch (error) {
      return votingFailure(res, error, 'Failed to save the template');
    }
  },

  async getEligibilityOptions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });

      return res.status(200).json({ success: true, data: await eligibilityService.options(associationId) });
    } catch (error) {
      return votingFailure(res, error, 'Failed to get the options');
    }
  },

  async getElectionProgress(req: Request, res: Response) {
    try {
      const { electionId } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const progress = await votingService.getElectionProgress(associationId, parseInt(electionId));

      return res.status(200).json({ success: true, data: progress });
    } catch (error) {
      return votingFailure(res, error, 'Failed to get election progress');
    }
  },

  async getElectionResults(req: Request, res: Response) {
    try {
      const { electionId } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const results = await votingService.getElectionResults(associationId, parseInt(electionId), await can(req, PERMISSIONS.ELECTION_RESULTS_VIEW));

      return res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error('Error getting election results:', error);
      return votingFailure(res, error, 'Failed to get election results');
    }
  },

  // ==========================================
  // POLL ENDPOINTS
  // ==========================================

  async createPoll(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = createPollSchema.parse(req.body);
      const poll = await votingService.createPoll(associationId, userId, validatedData);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CREATE',
          tableName: 'polls',
          recordId: poll.id,
          newValues: poll,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Poll created successfully',
        data: poll,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating poll:', error);
      return votingFailure(res, error, 'Failed to create poll');
    }
  },

  async updatePoll(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = updatePollSchema.parse(req.body);
      const poll = await votingService.updatePoll(associationId, parseInt(id), validatedData);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'polls',
          recordId: poll.id,
          newValues: poll,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Poll updated successfully',
        data: poll,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating poll:', error);
      return votingFailure(res, error, 'Failed to update poll');
    }
  },

  async getPoll(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const poll = await votingService.getPoll(associationId, parseInt(id), await can(req, PERMISSIONS.POLL_MANAGE));

      return res.status(200).json({
        success: true,
        data: poll,
      });
    } catch (error) {
      console.error('Error fetching poll:', error);
      return votingFailure(res, error, 'Failed to fetch poll');
    }
  },

  async listPolls(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = pollQuerySchema.parse(req.query);
      const result = await votingService.listPolls(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        status: queryParams.status,
        pollType: queryParams.pollType,
        search: queryParams.search,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing polls:', error);
      return res.status(500).json({ success: false, message: 'Failed to list polls' });
    }
  },

  async deletePoll(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      await votingService.deletePoll(associationId, parseInt(id));

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'DELETE',
          tableName: 'polls',
          recordId: parseInt(id),
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Poll deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting poll:', error);
      return votingFailure(res, error, 'Failed to delete poll');
    }
  },

  // ==========================================
  // POLL STATUS ENDPOINTS
  // ==========================================

  async startPoll(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const poll = await votingService.startPoll(associationId, parseInt(id));

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'polls',
          recordId: parseInt(id),
          newValues: { status: 'ACTIVE' },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Poll started successfully',
        data: poll,
      });
    } catch (error) {
      console.error('Error starting poll:', error);
      return votingFailure(res, error, 'Failed to start poll');
    }
  },

  async closePoll(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const poll = await votingService.closePoll(associationId, parseInt(id));

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'polls',
          recordId: parseInt(id),
          newValues: { status: 'CLOSED' },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Poll closed successfully',
        data: poll,
      });
    } catch (error) {
      console.error('Error closing poll:', error);
      return votingFailure(res, error, 'Failed to close poll');
    }
  },

  async cancelPoll(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const poll = await votingService.cancelPoll(associationId, parseInt(id));

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'polls',
          recordId: parseInt(id),
          newValues: { status: 'CANCELLED' },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Poll cancelled successfully',
        data: poll,
      });
    } catch (error) {
      console.error('Error cancelling poll:', error);
      return votingFailure(res, error, 'Failed to cancel poll');
    }
  },

  // ==========================================
  // POLL OPTION ENDPOINTS
  // ==========================================

  async addPollOption(req: Request, res: Response) {
    try {
      const { pollId } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = addPollOptionSchema.parse(req.body);
      const option = await votingService.addPollOption(associationId, parseInt(pollId), validatedData);

      return res.status(201).json({
        success: true,
        message: 'Option added successfully',
        data: option,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error adding poll option:', error);
      return votingFailure(res, error, 'Failed to add option');
    }
  },

  async deletePollOption(req: Request, res: Response) {
    try {
      const { optionId } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      await votingService.deletePollOption(associationId, parseInt(optionId));

      return res.status(200).json({
        success: true,
        message: 'Option deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting poll option:', error);
      return votingFailure(res, error, 'Failed to delete option');
    }
  },

  // ==========================================
  // POLL RESPONSE ENDPOINTS
  // ==========================================

  async submitPollResponse(req: Request, res: Response) {
    try {
      const { pollId } = req.params;
      const associationId = req.user?.associationId;
      const memberId = req.user?.memberId;

      if (!associationId || !memberId) {
        return res.status(400).json({ success: false, message: 'Association and member ID required' });
      }

      const validatedData = submitPollResponseSchema.parse(req.body);
      const result = await votingService.submitPollResponse(
        associationId,
        parseInt(pollId),
        memberId,
        validatedData
      );

      return res.status(200).json({
        success: true,
        message: result.message,
        data: { responseHash: result.responseHash },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error submitting poll response:', error);
      return votingFailure(res, error, 'Failed to submit response');
    }
  },

  async getPollResults(req: Request, res: Response) {
    try {
      const { pollId } = req.params;
      const associationId = req.user?.associationId;
      const memberId = req.user?.memberId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const results = await votingService.getPollResults(associationId, parseInt(pollId), memberId, await can(req, PERMISSIONS.POLL_MANAGE));

      return res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error('Error getting poll results:', error);
      return votingFailure(res, error, 'Failed to get poll results');
    }
  },

  // ==========================================
  // DASHBOARD ENDPOINTS
  // ==========================================

  async getDashboard(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const dashboard = await votingService.getDashboard(associationId);

      return res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      console.error('Error fetching voting dashboard:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
    }
  },

  async getActiveVotingItems(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const items = await votingService.getActiveVotingItems(associationId);

      return res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      console.error('Error fetching active voting items:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch active items' });
    }
  },
};
