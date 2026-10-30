import type { GroupDTO, MyMembershipDTO } from '@/types/api/ajo';

/** The rotating pots to open a board for: those the person is in (not left) and, for an officer, every rotating pot of the group. Cancelled ones are left out; each appears once. */
export function mergeRotatingCircles(memberships: MyMembershipDTO[], groups: GroupDTO[]): GroupDTO[] {
  const found = new Map<number, GroupDTO>();
  for (const m of memberships) if (m.group.model === 'ROTATING_POT' && m.status !== 'LEFT' && m.group.status !== 'CANCELLED') found.set(m.group.id, m.group);
  for (const g of groups) if (g.model === 'ROTATING_POT' && g.status !== 'CANCELLED') found.set(g.id, g);
  return [...found.values()];
}
