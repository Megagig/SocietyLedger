import { Bell, Wallet } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

// project-overview.md §6.4 — own-finances overview, outstanding/pay, ledger, dues/levies/
// penalties/donations, cooperatives savings/loans all land across F2.6–F2.9.
export default function MoneyScreen() {
  const router = useRouter();

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        large
        title="Money"
        rightActions={
          <IconButton icon={Bell} accessibilityLabel="Notifications" onPress={() => router.push('/(app)/notifications')} />
        }
      />
      <EmptyState icon={Wallet} title="Your finances" description="Outstanding dues, payments and the ledger arrive in Phase 2 (F2.6–F2.9)." />
    </Screen>
  );
}
