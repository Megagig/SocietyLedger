import { useRouter } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';
import { View } from 'react-native';

import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { IconCircle } from '@/components/ui/IconCircle';
import { PROOFS_VIEW_ACCESS, usePendingProofCount } from '@/features/nigerianPayments/queries';
import { useCan } from '@/hooks/useCan';

/** project-overview.md §6.9 PY1 — the Payments hub: what is waiting for an officer. Bank transfers join it with F5.5. */
export default function PaymentsHubScreen() {
  const router = useRouter();
  const canView = useCan(PROOFS_VIEW_ACCESS);
  const waiting = usePendingProofCount().data ?? 0;
  const back = () => router.back();

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Payments" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Payments" onBack={back} docsKey="PY1" />

      <View className="gap-6 pb-6">
        <Section title="Waiting for you">
          <ListGroup>
            <ListItem
              leading={<IconCircle icon={ReceiptText} tone={waiting > 0 ? 'warning' : 'primary'} />}
              title="Payment proofs"
              meta="Receipts and notes members sent to confirm a payment"
              trailing={waiting > 0 ? <Badge tone="warning">{`${waiting} waiting`}</Badge> : undefined}
              showChevron
              onPress={() => router.push('/(app)/(tabs)/manage/payments/proofs' as never)}
              testID="payments-proofs"
            />
          </ListGroup>
        </Section>
      </View>
    </Screen>
  );
}
