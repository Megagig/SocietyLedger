import { View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import type { UseQueryResult } from '@tanstack/react-query';

import { Text } from '@/components/ui/Text';
import { Skeleton } from '@/components/ui/Skeleton';
import { insertThousands } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { DashboardOverviewDTO } from '@/api/endpoints/dashboard';

type Props = {
  dashboardQuery: UseQueryResult<DashboardOverviewDTO, unknown>;
};

/** Revenue Analytics bar chart — 6 months of revenue trend data. */
export function RevenueChart({ dashboardQuery }: Props) {
  const { color, chart } = useThemeTokens();

  if (dashboardQuery.isPending) {
    return <Skeleton width="100%" height={180} radius="lg" />;
  }

  if (!dashboardQuery.data) return null;

  const trend = dashboardQuery.data.revenueTrend;

  if (trend.length === 0) {
    return (
      <View
        style={{
          backgroundColor: color.surfaceRaised,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: color.border,
          padding: 16,
        }}
      >
        <Text variant="h3" style={{ marginBottom: 12 }}>Revenue Analytics</Text>
        <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" tone="secondary">No revenue data yet</Text>
        </View>
      </View>
    );
  }

  const barData = trend.map((item) => ({
    value: Math.round(parseFloat(item.revenue)),
    label: item.month.slice(0, 3),
    frontColor: chart[0],
    topLabelComponent: undefined,
  }));

  const maxValue = Math.max(...barData.map((d) => d.value), 1);
  const yAxisMax = Math.ceil(maxValue / 1000) * 1000;

  return (
    <View
      style={{
        backgroundColor: color.surfaceRaised,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: color.border,
        padding: 16,
        overflow: 'hidden',
      }}
    >
      <Text variant="h3" style={{ marginBottom: 16 }}>Revenue Analytics</Text>
      <BarChart
        data={barData}
        barWidth={28}
        spacing={16}
        roundedTop
        roundedBottom
        hideRules
        xAxisColor={color.border}
        yAxisColor={color.border}
        xAxisLabelTextStyle={{ color: color.textSecondary, fontSize: 10 }}
        yAxisTextStyle={{ color: color.textSecondary, fontSize: 9 }}
        noOfSections={4}
        maxValue={yAxisMax}
        yAxisLabelWidth={76}
        formatYLabel={(v) => {
          const n = parseFloat(v);
          return Number.isNaN(n) ? v : `₦${insertThousands(String(Math.round(n)))}`;
        }}
        height={140}
        barBorderRadius={6}
        backgroundColor={color.surfaceRaised}
        isAnimated
      />
    </View>
  );
}
