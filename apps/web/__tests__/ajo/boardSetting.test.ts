import { boardSetting } from '@/lib/ajo/boardSetting';

const v = (effectiveFrom: string, memberVisibility: 'FULL' | 'OFF') => ({ effectiveFrom, rules: { memberVisibility } });
const now = new Date('2026-11-01T00:00:00Z');

describe('boardSetting', () => {
  it('is on when the rules in effect let members see each other', () => {
    expect(boardSetting([v('2026-10-01T00:00:00Z', 'FULL')], now)).toEqual({ state: 'ON' });
  });

  it('is off when they do not', () => {
    expect(boardSetting([v('2026-10-01T00:00:00Z', 'OFF')], now)).toEqual({ state: 'OFF' });
  });

  it('says when it turns on, because a rule change waits out its notice period', () => {
    expect(boardSetting([v('2026-10-01T00:00:00Z', 'OFF'), v('2026-11-08T00:00:00Z', 'FULL')], now)).toEqual({ state: 'TURNS_ON', on: '2026-11-08T00:00:00Z' });
  });

  it('says when it turns off', () => {
    expect(boardSetting([v('2026-10-01T00:00:00Z', 'FULL'), v('2026-11-08T00:00:00Z', 'OFF')], now)).toEqual({ state: 'TURNS_OFF', on: '2026-11-08T00:00:00Z' });
  });

  it('ignores a later version that changes nothing', () => {
    expect(boardSetting([v('2026-10-01T00:00:00Z', 'OFF'), v('2026-11-08T00:00:00Z', 'OFF')], now)).toEqual({ state: 'OFF' });
  });
});
