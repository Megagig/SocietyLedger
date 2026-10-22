import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import type { GuarantorRequestDTO } from '@/types/api/loans';

export type GuarantorRequestCardProps = {
  request: GuarantorRequestDTO;
  onAccept: () => void;
  onDecline: () => void;
};

/** Someone has asked me to guarantee their loan: who, what for, how much is mine, and the two ways to answer. */
export function GuarantorRequestCard({ request, onAccept, onDecline }: GuarantorRequestCardProps) {
  const { member, loanProduct, amount, purpose } = request.loanApplication;
  const name = `${member.firstName} ${member.lastName}`;

  return (
    <View
      testID={`guarantor-request-${request.id}`}
      className="overflow-hidden rounded-xl border border-border bg-surface dark:border-transparent"
    >
      <View className="h-1 bg-warning" />
      <View className="gap-4 p-4">
        <View className="flex-row items-center gap-3">
          <Avatar name={name} size={40} colorSeed={member.membershipId} />
          <View className="flex-1">
            <Text variant="body-lg" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`${member.membershipId} · asked ${formatDate(request.createdAt, 'relative')}`}
            </Text>
          </View>
        </View>

        <Text variant="body" tone="secondary">
          {`wants you to guarantee their ${loanProduct.name}`}
        </Text>

        <View className="flex-row gap-3">
          <View className="flex-1 gap-0.5 rounded-lg bg-surface-sunken p-3">
            <Text variant="caption" tone="secondary">
              Loan amount
            </Text>
            <Money value={amount} size="h3" />
          </View>
          <View className="flex-1 gap-0.5 rounded-lg bg-primary-soft p-3">
            <Text variant="caption" tone="secondary">
              Your guarantee
            </Text>
            <Money value={request.guaranteedAmount} size="h3" tone="onPrimarySoft" />
          </View>
        </View>

        <View className="gap-1 border-l-2 border-border-strong pl-3">
          <Text variant="caption" tone="secondary">
            Purpose
          </Text>
          <Text variant="body" numberOfLines={4}>
            {purpose}
          </Text>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button variant="secondary" fullWidth onPress={onDecline}>
              Decline
            </Button>
          </View>
          <View className="flex-1">
            <Button variant="gradient" fullWidth onPress={onAccept}>
              Accept
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}
