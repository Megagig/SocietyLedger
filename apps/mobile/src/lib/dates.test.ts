import { formatDate, isToday } from './dates';

describe('formatDate', () => {
  it('formats "short" as weekday + day + month', () => {
    expect(formatDate('2026-10-14T10:00:00.000Z', 'short')).toBe('Wed 14 Oct');
  });

  it('formats "long" as day + month + year', () => {
    expect(formatDate('2026-10-14T10:00:00.000Z', 'long')).toBe('14 Oct 2026');
  });

  it('formats "time" as h:mm AM/PM', () => {
    expect(formatDate('2026-10-14T10:30:00.000Z', 'time')).toBe('11:30 AM');
  });

  it('formats "monthYear" as full month name + year', () => {
    expect(formatDate('2026-10-14T10:00:00.000Z', 'monthYear')).toBe('October 2026');
  });

  it('defaults to "short" when no variant is given', () => {
    expect(formatDate('2026-10-14T10:00:00.000Z')).toBe(formatDate('2026-10-14T10:00:00.000Z', 'short'));
  });

  describe('"relative"', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-10-14T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('formats a past time as "<n> ago"', () => {
      expect(formatDate('2026-10-14T11:55:00.000Z', 'relative')).toBe('5 minutes ago');
    });

    it('formats a future time as "in <n>"', () => {
      expect(formatDate('2026-10-14T12:05:00.000Z', 'relative')).toBe('in 5 minutes');
    });
  });
});

describe('isToday', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-14T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is true for a timestamp earlier today', () => {
    expect(isToday('2026-10-14T06:00:00.000Z')).toBe(true);
  });

  it('is false for yesterday', () => {
    expect(isToday('2026-10-13T12:00:00.000Z')).toBe(false);
  });

  it('is false for tomorrow', () => {
    expect(isToday('2026-10-15T12:00:00.000Z')).toBe(false);
  });
});
