import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { ReportCircle, ReportColumn, ReportMetric, ReportRow, ReportTotals } from '@/types/api/ajoReports';
import { MODEL_LABEL } from '../../format';
import { describeRow, formatMetric, formatCell, type RowLine } from '../../reportFormat';
import { AjoMoney } from '../AjoMoney';
import { BoardCard } from '../board/BoardParts';

function FigureRow({ metric }: { metric: ReportMetric }) {
  return (
    <View className="gap-0.5 border-b border-border pb-2" testID={`report-figure-${metric.key}`}>
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="body" className="flex-1">
          {metric.label}
        </Text>
        {metric.kind === 'money' && metric.value !== null ? (
          <AjoMoney kobo={String(metric.value)} />
        ) : (
          <Text variant="body-strong" style={{ fontVariant: ['tabular-nums'] }}>
            {formatMetric(metric)}
          </Text>
        )}
      </View>
      {metric.hint ? (
        <Text variant="caption" tone="secondary">
          {metric.hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The figures for each circle, then a total for circles of the same kind. A rotating pot and a collector-thrift group are never added
 * together. Ledger rows rather than tiles, so a full-length amount (₦45,000,000.00) always fits.
 */
export function ReportFigures({ blocks, totals }: { blocks: ReportCircle[]; totals: ReportTotals[] }) {
  return (
    <View className="gap-3" testID="report-figures">
      {blocks.map((b) => (
        <BoardCard key={b.groupId} title={`${b.groupName} · ${MODEL_LABEL[b.model]}`}>
          {b.metrics.map((m) => (
            <FigureRow key={m.key} metric={m} />
          ))}
        </BoardCard>
      ))}
      {totals.map((t) => (
        <BoardCard key={t.label} title={t.label}>
          <Text variant="caption" tone="secondary">
            {t.circles} circles added together
          </Text>
          {t.metrics.map((m) => (
            <FigureRow key={m.key} metric={m} />
          ))}
        </BoardCard>
      ))}
    </View>
  );
}

function Line({ line }: { line: RowLine }) {
  if (line.stacked) {
    return (
      <View className="gap-0.5">
        <Text variant="caption" tone="secondary">
          {line.label}
        </Text>
        <Text variant="body">{line.value}</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-start justify-between gap-3">
      <Text variant="caption" tone="secondary" className="flex-1">
        {line.label}
      </Text>
      <Text variant="body" style={line.kind === 'money' || line.kind === 'int' || line.kind === 'percent' ? { fontVariant: ['tabular-nums'] } : undefined}>
        {line.value}
      </Text>
    </View>
  );
}

/** One report row as a card with every column of the web table still on it. */
export function ReportRowCard({ columns, row, timeZone, showCircle, testID }: { columns: ReportColumn[]; row: ReportRow; timeZone: string; showCircle: boolean; testID?: string }) {
  const { title, circle, lines } = describeRow(columns, row, timeZone);
  return (
    <View className="gap-1 border-b border-border pb-3" testID={testID}>
      <Text variant="body-strong">{title}</Text>
      {showCircle && circle ? (
        <Text variant="caption" tone="secondary">
          {circle}
        </Text>
      ) : null}
      {lines.map((line) => (
        <Line key={line.label} line={line} />
      ))}
    </View>
  );
}

export { formatCell };
