import { Inbox } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

// project-overview.md §6.6 (N1) — the real inbox (All/Unread, grouped, swipe actions) lands at
// F3.2 alongside the header bell's unread badge. For now this is just the bell's navigation
// target so build-plan.md F1.8's "header bell placeholder" is actually reachable, not a dead tap.
export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Notifications" onBack={() => router.back()} />
      <EmptyState icon={Inbox} title="No notifications yet" description="The notifications inbox arrives in Phase 3 (F3.2)." />
    </Screen>
  );
}
