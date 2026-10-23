import { daysOverdue, lastRemindedAt, remindedLabel, reminderOutcomeSummary } from './labels';

const now = new Date('2026-10-24T12:00:00.000Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe('daysOverdue', () => {
  it('counts whole days past the due date, and is 0 when not yet due or undated', () => {
    expect(daysOverdue(daysAgo(10), now)).toBe(10);
    expect(daysOverdue(daysAgo(-3), now)).toBe(0);
    expect(daysOverdue(null, now)).toBe(0);
  });
});

describe('remindedLabel', () => {
  it('says when they were last reminded, or nothing', () => {
    expect(remindedLabel(null, now)).toBeNull();
    expect(remindedLabel(daysAgo(0), now)).toBe('Reminded today');
    expect(remindedLabel(daysAgo(1), now)).toBe('Reminded yesterday');
    expect(remindedLabel(daysAgo(5), now)).toBe('Reminded 5 days ago');
  });
});

describe('lastRemindedAt', () => {
  it('picks the newest reminder across charges', () => {
    expect(lastRemindedAt([{ lastReminderSentAt: daysAgo(5) }, { lastReminderSentAt: daysAgo(2) }, { lastReminderSentAt: null }])).toBe(daysAgo(2));
    expect(lastRemindedAt([{ lastReminderSentAt: null }])).toBeNull();
  });
});

describe('reminderOutcomeSummary', () => {
  it('reports what happened, honestly', () => {
    expect(reminderOutcomeSummary({ sent: 3, failed: 0, noContact: 0, skippedRecently: 0 })).toBe('Reminded 3 members');
    expect(reminderOutcomeSummary({ sent: 1, failed: 1, noContact: 2, skippedRecently: 4 })).toBe(
      "Reminded 1 member · 4 charges skipped — reminded in the last 24 hours · 2 can't be reached (no email or login) · 1 failed",
    );
    expect(reminderOutcomeSummary({ sent: 0, failed: 0, noContact: 0, skippedRecently: 0 })).toBe('Nothing was sent.');
  });
});
