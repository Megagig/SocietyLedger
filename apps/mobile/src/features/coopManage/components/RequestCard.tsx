import { useState } from 'react';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import type { SavingsDepositStatus } from '@/types/api/cooperatives';
import { isOwnRequest, REQUEST_STATUS_KEYS, REQUEST_STATUS_LABELS } from '../labels';

export type RequestLike = {
  id: number;
  memberId: number;
  memberName: string;
  memberNumber: string;
  amount: string | number;
  paymentDate: string;
  reference: string | null;
  memberNote: string | null;
  hasReceipt: boolean;
  status: SavingsDepositStatus;
  rejectionReason: string | null;
};

export type ReceiptLink = { url: string; filename?: string; mimeType?: string };

/**
 * One member-declared deposit or repayment waiting on an officer: who paid how much and when, their reference and note, the receipt
 * (an image opens in the zoom viewer, a PDF in the in-app browser), and Approve / Reject while it is waiting. An officer's own request
 * shows a note instead of the buttons: another officer has to decide it.
 */
export function RequestCard({
  request,
  context,
  ownMemberId,
  canDecide,
  loadReceipt,
  onApprove,
  onReject,
  busy = false,
}: {
  request: RequestLike;
  /** What it is for: the account number or the loan number. */
  context: string;
  ownMemberId: number | undefined;
  canDecide: boolean;
  loadReceipt: (id: number) => Promise<ReceiptLink>;
  onApprove: (request: RequestLike) => void;
  onReject: (request: RequestLike) => void;
  busy?: boolean;
}) {
  const [viewer, setViewer] = useState<{ uri: string; title?: string } | null>(null);
  const own = isOwnRequest(request.memberId, ownMemberId);
  const waiting = request.status === 'PENDING';

  const openReceipt = async () => {
    try {
      const link = await loadReceipt(request.id);
      if (link.mimeType?.startsWith('image/')) {
        setViewer({ uri: link.url, title: link.filename });
      } else {
        await WebBrowser.openBrowserAsync(link.url);
      }
    } catch {
      toast.error('Could not open the receipt. Try again.');
    }
  };

  return (
    <View className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID={`request-${request.id}`}>
      <View className="flex-row items-start">
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {request.memberName}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${request.memberNumber} · ${context}`}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`Paid ${formatDate(request.paymentDate, 'long')}${request.reference ? ` · Ref ${request.reference}` : ''}`}
          </Text>
        </View>
        <View className="ml-3 items-end gap-1.5">
          <Money value={request.amount} size="body-strong" />
          <StatusChip status={REQUEST_STATUS_KEYS[request.status]} label={REQUEST_STATUS_LABELS[request.status]} />
        </View>
      </View>

      {request.memberNote ? (
        <Text variant="caption" tone="secondary">
          {`Member's note: ${request.memberNote}`}
        </Text>
      ) : null}
      {request.status === 'REJECTED' && request.rejectionReason ? (
        <Text variant="caption" tone="danger">{`Reason: ${request.rejectionReason}`}</Text>
      ) : null}

      {request.hasReceipt ? (
        <View className="flex-row">
          <Button variant="ghost" size="sm" onPress={() => void openReceipt()} testID={`request-receipt-${request.id}`}>
            View receipt
          </Button>
        </View>
      ) : null}

      {waiting && canDecide ? (
        own ? (
          <Text variant="caption" tone="secondary" testID={`request-own-${request.id}`}>
            This is your own request, so another officer needs to decide it.
          </Text>
        ) : (
          <View className="flex-row gap-3">
            <Button variant="secondary" fullWidth disabled={busy} onPress={() => onReject(request)} testID={`request-reject-${request.id}`}>
              Reject
            </Button>
            <Button variant="primary" fullWidth loading={busy} onPress={() => onApprove(request)} testID={`request-approve-${request.id}`}>
              Approve
            </Button>
          </View>
        )
      ) : null}

      <ImageViewerModal visible={viewer !== null} uri={viewer?.uri ?? null} title={viewer?.title} onClose={() => setViewer(null)} />
    </View>
  );
}
