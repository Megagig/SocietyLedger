import { waitFor } from '@testing-library/react-native';

import { renderHookWithQueryClient } from '@/test-utils/renderWithProviders';

// `useTenantKey` pulls in `stores/tenant.ts` → real MMKV, unavailable under Jest.
jest.mock('@/lib/storage', () => {
  const map = new Map<string, string>();
  return {
    storage: {
      getString: (key: string) => map.get(key),
      set: (key: string, value: string) => map.set(key, String(value)),
      remove: (key: string) => map.delete(key),
    },
  };
});

// `sonner-native` is ESM-only under Jest; `@/lib/push` drags in router/constants/MMKV — neither matters for query tests.
jest.mock('sonner-native', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/lib/push', () => ({ setBadgeCount: jest.fn() }));

const mockList = jest.fn();
jest.mock('@/api/endpoints/notifications', () => ({ notificationsApi: { list: mockList } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- must run after the jest.mock calls above
const { useAnnouncements } = require('./queries');

describe('useAnnouncements', () => {
  beforeEach(() => mockList.mockReset());

  it('filters to announcement-type notifications only, capped to the limit', async () => {
    mockList.mockResolvedValue({
      notifications: [
        { id: 1, title: 'Payment received', message: '', type: 'payment_received', entityId: null, isRead: false, createdAt: '2026-01-01T00:00:00Z' },
        { id: 2, title: 'Announcement A', message: '', type: 'announcement', entityId: null, isRead: false, createdAt: '2026-01-02T00:00:00Z' },
        { id: 3, title: 'Announcement B', message: '', type: 'announcement', entityId: null, isRead: false, createdAt: '2026-01-03T00:00:00Z' },
        { id: 4, title: 'Announcement C', message: '', type: 'announcement', entityId: null, isRead: false, createdAt: '2026-01-04T00:00:00Z' },
        { id: 5, title: 'Announcement D', message: '', type: 'announcement', entityId: null, isRead: false, createdAt: '2026-01-05T00:00:00Z' },
      ],
      total: 5,
      unreadCount: 5,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const { result, unmount, queryClient } = await renderHookWithQueryClient(() => useAnnouncements(3));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.every((n: { type: string }) => n.type === 'announcement')).toBe(true);
    expect(mockList).toHaveBeenCalledWith({ limit: 20 });

    unmount();
    queryClient.clear();
  });

  it('returns an empty array when there are no announcements', async () => {
    mockList.mockResolvedValue({
      notifications: [{ id: 1, title: 'System', message: '', type: 'system', entityId: null, isRead: false, createdAt: '2026-01-01T00:00:00Z' }],
      total: 1,
      unreadCount: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const { result, unmount, queryClient } = await renderHookWithQueryClient(() => useAnnouncements(3));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);

    unmount();
    queryClient.clear();
  });
});
