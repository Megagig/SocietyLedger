import { Bell, Briefcase } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

// project-overview.md §6.8/§6.9 — members, finance, payments verification, accounting, reports,
// meetings/elections/polls/welfare/cooperatives admin, communication, AI, settings, support land
// across Phase 4+. This screen (and the tab itself) is only reachable with a management
// permission — `(tabs)/_layout.tsx`'s `href` conditional, driven by `MANAGE_TAB_PERMISSIONS`.
export default function ManageScreen() {
  const router = useRouter();

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        large
        title="Manage"
        rightActions={
          <IconButton icon={Bell} accessibilityLabel="Notifications" onPress={() => router.push('/(app)/notifications')} />
        }
      />
      <EmptyState icon={Briefcase} title="Officer hub" description="Member, finance and operations tools arrive from Phase 4 onward." />
    </Screen>
  );
}
