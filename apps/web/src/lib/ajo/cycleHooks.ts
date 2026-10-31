'use client';

/**
 * Collector-thrift cycles (spec §16.5): the calls and hooks. A saver sets their own amount and answers "withdraw or continue" for
 * themselves; an officer sees the whole cycle and, once it is over and the savers who are leaving are paid, starts the next one.
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { useAjoAction } from './staffHooks';

type Envelope<T> = { success: boolean; data: T };
const get = async <T>(url: string): Promise<T> => ((await api.get(url)) as { data: Envelope<T> }).data.data;
const send = async <T>(method: 'put' | 'post', url: string, body: unknown): Promise<T> => ((await api[method](url, body)) as { data: Envelope<T> }).data.data;

export type CycleChoice = 'PENDING' | 'WITHDRAW' | 'CONTINUE';

/** What one saver sees about their cycle. Money is a kobo string. */
export type CycleViewDTO = {
  membershipId: number;
  groupId: number;
  cycleNo: number;
  amountKobo: string;
  minAmountKobo: string;
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
  ifNoAnswer: string;
};

/** What an officer sees about the running cycle. */
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
  people: Array<{ membershipId: number; name: string; amountKobo: string; savedKobo: string; choice: CycleChoice; effectiveChoice: 'WITHDRAW' | 'CONTINUE'; nextAmountKobo: string | null; decidedVia: string | null }>;
};

export const useCycle = (membershipId: number) => useQuery({ queryKey: ['ajo', 'cycle', membershipId], queryFn: () => get<CycleViewDTO>(`/ajo/memberships/${membershipId}/cycle`), enabled: membershipId > 0 });
export const useGroupCycle = (groupId: number) => useQuery({ queryKey: ['ajo', 'group-cycle', groupId], queryFn: () => get<GroupCycleDTO>(`/ajo/groups/${groupId}/cycle`), enabled: groupId > 0 });

export const useSetAmount = (membershipId: number) => useAjoAction((amountKobo: string) => send<{ amountKobo: string; changed: boolean }>('put', `/ajo/memberships/${membershipId}/amount`, { amountKobo }));
export const useDecideCycle = (membershipId: number) =>
  useAjoAction((input: { choice: 'WITHDRAW' | 'CONTINUE'; nextAmountKobo?: string }) => send<CycleViewDTO>('post', `/ajo/memberships/${membershipId}/cycle/decision`, input));
export const useStartNextCycle = (groupId: number) => useAjoAction<void>(() => send<{ cycleNo: number; startsOn: string; endsOn: string; continuing: number; withdrawn: number }>('post', `/ajo/groups/${groupId}/cycles/next`, {}));
