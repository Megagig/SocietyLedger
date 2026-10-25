import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  NotificationsListResponseDTO,
  UnreadCountResponseDTO,
  NotificationPreferencesDTO,
} from '@/types/api/notifications';

export type ListNotificationsParams = { page?: number; limit?: number; unread?: boolean };

/** `/notifications/*` — no `X-Tenant` needed (api-contract.md §0 exclusion list, §7). */
export const notificationsApi = {
  /** GET /notifications — verified against notifications.controller.ts list (2026-10-20).
   * **Real finding: no `type` filter support at all** — only `page`/`limit`/`unread` are read
   * server-side; a `type=announcement` query param is silently ignored. H1's "Latest
   * announcements" fetches a page and filters by `type === 'announcement'` client-side. */
  async list(params: ListNotificationsParams = {}): Promise<NotificationsListResponseDTO> {
    return unwrap<NotificationsListResponseDTO>(client.get('/notifications', { params }));
  },

  /** GET /notifications/unread-count — verified api-contract.md §7. */
  async getUnreadCount(): Promise<UnreadCountResponseDTO> {
    return unwrap<UnreadCountResponseDTO>(client.get('/notifications/unread-count'));
  },

  /** PUT /notifications/:id/read — marks one as read. Scoped to caller's own notifications. */
  async markRead(id: number): Promise<void> {
    await unwrap<undefined>(client.put(`/notifications/${id}/read`));
  },

  /** PUT /notifications/read-all — marks all as read. */
  async markAllRead(): Promise<void> {
    await unwrap<undefined>(client.put('/notifications/read-all'));
  },

  /** DELETE /notifications/:id — deletes one. 404 if not the caller's. */
  async deleteOne(id: number): Promise<void> {
    await unwrap<undefined>(client.delete(`/notifications/${id}`));
  },

  /** GET /notifications/preferences — returns current preferences or server defaults. */
  async getPreferences(): Promise<NotificationPreferencesDTO> {
    return unwrap<NotificationPreferencesDTO>(client.get('/notifications/preferences'));
  },

  /**
   * PUT /notifications/preferences — **no server-side Zod validation** (api-contract.md §7).
   * The body is spread directly into a Prisma upsert. Validate client-side before calling.
   */
  async updatePreferences(payload: Partial<NotificationPreferencesDTO>): Promise<NotificationPreferencesDTO> {
    return unwrap<NotificationPreferencesDTO>(client.put('/notifications/preferences', payload));
  },
};
