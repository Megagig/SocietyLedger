import { z } from 'zod';

import type { ElectionType, PollType } from '@/types/api/enums';
import type { ElectionPayload, PollPayload, PollUpdatePayload, PositionPayload } from '@/types/api/electionsManage';
import type { ElectionDetailDTO, PollDetailDTO } from '@/types/api/voting';

const isoOrBlank = z.string();
const when = (value: string): Date | null => (value ? new Date(value) : null);

// ---------------------------------------------------------------- an election

export const electionFormSchema = z
  .object({
    title: z.string().trim().min(3, 'The title needs at least 3 characters').max(200, 'Keep the title under 200 characters'),
    description: z.string().trim().max(2000, 'Keep the description under 2,000 characters'),
    electionType: z.string().min(1, 'Choose the kind of election'),
    nominationStartDate: isoOrBlank,
    nominationEndDate: isoOrBlank,
    votingStartDate: z.string().min(1, 'Say when voting starts'),
    votingEndDate: z.string().min(1, 'Say when voting ends'),
    allowAbstention: z.boolean(),
    isAnonymous: z.boolean(),
    requiresQuorum: z.boolean(),
    quorumPercentage: z.string().trim(),
    /** Only used when the election is created; afterwards positions are changed one at a time. */
    positions: z.array(z.object({ title: z.string().trim().max(100, 'Keep it under 100 characters') })),
  })
  .superRefine((v, ctx) => {
    const votingStart = when(v.votingStartDate);
    const votingEnd = when(v.votingEndDate);
    const nominationStart = when(v.nominationStartDate);
    const nominationEnd = when(v.nominationEndDate);
    if (votingStart && votingEnd && votingEnd <= votingStart) {
      ctx.addIssue({ code: 'custom', path: ['votingEndDate'], message: 'Voting has to end after it starts' });
    }
    if (nominationStart && nominationEnd && nominationEnd <= nominationStart) {
      ctx.addIssue({ code: 'custom', path: ['nominationEndDate'], message: 'Nominations have to end after they start' });
    }
    if (nominationEnd && votingStart && nominationEnd > votingStart) {
      ctx.addIssue({ code: 'custom', path: ['nominationEndDate'], message: 'Nominations have to close before voting starts' });
    }
    if (v.requiresQuorum) {
      const pct = Number(v.quorumPercentage);
      if (!/^\d+$/.test(v.quorumPercentage) || pct < 1 || pct > 100) {
        ctx.addIssue({ code: 'custom', path: ['quorumPercentage'], message: 'Say what percentage of members must vote (1 to 100)' });
      }
    }
    v.positions.forEach((p, i) => {
      if (p.title && p.title.length < 2) ctx.addIssue({ code: 'custom', path: ['positions', i, 'title'], message: 'The title needs at least 2 characters' });
    });
  });
export type ElectionFormValues = z.infer<typeof electionFormSchema>;

export const emptyElectionValues = (): ElectionFormValues => ({
  title: '', description: '', electionType: 'GENERAL', nominationStartDate: '', nominationEndDate: '', votingStartDate: '', votingEndDate: '',
  allowAbstention: true, isAnonymous: true, requiresQuorum: false, quorumPercentage: '', positions: [{ title: '' }],
});

export function electionToFormValues(election: ElectionDetailDTO): ElectionFormValues {
  return {
    title: election.title,
    description: election.description ?? '',
    electionType: election.electionType,
    nominationStartDate: election.nominationStartDate ?? '',
    nominationEndDate: election.nominationEndDate ?? '',
    votingStartDate: election.votingStartDate,
    votingEndDate: election.votingEndDate,
    allowAbstention: election.allowAbstention,
    isAnonymous: election.isAnonymous,
    requiresQuorum: election.requiresQuorum,
    quorumPercentage: election.quorumPercentage === null ? '' : String(election.quorumPercentage),
    positions: [],
  };
}

export function toElectionPayload(values: ElectionFormValues, create: boolean): ElectionPayload {
  const positions: PositionPayload[] = values.positions.filter((p) => p.title.trim()).map((p) => ({ title: p.title.trim(), maxCandidates: 1 }));
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    electionType: values.electionType as ElectionType,
    nominationStartDate: values.nominationStartDate || null,
    nominationEndDate: values.nominationEndDate || null,
    votingStartDate: values.votingStartDate,
    votingEndDate: values.votingEndDate,
    allowAbstention: values.allowAbstention,
    isAnonymous: values.isAnonymous,
    requiresQuorum: values.requiresQuorum,
    quorumPercentage: values.requiresQuorum ? Number(values.quorumPercentage) : null,
    ...(create && positions.length > 0 ? { positions } : {}),
  };
}

// ---------------------------------------------------------------- a position

