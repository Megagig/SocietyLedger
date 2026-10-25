import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Wallet, CheckCircle2, Calendar, Users } from 'lucide-react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/dates';
import { formatMoney, toDecimal } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { FinanceSummaryDTO } from '@/types/api/memberFinance';

type Props = {
  summaryQuery: UseQueryResult<FinanceSummaryDTO, unknown>;
  upcomingMeetingsCount: number;
};

type StatTileProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  valueColor?: string;
  /** Opens the records behind the figure. */
  onPress?: () => void;
};

function StatTile({ label, value, icon: Icon, iconColor, iconBg, valueColor, onPress }: StatTileProps) {
  const { color } = useThemeTokens();
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      {...(onPress ? { onPress, accessibilityRole: 'button' as const, accessibilityLabel: `${label}: ${value}. Opens the details.` } : {})}
      style={{
        flex: 1,
        backgroundColor: color.surfaceRaised,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: color.border,
        padding: 16,
        gap: 12,
      }}
    >
      {/* Icon badge */}
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={18} color={iconColor} strokeWidth={2} />
      </View>

      {/* Value + label stacked */}
      <View style={{ gap: 3 }}>
        <Text
          variant="h3"
          numberOfLines={1}
          style={{ color: valueColor ?? color.text, fontSize: 18 }}
        >
          {value}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Wrapper>
  );
}

/** 2×2 stat grid — Outstanding Balance, Paid This Month, Next Due Date, Upcoming Meetings. */
export function MemberStatRow({ summaryQuery, upcomingMeetingsCount }: Props) {
  const { color } = useThemeTokens();
  const router = useRouter();

  if (summaryQuery.isPending) {
    return (
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Skeleton width="100%" height={104} radius="lg" /></View>
          <View style={{ flex: 1 }}><Skeleton width="100%" height={104} radius="lg" /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Skeleton width="100%" height={104} radius="lg" /></View>
          <View style={{ flex: 1 }}><Skeleton width="100%" height={104} radius="lg" /></View>
        </View>
      </View>
    );
  }

  if (!summaryQuery.data) return null;

  const s = summaryQuery.data;
  const outstanding = toDecimal(s.totalOutstanding);
  const paidThisMonth = toDecimal(s.paidThisMonth);
  const nextDueDate = s.upcomingPayments[0]?.dueDate;
  const hasOutstanding = outstanding.greaterThan(0);
  const nextDueId = s.upcomingPayments[0]?.id;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile
          label="Outstanding Balance"
          value={formatMoney(outstanding)}
          onPress={() => router.push('/(app)/(tabs)/money' as never)}
          icon={Wallet}
          iconBg={hasOutstanding ? color.dangerSoft : color.successSoft}
          iconColor={hasOutstanding ? color.danger : color.success}
          valueColor={hasOutstanding ? color.danger : color.success}
        />
        <StatTile
          label="Paid This Month"
          value={formatMoney(paidThisMonth)}
          onPress={() => router.push('/(app)/(tabs)/money/payments' as never)}
          icon={CheckCircle2}
          iconBg={color.successSoft}
          iconColor={color.success}
          valueColor={color.success}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile
          label="Next Due Date"
          value={nextDueDate ? formatDate(nextDueDate, 'short') : 'None'}
          onPress={nextDueId ? () => router.push(`/(app)/(tabs)/money/transaction/${nextDueId}` as never) : undefined}
          icon={Calendar}
          iconBg={nextDueDate ? color.warningSoft : color.surfaceSunken}
          iconColor={nextDueDate ? color.warning : color.textTertiary}
        />
        <StatTile
          label="Upcoming Meetings"
          value={upcomingMeetingsCount > 0 ? String(upcomingMeetingsCount) : 'None'}
          onPress={upcomingMeetingsCount > 0 ? () => router.push('/(app)/(tabs)/community/meetings' as never) : undefined}
          icon={Users}
          iconBg={color.infoSoft}
          iconColor={color.info}
          valueColor={upcomingMeetingsCount > 0 ? color.info : undefined}
        />
      </View>
    </View>
  );
}
