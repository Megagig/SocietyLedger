import { View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import type { UseQueryResult } from '@tanstack/react-query';

import { Text } from '@/components/ui/Text';
import { Skeleton } from '@/components/ui/Skeleton';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { DashboardOverviewDTO } from '@/api/endpoints/dashboard';

type Props = {
  dashboardQuery: UseQueryResult<DashboardOverviewDTO, unknown>;
};

/** Payment Methods donut chart with legend. */
export function PaymentMethodsChart({ dashboardQuery }: Props) {
  const { color, chart } = useThemeTokens();

  if (dashboardQuery.isPending) {
    return <Skeleton width="100%" height={180} radius="lg" />;
  }

  if (!dashboardQuery.data) return null;

  const methods = dashboardQuery.data.paymentMethods;

  if (methods.length === 0) {
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
        <Text variant="h3" style={{ marginBottom: 12 }}>Payment Methods</Text>
        <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" tone="secondary">No payment data yet</Text>
        </View>
      </View>
    );
  }

  const pieData = methods.map((item, i) => ({
    value: item.percentage,
    color: item.color || chart[i % chart.length],
    text: `${Math.round(item.percentage)}%`,
    label: item.name,
  }));

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
      <Text variant="h3" style={{ marginBottom: 16 }}>Payment Methods</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <PieChart
          data={pieData}
          donut
          innerRadius={44}
          radius={72}
          textSize={10}
          textColor={color.textInverse}
          showText
          centerLabelComponent={() => (
            <View style={{ alignItems: 'center' }}>
              <Text variant="caption" tone="secondary">Methods</Text>
              <Text variant="label">{methods.length}</Text>
            </View>
          )}
        />
        {/* Legend */}
        <View style={{ flex: 1, gap: 8 }}>
          {pieData.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: item.color }}
              />
              <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                {item.label}
              </Text>
              <Text variant="caption" tone="secondary">
                {Math.round(item.value)}%
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
