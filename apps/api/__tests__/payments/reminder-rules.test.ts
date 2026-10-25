import { REMINDER_COOLDOWN_HOURS, reminderText, splitByCooldown, wasRemindedRecently } from '../../src/modules/finance/reminder-rules';

const now = new Date('2026-10-24T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe('wasRemindedRecently', () => {
  it('is true inside the cooldown and false at or past it, or when never reminded', () => {
    expect(wasRemindedRecently(hoursAgo(1), now)).toBe(true);
    expect(wasRemindedRecently(hoursAgo(REMINDER_COOLDOWN_HOURS - 0.1), now)).toBe(true);
    expect(wasRemindedRecently(hoursAgo(REMINDER_COOLDOWN_HOURS), now)).toBe(false);
    expect(wasRemindedRecently(hoursAgo(72), now)).toBe(false);
    expect(wasRemindedRecently(null, now)).toBe(false);
  });
});

describe('splitByCooldown', () => {
  it('separates charges that can be reminded from those reminded too recently', () => {
    const charges = [
      { id: 1, lastReminderSentAt: null },
      { id: 2, lastReminderSentAt: hoursAgo(2) },
      { id: 3, lastReminderSentAt: hoursAgo(48) },
    ];
    const { fresh, recent } = splitByCooldown(charges, now);
    expect(fresh.map((c) => c.id)).toEqual([1, 3]);
    expect(recent.map((c) => c.id)).toEqual([2]);
  });
});

describe('reminderText', () => {
  it('says what is owed, and is firmer when overdue', () => {
    const waiting = reminderText({ count: 1, total: 5000, overdue: false });
    expect(waiting.title).toBe('Payment reminder');
    expect(waiting.message).toContain('1 payment waiting');
    expect(waiting.message).toContain('5,000.00');
    const overdue = reminderText({ count: 3, total: 12000.5, overdue: true });
    expect(overdue.title).toBe('Payment overdue');
    expect(overdue.message).toContain('3 payments overdue');
  });

  it('adds the officer\'s own message in place of the default nudge', () => {
    expect(reminderText({ count: 1, total: 100, overdue: false, custom: 'See you Saturday.' }).message).toContain('See you Saturday.');
    expect(reminderText({ count: 1, total: 100, overdue: false }).message).toContain('Please pay when you can.');
  });
});
