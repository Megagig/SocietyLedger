import { useRouter } from 'expo-router';
import { PiggyBank } from 'lucide-react-native';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { SectionCard } from '@/components/layout/SectionCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoMoney } from '@/features/ajo/components/AjoMoney';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { AjoStatusBadge } from '@/features/ajo/components/AjoStatusBadge';
import { formatDay, formatMoment, koboPositive } from '@/features/ajo/format';
import { AJO_MEMBER_ACCESS, useContributions, useMyMemberships } from '@/features/ajo/queries';
import type { MyMembershipDTO } from '@/types/api/ajo';

const STATUS_WORDS: Record<string, string> = { REPORTED: 'Reported, waiting to be confirmed', CASH_RECEIVED: 'Cash recorded, waiting to be counted', CONFIRMED: 'Confirmed', REJECTED: 'Turned down', REVERSED: 'Reversed' };

function CirclePayments({ item, canWrite }: { item: MyMembershipDTO; canWrite: boolean }) {
  const router = useRouter();
  const payments = useContributions(item.membershipId);
  const running = item.status === 'ACTIVE' && item.group.status === 'ACTIVE';
  return (
    <View className="gap-3" testID={`ajo-my-payments-${item.membershipId}`}>
      <Card>
        <View className="gap-2">
          <Text variant="h3">{item.group.name}</Text>
          <Text variant="body" tone="secondary">
            {item.nextDue ? (
              <>
                Next payment <AjoMoney kobo={item.nextDue.remainingKobo} /> due {formatDay(item.nextDue.dueDate)}
              </>
            ) : (
              'Nothing coming up'
            )}
          </Text>
          {koboPositive(item.overdueKobo) ? (
            <Text variant="body" tone="danger">
              Overdue <AjoMoney kobo={item.overdueKobo} />
            </Text>
          ) : null}
          {running && canWrite ? (
            <Button onPress={() => router.push(`/(app)/(tabs)/money/thrift/${item.membershipId}/pay` as never)} testID={`ajo-report-payment-${item.membershipId}`}>
              Report a payment
            </Button>
          ) : null}
          {!running ? (
            <Text variant="caption" tone="secondary">
              {item.status !== 'ACTIVE'
                ? 'You can pay once you have been approved. The circle’s officers will tell you when.'
                : item.group.status === 'ACTIVE'
                  ? 'Payments are paused.'
                  : `Payments open when ${item.group.name} starts on ${formatDay(item.group.startDate)}.`}
            </Text>
          ) : (
            <Text variant="caption" tone="tertiary">
              Pay into the circle’s bank account, then report it with your slip. It counts once an officer has confirmed it against the bank statement.
            </Text>
          )}
        </View>
      </Card>
      {payments.data && payments.data.length > 0 ? (
        <SectionCard title="Your payments">
          {payments.data.map((p) => (
            <View key={p.id} className="gap-1 px-4 py-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text variant="body-strong">
                  <AjoMoney kobo={p.amountKobo} /> · {p.method === 'CASH' ? 'Cash to collector' : 'Bank transfer'}
                </Text>
                <AjoStatusBadge status={p.status} label={STATUS_WORDS[p.status] ?? p.status} />
              </View>
              <Text variant="caption" tone="tertiary">
                {formatMoment(p.receivedAt)}
                {p.recordedByOfficer ? ' · recorded by an officer from the bank' : ''}
                {p.reason ? ` · ${p.reason}` : ''}
              </Text>
            </View>
          ))}
        </SectionCard>
      ) : (
        <Text variant="caption" tone="tertiary">
          No payments yet.
        </Text>
      )}
    </View>
  );
}

/** Every circle I am in: what I owe, how to pay and report it with a slip, and each payment with where it stands. */
export default function MyPaymentsScreen() {
  const mine = useMyMemberships();
  const { canWrite } = useAjoWrite();
  const circles = (mine.data ?? []).filter((m) => m.status !== 'LEFT');
  return (
    <AjoScreen title="My payments" access={AJO_MEMBER_ACCESS} refreshing={mine.isRefetching} onRefresh={() => void mine.refetch()}>
      <Text variant="body" tone="secondary">
        Report what you paid with your slip, and see where each payment stands.
      </Text>
      {mine.isPending ? (
        <AjoLoading />
      ) : mine.isError ? (
        <ErrorState error={mine.error} onRetry={() => mine.refetch()} />
      ) : circles.length > 0 ? (
        <View className="gap-6">
          {circles.map((c) => (
            <CirclePayments key={c.membershipId} item={c} canWrite={canWrite} />
          ))}
        </View>
      ) : (
        <EmptyState icon={PiggyBank} title="You are not in a circle yet." description="When an officer adds you, you can pay and report payments here." />
      )}
    </AjoScreen>
  );
}
