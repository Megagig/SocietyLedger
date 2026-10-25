import type { NotificationDTO } from '@/types/api/notifications';

import { applyNotificationFilters, DEFAULT_FILTERS, hasActiveFilters, hasClientFilters } from './filters';

function n(over: Partial<NotificationDTO>): NotificationDTO {
  return { id: 1, title: 'Title', message: 'Body', type: 'system', entityId: null, isRead: false, createdAt: '2026-03-10T12:00:00Z', ...over };
}

const items = [
  n({ id: 1, type: 'payment_due', title: 'Dues reminder', isRead: false, createdAt: '2026-03-01T09:00:00Z' }),
  n({ id: 2, type: 'payment_received', title: 'Payment received', message: 'Thank you', isRead: true, createdAt: '2026-03-10T09:00:00Z' }),
  n({ id: 3, type: 'announcement', title: 'AGM notice', isRead: true, createdAt: '2026-03-20T09:00:00Z' }),
];

describe('applyNotificationFilters', () => {
  it('returns everything with the default filters', () => {
    expect(applyNotificationFilters(items, DEFAULT_FILTERS)).toHaveLength(3);
  });

  it('filters by type', () => {
    expect(applyNotificationFilters(items, { ...DEFAULT_FILTERS, type: 'announcement' }).map((x) => x.id)).toEqual([3]);
  });

  it('filters by read status (the web never applied this one)', () => {
    expect(applyNotificationFilters(items, { ...DEFAULT_FILTERS, status: 'read' }).map((x) => x.id)).toEqual([2, 3]);
    expect(applyNotificationFilters(items, { ...DEFAULT_FILTERS, status: 'unread' }).map((x) => x.id)).toEqual([1]);
  });

  it('searches title and message, case-insensitively', () => {
    expect(applyNotificationFilters(items, { ...DEFAULT_FILTERS, search: 'THANK' }).map((x) => x.id)).toEqual([2]);
    expect(applyNotificationFilters(items, { ...DEFAULT_FILTERS, search: 'agm' }).map((x) => x.id)).toEqual([3]);
  });

  it('includes the whole end day in a date range', () => {
    const f = { ...DEFAULT_FILTERS, startDate: '2026-03-10T00:00:00', endDate: '2026-03-10T00:00:00' };
    expect(applyNotificationFilters(items, f).map((x) => x.id)).toEqual([2]);
  });
});

describe('filter flags', () => {
  it('detects active filters', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, search: ' x ' })).toBe(true);
  });

  it('treats unread as server-side and read as client-side', () => {
    expect(hasClientFilters({ ...DEFAULT_FILTERS, status: 'unread' })).toBe(false);
    expect(hasClientFilters({ ...DEFAULT_FILTERS, status: 'read' })).toBe(true);
  });
});
