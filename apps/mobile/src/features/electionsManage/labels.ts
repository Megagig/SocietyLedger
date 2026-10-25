import type { PermissionAlias } from '@/lib/permissions';
import type { CandidateStatus, ElectionStatus, ElectionType, PollStatus, PollType } from '@/types/api/enums';
import type { CandidateDTO, ElectionDetailDTO } from '@/types/api/voting';

/** The module the elections and polls belong to. */
export const VOTING_MODULE = 'voting';

// ---------------------------------------------------------------- elections

export const ELECTION_STATUS_LABELS: Record<ElectionStatus, string> = {
  DRAFT: 'Draft',
  NOMINATIONS_OPEN: 'Nominations open',
  NOMINATIONS_CLOSED: 'Nominations closed',
  VOTING_OPEN: 'Voting open',
  VOTING_CLOSED: 'Voting closed',
  RESULTS_PUBLISHED: 'Results published',
  CANCELLED: 'Cancelled',
};

export const ELECTION_STATUS_OPTIONS = (Object.keys(ELECTION_STATUS_LABELS) as ElectionStatus[]).map((value) => ({ value, label: ELECTION_STATUS_LABELS[value] }));

/** The key `StatusChip` understands for an election. */
export const electionStatusKey = (status: ElectionStatus): string =>
  ({
    DRAFT: 'draft',
    NOMINATIONS_OPEN: 'nominations',
    NOMINATIONS_CLOSED: 'under_review',
    VOTING_OPEN: 'voting_open',
    VOTING_CLOSED: 'closed',
    RESULTS_PUBLISHED: 'completed',
    CANCELLED: 'cancelled',
  })[status];

export const ELECTION_TYPE_LABELS: Record<ElectionType, string> = {
  GENERAL: 'General',
  EXECUTIVE: 'Executive committee',
  COMMITTEE: 'Committee member',
  SPECIAL: 'Special purpose',
};

export const ELECTION_TYPE_OPTIONS = (Object.keys(ELECTION_TYPE_LABELS) as ElectionType[]).map((value) => ({ value, label: ELECTION_TYPE_LABELS[value] }));

/** Anyone who can do something about an election sees the section; this is what makes Elections appear in Manage. */
export const ELECTION_ADMIN_ACCESS: PermissionAlias[] = [
  'ELECTION_MANAGE',
  'ELECTION_CANDIDATES',
  'ELECTION_RUN',
  'ELECTION_RESULTS_VIEW',
  'ELECTION_RESULTS_PUBLISH',
];

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  PENDING: 'Waiting',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
  WITHDRAWN: 'Withdrawn',
};
export const candidateStatusKey = (status: CandidateStatus): string =>
  status === 'PENDING' ? 'pending' : status === 'APPROVED' ? 'approved' : status === 'REJECTED' ? 'rejected' : 'closed';

/** The four stages an election moves through, for the progress line on the control screen. */
export const ELECTION_STAGES = ['Draft', 'Nominations', 'Voting', 'Results'] as const;

/** Which stage an election is in (0–3), or -1 when it was cancelled. */
export function stageIndex(status: ElectionStatus): number {
  switch (status) {
    case 'DRAFT':
      return 0;
    case 'NOMINATIONS_OPEN':
    case 'NOMINATIONS_CLOSED':
      return 1;
    case 'VOTING_OPEN':
    case 'VOTING_CLOSED':
      return 2;
    case 'RESULTS_PUBLISHED':
      return 3;
    default:
      return -1;
  }
}

export type ElectionStepAction = 'startNominations' | 'closeNominations' | 'startVoting' | 'closeVoting' | 'publishResults';

export type ElectionStep = {
  action: ElectionStepAction;
  label: string;
  /** What the confirmation says will happen. */
  confirmTitle: string;
  confirmDescription: string;
  /** The permission needed to take it. */
  access: PermissionAlias;
};

const STEPS: Partial<Record<ElectionStatus, ElectionStep>> = {
  DRAFT: {
    action: 'startNominations',
    label: 'Open nominations',
    confirmTitle: 'Open nominations?',
    confirmDescription: 'Members can nominate themselves. You can still add and approve candidates.',
    access: 'ELECTION_RUN',
  },
  NOMINATIONS_OPEN: {
    action: 'closeNominations',
    label: 'Close nominations',
    confirmTitle: 'Close nominations?',
    confirmDescription: 'Members can no longer nominate themselves. You can still approve or reject the nominations you have.',
    access: 'ELECTION_RUN',
  },
  NOMINATIONS_CLOSED: {
    action: 'startVoting',
    label: 'Open voting',
    confirmTitle: 'Open voting?',
    confirmDescription: 'Members can vote straight away. The candidates are then fixed and the number of members who can vote is set.',
    access: 'ELECTION_RUN',
  },
  VOTING_OPEN: {
    action: 'closeVoting',
    label: 'Close voting',
    confirmTitle: 'Close voting?',
    confirmDescription: 'No more votes are taken. This can’t be undone.',
    access: 'ELECTION_RUN',
  },
  VOTING_CLOSED: {
    action: 'publishResults',
    label: 'Publish results',
    confirmTitle: 'Publish the results?',
    confirmDescription: 'Every member can see them. This can’t be undone.',
    access: 'ELECTION_RESULTS_PUBLISH',
  },
};

