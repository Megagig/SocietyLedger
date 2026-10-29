import { useRouter } from 'expo-router';
import { PiggyBank } from 'lucide-react-native';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { AjoStatusBadge } from '@/features/ajo/components/AjoStatusBadge';
import { MembershipCard } from '@/features/ajo/components/MembershipCard';
import { AJO_MEMBER_ACCESS, useMyMemberships, useVerification } from '@/features/ajo/queries';

/** THM1 (my circles, next due, payout position) with THM9 (where SocietyLedger's check of me stands). */
export default function MyThriftScreen() {
  const router = useRouter();
  const mine = useMyMemberships();
  const verification = useVerification();
  const check = verification.data;

  return (
    <AjoScreen
      title="My thrift"
      access={AJO_MEMBER_ACCESS}
      refreshing={mine.isRefetching}
      onRefresh={() => {
        void mine.refetch();
        void verification.refetch();
      }}
    >
      <Text variant="body" tone="secondary">
        Your savings circles, what you owe and when you collect.
      </Text>

      {check && check.status !== 'VERIFIED' ? (
        <Card testID="ajo-verification-card">
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Text variant="h3">Your payout check</Text>
              <AjoStatusBadge status={check.status} />
            </View>
            <Text variant="body" tone="secondary">
              {check.status === 'REJECTED'
                ? `SocietyLedger could not verify you: ${check.rejectionReason ?? 'no reason was given'}. Fix it on your payout account and tell your circle officer.`
                : check.status === 'PENDING'
                  ? 'SocietyLedger is checking your details. You can pay in as usual; you can only be paid out once this is done.'
                  : 'To be paid out you need a payout account, and SocietyLedger checks it first.'}
            </Text>
            <Button variant="secondary" onPress={() => router.push('/(app)/(tabs)/money/thrift/payout-account' as never)} testID="ajo-go-payout-account">
              Go to my payout account
            </Button>
          </View>
        </Card>
      ) : null}

      {mine.isPending ? (
        <AjoLoading />
      ) : mine.isError ? (
        <ErrorState error={mine.error} onRetry={() => mine.refetch()} />
      ) : mine.data.length > 0 ? (
        <View className="gap-4">
          {mine.data.map((item) => (
            <MembershipCard key={item.membershipId} item={item} />
          ))}
          {!check || check.status === 'VERIFIED' ? (
            <Button variant="ghost" onPress={() => router.push('/(app)/(tabs)/money/thrift/payout-account' as never)} testID="ajo-payout-account-link">
              My payout account
            </Button>
          ) : null}
        </View>
      ) : (
        <EmptyState icon={PiggyBank} title="You are not in any savings circle yet." description="When an officer adds you, it will show here and you will be told what to do next." />
      )}
    </AjoScreen>
  );
}
