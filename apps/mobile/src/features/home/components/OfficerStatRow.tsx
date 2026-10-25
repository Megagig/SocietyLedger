import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Users, TrendingUp, Clock, AlertTriangle } from 'lucide-react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { Skeleton } from '@/components/ui/Skeleton';
import { chargesHref, paymentsHref } from '@/features/reports/drill';
import { useReportsAccess } from '@/features/reports/queries';
import { MEMBERS_VIEW_ACCESS } from '@/features/members/queries';
import { useCan } from '@/hooks/useCan';
import { formatMoney, toDecimal } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { DashboardOverviewDTO } from '@/api/endpoints/dashboard';

type Props = {
  dashboardQuery: UseQueryResult<DashboardOverviewDTO, unknown>;
};

type StatTileProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  /** Opens the records behind the figure. A tile with nothing to open is shown plainly. */
  onPress?: () => void;
};

function OfficerStatTile({ label, value, icon: Icon, iconColor, iconBg, onPress }: StatTileProps) {
  const { color } = useThemeTokens();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      {...(onPress ? { onPress, accessibilityRole: 'button' as const, accessibilityLabel: `${label}: ${value}. Opens the list.` } : {})}
      style={{
        flex: 1,
        backgroundColor: color.surfaceRaised,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: color.border,
        paddingVertical: 14,
        paddingHorizontal: 12,
        gap: 8,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={16} color={iconColor} strokeWidth={2} />
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="h3" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </Wrapper>
  );
}

/** 2×2 stat grid for the officer Association view — Total Members, Total Revenue,
 * Pending Payments, Overdue Payments. */
export function OfficerStatRow({ dashboardQuery }: Props) {
  const { color } = useThemeTokens();
  const router = useRouter();
  const canMembers = useCan(MEMBERS_VIEW_ACCESS);
  const canReports = useReportsAccess();

  if (dashboardQuery.isPending) {
    return (
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Skeleton width="100%" height={88} radius="lg" /></View>
          <View style={{ flex: 1 }}><Skeleton width="100%" height={88} radius="lg" /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Skeleton width="100%" height={88} radius="lg" /></View>
          <View style={{ flex: 1 }}><Skeleton width="100%" height={88} radius="lg" /></View>
        </View>
      </View>
    );
  }

  if (!dashboardQuery.data) return null;

  const d = dashboardQuery.data;
  const totalRevenue = toDecimal(d.financialSummary.totalInflow);

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <OfficerStatTile
          label="Total Members"
          value={d.memberStats.total.toString()}
          onPress={canMembers ? () => router.push('/(app)/(tabs)/manage/members' as never) : undefined}
          icon={Users}
          iconColor={color.info}
          iconBg={color.infoSoft}
        />
        <OfficerStatTile
          label="Total Revenue"
          value={formatMoney(totalRevenue)}
          onPress={canReports ? () => router.push(paymentsHref({}, 'Everything received') as never) : undefined}
          icon={TrendingUp}
          iconColor={color.success}
          iconBg={color.successSoft}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <OfficerStatTile
          label="Pending Payments"
          value={d.financialSummary.pendingPayments.toString()}
          onPress={canReports ? () => router.push(chargesHref({ scope: 'aging', bucket: 'notYetDue' }, 'Owed, not yet due') as never) : undefined}
          icon={Clock}
          iconColor={color.warning}
          iconBg={color.warningSoft}
        />
        <OfficerStatTile
          label="Overdue Payments"
          value={d.financialSummary.overduePayments.toString()}
          onPress={canReports ? () => router.push(chargesHref({ scope: 'overdue' }, 'Overdue charges') as never) : undefined}
          icon={AlertTriangle}
          iconColor={color.danger}
          iconBg={color.dangerSoft}
        />
      </View>
    </View>
  );
}
