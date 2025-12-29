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
      const message = error instanceof Error ? error.message : 'Failed to create election';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to update election';
      return res.status(500).json({ success: false, message });
    }
  },

  async getElection(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const election = await votingService.getElection(associationId, parseInt(id));

      return res.status(200).json({
        success: true,
        data: election,
      });
    } catch (error) {
      console.error('Error fetching election:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch election';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to delete election';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to start nominations';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to close nominations';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to start voting';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to close voting';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to publish results';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to cancel election';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to add position';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to update position';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to delete position';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to register candidate';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to submit nomination';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to process candidate';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to withdraw candidacy';
      return res.status(500).json({ success: false, message });
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
      });

      return res.status(200).json({
        success: true,
        data: candidates,
      });
    } catch (error) {
      console.error('Error listing candidates:', error);
      const message = error instanceof Error ? error.message : 'Failed to list candidates';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to cast vote';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to cast votes';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to get voter status';
      return res.status(500).json({ success: false, message });
    }
  },

  async getElectionResults(req: Request, res: Response) {
    try {
      const { electionId } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const results = await votingService.getElectionResults(associationId, parseInt(electionId));

      return res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error('Error getting election results:', error);
      const message = error instanceof Error ? error.message : 'Failed to get election results';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to create poll';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to update poll';
      return res.status(500).json({ success: false, message });
    }
  },

  async getPoll(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const poll = await votingService.getPoll(associationId, parseInt(id));

      return res.status(200).json({
        success: true,
        data: poll,
      });
    } catch (error) {
      console.error('Error fetching poll:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch poll';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to delete poll';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to start poll';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to close poll';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to cancel poll';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to add option';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to delete option';
      return res.status(500).json({ success: false, message });
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
      const message = error instanceof Error ? error.message : 'Failed to submit response';
      return res.status(500).json({ success: false, message });
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

      const results = await votingService.getPollResults(associationId, parseInt(pollId), memberId);

      return res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error('Error getting poll results:', error);
      const message = error instanceof Error ? error.message : 'Failed to get poll results';
      return res.status(500).json({ success: false, message });
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
