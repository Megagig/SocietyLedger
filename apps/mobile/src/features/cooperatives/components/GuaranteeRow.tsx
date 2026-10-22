import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import type { GuaranteedLoanDTO } from '@/types/api/cooperatives';

/** A loan I've agreed to guarantee: the borrower, the product and loan number (or "awaiting payout"), my share and its status. */
export function GuaranteeRow({ guarantee }: { guarantee: GuaranteedLoanDTO }) {
  const borrower = guarantee.applicantName || guarantee.applicationNumber;
  const loanPart = guarantee.loanNumber ?? 'awaiting payout';
  const status = (guarantee.loanStatus ?? guarantee.applicationStatus).toLowerCase();

  return (
    <View className="flex-row items-center gap-3 px-4 py-3" testID={`guarantee-${guarantee.id}`}>
      <Avatar name={borrower} size={40} colorSeed={guarantee.loanApplicationId} />
      <View className="flex-1">
        <Text variant="body-lg" numberOfLines={1}>
          {borrower}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {`${guarantee.productName} · ${loanPart}`}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Money value={guarantee.guaranteeAmount} />
        <StatusChip status={status} />
      </View>
    </View>
  );
}
