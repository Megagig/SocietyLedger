import { useQuery } from '@tanstack/react-query';

import { ajoBoardApi } from '@/api/endpoints/ajoBoard';
import { ApiError } from '@/api/errors';
import { useTenantKey } from '@/hooks/useTenantKey';
import { ajoKeys } from './queries';

/** Board keys sit under the Ajo root, so the refresh that follows a payment also refreshes the board. Reads only. */
const boardKey = (tenant: string, groupId: number, ...rest: (string | number)[]) => [...ajoKeys.all(tenant), 'board', groupId, ...rest] as const;

const STALE = 30_000;

export function useBoardOverview(groupId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: boardKey(tenant, groupId, 'overview'), queryFn: () => ajoBoardApi.overview(groupId), enabled: groupId > 0, retry: false, staleTime: STALE });
}
export function useBoardRound(groupId: number, round: number, filter: 'ALL' | 'PAID' | 'NOT_PAID') {
  const tenant = useTenantKey();
  return useQuery({ queryKey: boardKey(tenant, groupId, 'round', round, filter), queryFn: () => ajoBoardApi.round(groupId, round, filter), enabled: groupId > 0 && round > 0, staleTime: STALE });
}
export function useBoardMatrix(groupId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: boardKey(tenant, groupId, 'matrix'), queryFn: () => ajoBoardApi.matrix(groupId), enabled: groupId > 0, staleTime: STALE });
}
export function useBoardPayouts(groupId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: boardKey(tenant, groupId, 'payouts'), queryFn: () => ajoBoardApi.payouts(groupId), enabled: groupId > 0, staleTime: STALE });
}
export function useBoardMembers(groupId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: boardKey(tenant, groupId, 'members'), queryFn: () => ajoBoardApi.members(groupId), enabled: groupId > 0, staleTime: STALE });
}
export function useBoardArrears(groupId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: boardKey(tenant, groupId, 'arrears'), queryFn: () => ajoBoardApi.arrears(groupId), enabled: groupId > 0, staleTime: STALE });
}
export function useBoardMetrics(groupId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: boardKey(tenant, groupId, 'metrics'), queryFn: () => ajoBoardApi.metrics(groupId), enabled: groupId > 0, staleTime: STALE });
}
export function useBoardActivity(groupId: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: boardKey(tenant, groupId, 'activity'), queryFn: () => ajoBoardApi.activity(groupId), enabled: groupId > 0, staleTime: STALE });
}

/** Why the board is closed to this person, if it is: the API's code, as a plain reason the screen can explain. */
export function boardClosedReason(error: unknown): 'NOT_AVAILABLE' | 'OFF' | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'BOARD_NOT_AVAILABLE') return 'NOT_AVAILABLE';
  if (error.code === 'BOARD_OFF') return 'OFF';
  return null;
}
