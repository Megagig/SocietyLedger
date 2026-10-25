import { membersManageApi } from '@/api/endpoints/membersManage';

/** Every active member's id, a page at a time — what "all active members" means for a bulk charge or a levy. */
export async function allActiveMemberIds(): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; page <= 50; page++) {
    const result = await membersManageApi.listMembers({ page, limit: 100, status: 'active' });
    ids.push(...result.members.map((m) => m.id));
    if (!result.pagination.hasMore) break;
  }
  return ids;
}
