import { client } from '../client';
import { unwrap } from '../envelope';
import type { UpcomingMeetingDTO } from '@/types/api/meetings';

/** `/meetings/*` (tenant required). Only `getUpcoming` so far — `getRecent`/`:id`/etc. land here
 * as later features need them. */
export const meetingsApi = {
  /** GET /meetings/upcoming?limit — verified against meetings.controller.ts getUpcoming
   * (2026-10-20). Bare array, no pagination wrapper; `limit` is genuinely respected here
   * (unlike `/members/me/payments`). */
  async getUpcoming(limit: number): Promise<UpcomingMeetingDTO[]> {
    return unwrap<UpcomingMeetingDTO[]>(client.get('/meetings/upcoming', { params: { limit } }));
  },
};
