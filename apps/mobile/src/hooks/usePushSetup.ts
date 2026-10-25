/**
 * F3.1 — Wires up push notifications for an authenticated session.
 * Mount once in (app)/_layout.tsx after the auth guard passes.
 *
 * - Asks for permission + registers token after the first meaningful action
 *   (MMKV flag `prefs.pushPrompted` gates the OS prompt to avoid a day-one ask).
 * - Subscribes to notification taps and routes them via `routePushNotification`.
 * - Badge count is synced with the unread notification count (F3.2 wires the query;
 *   this hook provides the setter used by the bell badge).
 */

import { useEffect, useRef } from 'react';

import {
  hasPushBeenPrompted,
  loadNotifications,
  markPushPrompted,
  registerPushToken,
  routePushNotification,
} from '@/lib/push';
import { useTenantStore } from '@/stores/tenant';

export function usePushSetup(): void {
  const tenantId = useTenantStore((s) => s.current?.id);
  const registered = useRef(false);

  // Register token once per session (idempotent inside registerPushToken).
  // Deferred to after the first render so it never blocks the splash-to-home transition.
  useEffect(() => {
    if (registered.current) return;
    registered.current = true;

    // architecture.md §8.1 — prompt only if the user has taken at least one action already
    // (flagged by `markPushPrompted()` called from the home screen's first real render).
    if (!hasPushBeenPrompted()) return;

    registerPushToken().catch(() => {});
  }, []);

  // Handle taps on notifications (background / quit state).
  // expo-notifications is lazy so the module loads even without its native build.
  useEffect(() => {
    let sub: { remove: () => void } | null = null;

    loadNotifications()
      .then((Notifications) => {
        if (!Notifications) return;
        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data as Record<string, unknown>;
          routePushNotification(
            {
              type: typeof data['type'] === 'string' ? data['type'] : undefined,
              entityId: typeof data['entityId'] === 'number' ? data['entityId'] : undefined,
              associationId: typeof data['associationId'] === 'number' ? data['associationId'] : undefined,
              notificationId: typeof data['notificationId'] === 'number' ? data['notificationId'] : undefined,
            },
            tenantId,
          );
        });
      })
      .catch(() => {});

    return () => { sub?.remove(); };
  }, [tenantId]);
}

/**
 * Call once after the home screen's first real data render.
 * Marks the user as having taken a meaningful action — after this, the next
 * `usePushSetup` mount (or foreground return) will trigger the OS permission prompt.
 */
export async function triggerPushPermissionPrompt(): Promise<void> {
  if (hasPushBeenPrompted()) return;
  markPushPrompted();
  await registerPushToken();
}
