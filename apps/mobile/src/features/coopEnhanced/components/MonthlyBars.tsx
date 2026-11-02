import { View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { Text } from '@/components/ui/Text';
import { formatMoney, insertThousands } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { MONTH_SHORT } from '../labels';

/**
 * Twelve monthly bars. The axis always shows the full figure (₦300,000.00), never 300k, and a quiet year says so in words instead of
 * drawing an empty chart. The figures are also read out in one sentence so the chart can be heard without being seen.
 */
export function MonthlyBars({ title, subtitle, data, tone = 'primary' }: { title: string; subtitle: string; data: string[]; tone?: 'primary' | 'info' }) {
  const { color, chart } = useThemeTokens();
  const values = MONTH_SHORT.map((_, i) => Math.round(Number(data[i] ?? 0)));
  const maxValue = Math.max(...values, 0);
  const spoken = values.map((v, i) => (v > 0 ? `${MONTH_SHORT[i]} ${formatMoney(v)}` : null)).filter(Boolean).join(', ');

  const bars = values.map((value, i) => ({
    value,
    label: MONTH_SHORT[i] ?? '',
    frontColor: tone === 'info' ? color.info : chart[0],
  }));
  // Round the top of the axis up to a tidy figure so the labels are whole naira.
  const step = maxValue > 0 ? Math.pow(10, Math.max(Math.floor(Math.log10(maxValue)) - 1, 0)) : 1000;
  const yAxisMax = Math.max(Math.ceil(maxValue / step) * step, 1000);

  return (
    <View
      style={{ backgroundColor: color.surfaceRaised, borderRadius: 16, borderWidth: 1, borderColor: color.border, padding: 16, overflow: 'hidden' }}
      accessible
      accessibilityLabel={`${title}. ${subtitle}. ${spoken || 'No activity recorded for this period'}`}
    >
      <Text variant="h3">{title}</Text>
      <Text variant="caption" tone="secondary" style={{ marginBottom: 12 }}>
        {subtitle}
      </Text>
      {maxValue === 0 ? (
        <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" tone="secondary">
            No activity recorded for this period
          </Text>
        </View>
      ) : (
        <BarChart
          data={bars}
          barWidth={14}
          spacing={10}
          roundedTop
          hideRules
          xAxisColor={color.border}
          yAxisColor={color.border}
          xAxisLabelTextStyle={{ color: color.textSecondary, fontSize: 9 }}
          yAxisTextStyle={{ color: color.textSecondary, fontSize: 9 }}
          noOfSections={4}
          maxValue={yAxisMax}
          yAxisLabelWidth={92}
          isAnimated={false}
          formatYLabel={(v) => {
            const n = parseFloat(v);
            return Number.isNaN(n) ? v : `₦${insertThousands(String(Math.round(n)))}.00`;
          }}
        />
      )}
    </View>
  );
}
