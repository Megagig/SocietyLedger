import { client } from '../client';
import { unwrap } from '../envelope';
import type { NotificationsListResponseDTO } from '@/types/api/notifications';

export type ListNotificationsParams = { page?: number; limit?: number; unread?: boolean };

/** `/notifications/*`. Only `list` so far — `unread-count`/`read`/`read-all`/`preferences` land
 * here as N1/N2 (F3.2) build them. */
export const notificationsApi = {
  /** GET /notifications — verified against notifications.controller.ts list (2026-10-20).
   * **Real finding: no `type` filter support at all** — only `page`/`limit`/`unread` are read
   * server-side; a `type=announcement` query param is silently ignored. H1's "Latest
   * announcements" fetches a page and filters by `type === 'announcement'` client-side. */
  async list(params: ListNotificationsParams = {}): Promise<NotificationsListResponseDTO> {
    return unwrap<NotificationsListResponseDTO>(client.get('/notifications', { params }));
  },
};
