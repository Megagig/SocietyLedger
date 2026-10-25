export type VotingStats = {
  participated: number;
  available: number;
  /** Whole-number percentage; 0 when there is nothing to vote on (matches the web "My Voting" stat cards). */
  participationRate: number;
};

/** `votedFlags[i]` is `hasVoted` for history election `i`, or undefined while that status is still loading. */
export function computeVotingStats(available: number, votedFlags: (boolean | undefined)[]): VotingStats {
  const participated = votedFlags.filter(Boolean).length;
  return {
    participated,
    available,
    participationRate: available > 0 ? Math.round((participated / available) * 100) : 0,
  };
}
