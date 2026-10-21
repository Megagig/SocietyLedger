import type { NotificationDTO } from '@/types/api/notifications';

export type NotificationTypeFilter = 'all' | 'payment_due' | 'payment_received' | 'system' | 'approval' | 'announcement';
export type NotificationStatusFilter = 'all' | 'unread' | 'read';

export type NotificationFilters = {
  type: NotificationTypeFilter;
  status: NotificationStatusFilter;
  search: string;
  /** ISO strings from the date picker; empty = open-ended. */
  startDate: string;
  endDate: string;
};

export const DEFAULT_FILTERS: NotificationFilters = { type: 'all', status: 'all', search: '', startDate: '', endDate: '' };

/** Same five kinds the web filter offers (notifications.controller.ts's `type` enum). */
export const TYPE_FILTER_OPTIONS: { label: string; value: NotificationTypeFilter }[] = [
  { label: 'All types', value: 'all' },
  { label: 'Payment due', value: 'payment_due' },
  { label: 'Payment received', value: 'payment_received' },
  { label: 'System', value: 'system' },
  { label: 'Approval', value: 'approval' },
  { label: 'Announcement', value: 'announcement' },
];

export function hasActiveFilters(f: NotificationFilters): boolean {
  return f.type !== 'all' || f.status !== 'all' || f.search.trim() !== '' || f.startDate !== '' || f.endDate !== '';
}

/** Filters that the API can't apply (it only reads page/limit/unread), so they run on loaded pages. */
export function hasClientFilters(f: NotificationFilters): boolean {
  return f.type !== 'all' || f.status === 'read' || f.search.trim() !== '' || f.startDate !== '' || f.endDate !== '';
}

function startOfDay(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(iso: string): number {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function applyNotificationFilters(items: NotificationDTO[], f: NotificationFilters): NotificationDTO[] {
  const search = f.search.trim().toLowerCase();
  const from = f.startDate ? startOfDay(f.startDate) : undefined;
  const to = f.endDate ? endOfDay(f.endDate) : undefined;

  return items.filter((n) => {
    if (f.type !== 'all' && n.type !== f.type) return false;
    if (f.status === 'unread' && n.isRead) return false;
    if (f.status === 'read' && !n.isRead) return false;
    if (search && !n.title.toLowerCase().includes(search) && !n.message.toLowerCase().includes(search)) return false;
    const created = new Date(n.createdAt).getTime();
    if (from !== undefined && created < from) return false;
    if (to !== undefined && created > to) return false;
    return true;
  });
}
