import {
  assignOutcomeSummary,
  assignmentCanRemove,
  campaignCanAssign,
  campaignCanClose,
  campaignCanEdit,
  campaignStatusKey,
  categoryTypeLocked,
  categoryUsageLabel,
  deadlineLabel,
  frequencyLabel,
  stillOwedLine,
} from './labels';

describe('categories', () => {
  it('says how much a category is used', () => {
    expect(categoryUsageLabel(0)).toBe('Not used yet');
    expect(categoryUsageLabel(1)).toBe('Used by 1 charge or campaign');
    expect(categoryUsageLabel(12)).toBe('Used by 12 charges and campaigns');
  });

  it('locks the type once anything uses the category', () => {
    expect(categoryTypeLocked({ usageCount: 0 })).toBe(false);
    expect(categoryTypeLocked({ usageCount: 3 })).toBe(true);
    expect(categoryTypeLocked(null)).toBe(false);
  });

  it('names a frequency, or nothing', () => {
    expect(frequencyLabel('monthly')).toBe('Monthly');
    expect(frequencyLabel('one-time')).toBe('One-time');
    expect(frequencyLabel(null)).toBeNull();
  });
});

describe('campaign actions', () => {
  it('only an active campaign takes members and can be closed', () => {
    expect(campaignCanAssign('ACTIVE')).toBe(true);
    expect(campaignCanClose('ACTIVE')).toBe(true);
    for (const status of ['DRAFT', 'CLOSED', 'COMPLETED', 'CANCELLED'] as const) {
      expect(campaignCanAssign(status)).toBe(false);
      expect(campaignCanClose(status)).toBe(false);
    }
  });

  it('a completed or cancelled campaign is a record, not editable', () => {
    expect(campaignCanEdit('ACTIVE')).toBe(true);
    expect(campaignCanEdit('CLOSED')).toBe(true);
    expect(campaignCanEdit('COMPLETED')).toBe(false);
    expect(campaignCanEdit('CANCELLED')).toBe(false);
  });

  it('maps a status to a chip key', () => {
    expect(campaignStatusKey('CLOSED')).toBe('closed');
    expect(campaignStatusKey('ACTIVE')).toBe('active');
  });

  it('removing a member is only for one who has paid nothing', () => {
    expect(assignmentCanRemove({ paidAmount: 0 })).toBe(true);
    expect(assignmentCanRemove({ paidAmount: 500 })).toBe(false);
  });
});

describe('deadlineLabel', () => {
  const now = new Date('2026-10-26T15:00:00');
  it('counts whole days from today', () => {
    expect(deadlineLabel('2026-10-26T00:00:00', now)).toBe('Due today');
    expect(deadlineLabel('2026-10-27T00:00:00', now)).toBe('1 day left');
    expect(deadlineLabel('2026-11-05T00:00:00', now)).toBe('10 days left');
    expect(deadlineLabel('2026-10-25T00:00:00', now)).toBe('1 day overdue');
    expect(deadlineLabel('2026-10-20T00:00:00', now)).toBe('6 days overdue');
  });
});

describe('the debt outlives the campaign', () => {
  it('a closed campaign says what is still owed and that it stays owed', () => {
    expect(stillOwedLine(12, true)).toMatch(/12 members still owe this levy.*stay owed and keep being reminded/);
    expect(stillOwedLine(1, true)).toMatch(/^1 member still owes/);
  });
  it('an open campaign just counts them, and nobody owing is good news', () => {
    expect(stillOwedLine(3, false)).toBe('3 members still owe this levy.');
    expect(stillOwedLine(0, true)).toBe('Everyone assigned has paid.');
  });
  it('summarises an assignment', () => {
    expect(assignOutcomeSummary({ assigned: 4, skipped: 0 })).toBe('Assigned 4 members');
    expect(assignOutcomeSummary({ assigned: 1, skipped: 3 })).toBe('Assigned 1 member · 3 already in the campaign');
  });
});
