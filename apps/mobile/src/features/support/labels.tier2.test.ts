import { CATEGORY_OPTIONS, PLATFORM_CATEGORY_OPTIONS, STAFF_STATUS_LABELS, STATUS_ACTIONS } from './labels';
import type { TicketStatus } from '@/types/api/support';

// Mirrors VALID_STATUS_TRANSITIONS in apps/api/src/modules/support/support.types.ts — the API rejects anything else.
const API_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_ON_USER', 'WAITING_ON_STAFF', 'RESOLVED', 'CLOSED'],
  WAITING_ON_USER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  WAITING_ON_STAFF: ['IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
};

describe('Tier 2 labels', () => {
  it('offers members the original eight categories, with no billing or data', () => {
    expect(CATEGORY_OPTIONS.map((o) => o.value)).not.toContain('BILLING');
    expect(CATEGORY_OPTIONS.map((o) => o.value)).not.toContain('DATA');
    expect(CATEGORY_OPTIONS).toHaveLength(8);
  });

  it('offers an association admin exactly the categories the API accepts for a platform ticket', () => {
    expect(PLATFORM_CATEGORY_OPTIONS.map((o) => o.value)).toEqual(['ACCESS', 'BILLING', 'DATA', 'TECHNICAL', 'BUG', 'FEATURE_REQUEST', 'OTHER']);
  });

  it("words the statuses from the staff member's side", () => {
    expect(STAFF_STATUS_LABELS.WAITING_ON_USER).toBe('Waiting on member');
    expect(STAFF_STATUS_LABELS.WAITING_ON_STAFF).toBe('Needs reply');
  });

  it('only offers status moves the API allows', () => {
    for (const [from, actions] of Object.entries(STATUS_ACTIONS) as [TicketStatus, { status: TicketStatus }[]][]) {
      for (const action of actions) {
        expect(API_TRANSITIONS[from]).toContain(action.status);
      }
    }
  });

  it('always offers a way forward, so a staff member is never stuck on a ticket', () => {
    for (const actions of Object.values(STATUS_ACTIONS)) {
      expect(actions.length).toBeGreaterThan(0);
    }
  });
});
