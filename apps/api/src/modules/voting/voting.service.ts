// ============================================
// PHASE 4.5: VOTING & ELECTIONS SERVICE
// ============================================

import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { RuleError } from '../finance/rule-error';
import * as rules from './voting-rules';
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

type Tx = Prisma.TransactionClient;

/** Holds the election's row until the transaction ends, so votes, candidate decisions and the lifecycle can't interleave. */
async function lockElection(tx: Tx, electionId: number): Promise<void> {
  await tx.$queryRaw`SELECT id FROM elections WHERE id = ${electionId} FOR UPDATE`;
}

async function lockPoll(tx: Tx, pollId: number): Promise<void> {
  await tx.$queryRaw`SELECT id FROM polls WHERE id = ${pollId} FOR UPDATE`;
}

/**
 * Moves an election one step, once. The status is part of the update's condition, so of two committee members (or a double
 * tap) only one gets through; the other is told where the election is now instead of the step running twice.
 */
async function claimElection(associationId: number, electionId: number, action: rules.ElectionAction, data: Prisma.ElectionUncheckedUpdateManyInput) {
  const { count } = await prisma.election.updateMany({
    where: { id: electionId, associationId, status: { in: rules.ELECTION_TRANSITIONS[action] } },
    data,
  });

  if (count !== 1) {
    const current = await prisma.election.findFirst({ where: { id: electionId, associationId }, select: { status: true } });
    if (!current) throw new Error('Election not found');
    rules.assertElectionTransition(action, current.status);
    throw rules.alreadyMovedOn();
  }

  return prisma.election.findFirstOrThrow({ where: { id: electionId } });
}

async function claimPoll(associationId: number, pollId: number, action: rules.PollAction, data: Prisma.PollUncheckedUpdateManyInput) {
  const { count } = await prisma.poll.updateMany({
    where: { id: pollId, associationId, status: { in: rules.POLL_TRANSITIONS[action] } },
    data,
  });

  if (count !== 1) {
    const current = await prisma.poll.findFirst({ where: { id: pollId, associationId }, select: { status: true } });
    if (!current) throw new Error('Poll not found');
    rules.assertPollTransition(action, current.status);
    throw rules.alreadyMovedOnPoll();
  }

  return prisma.poll.findFirstOrThrow({ where: { id: pollId } });
}

/** Two positions in one election can't share an order number. */
function positionOrderTaken(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new RuleError('Another position already has that order number.', 409, 'ORDER_TAKEN');
  }
  return error;
}

