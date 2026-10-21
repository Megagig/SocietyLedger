import { Linking, View } from 'react-native';
import { toast } from 'sonner-native';

import { cooperativesApi } from '@/api/endpoints/cooperatives';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import type { SavingsDepositDTO } from '@/types/api/cooperatives';
import { DEPOSIT_STATUS_LABELS } from '../labels';

/** One receipt-backed deposit request. The status wording matches the web ("Awaiting confirmation" / "Confirmed" / "Not approved"). */
export function DepositRow({ deposit }: { deposit: SavingsDepositDTO }) {
  const viewReceipt = async () => {
    try {
      const { url } = await cooperativesApi.getSavingsDepositReceiptUrl(deposit.id);
      await Linking.openURL(url);
    } catch {
      toast.error('Could not open the receipt. Try again.');
    }
  };

  return (
    <View className="gap-2 px-4 py-3" testID={`deposit-row-${deposit.id}`}>
      <View className="flex-row items-center">
        <View className="flex-1">
          <Text variant="body-lg" numberOfLines={1}>
            {`Paid ${formatDate(deposit.paymentDate, 'long')}`}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`Account ${deposit.accountNumber}${deposit.reference ? ` · Ref ${deposit.reference}` : ''}`}
          </Text>
        </View>
        <View className="ml-3 items-end gap-1">
          <Money value={deposit.amount} />
          <StatusChip status={deposit.status.toLowerCase()} label={DEPOSIT_STATUS_LABELS[deposit.status]} />
        </View>
      </View>
      {deposit.status === 'REJECTED' && deposit.rejectionReason ? (
        <Text variant="caption" tone="danger">{`Reason: ${deposit.rejectionReason}`}</Text>
      ) : null}
      {deposit.hasReceipt ? (
        <View className="flex-row">
          <Button variant="ghost" size="sm" onPress={viewReceipt}>
            View receipt
          </Button>
        </View>
      ) : null}
    </View>
  );
}
