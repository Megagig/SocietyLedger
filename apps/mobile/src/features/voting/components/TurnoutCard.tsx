import { View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { Skeleton } from '@/components/ui/Skeleton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { formatDate } from '@/lib/dates';
import { useElectionProgress } from '../queries';

/**
 * How an election is going while members vote: how many of the eligible members have voted, how that built up, and how many have voted
 * on each position. It refreshes every few seconds and shows turnout only — never who is ahead or who anyone voted for.
 */
export function TurnoutCard({ electionId, compact = false, width = 280 }: { electionId: number; compact?: boolean; width?: number }) {
  const { color, chart } = useThemeTokens();
  const query = useElectionProgress(electionId);
  const progress = query.data;

  if (query.isPending) return <Skeleton width="100%" height={compact ? 56 : 200} radius="md" />;
  if (query.isError || !progress) return null;

  const live = progress.status === 'VOTING_OPEN';
  const quorum = progress.requiresQuorum && progress.quorumPercentage ? progress.quorumPercentage : null;
  const points = progress.timeline.map((p) => ({ value: p.voted, label: '' }));

  return (
    <View className="gap-3" testID={`turnout-${electionId}`}>
      <View className="flex-row items-end justify-between">
        <View className="flex-1">
          <Text variant="h2">{`${progress.voted} of ${progress.eligible}`}</Text>
          <Text variant="caption" tone="secondary">
            {`members have voted · ${progress.turnoutPercent}% turnout${quorum !== null ? (progress.quorumMet ? ` · ${quorum}% minimum met` : ` · ${quorum}% needed`) : ''}`}
          </Text>
        </View>
        {live ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-success-soft px-3 py-1">
            <View className="h-2 w-2 rounded-full bg-success" />
            <Text variant="micro" tone="success">
              Live
            </Text>
          </View>
        ) : null}
      </View>

      <ProgressBar percent={progress.turnoutPercent} tone={quorum !== null && progress.quorumMet ? 'success' : 'primary'} label="Turnout" />

      {!compact && points.length > 1 ? (
        <View className="gap-1" testID={`turnout-chart-${electionId}`}>
          <Text variant="caption" tone="secondary">
            Members who have voted, over time
          </Text>
          <LineChart
            data={points}
            areaChart
            curved
            width={width}
            height={120}
            maxValue={Math.max(progress.eligible, progress.voted, 1)}
            noOfSections={3}
            hideDataPoints
            color={chart[0]}
            startFillColor={chart[0]}
            endFillColor={color.surfaceRaised}
            startOpacity={0.4}
            endOpacity={0.05}
            thickness={2}
            hideRules
            xAxisColor={color.border}
            yAxisColor={color.border}
            yAxisTextStyle={{ color: color.textSecondary, fontSize: 9 }}
            yAxisLabelWidth={28}
            backgroundColor={color.surfaceRaised}
            initialSpacing={0}
            spacing={Math.max(4, Math.floor((width - 36) / points.length))}
            isAnimated={false}
          />
          <View className="flex-row justify-between">
            <Text variant="micro" tone="tertiary">
              {formatDate(progress.votingStartDate, 'long')}
            </Text>
            <Text variant="micro" tone="tertiary">
              {formatDate(progress.votingEndDate, 'long')}
            </Text>
          </View>
        </View>
      ) : null}

      {!compact && progress.positions.length > 0 ? (
        <View className="gap-2">
          <Text variant="caption" tone="secondary">
            Voting on each position
          </Text>
          {progress.positions.map((p) => (
            <View key={p.positionId} className="gap-1">
              <View className="flex-row justify-between">
                <Text variant="body">{p.title}</Text>
                <Text variant="caption" tone="secondary">{`${p.voted} of ${progress.eligible}`}</Text>
              </View>
              <ProgressBar percent={progress.eligible > 0 ? (p.voted / progress.eligible) * 100 : 0} label={p.title} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
