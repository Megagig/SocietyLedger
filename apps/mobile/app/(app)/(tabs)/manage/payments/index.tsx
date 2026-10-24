import { useRouter } from 'expo-router';
import { Landmark, ReceiptText, Scale, Wallet } from 'lucide-react-native';
import { View } from 'react-native';

import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { IconCircle } from '@/components/ui/IconCircle';
import { BANK_ACCOUNTS_VIEW_ACCESS, PROOFS_VIEW_ACCESS, TRANSFERS_VIEW_ACCESS, usePendingProofCount, usePendingTransferCount } from '@/features/nigerianPayments/queries';
import { RECON_ANY_ACCESS } from '@/features/reconciliation/labels';
import { useWaitingMatchCount } from '@/features/reconciliation/queries';
import { useCan } from '@/hooks/useCan';

/** project-overview.md §6.9 PY1 — the Payments hub: what is waiting for an officer, and the accounts members pay into. */
export default function PaymentsHubScreen() {
  const router = useRouter();
  const canProofs = useCan(PROOFS_VIEW_ACCESS);
  const canTransfers = useCan(TRANSFERS_VIEW_ACCESS);
  const canAccounts = useCan(BANK_ACCOUNTS_VIEW_ACCESS);
  const waitingProofs = usePendingProofCount().data ?? 0;
  const waitingTransfers = usePendingTransferCount().data ?? 0;
  const canRecon = useCan(RECON_ANY_ACCESS);
  const waitingMatches = useWaitingMatchCount().data ?? 0;
  const back = () => router.back();

  if (!canProofs && !canTransfers && !canAccounts && !canRecon) {
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
        {canProofs || canTransfers || canRecon ? (
          <Section title="Waiting for you">
            <ListGroup>
              {canProofs ? (
                <ListItem
                  leading={<IconCircle icon={ReceiptText} tone={waitingProofs > 0 ? 'warning' : 'primary'} />}
                  title="Payment proofs"
                  meta="Receipts and notes members sent to confirm a payment"
                  trailing={waitingProofs > 0 ? <Badge tone="warning">{`${waitingProofs} waiting`}</Badge> : undefined}
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/payments/proofs' as never)}
                  testID="payments-proofs"
                />
              ) : null}
              {canTransfers ? (
                <ListItem
                  leading={<IconCircle icon={Wallet} tone={waitingTransfers > 0 ? 'warning' : 'primary'} />}
                  title="Bank transfers"
                  meta="Transfers recorded from your bank statement"
                  trailing={waitingTransfers > 0 ? <Badge tone="warning">{`${waitingTransfers} waiting`}</Badge> : undefined}
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/payments/transfers' as never)}
                  testID="payments-transfers"
                />
              ) : null}
              {canRecon ? (
                <ListItem
                  leading={<IconCircle icon={Scale} tone={waitingMatches > 0 ? 'warning' : 'primary'} />}
                  title="Reconciliation"
                  meta="Import your bank statement and match the money to charges"
                  trailing={waitingMatches > 0 ? <Badge tone="warning">{`${waitingMatches} to confirm`}</Badge> : undefined}
                  showChevron
                  onPress={() => router.push('/(app)/(tabs)/manage/payments/reconciliation' as never)}
                  testID="payments-reconciliation"
                />
              ) : null}
            </ListGroup>
          </Section>
        ) : null}

        {canAccounts ? (
          <Section title="Set up">
            <ListGroup>
              <ListItem
                leading={<IconCircle icon={Landmark} tone="info" />}
                title="Bank accounts"
                meta="The accounts members are shown when they pay"
                showChevron
                onPress={() => router.push('/(app)/(tabs)/manage/payments/bank-accounts' as never)}
                testID="payments-bank-accounts"
              />
            </ListGroup>
          </Section>
        ) : null}
      </View>
    </Screen>
  );
}
