// ============================================
// PHASE 4.5: VOTING & ELECTIONS VALIDATION
// ============================================

import { z } from 'zod';

// Enums - Must match Prisma schema exactly
const electionTypes = ['GENERAL', 'EXECUTIVE', 'COMMITTEE', 'SPECIAL'] as const;
const electionStatuses = ['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED', 'VOTING_OPEN', 'VOTING_CLOSED', 'RESULTS_PUBLISHED', 'CANCELLED'] as const;
const candidateStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const;
const pollTypes = ['YES_NO', 'MULTIPLE_CHOICE', 'SINGLE_CHOICE', 'RATING'] as const;
const pollStatuses = ['DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED'] as const;

// ==========================================
// ELECTION SCHEMAS
// ==========================================

export const createPositionSchema = z.object({
  title: z.string().min(2, 'Position title must be at least 2 characters').max(100),
  description: z.string().max(500).optional().nullable(),
  maxCandidates: z.number().int().min(1).default(1),
  orderNumber: z.number().int().min(0).optional(),
});

export const createElectionSchema = z.object({
  title: z.string().min(3, 'Election title must be at least 3 characters').max(200),
  description: z.string().max(2000).optional().nullable(),
  electionType: z.enum(electionTypes),
  nominationStartDate: z.string().datetime().optional().nullable(),
  nominationEndDate: z.string().datetime().optional().nullable(),
  votingStartDate: z.string().datetime(),
  votingEndDate: z.string().datetime(),
  maxVotesPerMember: z.number().int().min(1).default(1),
  allowAbstention: z.boolean().default(true),
  isAnonymous: z.boolean().default(true),
  requiresQuorum: z.boolean().default(false),
  quorumPercentage: z.number().min(0).max(100).optional().nullable(),
  positions: z.array(createPositionSchema).optional(),
}).refine(
  (data) => {
    const votingStart = new Date(data.votingStartDate);
    const votingEnd = new Date(data.votingEndDate);
    return votingEnd > votingStart;
  },
  { message: 'Voting end date must be after voting start date', path: ['votingEndDate'] }
).refine(
  (data) => {
    if (data.nominationStartDate && data.nominationEndDate) {
      const nomStart = new Date(data.nominationStartDate);
      const nomEnd = new Date(data.nominationEndDate);
      return nomEnd > nomStart;
    }
    return true;
  },
  { message: 'Nomination end date must be after nomination start date', path: ['nominationEndDate'] }
).refine(
  (data) => {
    if (data.nominationEndDate && data.votingStartDate) {
      const nomEnd = new Date(data.nominationEndDate);
      const votingStart = new Date(data.votingStartDate);
      return votingStart >= nomEnd;
    }
    return true;
  },
  { message: 'Voting must start after nominations end', path: ['votingStartDate'] }
);

export const updateElectionSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  electionType: z.enum(electionTypes).optional(),
  nominationStartDate: z.string().datetime().optional().nullable(),
  nominationEndDate: z.string().datetime().optional().nullable(),
  votingStartDate: z.string().datetime().optional(),
  votingEndDate: z.string().datetime().optional(),
  maxVotesPerMember: z.number().int().min(1).optional(),
  allowAbstention: z.boolean().optional(),
  isAnonymous: z.boolean().optional(),
  requiresQuorum: z.boolean().optional(),
  quorumPercentage: z.number().min(0).max(100).optional().nullable(),
});

export const electionQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.enum(electionStatuses).optional(),
  electionType: z.enum(electionTypes).optional(),
  search: z.string().optional(),
});

// ==========================================
// POSITION SCHEMAS
// ==========================================

export const addPositionSchema = z.object({
  title: z.string().min(2, 'Position title must be at least 2 characters').max(100),
  description: z.string().max(500).optional().nullable(),
  maxCandidates: z.number().int().min(1).default(1),
  orderNumber: z.number().int().min(0).optional(),
});

export const updatePositionSchema = z.object({
  title: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  maxCandidates: z.number().int().min(1).optional(),
  orderNumber: z.number().int().min(0).optional(),
});

// ==========================================
// CANDIDATE SCHEMAS
// ==========================================

export const registerCandidateSchema = z.object({
  positionId: z.number().int().positive().optional().nullable(),
  memberId: z.number().int().positive('Member ID is required'),
  manifesto: z.string().max(5000).optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
});