/** Adds a candidate, either put forward by the committee or by the member themselves. They wait for a decision from someone else. */
async function addCandidate(
  associationId: number,
  electionId: number,
  memberId: number,
  data: { positionId?: number | null; manifesto?: string | null; photoUrl?: string | null; nominatedBy?: number },
  bySelf: boolean,
) {
  return prisma.$transaction(async (tx) => {
    await lockElection(tx, electionId);

    const election = await tx.election.findFirst({
      where: { id: electionId, associationId },
      include: { positions: { select: { id: true } } },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    rules.assertCanRegisterCandidate(election.status, bySelf);

    const member = await tx.member.findFirst({
      where: { id: memberId, associationId, status: 'active' },
      select: { id: true },
    });

    if (!member) {
      throw new RuleError(bySelf ? 'Only active members can stand for election.' : 'That member was not found or is not active.', 400, 'MEMBER_NOT_ELIGIBLE');
    }

    const positionId = data.positionId ?? null;
    rules.assertPositionBelongs(positionId, election.positions.map((p) => p.id));

    // A member has one row per position (the table is unique on election, position and member), so standing again after being
    // rejected or withdrawing reopens that row as a fresh nomination instead of adding a second one.
    const existingCandidate = await tx.candidate.findFirst({
      where: { electionId, positionId, memberId },
      select: { id: true, status: true },
    });

    if (existingCandidate && existingCandidate.status !== 'REJECTED' && existingCandidate.status !== 'WITHDRAWN') {
      throw new RuleError(bySelf ? 'You are already a candidate for this position.' : 'That member is already a candidate for this position.', 409, 'ALREADY_CANDIDATE');
    }

    const include = {
      member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
      position: { select: { id: true, title: true } },
    };

    if (existingCandidate) {
      return tx.candidate.update({
        where: { id: existingCandidate.id },
        data: {
          status: 'PENDING',
          manifesto: data.manifesto,
          photoUrl: data.photoUrl,
          nominatedBy: data.nominatedBy ?? null,
          nominatedAt: new Date(),
          approvedBy: null,
          approvedAt: null,
          rejectionReason: null,
          withdrawnAt: null,
          withdrawalReason: null,
        },
        include,
      });
    }

    return tx.candidate.create({
      data: {
        electionId,
        positionId,
        memberId,
        manifesto: data.manifesto,
        photoUrl: data.photoUrl,
        nominatedBy: data.nominatedBy,
        status: 'PENDING',
      },
      include,
    });
  });
}

export const votingService = {
  // ==========================================
  // ELECTION MANAGEMENT
  // ==========================================

  async createElection(associationId: number, userId: number, data: CreateElectionInput) {
    const votingStart = new Date(data.votingStartDate);
    const votingEnd = new Date(data.votingEndDate);
    rules.assertWindow(votingStart, votingEnd);
    rules.assertNominationWindow(
      data.nominationStartDate ? new Date(data.nominationStartDate) : null,
      data.nominationEndDate ? new Date(data.nominationEndDate) : null,
      votingStart,
    );
    rules.assertQuorumSetting(data.requiresQuorum, data.quorumPercentage);

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
        votingStartDate: votingStart,
        votingEndDate: votingEnd,
        maxVotesPerMember: data.maxVotesPerMember ?? 1,
        allowAbstention: data.allowAbstention ?? true,
        isAnonymous: data.isAnonymous ?? true,
        requiresQuorum: data.requiresQuorum ?? false,
        quorumPercentage: data.requiresQuorum ? data.quorumPercentage : null,
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

    rules.assertEditable(election.status);

    const votingStart = data.votingStartDate ? new Date(data.votingStartDate) : election.votingStartDate;
    const votingEnd = data.votingEndDate ? new Date(data.votingEndDate) : election.votingEndDate;
    const nominationStart = data.nominationStartDate ? new Date(data.nominationStartDate) : election.nominationStartDate;
    const nominationEnd = data.nominationEndDate ? new Date(data.nominationEndDate) : election.nominationEndDate;
    const requiresQuorum = data.requiresQuorum ?? election.requiresQuorum;
    const quorumPercentage = data.quorumPercentage ?? election.quorumPercentage;
    rules.assertWindow(votingStart, votingEnd);
    rules.assertNominationWindow(nominationStart, nominationEnd, votingStart);
    rules.assertQuorumSetting(requiresQuorum, quorumPercentage);

    // Claim the draft: if someone opened nominations while this was being edited, nothing is overwritten.
    const { count } = await prisma.election.updateMany({
      where: { id: electionId, associationId, status: 'DRAFT' },
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
        quorumPercentage: requiresQuorum ? quorumPercentage : null,
      },
    });
    if (count !== 1) throw rules.alreadyMovedOn();

    return prisma.election.findFirstOrThrow({
      where: { id: electionId },
      include: {
        positions: { orderBy: { orderNumber: 'asc' } },
      },
    });
  },
  async getElection(associationId: number, electionId: number, canSeeBeforePublishing = false) {
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

    // The count of votes each candidate has is the result: it is not handed out while voting is open, or before it is published.
    if (!rules.tallyVisible(election.status, canSeeBeforePublishing)) {
      return {
        ...election,
        positions: election.positions.map((p) => ({ ...p, candidates: p.candidates.map((c) => ({ ...c, voteCount: 0 })) })),
        candidates: election.candidates.map((c) => ({ ...c, voteCount: 0 })),
      };
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
      include: { _count: { select: { votes: true } } },
    });

    if (!election) {
      throw new Error('Election not found');
    }

    rules.assertDeletable(election.status);
    if (election._count.votes > 0) {
      throw new RuleError('This election has votes. Keep it as a record instead of deleting it.', 409, 'HAS_VOTES');
    }

    const { count } = await prisma.election.deleteMany({
      where: { id: electionId, associationId, status: { in: ['DRAFT', 'CANCELLED'] } },
    });
    if (count !== 1) throw rules.alreadyMovedOn();
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

    return claimElection(associationId, electionId, 'startNominations', {
      status: 'NOMINATIONS_OPEN',
      nominationStartDate: election.nominationStartDate || new Date(),
    });
  },
  async closeNominations(associationId: number, electionId: number, userId: number) {
    return claimElection(associationId, electionId, 'closeNominations', {
      status: 'NOMINATIONS_CLOSED',
      nominationEndDate: new Date(),
    });
  },
  async startVoting(associationId: number, electionId: number, userId: number) {
    return prisma.$transaction(async (tx) => {
      // Holding the election's row keeps a nomination from being decided while we check that the ballot is complete.
      await lockElection(tx, electionId);

      const election = await tx.election.findFirst({
        where: { id: electionId, associationId },
        include: {
          positions: { select: { id: true, title: true }, orderBy: { orderNumber: 'asc' } },
          candidates: { select: { positionId: true, status: true } },
        },
      });

      if (!election) {
        throw new Error('Election not found');
      }

      rules.assertElectionTransition('startVoting', election.status);

      const now = new Date();
      rules.assertReadyForVoting({
        positions: election.positions,
        candidates: election.candidates,
        votingEndDate: election.votingEndDate,
        now,
      });

      // Who can vote is fixed at this moment.
      const eligibleVoterCount = await tx.member.count({
        where: { associationId, status: 'active' },
      });

      const { count } = await tx.election.updateMany({
        where: { id: electionId, associationId, status: { in: rules.ELECTION_TRANSITIONS.startVoting } },
        data: { status: 'VOTING_OPEN', eligibleVoterCount, votingStartDate: now },
      });
      if (count !== 1) throw rules.alreadyMovedOn();

      return tx.election.findFirstOrThrow({ where: { id: electionId } });
    });
  },
  async closeVoting(associationId: number, electionId: number, userId: number) {
    return prisma.$transaction(async (tx) => {
      // Votes take the same lock, so every vote in flight finishes first and none can follow the close.
      await lockElection(tx, electionId);

      const election = await tx.election.findFirst({ where: { id: electionId, associationId } });

      if (!election) {
        throw new Error('Election not found');
      }

      rules.assertElectionTransition('closeVoting', election.status);

      const voters = await tx.vote.groupBy({ by: ['voterId'], where: { electionId } });
      const now = new Date();

      const { count } = await tx.election.updateMany({
        where: { id: electionId, associationId, status: 'VOTING_OPEN' },
        data: {
          status: 'VOTING_CLOSED',
          totalVotesCast: voters.length,
          votingEndDate: now < election.votingEndDate ? now : undefined,
        },
      });
      if (count !== 1) throw rules.alreadyMovedOn();

      return tx.election.findFirstOrThrow({ where: { id: electionId } });
    });
  },
  async publishResults(associationId: number, electionId: number, userId: number) {
    return prisma.$transaction(async (tx) => {
      await lockElection(tx, electionId);

      const election = await tx.election.findFirst({ where: { id: electionId, associationId } });

      if (!election) {
        throw new Error('Election not found');
      }

      rules.assertElectionTransition('publishResults', election.status);

      // Results that did not reach the quorum are not published: the committee cancels and runs the election again.
      const voters = await tx.vote.groupBy({ by: ['voterId'], where: { electionId } });
      rules.assertQuorumForPublishing(election.requiresQuorum, election.quorumPercentage, voters.length, election.eligibleVoterCount);

      const { count } = await tx.election.updateMany({
        where: { id: electionId, associationId, status: 'VOTING_CLOSED' },
        data: {
          status: 'RESULTS_PUBLISHED',
          totalVotesCast: voters.length,
          publishedBy: userId,
          publishedAt: new Date(),
        },
      });
      if (count !== 1) throw rules.alreadyMovedOn();

      return tx.election.findFirstOrThrow({ where: { id: electionId } });
    });
  },
  async cancelElection(associationId: number, electionId: number, userId: number, reason: string) {
    if (!reason || !reason.trim()) {
      throw new RuleError('Say why the election is being cancelled.', 400, 'REASON_REQUIRED');
    }

    return claimElection(associationId, electionId, 'cancel', {
      status: 'CANCELLED',
      cancelledBy: userId,
      cancelledAt: new Date(),
      cancellationReason: reason.trim(),
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

    rules.assertEditable(election.status, 'the positions');

    // Get next order number
    const lastPosition = await prisma.electionPosition.findFirst({
      where: { electionId },
      orderBy: { orderNumber: 'desc' },
    });

    const orderNumber = data.orderNumber ?? (lastPosition ? lastPosition.orderNumber + 1 : 0);

    try {
      return await prisma.electionPosition.create({
        data: {
          electionId,
          title: data.title,
          description: data.description,
          maxCandidates: data.maxCandidates ?? 1,
          orderNumber,
        },
      });
    } catch (error) {
      throw positionOrderTaken(error);
    }
  },
  async updatePosition(associationId: number, positionId: number, data: UpdatePositionInput) {
    const position = await prisma.electionPosition.findFirst({
      where: { id: positionId },
      include: { election: true },
    });

    if (!position || position.election.associationId !== associationId) {
      throw new Error('Position not found');
    }

    rules.assertEditable(position.election.status, 'the positions');

    try {
      return await prisma.electionPosition.update({
        where: { id: positionId },
        data: {
          title: data.title,
          description: data.description,
          maxCandidates: data.maxCandidates,
          orderNumber: data.orderNumber,
        },
      });
    } catch (error) {
      throw positionOrderTaken(error);
    }
  },
  async deletePosition(associationId: number, positionId: number) {
    const position = await prisma.electionPosition.findFirst({
      where: { id: positionId },
      include: { election: true, _count: { select: { candidates: true } } },
    });

    if (!position || position.election.associationId !== associationId) {
      throw new Error('Position not found');
    }

    rules.assertEditable(position.election.status, 'the positions');

    if (position._count.candidates > 0) {
      throw new RuleError('This position has candidates. Remove them first.', 409, 'HAS_CANDIDATES');
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
    return addCandidate(associationId, electionId, data.memberId, { ...data, nominatedBy: userId }, false);
  },
  async selfNominate(
    associationId: number,
    electionId: number,
    memberId: number,
    data: SelfNominateInput
  ) {
    return addCandidate(associationId, electionId, memberId, data, true);
  },
  async approveCandidate(
    associationId: number,
    candidateId: number,
    userId: number,
    data: ApproveCandidateInput
  ) {
    if (data.status === 'REJECTED' && !data.rejectionReason?.trim()) {
      throw new RuleError('Say why this nomination is being rejected.', 400, 'REASON_REQUIRED');
    }

    return prisma.$transaction(async (tx) => {
      const found = await tx.candidate.findFirst({
        where: { id: candidateId },
        select: { electionId: true, election: { select: { associationId: true } } },
      });

      if (!found || found.election.associationId !== associationId) {
        throw new Error('Candidate not found');
      }

      // Same lock as opening voting, so a nomination can't be approved after the ballot has been checked.
      await lockElection(tx, found.electionId);

      const candidate = await tx.candidate.findFirst({
        where: { id: candidateId },
        include: { election: { select: { status: true } } },
      });

      if (!candidate) {
        throw new Error('Candidate not found');
      }

      rules.assertCandidatesCanBeDecided(candidate.election.status);

      // A committee member can't decide their own nomination.
      const decider = await tx.member.findFirst({ where: { userId, associationId }, select: { id: true } });
      rules.assertNotOwnNomination(decider?.id, candidate.memberId);

      const { count } = await tx.candidate.updateMany({
        where: { id: candidateId, status: 'PENDING' },
        data: {
          status: data.status,
          approvedBy: userId,
          approvedAt: new Date(),
          rejectionReason: data.status === 'REJECTED' ? data.rejectionReason?.trim() : null,
        },
      });
      if (count !== 1) {
        throw new RuleError('This nomination was just decided by someone else.', 409, 'ALREADY_DECIDED');
      }

      return tx.candidate.findFirstOrThrow({
        where: { id: candidateId },
        include: {
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
          position: { select: { id: true, title: true } },
        },
      });
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

    rules.assertCanWithdraw(candidate.election.status);

    const { count } = await prisma.candidate.updateMany({
      where: { id: candidateId, memberId, status: { in: ['PENDING', 'APPROVED'] } },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
        withdrawalReason: data.withdrawalReason,
      },
    });
    if (count !== 1) {
      throw new RuleError('This nomination has already been decided or withdrawn.', 409, 'ALREADY_DECIDED');
    }

    return prisma.candidate.findFirstOrThrow({ where: { id: candidateId } });
  },
  async listCandidates(
    associationId: number,
    electionId: number,
    params: {
      positionId?: number;
      status?: string;
    },
    canSeeBeforePublishing = false,
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

    const candidates = await prisma.candidate.findMany({
      where,
      include: {
        member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        position: { select: { id: true, title: true } },
      },
      orderBy: [{ positionId: 'asc' }, { nominatedAt: 'asc' }],
    });

    return rules.tallyVisible(election.status, canSeeBeforePublishing) ? candidates : candidates.map((c) => ({ ...c, voteCount: 0 }));
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
    const now = new Date();

    const vote = await prisma.$transaction(async (tx) => {
      // One voter at a time per election: the checks below and the write behind them can't be interleaved with another
      // vote, or with the election being closed, so nobody votes twice and nobody votes after the close.
      await lockElection(tx, electionId);

      const election = await tx.election.findFirst({
        where: { id: electionId, associationId },
        include: { positions: { select: { id: true } } },
      });

      if (!election) {
        throw new Error('Election not found');
      }

      rules.assertVotingOpen({
        status: election.status,
        votingStartDate: election.votingStartDate,
        votingEndDate: election.votingEndDate,
        now,
      });

      // Verify member is eligible to vote
      const member = await tx.member.findFirst({
        where: { id: memberId, associationId, status: 'active' },
        select: { id: true },
      });

      if (!member) {
        throw new RuleError('Only active members can vote.', 403, 'NOT_ELIGIBLE');
      }

      const candidate = data.candidateId
        ? await tx.candidate.findFirst({
            where: { id: data.candidateId, electionId },
            select: { id: true, positionId: true, status: true },
          })
        : null;

      rules.assertValidBallot({
        election,
        positionIds: election.positions.map((p) => p.id),
        vote: data,
        candidate,
      });

      const positionId = data.positionId ?? null;

      const existingVote = await tx.vote.findFirst({
        where: { electionId, positionId, voterId: memberId },
        select: { id: true },
      });

      if (existingVote) {
        throw new RuleError(positionId === null ? 'You have already voted in this election.' : 'You have already voted for this position.', 409, 'ALREADY_VOTED');
      }

      const firstVoteInElection = !(await tx.vote.findFirst({ where: { electionId, voterId: memberId }, select: { id: true } }));

      const newVote = await tx.vote.create({
        data: {
          electionId,
          positionId,
          candidateId: data.isAbstention ? null : data.candidateId,
          voterId: memberId,
          voteHash: generateVoteHash(electionId, memberId, now),
          isAbstention: data.isAbstention ?? false,
        },
      });

      if (!data.isAbstention && data.candidateId) {
        await tx.candidate.update({
          where: { id: data.candidateId },
          data: { voteCount: { increment: 1 } },
        });
      }

      // The count is of members who have voted, so a member voting for several positions is counted once.
      if (firstVoteInElection) {
        await tx.election.update({
          where: { id: electionId },
          data: { totalVotesCast: { increment: 1 } },
        });
      }

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

    rules.assertVotingOpen({
      status: election.status,
      votingStartDate: election.votingStartDate,
      votingEndDate: election.votingEndDate,
      now: new Date(),
    });

    const results = [];
    for (const vote of data.votes) {
      try {
        const result = await this.castVote(associationId, electionId, memberId, vote);
        results.push({ positionId: vote.positionId, ...result });
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

  async getElectionResults(associationId: number, electionId: number, canSeeBeforePublishing = false) {
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

    // Until they are published, results are for the committee only; while voting is open there is no tally for anyone.
    rules.assertResultsVisible(election.status, canSeeBeforePublishing);

    const [voters, abstentions] = await Promise.all([
      prisma.vote.groupBy({ by: ['voterId'], where: { electionId } }),
      prisma.vote.groupBy({ by: ['positionId'], where: { electionId, isAbstention: true }, _count: { _all: true } }),
    ]);
    const abstentionsFor = (positionId: number | null) => abstentions.find((a) => a.positionId === positionId)?._count._all ?? 0;

    const voterTurnout = rules.turnoutPercent(voters.length, election.eligibleVoterCount);
    const quorumMet = rules.quorumMet(election.requiresQuorum, election.quorumPercentage, voters.length, election.eligibleVoterCount);

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

      const { winner, tied } = rules.pickWinner(candidateResults);

      return {
        positionId: position.id,
        positionTitle: position.title,
        candidates: candidateResults,
        abstentions: abstentionsFor(position.id),
        winner,
        tied,
      };
    });

    // Handle elections without positions (general voting)
    let generalResults = undefined;
    let generalWinner = undefined;
    let generalTied: typeof positionResults[number]['candidates'] = [];
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
      ({ winner: generalWinner, tied: generalTied } = rules.pickWinner(generalResults));
    }

    return {
      electionId: election.id,
      electionTitle: election.title,
      status: election.status,
      published: election.status === 'RESULTS_PUBLISHED',
      totalEligibleVoters: election.eligibleVoterCount,
      totalVotesCast: voters.length,
      voterTurnout,
      requiresQuorum: election.requiresQuorum,
      quorumPercentage: election.quorumPercentage,
      quorumMet,
      positions: positionResults,
      generalResults,
      generalWinner,
      generalTied,
      generalAbstentions: abstentionsFor(null),
    };
  },

  // ==========================================
  // POLL MANAGEMENT
  // ==========================================

  async createPoll(associationId: number, userId: number, data: CreatePollInput) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (endDate <= startDate) {
      throw new RuleError('A poll has to end after it starts.', 400, 'BAD_WINDOW');
    }

    const poll = await prisma.poll.create({
      data: {
        associationId,
        title: data.title,
        description: data.description,
        pollType: data.pollType,
        startDate,
        endDate,
        // Picking several answers is what a multiple-choice poll is; the flag mirrors the type so the apps never disagree.
        allowMultipleVotes: data.pollType === 'MULTIPLE_CHOICE',
        maxChoices: data.pollType === 'MULTIPLE_CHOICE' ? data.maxChoices : null,
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
      throw new RuleError('A poll can only be changed before it starts.', 409, 'NOT_EDITABLE');
    }

    const startDate = data.startDate ? new Date(data.startDate) : poll.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : poll.endDate;
    if (endDate <= startDate) {
      throw new RuleError('A poll has to end after it starts.', 400, 'BAD_WINDOW');
    }

    const { count } = await prisma.poll.updateMany({
      where: { id: pollId, associationId, status: 'DRAFT' },
      data: {
        title: data.title,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        maxChoices: poll.pollType === 'MULTIPLE_CHOICE' ? data.maxChoices : null,
        isAnonymous: data.isAnonymous,
        showResultsBeforeEnd: data.showResultsBeforeEnd,
      },
    });
    if (count !== 1) throw rules.alreadyMovedOnPoll();

    return prisma.poll.findFirstOrThrow({
      where: { id: pollId },
      include: {
        options: { orderBy: { orderNumber: 'asc' } },
      },
    });
  },
  async getPoll(associationId: number, pollId: number, canManage = false) {
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

    // While a poll is open, the answers so far are only for the people who run polls — unless the poll shows them.
    if (poll.status === 'ACTIVE' && !poll.showResultsBeforeEnd && !canManage) {
      return { ...poll, options: poll.options.map((o) => ({ ...o, voteCount: 0 })) };
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
      include: { _count: { select: { responses: true } } },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.status !== 'DRAFT' && poll.status !== 'CANCELLED') {
      throw new RuleError('Only a poll that has not started, or one that was cancelled, can be deleted.', 409, 'NOT_DELETABLE');
    }
    if (poll._count.responses > 0) {
      throw new RuleError('This poll has answers. Keep it as a record instead of deleting it.', 409, 'HAS_RESPONSES');
    }

    const { count } = await prisma.poll.deleteMany({
      where: { id: pollId, associationId, status: { in: ['DRAFT', 'CANCELLED'] } },
    });
    if (count !== 1) throw rules.alreadyMovedOnPoll();
    return { success: true };
  },
  // ==========================================
  // POLL STATUS MANAGEMENT
  // ==========================================

  async startPoll(associationId: number, pollId: number) {
    const poll = await prisma.poll.findFirst({
      where: { id: pollId, associationId },
      include: { _count: { select: { options: true } } },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    rules.assertPollTransition('start', poll.status);
    const now = new Date();
    rules.assertPollReady(poll._count.options, poll.endDate, now);

    return claimPoll(associationId, pollId, 'start', { status: 'ACTIVE', startDate: now });
  },
  async closePoll(associationId: number, pollId: number) {
    return prisma.$transaction(async (tx) => {
      // Answers take the same lock, so every answer in flight is counted and none can follow the close.
      await lockPoll(tx, pollId);

      const poll = await tx.poll.findFirst({ where: { id: pollId, associationId } });

      if (!poll) {
        throw new Error('Poll not found');
      }

      rules.assertPollTransition('close', poll.status);

      const responders = await tx.pollResponse.groupBy({ by: ['responderId'], where: { pollId } });
      const now = new Date();

      const { count } = await tx.poll.updateMany({
        where: { id: pollId, associationId, status: 'ACTIVE' },
        data: {
          status: 'CLOSED',
          totalResponses: responders.length,
          endDate: now < poll.endDate ? now : undefined,
        },
      });
      if (count !== 1) throw rules.alreadyMovedOnPoll();

      return tx.poll.findFirstOrThrow({ where: { id: pollId } });
    });
  },
  async cancelPoll(associationId: number, pollId: number) {
    return claimPoll(associationId, pollId, 'cancel', { status: 'CANCELLED' });
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
      throw new RuleError('Options can only be added before the poll starts.', 409, 'NOT_EDITABLE');
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
      throw new RuleError('Options can only be removed before the poll starts.', 409, 'NOT_EDITABLE');
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
    const now = new Date();
    const optionIds = data.optionIds;

    const responseHash = await prisma.$transaction(async (tx) => {
      // One answer at a time per poll: the checks below and the write behind them can't be interleaved with another
      // answer, or with the poll being closed, so nobody answers twice and nobody answers after the close.
      await lockPoll(tx, pollId);

      const poll = await tx.poll.findFirst({
        where: { id: pollId, associationId },
        include: { options: { select: { id: true } } },
      });

      if (!poll) {
        throw new Error('Poll not found');
      }

      rules.assertPollAnswer({
        poll,
        validOptionIds: poll.options.map((o) => o.id),
        optionIds,
        now,
      });

      const member = await tx.member.findFirst({
        where: { id: memberId, associationId, status: 'active' },
        select: { id: true },
      });

      if (!member) {
        throw new RuleError('Only active members can answer a poll.', 403, 'NOT_ELIGIBLE');
      }

      const existingResponse = await tx.pollResponse.findFirst({
        where: { pollId, responderId: memberId },
        select: { id: true },
      });

      if (existingResponse) {
        throw new RuleError('You have already answered this poll.', 409, 'ALREADY_RESPONDED');
      }

      const hash = generateVoteHash(pollId, memberId, now);

      await tx.pollResponse.createMany({
        data: optionIds.map((optionId) => ({ pollId, optionId, responderId: memberId, responseHash: hash })),
      });

      await tx.pollOption.updateMany({
        where: { id: { in: optionIds } },
        data: { voteCount: { increment: 1 } },
      });

      // The count is of members who have answered, so a member picking several options is counted once.
      await tx.poll.update({
        where: { id: pollId },
        data: { totalResponses: { increment: 1 } },
      });

      return hash;
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

  async getPollResults(associationId: number, pollId: number, memberId?: number, canManage = false) {
    const poll = await prisma.poll.findFirst({
      where: { id: pollId, associationId },
      include: {
        options: { orderBy: { orderNumber: 'asc' } },
      },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    rules.assertPollResultsVisible(poll.status, poll.showResultsBeforeEnd, canManage);

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
      candidatesAwaitingApproval,
      votingPastEnd,
      resultsToPublish,
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
      // What is waiting for the committee: nominations to decide, voting to close, results to publish.
      prisma.candidate.count({
        where: { status: 'PENDING', election: { associationId, status: { in: ['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED'] } } },
      }),
      prisma.election.count({ where: { associationId, status: 'VOTING_OPEN', votingEndDate: { lt: now } } }),
      prisma.election.count({ where: { associationId, status: 'VOTING_CLOSED' } }),
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
      candidatesAwaitingApproval,
      votingPastEnd,
      resultsToPublish,
      averageVoterTurnout,
      recentElections,
      recentPolls,
    };
  },

  /** Active members the committee can put forward as candidates. Committee members don't have the members list, so this is all they see of it. */
  async searchCandidateMembers(associationId: number, search: string | undefined, limit = 20) {
    const term = search?.trim();
    return prisma.member.findMany({
      where: {
        associationId,
        status: 'active',
        ...(term
          ? {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { memberId: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, memberId: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: Math.min(Math.max(limit, 1), 50),
    });
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
