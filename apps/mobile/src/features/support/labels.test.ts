import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, STATUS_LABELS, canCloseTicket, formatFileSize, isOpenTicket } from './labels';

describe('support labels', () => {
  it("words the statuses from the member's side", () => {
    expect(STATUS_LABELS.WAITING_ON_USER).toBe('Waiting on you');
    expect(STATUS_LABELS.WAITING_ON_STAFF).toBe('Waiting on support');
  });

  it('treats everything except resolved and closed as open', () => {
    expect((['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'WAITING_ON_STAFF'] as const).every((s) => isOpenTicket(s))).toBe(true);
    expect(isOpenTicket('RESOLVED')).toBe(false);
    expect(isOpenTicket('CLOSED')).toBe(false);
  });

  it('lets a member close only an open ticket', () => {
    expect(canCloseTicket('OPEN')).toBe(true);
    expect(canCloseTicket('CLOSED')).toBe(false);
  });

  it("offers every category and four priorities, in the API's vocabulary", () => {
    expect(CATEGORY_OPTIONS.map((o) => o.value)).toEqual(['ACCESS', 'PAYMENTS', 'REPORTS', 'MEMBERS', 'TECHNICAL', 'BUG', 'FEATURE_REQUEST', 'OTHER']);
    expect(PRIORITY_OPTIONS.map((o) => o.value)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
  });

  it('formats file sizes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
