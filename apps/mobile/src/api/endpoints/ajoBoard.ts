import { client } from '../client';
import { unwrap } from '../envelope';
import type { BoardActivityDTO, BoardArrearsDTO, BoardMatrixDTO, BoardMembersDTO, BoardMetricsDTO, BoardOverviewDTO, BoardPayoutsDTO, BoardRoundDTO } from '@/types/api/ajoBoard';

const get = <T>(url: string, params?: Record<string, unknown>) => unwrap<T>(client.get(url, { params }));

/**
 * The Circle board (spec §16.4): read-only, rotating pot only. A collector-thrift scheme answers 403 `BOARD_NOT_AVAILABLE` and a circle
 * whose admin has the board off answers 403 `BOARD_OFF` (officers can still read it).
 * Verified against apps/api ajo-board.controller.ts (2026-10-29).
 */
export const ajoBoardApi = {
  /** GET /ajo/groups/:id/board */
  overview: (groupId: number) => get<BoardOverviewDTO>(`/ajo/groups/${groupId}/board`),
  /** GET /ajo/groups/:id/board/rounds/:round */
  round: (groupId: number, round: number, filter: 'ALL' | 'PAID' | 'NOT_PAID') => get<BoardRoundDTO>(`/ajo/groups/${groupId}/board/rounds/${round}`, { filter }),
  /** GET /ajo/groups/:id/board/matrix */
  matrix: (groupId: number) => get<BoardMatrixDTO>(`/ajo/groups/${groupId}/board/matrix`),
  /** GET /ajo/groups/:id/board/payouts */
  payouts: (groupId: number) => get<BoardPayoutsDTO>(`/ajo/groups/${groupId}/board/payouts`),
  /** GET /ajo/groups/:id/board/members */
  members: (groupId: number) => get<BoardMembersDTO>(`/ajo/groups/${groupId}/board/members`),
  /** GET /ajo/groups/:id/board/arrears */
  arrears: (groupId: number) => get<BoardArrearsDTO>(`/ajo/groups/${groupId}/board/arrears`),
  /** GET /ajo/groups/:id/board/metrics */
  metrics: (groupId: number) => get<BoardMetricsDTO>(`/ajo/groups/${groupId}/board/metrics`),
  /** GET /ajo/groups/:id/board/activity */
  activity: (groupId: number, before?: string) => get<BoardActivityDTO>(`/ajo/groups/${groupId}/board/activity`, { before }),
};
