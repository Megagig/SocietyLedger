import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ReceiptText } from 'lucide-react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { ajoApi } from '@/api/endpoints/ajo';
import { ErrorState } from '@/components/feedback/ErrorState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { useTenantKey } from '@/hooks/useTenantKey';
import { formatMoment } from '../format';
import { ajoKeys } from '../queries';
import { AjoLoading } from './AjoStates';

export type ReceiptsSheetHandle = { open: (contributionId: number) => void };

/** The messages sent to a member when a payment was confirmed, in the words they were sent. */
export const ReceiptsSheet = forwardRef<ReceiptsSheetHandle>(function ReceiptsSheet(_props, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const tenant = useTenantKey();
  const [contributionId, setContributionId] = useState<number | null>(null);
  useImperativeHandle(ref, () => ({ open: (id) => { setContributionId(id); sheet.current?.present(); } }), []);
  const receipts = useQuery({
    queryKey: [...ajoKeys.all(tenant), 'receipts', contributionId],
    queryFn: () => ajoApi.receipts(contributionId ?? 0),
    enabled: contributionId !== null,
  });

  return (
    <BottomSheet ref={sheet} title="Receipt" snapPoints={['60%']} onDismiss={() => setContributionId(null)}>
      <View className="gap-3 pb-6">
        {receipts.isPending ? (
          <AjoLoading rows={1} />
        ) : receipts.isError ? (
          <ErrorState error={receipts.error} onRetry={() => receipts.refetch()} />
        ) : receipts.data.length > 0 ? (
          receipts.data.map((r) => (
            <View key={r.id} className="gap-2 rounded-lg bg-surface-sunken p-3">
              <Text variant="body">{r.message}</Text>
              <Text variant="caption" tone="tertiary">
                {r.sentAt
                  ? `Sent ${formatMoment(r.sentAt)}`
                  : r.queuedForCredits
                    ? 'Waiting to be sent: the group has run out of text credits, and it goes out when they are topped up.'
                    : r.state === 'FAILED'
                      ? 'We could not send this one. The record above is still correct.'
                      : 'Waiting to be sent.'}
              </Text>
            </View>
          ))
        ) : (
          <InlineEmpty icon={ReceiptText} message="No receipt yet. A receipt is made when an officer confirms the payment." />
        )}
      </View>
    </BottomSheet>
  );
});
