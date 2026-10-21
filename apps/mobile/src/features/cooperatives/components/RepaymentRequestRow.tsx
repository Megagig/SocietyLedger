import { Linking, View } from 'react-native';
import { toast } from 'sonner-native';

import { loansApi } from '@/api/endpoints/loans';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import type { LoanRepaymentRequestDTO } from '@/types/api/loans';
import { DEPOSIT_STATUS_LABELS } from '../labels';

/** One receipt-backed loan payment. Same status wording as savings deposits (Awaiting confirmation / Confirmed / Not approved). */
export function RepaymentRequestRow({ request }: { request: LoanRepaymentRequestDTO }) {
  const viewReceipt = async () => {
    try {
      const { url } = await loansApi.getRepaymentRequestReceiptUrl(request.id);
      await Linking.openURL(url);
    } catch {
      toast.error('Could not open the receipt. Try again.');
    }
  };

  return (
    <View className="gap-2 px-4 py-3" testID={`repayment-request-${request.id}`}>
      <View className="flex-row items-center">
        <View className="flex-1">
          <Text variant="body-lg" numberOfLines={1}>
            {`Paid ${formatDate(request.paymentDate, 'long')}`}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`Loan ${request.loanNumber}${request.reference ? ` · Ref ${request.reference}` : ''}`}
          </Text>
        </View>
        <View className="ml-3 items-end gap-1">
          <Money value={request.amount} />
          <StatusChip status={request.status.toLowerCase()} label={DEPOSIT_STATUS_LABELS[request.status]} />
        </View>
      </View>
      {request.status === 'REJECTED' && request.rejectionReason ? (
        <Text variant="caption" tone="danger">{`Reason: ${request.rejectionReason}`}</Text>
      ) : null}
      {request.hasReceipt ? (
        <View className="flex-row">
          <Button variant="ghost" size="sm" onPress={viewReceipt}>
            View receipt
          </Button>
        </View>
      ) : null}
    </View>
  );
}
