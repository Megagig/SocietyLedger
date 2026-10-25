import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { FileText, Maximize2 } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { toast } from 'sonner-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { GroupedRow, type RowPosition } from '@/features/financeSetup/components/GroupedRow';
import { isImageMime, isPdfMime } from '@/features/nigerianPayments/labels';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { BudgetPositionDTO, ExpenseDTO } from '@/types/api/expenses';
import { budgetSentence, EXPENSE_STATUS_LABELS, expenseStatusKey } from '../labels';
import { useReceiptLink } from '../queries';

/** One voucher: who was paid and what for, the amount, and where it stands. */
function ExpenseRowBase({ item, position, onPress }: { item: ExpenseDTO; position: RowPosition; onPress?: (item: ExpenseDTO) => void }) {
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.payee}, ${item.category.name}, ${EXPENSE_STATUS_LABELS[item.status]}`}
      testID={`expense-row-${item.id}`}
      minHeight={84}
    >
      <View className="gap-1">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text variant="body-lg" numberOfLines={1}>
              {item.payee}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {item.voucherNumber} · {formatDate(item.expenseDate, 'long')} · {item.category.name}
            </Text>
          </View>
          <Money value={item.amount} size="body-strong" />
        </View>
        <View className="flex-row items-center gap-2">
          <StatusChip status={expenseStatusKey(item.status)} label={EXPENSE_STATUS_LABELS[item.status]} />
          {item.overBudget ? <Badge tone="warning">Over budget</Badge> : null}
          {!item.hasReceipt && item.status !== 'DRAFT' ? <Badge tone="neutral">No receipt</Badge> : null}
        </View>
      </View>
    </GroupedRow>
  );
}
export const ExpenseRow = memo(ExpenseRowBase);

/** The budget line a category belongs to, in words: what is left, or how far this takes it over. Shown on the form and to the approver. */
export function BudgetNote({ position, testID }: { position: BudgetPositionDTO; testID?: string }) {
  const { text, over } = budgetSentence(position);
  return (
    <View className={over ? 'gap-1 rounded-lg bg-warning-soft p-4' : 'gap-1 rounded-lg border border-border bg-surface p-4 dark:border-transparent'} testID={testID ?? 'budget-note'}>
      <Text variant="label" tone={over ? 'warning' : 'secondary'}>
        {position.budgetName}
      </Text>
      <Text variant="body">{text}</Text>
    </View>
  );
}

/** The receipt of a voucher: a picture shows inline and opens in the zoom viewer; a PDF opens in the phone's own viewer. */
export function ReceiptCard({ expenseId, hasReceipt, noReceiptReason }: { expenseId: number; hasReceipt: boolean; noReceiptReason: string | null }) {
  const { color } = useThemeTokens();
  const [viewerOpen, setViewerOpen] = useState(false);
  const link = useReceiptLink(expenseId, hasReceipt);

  if (!hasReceipt) {
    return (
      <View className="gap-1 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="receipt-none">
        <Text variant="body" tone="secondary">
          No receipt was attached.
        </Text>
        {noReceiptReason ? <Text variant="body">{`Reason given: ${noReceiptReason}`}</Text> : null}
      </View>
    );
  }
  if (link.isPending) return <Skeleton width="100%" height={220} radius="lg" />;
  if (link.isError || !link.data) return <ErrorState title="We couldn't load the receipt." onRetry={() => link.refetch()} error={link.error} />;

  const { url, type } = link.data;
  const open = () => void WebBrowser.openBrowserAsync(url).catch(() => toast.error('Could not open the receipt. Try again.'));

  if (isPdfMime(type ?? '') || !isImageMime(type ?? '')) {
    return (
      <View className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="receipt-file">
        <View className="flex-row items-center gap-3">
          <FileText size={28} color={color.primary} strokeWidth={1.5} />
          <Text variant="body-strong" className="flex-1">
            Receipt (PDF)
          </Text>
        </View>
        <Button variant="soft" onPress={open} testID="receipt-open">
          Open receipt
        </Button>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setViewerOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Receipt image. Open to zoom."
        className="overflow-hidden rounded-lg border border-border bg-surface-sunken dark:border-transparent"
        testID="receipt-image"
      >
        <Image source={{ uri: url }} contentFit="contain" style={{ width: '100%', height: 260 }} accessibilityLabel="Receipt" />
        <View className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-overlay/80 px-3 py-1.5">
          <Maximize2 size={14} color={color.onPassbook} strokeWidth={2} />
          <Text variant="caption" tone="onPassbook">
            Zoom
          </Text>
        </View>
      </Pressable>
      <ImageViewerModal visible={viewerOpen} uri={url} title="Receipt" onClose={() => setViewerOpen(false)} />
    </>
  );
}