/** The one step that moves the election forward from where it is, or null once it is finished or cancelled. */
export const nextStep = (status: ElectionStatus): ElectionStep | null => STEPS[status] ?? null;

/** Straight to voting from a draft: for when the committee has put the candidates in itself. */
export const OPEN_VOTING_NOW: ElectionStep = {
  action: 'startVoting',
  label: 'Open voting now',
  confirmTitle: 'Open voting now?',
  confirmDescription: 'Skips nominations. Members can vote straight away, and the candidates are then fixed.',
  access: 'ELECTION_RUN',
};

export const isFinished = (status: ElectionStatus): boolean => status === 'RESULTS_PUBLISHED' || status === 'CANCELLED';
export const canEditElection = (status: ElectionStatus): boolean => status === 'DRAFT';
export const canCancelElection = (status: ElectionStatus): boolean => !isFinished(status);
/** Mirrors the API: a draft or cancelled election with no votes. */
export const canDeleteElection = (election: Pick<ElectionDetailDTO, 'status' | '_count'>): boolean =>
  (election.status === 'DRAFT' || election.status === 'CANCELLED') && election._count.votes === 0;
/** Nominations can be added by the committee before they close. */
export const canAddCandidates = (status: ElectionStatus): boolean => status === 'DRAFT' || status === 'NOMINATIONS_OPEN';
/** Candidates can be approved or rejected until voting opens, even after nominations close. */
export const canDecideCandidates = (status: ElectionStatus): boolean => status === 'DRAFT' || status === 'NOMINATIONS_OPEN' || status === 'NOMINATIONS_CLOSED';

export type CandidateGuard = 'ok' | 'own' | 'decided' | 'locked';

/**
 * Whether this committee member may approve or reject a nomination: not their own, only while it is waiting, and only before voting
 * opens. Mirrors the API, so the buttons are hidden rather than refused.
 */
export function candidateGuard(candidate: Pick<CandidateDTO, 'status' | 'memberId'>, electionStatus: ElectionStatus, ownMemberId: number | undefined): CandidateGuard {
  if (candidate.status !== 'PENDING') return 'decided';
  if (!canDecideCandidates(electionStatus)) return 'locked';
  if (ownMemberId !== undefined && candidate.memberId === ownMemberId) return 'own';
  return 'ok';
}

export const CANDIDATE_GUARD_MESSAGES: Record<Exclude<CandidateGuard, 'ok' | 'decided' | 'locked'>, string> = {
  own: 'This is your own nomination, so another member of the committee needs to decide it.',
};

export const countByStatus = (candidates: Pick<CandidateDTO, 'status'>[], status: CandidateStatus): number => candidates.filter((c) => c.status === status).length;

/** "2 nominations are waiting for a decision" — what stops voting from opening. */
export function waitingNote(pending: number): string | null {
  if (pending <= 0) return null;
  return `${pending} ${pending === 1 ? 'nomination is' : 'nominations are'} waiting for a decision. Voting can’t open until each one is approved or rejected.`;
}

/** The share of eligible members who voted, as a whole percent. */
export const turnoutPercent = (voted: number, eligible: number): number => (eligible > 0 ? Math.round((voted / eligible) * 100) : 0);

// ---------------------------------------------------------------- polls

export const POLL_STATUS_LABELS: Record<PollStatus, string> = { DRAFT: 'Draft', ACTIVE: 'Open', CLOSED: 'Closed', CANCELLED: 'Cancelled' };
export const POLL_STATUS_OPTIONS = (Object.keys(POLL_STATUS_LABELS) as PollStatus[]).map((value) => ({ value, label: POLL_STATUS_LABELS[value] }));
export const pollStatusKey = (status: string): string => (status === 'ACTIVE' ? 'active' : status.toLowerCase());

/** Rating polls aren't offered on the phone; everything else is. */
export const POLL_TYPE_LABELS: Partial<Record<PollType, string>> = {
  SINGLE_CHOICE: 'Pick one answer',
  MULTIPLE_CHOICE: 'Pick several answers',
  YES_NO: 'Yes or no',
};
export const POLL_TYPE_OPTIONS = (Object.keys(POLL_TYPE_LABELS) as PollType[]).map((value) => ({ value, label: POLL_TYPE_LABELS[value]! }));

export const canEditPoll = (status: string): boolean => status === 'DRAFT';
export const canCancelPoll = (status: string): boolean => status === 'DRAFT' || status === 'ACTIVE';
/** A draft or cancelled poll nobody has answered. */
export const canDeletePoll = (poll: { status: string; _count: { responses: number } }): boolean =>
  (poll.status === 'DRAFT' || poll.status === 'CANCELLED') && poll._count.responses === 0;
