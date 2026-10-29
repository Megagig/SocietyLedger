/**
 * Collector-thrift cycles (spec §16.5): what a saver and an officer see. Same shapes as apps/web `cycleHooks.ts`. Money is a kobo string.
 */

export type CycleChoice = 'PENDING' | 'WITHDRAW' | 'CONTINUE';

export type CycleViewDTO = {
  membershipId: number;
  groupId: number;
  cycleNo: number;
  /** What this saver pays each time in this cycle. They chose it and it stays the same for the whole cycle. */
  amountKobo: string;
  minAmountKobo: string;
  /** Savings brought in from the cycle before, after that cycle's collector fee. */
  carriedKobo: string;
  startsOn: string;
  endsOn: string | null;
  promptOpensOn: string | null;
  canChangeAmount: boolean;
  canDecide: boolean;
  choice: CycleChoice;
  effectiveChoice: 'WITHDRAW' | 'CONTINUE';
  nextAmountKobo: string | null;
  decidedVia: string | null;
  decidedAt: string | null;
  payoutStarted: boolean;
  /** "If you do not answer, your savings are paid out to you." */
  ifNoAnswer: string;
};

export type GroupCycleDTO = {
  groupId: number;
  cycleNo: number;
  startsOn: string;
  endsOn: string | null;
  promptOpensOn: string | null;
  promptOpen: boolean;
  cycleOver: boolean;
  counts: { continuing: number; withdrawing: number; noAnswer: number };
  canStartNext: boolean;
  people: {
    membershipId: number;
    name: string;
    amountKobo: string;
    savedKobo: string;
    choice: CycleChoice;
    effectiveChoice: 'WITHDRAW' | 'CONTINUE';
    nextAmountKobo: string | null;
    decidedVia: string | null;
  }[];
};
