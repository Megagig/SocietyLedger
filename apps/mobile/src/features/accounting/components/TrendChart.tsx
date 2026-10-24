import { View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { Text } from '@/components/ui/Text';
import { insertThousands, toDecimal } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type TrendPoint = { month: string; income: string | number; expenses: string | number };

/** Income and spending for each of the last months, side by side. Amounts on the axis are written in full. */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const { color, chart } = useThemeTokens();
  const hasData = points.some((p) => !toDecimal(p.income).isZero() || !toDecimal(p.expenses).isZero());

  if (!hasData) {
    return (
      <View className="items-center justify-center rounded-lg border border-border bg-surface p-6 dark:border-transparent">
        <Text variant="body" tone="secondary">
          Nothing has been posted in the last six months.
        </Text>
      </View>
    );
  }

  const data = points.flatMap((p) => [
    { value: Math.round(toDecimal(p.income).toNumber()), label: p.month.slice(0, 3), frontColor: chart[0], spacing: 4 },
    { value: Math.round(toDecimal(p.expenses).toNumber()), frontColor: chart[1] ?? chart[0], spacing: 20 },
  ]);
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View className="gap-3 overflow-hidden rounded-lg border border-border bg-surface p-4 dark:border-transparent" accessibilityLabel="Income and spending for the last six months">
      <BarChart
        data={data}
        barWidth={14}
        roundedTop
        hideRules
        xAxisColor={color.border}
        yAxisColor={color.border}
        xAxisLabelTextStyle={{ color: color.textSecondary, fontSize: 10 }}
        yAxisTextStyle={{ color: color.textSecondary, fontSize: 9 }}
        noOfSections={4}
        maxValue={Math.ceil(max / 1000) * 1000}
        yAxisLabelWidth={76}
        formatYLabel={(v) => {
          const n = parseFloat(v);
          return Number.isNaN(n) ? v : `₦${insertThousands(String(Math.round(n)))}`;
        }}
        height={140}
        backgroundColor={color.surface}
      />
      <View className="flex-row gap-4">
        <Legend colour={chart[0]} label="Income" />
        <Legend colour={chart[1] ?? chart[0]} label="Spending" />
      </View>
    </View>
  );
}

function Legend({ colour, label }: { colour: string | undefined; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-3 w-3 rounded-sm" style={{ backgroundColor: colour }} />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}