export const selfNominateSchema = z.object({
  positionId: z.number().int().positive().optional().nullable(),
  manifesto: z.string().max(5000).optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
});

export const approveCandidateSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().max(500).optional().nullable(),
}).refine(
  (data) => {
    if (data.status === 'REJECTED' && !data.rejectionReason) {
      return false;
    }
    return true;
  },
  { message: 'Rejection reason is required when rejecting a candidate', path: ['rejectionReason'] }
);

export const withdrawCandidateSchema = z.object({
  withdrawalReason: z.string().max(500).optional().nullable(),
});

// ==========================================
// VOTE SCHEMAS
// ==========================================

export const castVoteSchema = z.object({
  positionId: z.number().int().positive().optional().nullable(),
  candidateId: z.number().int().positive().optional().nullable(),
  isAbstention: z.boolean().default(false),
}).refine(
  (data) => {
    // Either candidateId or isAbstention must be provided
    return Boolean(data.candidateId) || data.isAbstention === true;
  },
  { message: 'Either select a candidate or abstain', path: ['candidateId'] }
);

export const bulkCastVoteSchema = z.object({
  votes: z.array(z.object({
    positionId: z.number().int().positive(),
    candidateId: z.number().int().positive().optional().nullable(),
    isAbstention: z.boolean().default(false),
  })).min(1, 'At least one vote is required'),
});

// ==========================================
// POLL SCHEMAS
// ==========================================

export const createPollOptionSchema = z.object({
  optionText: z.string().min(1, 'Option text is required').max(500),
  orderNumber: z.number().int().min(0).optional(),
});

export const createPollSchema = z.object({
  title: z.string().min(3, 'Poll title must be at least 3 characters').max(200),
  description: z.string().max(2000).optional().nullable(),
  pollType: z.enum(pollTypes),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  allowMultipleVotes: z.boolean().default(false),
  maxChoices: z.number().int().min(1).optional().nullable(),
  isAnonymous: z.boolean().default(true),
  showResultsBeforeEnd: z.boolean().default(false),
  options: z.array(createPollOptionSchema).min(2, 'At least 2 options are required'),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end > start;
  },
  { message: 'End date must be after start date', path: ['endDate'] }
).refine(
  (data) => {
    if (data.pollType === 'YES_NO' && data.options.length !== 2) {
      return false;
    }
    return true;
  },
  { message: 'Yes/No polls must have exactly 2 options', path: ['options'] }
);

export const updatePollSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  allowMultipleVotes: z.boolean().optional(),
  maxChoices: z.number().int().min(1).optional().nullable(),
  isAnonymous: z.boolean().optional(),
  showResultsBeforeEnd: z.boolean().optional(),
});

export const pollQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.enum(pollStatuses).optional(),
  pollType: z.enum(pollTypes).optional(),
  search: z.string().optional(),
});

export const submitPollResponseSchema = z.object({
  optionIds: z.array(z.number().int().positive()).min(1, 'At least one option must be selected'),
});

export const addPollOptionSchema = z.object({
  optionText: z.string().min(1, 'Option text is required').max(500),
  orderNumber: z.number().int().min(0).optional(),
});

// Type exports
export type CreateElectionInput = z.infer<typeof createElectionSchema>;
export type UpdateElectionInput = z.infer<typeof updateElectionSchema>;
export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type AddPositionInput = z.infer<typeof addPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
export type RegisterCandidateInput = z.infer<typeof registerCandidateSchema>;
export type SelfNominateInput = z.infer<typeof selfNominateSchema>;
export type ApproveCandidateInput = z.infer<typeof approveCandidateSchema>;
export type WithdrawCandidateInput = z.infer<typeof withdrawCandidateSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;
export type BulkCastVoteInput = z.infer<typeof bulkCastVoteSchema>;
export type CreatePollInput = z.infer<typeof createPollSchema>;
export type UpdatePollInput = z.infer<typeof updatePollSchema>;
export type CreatePollOptionInput = z.infer<typeof createPollOptionSchema>;
export type SubmitPollResponseInput = z.infer<typeof submitPollResponseSchema>;
export type AddPollOptionInput = z.infer<typeof addPollOptionSchema>;
