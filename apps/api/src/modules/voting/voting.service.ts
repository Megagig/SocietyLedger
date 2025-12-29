// ============================================
// PHASE 4.5: VOTING & ELECTIONS SERVICE
// ============================================

import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import crypto from 'crypto';
import {
  CreateElectionInput,
  UpdateElectionInput,
  AddPositionInput,
  UpdatePositionInput,
  RegisterCandidateInput,
  SelfNominateInput,
  ApproveCandidateInput,
  WithdrawCandidateInput,
  CastVoteInput,
  BulkCastVoteInput,
  CreatePollInput,
  UpdatePollInput,
  SubmitPollResponseInput,
  AddPollOptionInput,
} from './voting.validation';

// Helper to generate vote hash for verification
function generateVoteHash(electionId: number, voterId: number, timestamp: Date): string {
  const data = `${electionId}-${voterId}-${timestamp.toISOString()}-${crypto.randomBytes(16).toString('hex')}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export const votingService = {
  // ==========================================
  // ELECTION MANAGEMENT
  // ==========================================

  async createElection(associationId: number, userId: number, data: CreateElectionInput) {
    // Get eligible voter count (active members)
    const eligibleVoterCount = await prisma.member.count({
      where: { associationId, status: 'active' },
    });

    const election = await prisma.election.create({
      data: {
        associationId,
        title: data.title,
        description: data.description,
        electionType: data.electionType,
        nominationStartDate: data.nominationStartDate ? new Date(data.nominationStartDate) : null,
        nominationEndDate: data.nominationEndDate ? new Date(data.nominationEndDate) : null,
        votingStartDate: new Date(data.votingStartDate),
        votingEndDate: new Date(data.votingEndDate),
        maxVotesPerMember: data.maxVotesPerMember ?? 1,
        allowAbstention: data.allowAbstention ?? true,
        isAnonymous: data.isAnonymous ?? true,
        requiresQuorum: data.requiresQuorum ?? false,
        quorumPercentage: data.quorumPercentage,
        eligibleVoterCount,
        createdBy: userId,
        positions: data.positions && data.positions.length > 0 ? {
          create: data.positions.map((pos, index) => ({
            title: pos.title,
            description: pos.description,
            maxCandidates: pos.maxCandidates ?? 1,
            orderNumber: pos.orderNumber ?? index,
          })),
        } : undefined,
      },
      include: {
        positions: { orderBy: { orderNumber: 'asc' } },
        creator: { select: { id: true, email: true } },
      },
    });

    return election;
  },

  async updateElection(associationId: number, electionId: number, data: UpdateElectionInput) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'DRAFT') {
      throw new Error('Can only edit elections in draft status');
    }

    return prisma.election.update({
      where: { id: electionId },
      data: {
        title: data.title,
        description: data.description,
        electionType: data.electionType,
        nominationStartDate: data.nominationStartDate ? new Date(data.nominationStartDate) : undefined,
        nominationEndDate: data.nominationEndDate ? new Date(data.nominationEndDate) : undefined,
        votingStartDate: data.votingStartDate ? new Date(data.votingStartDate) : undefined,
        votingEndDate: data.votingEndDate ? new Date(data.votingEndDate) : undefined,
        maxVotesPerMember: data.maxVotesPerMember,
        allowAbstention: data.allowAbstention,
        isAnonymous: data.isAnonymous,
        requiresQuorum: data.requiresQuorum,
        quorumPercentage: data.quorumPercentage,
      },
      include: {
        positions: { orderBy: { orderNumber: 'asc' } },
      },
    });
  },

  async getElection(associationId: number, electionId: number) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
      include: {
        positions: {
          orderBy: { orderNumber: 'asc' },
          include: {
            candidates: {
              where: { status: 'APPROVED' },
              include: {
                member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        candidates: {
          include: {
            member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
            position: { select: { id: true, title: true } },
          },
        },
        creator: { select: { id: true, email: true } },
        _count: {
          select: {
            votes: true,
            candidates: true,
          },
        },
      },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    return election;
  },

  async listElections(
    associationId: number,
    params: {
      page: number;
      limit: number;
      status?: string;
      electionType?: string;
      search?: string;
    }
  ) {
    const { page, limit, status, electionType, search } = params;
    const skip = (page - 1) * limit;

    const where: any = { associationId };

    if (status) where.status = status;
    if (electionType) where.electionType = electionType;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [elections, totalCount] = await Promise.all([
      prisma.election.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          positions: { select: { id: true, title: true } },
          _count: {
            select: {
              votes: true,
              candidates: { where: { status: 'APPROVED' } },
            },
          },
        },
      }),
      prisma.election.count({ where }),
    ]);

    return {
      elections,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + elections.length < totalCount,
      },
    };
  },

  async deleteElection(associationId: number, electionId: number) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'DRAFT' && election.status !== 'CANCELLED') {
      throw new Error('Can only delete elections in draft or cancelled status');
    }

    await prisma.election.delete({ where: { id: electionId } });
    return { success: true };
  },

  // ==========================================
  // ELECTION STATUS MANAGEMENT
  // ==========================================

  async startNominations(associationId: number, electionId: number, userId: number) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'DRAFT') {
      throw new Error('Can only start nominations from draft status');
    }

    return prisma.election.update({
      where: { id: electionId },
      data: {
        status: 'NOMINATIONS_OPEN',
        nominationStartDate: election.nominationStartDate || new Date(),
      },
    });
  },

  async closeNominations(associationId: number, electionId: number, userId: number) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
      include: {
        candidates: { where: { status: 'APPROVED' } },
      },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'NOMINATIONS_OPEN') {
      throw new Error('Nominations are not currently open');
    }

    if (election.candidates.length === 0) {
      throw new Error('Cannot close nominations without any approved candidates');
    }

    return prisma.election.update({
      where: { id: electionId },
      data: {
        status: 'DRAFT', // Back to draft until voting starts
        nominationEndDate: new Date(),
      },
    });
  },

  async startVoting(associationId: number, electionId: number, userId: number) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
      include: {
        candidates: { where: { status: 'APPROVED' } },
      },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'DRAFT' && election.status !== 'NOMINATIONS_OPEN') {
      throw new Error('Cannot start voting from current status');
    }

    if (election.candidates.length === 0) {
      throw new Error('Cannot start voting without any approved candidates');
    }

    // Update eligible voter count
    const eligibleVoterCount = await prisma.member.count({
      where: { associationId, status: 'active' },
    });

    return prisma.election.update({
      where: { id: electionId },
      data: {
        status: 'VOTING_OPEN',
        eligibleVoterCount,
        votingStartDate: new Date(),
      },
    });
  },

  async closeVoting(associationId: number, electionId: number, userId: number) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'VOTING_OPEN') {
      throw new Error('Voting is not currently open');
    }

    // Get total votes cast
    const totalVotesCast = await prisma.vote.count({
      where: { electionId },
    });

    return prisma.election.update({
      where: { id: electionId },
      data: {
        status: 'VOTING_CLOSED',
        totalVotesCast,
        votingEndDate: new Date(),
      },
    });
  },

  async publishResults(associationId: number, electionId: number, userId: number) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'VOTING_CLOSED') {
      throw new Error('Voting must be closed before publishing results');
    }

    return prisma.election.update({
      where: { id: electionId },
      data: {
        status: 'RESULTS_PUBLISHED',
        publishedBy: userId,
        publishedAt: new Date(),
      },
    });
  },

  async cancelElection(associationId: number, electionId: number, userId: number, reason: string) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status === 'RESULTS_PUBLISHED') {
      throw new Error('Cannot cancel an election after results are published');
    }

    return prisma.election.update({
      where: { id: electionId },
      data: {
        status: 'CANCELLED',
        cancelledBy: userId,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });
  },

  // ==========================================
  // POSITION MANAGEMENT
  // ==========================================

  async addPosition(associationId: number, electionId: number, data: AddPositionInput) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'DRAFT') {
      throw new Error('Can only add positions to elections in draft status');
    }

    // Get next order number
    const lastPosition = await prisma.electionPosition.findFirst({
      where: { electionId },
      orderBy: { orderNumber: 'desc' },
    });

    const orderNumber = data.orderNumber ?? (lastPosition ? lastPosition.orderNumber + 1 : 0);

    return prisma.electionPosition.create({
      data: {
        electionId,
        title: data.title,
        description: data.description,
        maxCandidates: data.maxCandidates ?? 1,
        orderNumber,
      },
    });
  },

  async updatePosition(associationId: number, positionId: number, data: UpdatePositionInput) {
    const position = await prisma.electionPosition.findFirst({
      where: { id: positionId },
      include: { election: true },
    });

    if (!position || position.election.associationId !== associationId) {
      throw new Error('Position not found');
    }

    if (position.election.status !== 'DRAFT') {
      throw new Error('Can only edit positions in elections with draft status');
    }

    return prisma.electionPosition.update({
      where: { id: positionId },
      data: {
        title: data.title,
        description: data.description,
        maxCandidates: data.maxCandidates,
        orderNumber: data.orderNumber,
      },
    });
  },

  async deletePosition(associationId: number, positionId: number) {
    const position = await prisma.electionPosition.findFirst({
      where: { id: positionId },
      include: { election: true },
    });

    if (!position || position.election.associationId !== associationId) {
      throw new Error('Position not found');
    }

    if (position.election.status !== 'DRAFT') {
      throw new Error('Can only delete positions from elections in draft status');
    }

    await prisma.electionPosition.delete({ where: { id: positionId } });
    return { success: true };
  },

  // ==========================================
  // CANDIDATE MANAGEMENT
  // ==========================================

  async registerCandidate(
    associationId: number,
    electionId: number,
    userId: number,
    data: RegisterCandidateInput
  ) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'DRAFT' && election.status !== 'NOMINATIONS_OPEN') {
      throw new Error('Nominations are not currently open');
    }

    // Verify member exists
    const member = await prisma.member.findFirst({
      where: { id: data.memberId, associationId, status: 'active' },
    });

    if (!member) {
      throw new Error('Member not found or not active');
    }

    // Check if already a candidate for this position
    const existingCandidate = await prisma.candidate.findFirst({
      where: {
        electionId,
        positionId: data.positionId,
        memberId: data.memberId,
        status: { notIn: ['REJECTED', 'WITHDRAWN'] },
      },
    });

    if (existingCandidate) {
      throw new Error('Member is already a candidate for this position');
    }

    // Verify position exists if provided
    if (data.positionId) {
      const position = await prisma.electionPosition.findFirst({
        where: { id: data.positionId, electionId },
      });

      if (!position) {
        throw new Error('Position not found');
      }
    }

    return prisma.candidate.create({
      data: {
        electionId,
        positionId: data.positionId,
        memberId: data.memberId,
        manifesto: data.manifesto,
        photoUrl: data.photoUrl,
        nominatedBy: userId,
        status: 'PENDING',
      },
      include: {
        member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        position: { select: { id: true, title: true } },
      },
    });
  },

  async selfNominate(
    associationId: number,
    electionId: number,
    memberId: number,
    data: SelfNominateInput
  ) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'DRAFT' && election.status !== 'NOMINATIONS_OPEN') {
      throw new Error('Nominations are not currently open');
    }

    // Verify member exists and is active
    const member = await prisma.member.findFirst({
      where: { id: memberId, associationId, status: 'active' },
    });

    if (!member) {
      throw new Error('Member not found or not active');
    }

    // Check if already a candidate for this position
    const existingCandidate = await prisma.candidate.findFirst({
      where: {
        electionId,
        positionId: data.positionId,
        memberId,
        status: { notIn: ['REJECTED', 'WITHDRAWN'] },
      },
    });

    if (existingCandidate) {
      throw new Error('You are already a candidate for this position');
    }

    return prisma.candidate.create({
      data: {
        electionId,
        positionId: data.positionId,
        memberId,
        manifesto: data.manifesto,
        photoUrl: data.photoUrl,
        status: 'PENDING',
      },
      include: {
        member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        position: { select: { id: true, title: true } },
      },
    });
  },

  async approveCandidate(
    associationId: number,
    candidateId: number,
    userId: number,
    data: ApproveCandidateInput
  ) {
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId },
      include: { election: true },
    });

    if (!candidate || candidate.election.associationId !== associationId) {
      throw new Error('Candidate not found');
    }

    if (candidate.status !== 'PENDING') {
      throw new Error('Candidate is not pending approval');
    }

    return prisma.candidate.update({
      where: { id: candidateId },
      data: {
        status: data.status,
        approvedBy: userId,
        approvedAt: new Date(),
        rejectionReason: data.rejectionReason,
      },
      include: {
        member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        position: { select: { id: true, title: true } },
      },
    });
  },

  async withdrawCandidate(
    associationId: number,
    candidateId: number,
    memberId: number,
    data: WithdrawCandidateInput
  ) {
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, memberId },
      include: { election: true },
    });

    if (!candidate || candidate.election.associationId !== associationId) {
      throw new Error('Candidate not found');
    }

    if (candidate.election.status === 'VOTING_CLOSED' || candidate.election.status === 'RESULTS_PUBLISHED') {
      throw new Error('Cannot withdraw after voting has closed');
    }

    return prisma.candidate.update({
      where: { id: candidateId },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
        withdrawalReason: data.withdrawalReason,
      },
    });
  },

  async listCandidates(
    associationId: number,
    electionId: number,
    params: {
      positionId?: number;
      status?: string;
    }
  ) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    const where: any = { electionId };
    if (params.positionId) where.positionId = params.positionId;
    if (params.status) where.status = params.status;

    return prisma.candidate.findMany({
      where,
      include: {
        member: { select: { id: true, memberId: true, firstName: true, lastName: true, email: true } },
        position: { select: { id: true, title: true } },
      },
      orderBy: [{ positionId: 'asc' }, { nominatedAt: 'asc' }],
    });
  },


  // ==========================================
  // VOTING
  // ==========================================

  async castVote(
    associationId: number,
    electionId: number,
    memberId: number,
    data: CastVoteInput
  ) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'VOTING_OPEN') {
      throw new Error('Voting is not currently open');
    }

    // Check voting period
    const now = new Date();
    if (now < election.votingStartDate || now > election.votingEndDate) {
      throw new Error('Voting is not within the allowed time period');
    }

    // Verify member is eligible to vote
    const member = await prisma.member.findFirst({
      where: { id: memberId, associationId, status: 'active' },
    });

    if (!member) {
      throw new Error('Member not found or not eligible to vote');
    }

    // Check if already voted for this position
    const existingVote = await prisma.vote.findFirst({
      where: {
        electionId,
        positionId: data.positionId,
        voterId: memberId,
      },
    });

    if (existingVote) {
      throw new Error('You have already voted for this position');
    }

    // Validate candidate if not abstaining
    if (!data.isAbstention && data.candidateId) {
      const candidate = await prisma.candidate.findFirst({
        where: {
          id: data.candidateId,
          electionId,
          positionId: data.positionId,
          status: 'APPROVED',
        },
      });

      if (!candidate) {
        throw new Error('Invalid candidate selection');
      }
    }

    // Check if abstention is allowed
    if (data.isAbstention && !election.allowAbstention) {
      throw new Error('Abstention is not allowed in this election');
    }

    // Generate vote hash for verification
    const voteHash = generateVoteHash(electionId, memberId, now);

    const vote = await prisma.$transaction(async (tx) => {
      // Create vote
      const newVote = await tx.vote.create({
        data: {
          electionId,
          positionId: data.positionId,
          candidateId: data.isAbstention ? null : data.candidateId,
          voterId: memberId,
          voteHash,
          isAbstention: data.isAbstention ?? false,
        },
      });

      // Update candidate vote count if not abstaining
      if (!data.isAbstention && data.candidateId) {
        await tx.candidate.update({
          where: { id: data.candidateId },
          data: { voteCount: { increment: 1 } },
        });
      }

      // Update election total votes
      await tx.election.update({
        where: { id: electionId },
        data: { totalVotesCast: { increment: 1 } },
      });

      return newVote;
    });

    return {
      success: true,
      voteHash: vote.voteHash,
      message: data.isAbstention ? 'Abstention recorded' : 'Vote cast successfully',
    };
  },

  async bulkCastVotes(
    associationId: number,
    electionId: number,
    memberId: number,
    data: BulkCastVoteInput
  ) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'VOTING_OPEN') {
      throw new Error('Voting is not currently open');
    }

    const results = [];
    for (const vote of data.votes) {
      try {
        const result = await this.castVote(associationId, electionId, memberId, vote);
        results.push({ positionId: vote.positionId, success: true, ...result });
      } catch (error) {
        results.push({
          positionId: vote.positionId,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to cast vote',
        });
      }
    }

    return results;
  },

  async hasVoted(associationId: number, electionId: number, memberId: number, positionId?: number) {
    const where: any = { electionId, voterId: memberId };
    if (positionId) where.positionId = positionId;

    const vote = await prisma.vote.findFirst({ where });
    return !!vote;
  },

  async getVoterStatus(associationId: number, electionId: number, memberId: number) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
      include: { positions: { orderBy: { orderNumber: 'asc' } } },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    const votes = await prisma.vote.findMany({
      where: { electionId, voterId: memberId },
      select: { positionId: true, isAbstention: true, votedAt: true },
    });

    const votedPositionIds = votes.map((v) => v.positionId);

    return {
      electionId,
      memberId,
      hasVoted: votes.length > 0,
      votedPositions: votedPositionIds,
      pendingPositions: election.positions
        .filter((p) => !votedPositionIds.includes(p.id))
        .map((p) => ({ id: p.id, title: p.title })),
      totalPositions: election.positions.length,
      votesCompleted: votes.length,
    };
  },

  // ==========================================
  // ELECTION RESULTS
  // ==========================================

  async getElectionResults(associationId: number, electionId: number) {
    const election = await prisma.election.findFirst({
      where: { id: electionId, associationId },
      include: {
        positions: {
          orderBy: { orderNumber: 'asc' },
          include: {
            candidates: {
              where: { status: 'APPROVED' },
              include: {
                member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
              },
              orderBy: { voteCount: 'desc' },
            },
          },
        },
        candidates: {
          where: { status: 'APPROVED', positionId: null },
          include: {
            member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
          },
          orderBy: { voteCount: 'desc' },
        },
      },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    // Check if results can be viewed
    if (election.status !== 'VOTING_CLOSED' && election.status !== 'RESULTS_PUBLISHED') {
      throw new Error('Results are not yet available');
    }

    const voterTurnout = election.eligibleVoterCount > 0
      ? Math.round((election.totalVotesCast / election.eligibleVoterCount) * 100)
      : 0;

    const quorumMet = !election.requiresQuorum || 
      (election.quorumPercentage && voterTurnout >= election.quorumPercentage);

    // Calculate results per position
    const positionResults = election.positions.map((position) => {
      const totalVotesForPosition = position.candidates.reduce((sum, c) => sum + c.voteCount, 0);
      
      const candidateResults = position.candidates.map((candidate) => ({
        candidateId: candidate.id,
        memberId: candidate.memberId,
        memberName: `${candidate.member.firstName} ${candidate.member.lastName}`,
        voteCount: candidate.voteCount,
        votePercentage: totalVotesForPosition > 0
          ? Math.round((candidate.voteCount / totalVotesForPosition) * 100)
          : 0,
      }));

      const winner = candidateResults.length > 0 ? candidateResults[0] : undefined;

      return {
        positionId: position.id,
        positionTitle: position.title,
        candidates: candidateResults,
        winner: winner && winner.voteCount > 0 ? winner : undefined,
      };
    });

    // Handle elections without positions (general voting)
    let generalResults = undefined;
    if (election.candidates.length > 0) {
      const totalVotes = election.candidates.reduce((sum, c) => sum + c.voteCount, 0);
      generalResults = election.candidates.map((candidate) => ({
        candidateId: candidate.id,
        memberId: candidate.memberId,
        memberName: `${candidate.member.firstName} ${candidate.member.lastName}`,
        voteCount: candidate.voteCount,
        votePercentage: totalVotes > 0
          ? Math.round((candidate.voteCount / totalVotes) * 100)
          : 0,
      }));
    }

    return {
      electionId: election.id,
      electionTitle: election.title,
      status: election.status,
      totalEligibleVoters: election.eligibleVoterCount,
      totalVotesCast: election.totalVotesCast,
      voterTurnout,
      quorumMet,
      positions: positionResults,
      generalResults,
    };
  },

  // ==========================================
  // POLL MANAGEMENT
  // ==========================================

  async createPoll(associationId: number, userId: number, data: CreatePollInput) {
    const poll = await prisma.poll.create({
      data: {
        associationId,
        title: data.title,
        description: data.description,
        pollType: data.pollType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        allowMultipleVotes: data.allowMultipleVotes ?? false,
        maxChoices: data.maxChoices,
        isAnonymous: data.isAnonymous ?? true,
        showResultsBeforeEnd: data.showResultsBeforeEnd ?? false,
        createdBy: userId,
        options: {
          create: data.options.map((opt, index) => ({
            optionText: opt.optionText,
            orderNumber: opt.orderNumber ?? index,
          })),
        },
      },
      include: {
        options: { orderBy: { orderNumber: 'asc' } },
        creator: { select: { id: true, email: true } },
      },
    });

    return poll;
  },

  async updatePoll(associationId: number, pollId: number, data: UpdatePollInput) {
    const poll = await prisma.poll.findFirst({
      where: { id: pollId, associationId },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.status !== 'DRAFT') {
      throw new Error('Can only edit polls in draft status');
    }

    return prisma.poll.update({
      where: { id: pollId },
      data: {
        title: data.title,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        allowMultipleVotes: data.allowMultipleVotes,
        maxChoices: data.maxChoices,
        isAnonymous: data.isAnonymous,
        showResultsBeforeEnd: data.showResultsBeforeEnd,
      },
      include: {
        options: { orderBy: { orderNumber: 'asc' } },
      },
    });
  },

  async getPoll(associationId: number, pollId: number) {
    const poll = await prisma.poll.findFirst({
      where: { id: pollId, associationId },
      include: {
        options: { orderBy: { orderNumber: 'asc' } },
        creator: { select: { id: true, email: true } },
        _count: { select: { responses: true } },
      },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    return poll;
  },

  async listPolls(
    associationId: number,
    params: {
      page: number;
      limit: number;
      status?: string;
      pollType?: string;
      search?: string;
    }
  ) {
    const { page, limit, status, pollType, search } = params;
    const skip = (page - 1) * limit;

    const where: any = { associationId };

    if (status) where.status = status;
    if (pollType) where.pollType = pollType;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [polls, totalCount] = await Promise.all([
      prisma.poll.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          options: { select: { id: true, optionText: true } },
          _count: { select: { responses: true } },
        },
      }),
      prisma.poll.count({ where }),
    ]);

    return {
      polls,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + polls.length < totalCount,
      },
    };
  },

  async deletePoll(associationId: number, pollId: number) {
    const poll = await prisma.poll.findFirst({
      where: { id: pollId, associationId },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.status !== 'DRAFT' && poll.status !== 'CANCELLED') {
      throw new Error('Can only delete polls in draft or cancelled status');
    }

    await prisma.poll.delete({ where: { id: pollId } });
    return { success: true };
  },

  // ==========================================
  // POLL STATUS MANAGEMENT
  // ==========================================

  async startPoll(associationId: number, pollId: number) {
    const poll = await prisma.poll.findFirst({
      where: { id: pollId, associationId },
      include: { options: true },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.status !== 'DRAFT') {
      throw new Error('Can only start polls in draft status');
    }

    if (poll.options.length < 2) {
      throw new Error('Poll must have at least 2 options');
    }

    return prisma.poll.update({
      where: { id: pollId },
      data: {
        status: 'ACTIVE',
        startDate: new Date(),
      },
    });
  },

  async closePoll(associationId: number, pollId: number) {
    const poll = await prisma.poll.findFirst({
      where: { id: pollId, associationId },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.status !== 'ACTIVE') {
      throw new Error('Poll is not currently active');
    }

    // Get total responses
    const totalResponses = await prisma.pollResponse.groupBy({
      by: ['responderId'],
      where: { pollId },
    });

    return prisma.poll.update({
      where: { id: pollId },
      data: {
        status: 'CLOSED',
        totalResponses: totalResponses.length,
        endDate: new Date(),
      },
    });
  },

  async cancelPoll(associationId: number, pollId: number) {
    const poll = await prisma.poll.findFirst({
      where: { id: pollId, associationId },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.status === 'CLOSED') {
      throw new Error('Cannot cancel a closed poll');
    }

    return prisma.poll.update({
      where: { id: pollId },
      data: { status: 'CANCELLED' },
    });
  },

  // ==========================================
  // POLL OPTIONS
  // ==========================================

  async addPollOption(associationId: number, pollId: number, data: AddPollOptionInput) {
    const poll = await prisma.poll.findFirst({
      where: { id: pollId, associationId },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.status !== 'DRAFT') {
      throw new Error('Can only add options to polls in draft status');
    }

    // Get next order number
    const lastOption = await prisma.pollOption.findFirst({
      where: { pollId },
      orderBy: { orderNumber: 'desc' },
    });

    const orderNumber = data.orderNumber ?? (lastOption ? lastOption.orderNumber + 1 : 0);

    return prisma.pollOption.create({
      data: {
        pollId,
        optionText: data.optionText,
        orderNumber,
      },
    });
  },

  async deletePollOption(associationId: number, optionId: number) {
    const option = await prisma.pollOption.findFirst({
      where: { id: optionId },
      include: { poll: true },
    });

    if (!option || option.poll.associationId !== associationId) {
      throw new Error('Option not found');
    }

    if (option.poll.status !== 'DRAFT') {
      throw new Error('Can only delete options from polls in draft status');
    }

    await prisma.pollOption.delete({ where: { id: optionId } });
    return { success: true };
  },

  // ==========================================
  // POLL RESPONSES
  // ==========================================

  async submitPollResponse(
    associationId: number,
    pollId: number,
    memberId: number,
    data: SubmitPollResponseInput
  ) {
    const poll = await prisma.poll.findFirst({
      where: { id: pollId, associationId },
      include: { options: true },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.status !== 'ACTIVE') {
      throw new Error('Poll is not currently active');
    }

    // Check poll period
    const now = new Date();
    if (now < poll.startDate || now > poll.endDate) {
      throw new Error('Poll is not within the allowed time period');
    }

    // Verify member is eligible
    const member = await prisma.member.findFirst({
      where: { id: memberId, associationId, status: 'active' },
    });

    if (!member) {
      throw new Error('Member not found or not eligible to respond');
    }

    // Check if already responded
    const existingResponse = await prisma.pollResponse.findFirst({
      where: { pollId, responderId: memberId },
    });

    if (existingResponse && !poll.allowMultipleVotes) {
      throw new Error('You have already responded to this poll');
    }

    // Validate options
    const validOptionIds = poll.options.map((o) => o.id);
    const invalidOptions = data.optionIds.filter((id) => !validOptionIds.includes(id));
    if (invalidOptions.length > 0) {
      throw new Error('Invalid option selection');
    }

    // Check max choices
    if (poll.maxChoices && data.optionIds.length > poll.maxChoices) {
      throw new Error(`Maximum ${poll.maxChoices} choices allowed`);
    }

    // For single choice polls, only one option allowed
    if (poll.pollType === 'SINGLE_CHOICE' && data.optionIds.length > 1) {
      throw new Error('Only one option can be selected');
    }

    // For yes/no polls, only one option allowed
    if (poll.pollType === 'YES_NO' && data.optionIds.length > 1) {
      throw new Error('Only one option can be selected');
    }

    const responseHash = generateVoteHash(pollId, memberId, now);

    const responses = await prisma.$transaction(async (tx) => {
      // Create responses
      const createdResponses = await Promise.all(
        data.optionIds.map((optionId) =>
          tx.pollResponse.create({
            data: {
              pollId,
              optionId,
              responderId: memberId,
              responseHash,
            },
          })
        )
      );

      // Update option vote counts
      await Promise.all(
        data.optionIds.map((optionId) =>
          tx.pollOption.update({
            where: { id: optionId },
            data: { voteCount: { increment: 1 } },
          })
        )
      );

      // Update poll total responses
      await tx.poll.update({
        where: { id: pollId },
        data: { totalResponses: { increment: 1 } },
      });

      return createdResponses;
    });

    return {
      success: true,
      responseHash,
      message: 'Response submitted successfully',
    };
  },

  async hasRespondedToPoll(associationId: number, pollId: number, memberId: number) {
    const response = await prisma.pollResponse.findFirst({
      where: { pollId, responderId: memberId },
    });
    return !!response;
  },

  // ==========================================
  // POLL RESULTS
  // ==========================================

  async getPollResults(associationId: number, pollId: number, memberId?: number) {
    const poll = await prisma.poll.findFirst({
      where: { id: pollId, associationId },
      include: {
        options: { orderBy: { orderNumber: 'asc' } },
      },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    // Check if results can be viewed
    if (!poll.showResultsBeforeEnd && poll.status === 'ACTIVE') {
      throw new Error('Results are not available until the poll ends');
    }

    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.voteCount, 0);

    const optionResults = poll.options.map((option) => ({
      optionId: option.id,
      optionText: option.optionText,
      voteCount: option.voteCount,
      votePercentage: totalVotes > 0
        ? Math.round((option.voteCount / totalVotes) * 100)
        : 0,
    }));

    // Check if member has responded
    let hasResponded = false;
    if (memberId) {
      hasResponded = await this.hasRespondedToPoll(associationId, pollId, memberId);
    }

    return {
      pollId: poll.id,
      pollTitle: poll.title,
      pollType: poll.pollType,
      status: poll.status,
      totalResponses: poll.totalResponses,
      totalVotes,
      options: optionResults,
      hasResponded,
    };
  },

  // ==========================================
  // DASHBOARD & ANALYTICS
  // ==========================================

  async getDashboard(associationId: number) {
    const now = new Date();

    const [
      totalElections,
      activeElections,
      completedElections,
      totalPolls,
      activePolls,
      upcomingElections,
    ] = await Promise.all([
      prisma.election.count({ where: { associationId } }),
      prisma.election.count({ where: { associationId, status: 'VOTING_OPEN' } }),
      prisma.election.count({ where: { associationId, status: 'RESULTS_PUBLISHED' } }),
      prisma.poll.count({ where: { associationId } }),
      prisma.poll.count({ where: { associationId, status: 'ACTIVE' } }),
      prisma.election.count({
        where: {
          associationId,
          status: 'DRAFT',
          votingStartDate: { gt: now },
        },
      }),
    ]);

    // Calculate average voter turnout
    const completedElectionsData = await prisma.election.findMany({
      where: { associationId, status: 'RESULTS_PUBLISHED' },
      select: { eligibleVoterCount: true, totalVotesCast: true },
    });

    let averageVoterTurnout = 0;
    if (completedElectionsData.length > 0) {
      const totalTurnout = completedElectionsData.reduce((sum, e) => {
        if (e.eligibleVoterCount > 0) {
          return sum + (e.totalVotesCast / e.eligibleVoterCount) * 100;
        }
        return sum;
      }, 0);
      averageVoterTurnout = Math.round(totalTurnout / completedElectionsData.length);
    }

    // Get recent elections
    const recentElections = await prisma.election.findMany({
      where: { associationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        votingStartDate: true,
        votingEndDate: true,
        totalVotesCast: true,
      },
    });

    // Get recent polls
    const recentPolls = await prisma.poll.findMany({
      where: { associationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
        totalResponses: true,
      },
    });

    return {
      totalElections,
      activeElections,
      completedElections,
      totalPolls,
      activePolls,
      upcomingElections,
      averageVoterTurnout,
      recentElections,
      recentPolls,
    };
  },

  async getActiveVotingItems(associationId: number) {
    const now = new Date();

    const [activeElections, activePolls] = await Promise.all([
      prisma.election.findMany({
        where: {
          associationId,
          status: 'VOTING_OPEN',
          votingStartDate: { lte: now },
          votingEndDate: { gte: now },
        },
        select: {
          id: true,
          title: true,
          votingEndDate: true,
          totalVotesCast: true,
          eligibleVoterCount: true,
        },
      }),
      prisma.poll.findMany({
        where: {
          associationId,
          status: 'ACTIVE',
          startDate: { lte: now },
          endDate: { gte: now },
        },
        select: {
          id: true,
          title: true,
          endDate: true,
          totalResponses: true,
        },
      }),
    ]);

    return { activeElections, activePolls };
  },
};
