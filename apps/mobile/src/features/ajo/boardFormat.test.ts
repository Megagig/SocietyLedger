import { collectedPercent, daysPhrase, formatMomentIn, percent, shortDay } from './boardFormat';

describe('percent', () => {
  it('turns basis points into a whole percentage', () => {
    expect(percent(9500)).toBe('95%');
    expect(percent(0)).toBe('0%');
    expect(percent(8333)).toBe('83%');
  });
  it('says there is nothing to measure rather than showing 0%', () => {
    expect(percent(null)).toBe('None yet');
    expect(percent(undefined)).toBe('None yet');
  });
});

describe('collectedPercent', () => {
  it('works from kobo strings', () => {
    expect(collectedPercent('7000000', '10000000')).toBe(70);
    expect(collectedPercent('0', '10000000')).toBe(0);
  });
  it('does not divide by nothing', () => {
    expect(collectedPercent('500', '0')).toBe(0);
  });
  it('does not lose precision on a large pot', () => {
    expect(collectedPercent('900000000000000000', '1000000000000000000')).toBe(90);
  });
});

describe('shortDay', () => {
  it('shows the same calendar day wherever the reader is', () => {
    expect(shortDay('2027-03-04')).toBe('4 Mar');
    expect(shortDay('2027-03-04T00:00:00.000Z')).toBe('4 Mar');
  });
  it('is empty for nothing', () => {
    expect(shortDay(null)).toBe('');
    expect(shortDay('not a date')).toBe('');
  });
});

describe('formatMomentIn', () => {
  it('is empty for nothing or rubbish', () => {
    expect(formatMomentIn(null, 'Africa/Lagos')).toBe('');
    expect(formatMomentIn('nonsense', 'Africa/Lagos')).toBe('');
  });
  it('shows a time without throwing, even for a timezone the device does not know', () => {
    expect(formatMomentIn('2027-03-04T13:02:00.000Z', 'Africa/Lagos')).toMatch(/\d/);
    expect(formatMomentIn('2027-03-04T13:02:00.000Z', 'Not/AZone')).toMatch(/\d/);
  });
});

describe('daysPhrase', () => {
  it('reads naturally either side of today', () => {
    expect(daysPhrase(0)).toBe('today');
    expect(daysPhrase(1)).toBe('in 1 day');
    expect(daysPhrase(2)).toBe('in 2 days');
    expect(daysPhrase(-1)).toBe('1 day ago');
    expect(daysPhrase(-3)).toBe('3 days ago');
  });
});
