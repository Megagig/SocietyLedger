import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight, FileText, Paperclip } from 'lucide-react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Divider } from '@/components/ui/Divider';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { ProofListItemDTO } from '@/types/api/paymentProofsManage';
import { methodLabel, PROOF_STATUS_LABELS, proofMemberName } from '../labels';

export type ProofRowProps = {
  proof: ProofListItemDTO;
  /** Where the row sits in the list, so separately rendered rows read as one grouped surface (ui-rules.md §5.3). */
  position: 'first' | 'middle' | 'last' | 'only';
  onPress: (proof: ProofListItemDTO) => void;
};

function chargeCount(proof: ProofListItemDTO): number {
  return proof.transactionIds.length || (proof.transactionId ? 1 : 0);
}

/** One proof in the queue: who sent it, how they paid, how many charges it covers and when, with its status. */
function ProofRowBase({ proof, position, onPress }: ProofRowProps) {
  const { color } = useThemeTokens();
  const name = proofMemberName(proof);
  const charges = chargeCount(proof);
  const isFirst = position === 'first' || position === 'only';
  const isLast = position === 'last' || position === 'only';
  const statusLabel = PROOF_STATUS_LABELS[proof.status];
  const BackingIcon = proof.hasFile ? Paperclip : FileText;

  return (
    <View className={cn('overflow-hidden border-x border-border bg-surface dark:border-transparent', isFirst && 'rounded-t-md border-t', isLast && 'rounded-b-md border-b')}>
      {isFirst ? null : <Divider />}
      <Pressable
        onPress={() => onPress(proof)}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${statusLabel}, ${charges} ${charges === 1 ? 'charge' : 'charges'}`}
        android_ripple={{ color: `${color.primary}1F` }}
        className="min-h-[72px] flex-row items-center px-4 py-3"
        testID={`proof-row-${proof.id}`}
      >
        <View className="mr-3">
          <Avatar name={name} colorSeed={proof.member.id} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${proof.member.memberId} · ${methodLabel(proof.paymentMethod)}`}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <BackingIcon size={12} color={color.textTertiary} strokeWidth={1.75} />
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`${charges} ${charges === 1 ? 'charge' : 'charges'} · ${formatDate(proof.uploadedAt, 'relative')}`}
            </Text>
          </View>
        </View>
        <View className="ml-3">
          <StatusChip status={proof.status.toLowerCase()} label={statusLabel} />
        </View>
        <ChevronRight size={20} color={color.textTertiary} strokeWidth={1.75} style={{ marginLeft: 8 }} />
      </Pressable>
    </View>
  );
}

export const ProofRow = memo(ProofRowBase);
