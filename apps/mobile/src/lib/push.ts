/**
 * architecture.md §8 — push notification client plumbing.
 * All expo-notifications usage is lazy (dynamic import) so the module can load
 * even when the native build does not include expo-notifications yet.
 * F3.1 — wired into app/_layout.tsx (channels + foreground) and usePushSetup hook.
 */

import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';

import { devicesApi } from '@/api/endpoints/devices';
import { getBoolean, setBoolean, getString, setString, remove } from '@/lib/storage';

const PUSH_TOKEN_KEY = 'push.token';
const PUSH_PROMPTED_KEY = 'prefs.pushPrompted';

/**
 * expo-notifications throws at import time when its native module isn't in the installed dev build
 * (and Metro logs that as an error even if we catch it), so probe for the module first and only
 * then load the JS package. Returns null when push isn't available in this build.
 */
export async function loadNotifications(): Promise<typeof import('expo-notifications') | null> {
  if (!requireOptionalNativeModule('ExpoPushTokenManager')) return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

// ─── Android channels (architecture.md §8.1.4) ──────────────────────────────

export async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
    });
    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Payments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22C55E',
    });
    await Notifications.setNotificationChannelAsync('governance', {
      name: 'Meetings & Voting',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B5CF6',
    });
    await Notifications.setNotificationChannelAsync('announcements', {
      name: 'Announcements',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F59E0B',
    });
  } catch {
    // expo-notifications native module not available in current build; skip.
  }
}

export async function setBadgeCount(count: number): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // native module unavailable; skip.
  }
}

// ─── Foreground presentation ─────────────────────────────────────────────────

export async function configureForegroundHandler(): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // expo-notifications native module not available; skip.
  }
}

// ─── Permission & token registration (architecture.md §8.1) ─────────────────

/** Returns true if the OS permission is granted (or already granted). */
export async function requestPushPermission(): Promise<boolean> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    if (existing === 'denied') return false;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Returns true if we've already shown the system prompt. */
export function hasPushBeenPrompted(): boolean {
  return getBoolean(PUSH_PROMPTED_KEY) ?? false;
}

export function markPushPrompted(): void {
  setBoolean(PUSH_PROMPTED_KEY, true);
}

/** Returns the cached token, if any. */
export function getCachedPushToken(): string | undefined {
  return getString(PUSH_TOKEN_KEY);
}

/**
 * Requests OS permission, fetches the Expo push token, and registers it.
 * Idempotent — safe to call on every foreground.
 * Returns the token string, or null when push is unavailable.
 */
export async function registerPushToken(): Promise<string | null> {
  const granted = await requestPushPermission();
  if (!granted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const cached = getCachedPushToken();
    if (cached !== token) {
      await devicesApi.register({
        expoPushToken: token,
        platform: Platform.OS === 'android' ? 'android' : 'ios',
        deviceName: undefined,
        appVersion: Constants.expoConfig?.version ?? undefined,
      });
      setString(PUSH_TOKEN_KEY, token);
    }

    return token;
  } catch {
    return null;
  }
}

/** Unregisters the current device token from the API and clears local cache. */
export async function unregisterPushToken(): Promise<void> {
  const token = getCachedPushToken();
  if (!token) return;
  try {
    await devicesApi.unregister({ expoPushToken: token });
  } catch {
    // Best-effort; token is cleared regardless so it won't be re-used
  } finally {
    remove(PUSH_TOKEN_KEY);
  }
}

// ─── Tap routing map (architecture.md §8.2) ──────────────────────────────────

type PushData = {
  type?: string;
  entityId?: number;
  associationId?: number;
  notificationId?: number;
};

/**
 * In-app inbox rows carry the stored `Notification.type` kind (`payment_due`, …), while
 * `routePushNotification` switches on push-payload types (`dues.reminder`, …). Maps one to the
 * other; `undefined` means the kind has no destination (e.g. `system`) and the row only marks read.
 */