export const positionSchema = z.object({
  title: z.string().trim().min(2, 'The title needs at least 2 characters').max(100, 'Keep the title under 100 characters'),
  description: z.string().trim().max(500, 'Keep the description under 500 characters'),
});
export type PositionValues = z.infer<typeof positionSchema>;

export const toPositionPayload = (values: PositionValues): PositionPayload => ({ title: values.title.trim(), description: values.description.trim() || null, maxCandidates: 1 });

// ---------------------------------------------------------------- a candidate

export const candidateSchema = z.object({
  manifesto: z.string().trim().max(5000, 'Keep it under 5,000 characters'),
});
export type CandidateValues = z.infer<typeof candidateSchema>;

// ---------------------------------------------------------------- a poll

export const pollFormSchema = z
  .object({
    title: z.string().trim().min(3, 'The title needs at least 3 characters').max(200, 'Keep the title under 200 characters'),
    description: z.string().trim().max(2000, 'Keep the description under 2,000 characters'),
    pollType: z.string().min(1, 'Choose how members answer'),
    startDate: z.string().min(1, 'Say when the poll starts'),
    endDate: z.string().min(1, 'Say when the poll ends'),
    maxChoices: z.string().trim(),
    isAnonymous: z.boolean(),
    showResultsBeforeEnd: z.boolean(),
    /** Only used when the poll is created; afterwards options are added and removed one at a time. */
    options: z.array(z.object({ text: z.string().trim().max(500, 'Keep it under 500 characters') })),
  })
  .superRefine((v, ctx) => {
    const start = when(v.startDate);
    const end = when(v.endDate);
    if (start && end && end <= start) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The poll has to end after it starts' });
    if (v.pollType === 'MULTIPLE_CHOICE' && v.maxChoices && !/^[1-9]\d*$/.test(v.maxChoices)) {
      ctx.addIssue({ code: 'custom', path: ['maxChoices'], message: 'Enter a whole number, or leave it blank' });
    }
  });
export type PollFormValues = z.infer<typeof pollFormSchema>;

export const emptyPollValues = (): PollFormValues => ({
  title: '', description: '', pollType: 'SINGLE_CHOICE', startDate: '', endDate: '', maxChoices: '', isAnonymous: true, showResultsBeforeEnd: false,
  options: [{ text: '' }, { text: '' }],
});

/** Why the options can't be saved yet, or null. A yes/no poll makes its own two options. */
export function pollOptionsProblem(values: Pick<PollFormValues, 'pollType' | 'options' | 'maxChoices'>): string | null {
  if (values.pollType === 'YES_NO') return null;
  const texts = values.options.map((o) => o.text.trim()).filter(Boolean);
  if (texts.length < 2) return 'A poll needs at least two answers.';
  if (new Set(texts.map((t) => t.toLowerCase())).size !== texts.length) return 'Two answers are the same.';
  if (values.pollType === 'MULTIPLE_CHOICE' && values.maxChoices && Number(values.maxChoices) > texts.length) return 'Members can’t pick more answers than there are.';
  return null;
}

export function pollToFormValues(poll: PollDetailDTO): PollFormValues {
  return {
    title: poll.title,
    description: poll.description ?? '',
    pollType: poll.pollType,
    startDate: poll.startDate,
    endDate: poll.endDate,
    maxChoices: poll.maxChoices === null ? '' : String(poll.maxChoices),
    isAnonymous: poll.isAnonymous,
    showResultsBeforeEnd: poll.showResultsBeforeEnd,
    options: [],
  };
}

export function toPollPayload(values: PollFormValues): PollPayload {
  const pollType = values.pollType as PollType;
  const multiple = pollType === 'MULTIPLE_CHOICE';
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    pollType,
    startDate: values.startDate,
    endDate: values.endDate,
    allowMultipleVotes: multiple,
    maxChoices: multiple && values.maxChoices ? Number(values.maxChoices) : null,
    isAnonymous: values.isAnonymous,
    showResultsBeforeEnd: values.showResultsBeforeEnd,
    options:
      pollType === 'YES_NO'
        ? [{ optionText: 'Yes' }, { optionText: 'No' }]
        : values.options.filter((o) => o.text.trim()).map((o) => ({ optionText: o.text.trim() })),
  };
}

export function toPollUpdatePayload(values: PollFormValues): PollUpdatePayload {
  const multiple = values.pollType === 'MULTIPLE_CHOICE';
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    startDate: values.startDate,
    endDate: values.endDate,
    maxChoices: multiple && values.maxChoices ? Number(values.maxChoices) : null,
    isAnonymous: values.isAnonymous,
    showResultsBeforeEnd: values.showResultsBeforeEnd,
  };
}

export const pollOptionSchema = z.object({ optionText: z.string().trim().min(1, 'Write the answer').max(500, 'Keep it under 500 characters') });
export type PollOptionValues = z.infer<typeof pollOptionSchema>;
