import { Bell, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

// project-overview.md §6.5 — meetings, voting, polls, welfare, announcements land across
// Phase 3 (F3.4–F3.8).
export default function CommunityScreen() {
  const router = useRouter();

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        large
        title="Community"
        rightActions={
          <IconButton icon={Bell} accessibilityLabel="Notifications" onPress={() => router.push('/(app)/notifications')} />
        }
      />
      <EmptyState icon={Users} title="Your community" description="Meetings, voting, polls and welfare arrive in Phase 3 (F3.4–F3.8)." />
    </Screen>
  );
}
