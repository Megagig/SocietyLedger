import { mergeRotatingCircles } from './circles';
import type { GroupDTO, MyMembershipDTO } from '@/types/api/ajo';

const group = (id: number, model: string, status = 'RUNNING') => ({ id, model, status }) as unknown as GroupDTO;
const mine = (g: GroupDTO, status = 'ACTIVE') => ({ membershipId: g.id, status, group: g }) as unknown as MyMembershipDTO;

describe('mergeRotatingCircles', () => {
  it('lists the rotating pots a member is in, and not collector thrift or ones they left', () => {
    const out = mergeRotatingCircles([mine(group(1, 'ROTATING_POT')), mine(group(2, 'COLLECTOR_THRIFT')), mine(group(3, 'ROTATING_POT'), 'LEFT')], []);
    expect(out.map((g) => g.id)).toEqual([1]);
  });

  it('gives an officer who is not a contributor every rotating pot of the group', () => {
    const out = mergeRotatingCircles([], [group(1, 'ROTATING_POT'), group(2, 'COLLECTOR_THRIFT'), group(3, 'ROTATING_POT', 'OPEN')]);
    expect(out.map((g) => g.id)).toEqual([1, 3]);
  });

  it('shows a circle once when the person is both a member and an officer, and skips cancelled ones', () => {
    const g = group(1, 'ROTATING_POT');
    const out = mergeRotatingCircles([mine(g)], [g, group(4, 'ROTATING_POT', 'CANCELLED')]);
    expect(out.map((x) => x.id)).toEqual([1]);
  });
});
