'use client';

/**
 * The Circle board's calls and React Query hooks. Keys sit under `ajo` so the same refresh that follows a payment also refreshes the
 * board. The board only reads; nothing here changes anything.
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import type { BoardActivityDTO, BoardArrearsDTO, BoardMatrixDTO, BoardMembersDTO, BoardMetricsDTO, BoardOverviewDTO, BoardPayoutsDTO, BoardRoundDTO } from './boardTypes';

type Envelope<T> = { success: boolean; data: T };
const get = async <T>(url: string, params?: Record<string, unknown>): Promise<T> => ((await api.get(url, { params })) as { data: Envelope<T> }).data.data;

export const boardApi = {
  overview: (groupId: number) => get<BoardOverviewDTO>(`/ajo/groups/${groupId}/board`),
  round: (groupId: number, round: number, filter: 'ALL' | 'PAID' | 'NOT_PAID') => get<BoardRoundDTO>(`/ajo/groups/${groupId}/board/rounds/${round}`, { filter }),
  matrix: (groupId: number) => get<BoardMatrixDTO>(`/ajo/groups/${groupId}/board/matrix`),
  payouts: (groupId: number) => get<BoardPayoutsDTO>(`/ajo/groups/${groupId}/board/payouts`),
  members: (groupId: number) => get<BoardMembersDTO>(`/ajo/groups/${groupId}/board/members`),
  arrears: (groupId: number) => get<BoardArrearsDTO>(`/ajo/groups/${groupId}/board/arrears`),
  metrics: (groupId: number) => get<BoardMetricsDTO>(`/ajo/groups/${groupId}/board/metrics`),
  activity: (groupId: number, before?: string) => get<BoardActivityDTO>(`/ajo/groups/${groupId}/board/activity`, { before }),
};

const key = (groupId: number, ...rest: Array<string | number | undefined>) => ['ajo', 'board', groupId, ...rest] as const;
const on = (groupId: number) => groupId > 0;

export const useBoardOverview = (groupId: number) => useQuery({ queryKey: key(groupId, 'overview'), queryFn: () => boardApi.overview(groupId), enabled: on(groupId), retry: false, staleTime: 30_000 });
export const useBoardRound = (groupId: number, round: number, filter: 'ALL' | 'PAID' | 'NOT_PAID') => useQuery({ queryKey: key(groupId, 'round', round, filter), queryFn: () => boardApi.round(groupId, round, filter), enabled: on(groupId) && round > 0, staleTime: 30_000 });
export const useBoardMatrix = (groupId: number) => useQuery({ queryKey: key(groupId, 'matrix'), queryFn: () => boardApi.matrix(groupId), enabled: on(groupId), staleTime: 30_000 });
export const useBoardPayouts = (groupId: number) => useQuery({ queryKey: key(groupId, 'payouts'), queryFn: () => boardApi.payouts(groupId), enabled: on(groupId), staleTime: 30_000 });
export const useBoardMembers = (groupId: number) => useQuery({ queryKey: key(groupId, 'members'), queryFn: () => boardApi.members(groupId), enabled: on(groupId), staleTime: 30_000 });
export const useBoardArrears = (groupId: number) => useQuery({ queryKey: key(groupId, 'arrears'), queryFn: () => boardApi.arrears(groupId), enabled: on(groupId), staleTime: 30_000 });
export const useBoardMetrics = (groupId: number) => useQuery({ queryKey: key(groupId, 'metrics'), queryFn: () => boardApi.metrics(groupId), enabled: on(groupId), staleTime: 30_000 });
export const useBoardActivity = (groupId: number) => useQuery({ queryKey: key(groupId, 'activity'), queryFn: () => boardApi.activity(groupId), enabled: on(groupId), staleTime: 30_000 });
