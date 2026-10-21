import { ringDash } from './ring';

describe('ringDash', () => {
  it('draws nothing at 0% and everything at 100%', () => {
    const empty = ringDash(0, 50);
    const full = ringDash(100, 50);
    expect(empty.offset).toBeCloseTo(empty.circumference);
    expect(full.offset).toBeCloseTo(0);
  });

  it('draws half the circumference at 50%', () => {
    const half = ringDash(50, 40);
    expect(half.offset).toBeCloseTo(half.circumference / 2);
  });

  it('clamps out-of-range and non-finite percentages', () => {
    expect(ringDash(250, 30).percent).toBe(100);
    expect(ringDash(-5, 30).percent).toBe(0);
    expect(ringDash(Number.NaN, 30).percent).toBe(0);
  });
});