export function pushTypeForKind(kind: string): string | undefined {
  switch (kind) {
    case 'payment_due':
      return 'dues.reminder';
    case 'payment_received':
      return 'payment.received';
    case 'approval':
      return 'user.approval_pending';
    case 'announcement':
      return 'announcement';
    default:
      return undefined;
  }
}

/**
 * Routes a notification tap to the correct screen.
 * Called from the `lastNotificationResponse` listener in usePushSetup.
 */
export function routePushNotification(data: PushData, currentTenantId?: number): void {
  const { type, entityId, associationId } = data;

  if (associationId && currentTenantId && associationId !== currentTenantId) {
    router.navigate('/(app)/notifications');
    return;
  }

  switch (type) {
    case 'payment.confirmed':
    case 'payment.received':
      router.push('/(app)/(tabs)/money/payments');
      break;

    case 'payment.proof_submitted':
      if (entityId) router.push(`/(app)/(tabs)/manage/payments/proofs/${entityId}` as never);
      else router.push('/(app)/(tabs)/manage/payments/proofs' as never);
      break;

    case 'payment.proof_verified':
    case 'payment.proof_rejected':
      router.push('/(app)/(tabs)/money/payments');
      break;

    case 'bank_transfer.pending':
    case 'bank_transfer.verified':
      router.push('/(app)/(tabs)/money/payments');
      break;

    case 'dues.reminder':
    case 'dues.overdue':
    case 'levy.assigned':
    case 'penalty.applied':
      router.push('/(app)/(tabs)/money/pay' as never);
      break;

    case 'meeting.scheduled':
    case 'meeting.reminder':
    case 'meeting.cancelled':
      if (entityId) router.push(`/(app)/(tabs)/community/meetings/${entityId}` as never);
      else router.push('/(app)/(tabs)/community/meetings' as never);
      break;

    case 'election.nominations_open':
    case 'election.voting_open':
    case 'election.results':
      if (entityId) router.push(`/(app)/(tabs)/community/voting/${entityId}` as never);
      else router.push('/(app)/(tabs)/community/voting' as never);
      break;

    case 'poll.open':
      if (entityId) router.push(`/(app)/(tabs)/community/polls/${entityId}` as never);
      else router.push('/(app)/(tabs)/community/polls' as never);
      break;

    case 'welfare.payout_requested':
      if (entityId) router.push(`/(app)/(tabs)/manage/welfare/payouts/${entityId}` as never);
      else router.push('/(app)/(tabs)/community/welfare' as never);
      break;

    case 'welfare.payout_updated':
      router.push('/(app)/(tabs)/community/welfare' as never);
      break;

    case 'loan.application_submitted':
      if (entityId) router.push(`/(app)/(tabs)/manage/cooperatives/applications/${entityId}` as never);
      break;

    case 'loan.application_updated':
    case 'loan.repayment_due':
      router.push('/(app)/(tabs)/money/loans' as never);
      break;

    case 'guarantor.requested':
      router.push('/(app)/(tabs)/money/guarantor-requests' as never);
      break;

    case 'announcement':
      router.push('/(app)/(tabs)/community/announcements' as never);
      break;

    case 'support.ticket_created':
    case 'support.ticket_member_reply':
      // Staff: a member opened a ticket or replied — open it in the support desk.
      if (entityId) router.push(`/(app)/(tabs)/manage/support/${entityId}` as never);
      else router.push('/(app)/(tabs)/manage/support' as never);
      break;

    case 'support.ticket_reply':
      if (entityId) router.push(`/(app)/(tabs)/profile/help/tickets/${entityId}` as never);
      else router.push('/(app)/(tabs)/profile' as never);
      break;

    case 'user.approval_pending':
      router.push('/(app)/(tabs)/manage/members/approvals' as never);
      break;

    default:
      router.navigate('/(app)/notifications');
  }
}
