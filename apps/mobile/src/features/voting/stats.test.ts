import { computeVotingStats } from './stats';

describe('computeVotingStats', () => {
  it('is all zeros when there are no elections', () => {
    expect(computeVotingStats(0, [])).toEqual({ participated: 0, available: 0, participationRate: 0 });
  });

  it('counts voted elections and rounds the rate', () => {
    expect(computeVotingStats(3, [true, false, true])).toEqual({ participated: 2, available: 3, participationRate: 67 });
  });

  it('treats a still-loading status as not voted', () => {
    expect(computeVotingStats(2, [true, undefined])).toEqual({ participated: 1, available: 2, participationRate: 50 });
  });
});
