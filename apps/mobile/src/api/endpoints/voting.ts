import { client } from '../client';
import { unwrap } from '../envelope';
import type { ActiveVotingItemsDTO } from '@/types/api/voting';

/** `/voting/*` (tenant required). Only `getActive` so far — `dashboard`/`elections`/etc. land
 * here as F3.5+ need them. */
export const votingApi = {
  /** GET /voting/active — verified against voting.service.ts getActiveVotingItems (2026-10-20).
   * Two separate lists (`activeElections`/`activePolls`), not one merged feed. */
  async getActive(): Promise<ActiveVotingItemsDTO> {
    return unwrap<ActiveVotingItemsDTO>(client.get('/voting/active'));
  },
};
