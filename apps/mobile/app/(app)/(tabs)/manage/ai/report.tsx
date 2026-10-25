import { useRouter } from 'expo-router';
import { Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { AiGate } from '@/features/ai/components/AiGate';
import { UsageBar } from '@/features/ai/components/AiParts';
import { AI_BUY_ACCESS, AI_REPORT_ACCESS, REPORT_TYPE_OPTIONS, aiErrorMessage, canAfford, costWords, isOutOfRequests } from '@/features/ai/labels';
import { useAiReport } from '@/features/ai/mutations';
import { useAiCredits } from '@/features/ai/queries';
import { reportShareText } from '@/features/ai/reportText';
import { useCan } from '@/hooks/useCan';
import { useTenantStore } from '@/stores/tenant';
import { cn } from '@/lib/cn';
import type { AiReportType } from '@/types/api/ai';

/** project-overview.md §6.9 AI3 — a written report for the committee, from the same figures as Reports and Accounting. It is not saved; share it to keep it. */
export default function AiReportScreen() {
  return (
    <AiGate title="AI report" also={AI_REPORT_ACCESS}>
      <ReportBuilder />
    </AiGate>
  );
}

function ReportBuilder() {
  const router = useRouter();
  const credits = useAiCredits();
  const canBuy = useCan(AI_BUY_ACCESS);
  const make = useAiReport();
  const association = useTenantStore((s) => s.current?.name);
  const [type, setType] = useState<AiReportType>('monthly_summary');
  const [failure, setFailure] = useState<unknown>(null);

  const status = credits.data?.status;
  const cost = status?.weights.report ?? 5;
  const affordable = status ? canAfford(status, 'report') : true;
  const report = make.data;
  const buy = () => router.push('/(app)/(tabs)/manage/ai/credits' as never);
  const out = !affordable || isOutOfRequests(failure);

  function run() {
    setFailure(null);
    make.mutate({ reportType: type, includeRecommendations: true }, { onError: (error) => setFailure(error) });
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="AI report"
        onBack={() => router.back()}
        docsKey="AI3"
        rightActions={report ? <IconButton icon={Share2} accessibilityLabel="Share this report" onPress={() => void Share.share({ message: reportShareText(report, association) })} testID="ai-report-share" /> : undefined}
      />
      <View className="gap-4 pb-8">
        <UsageBar status={status} canBuy={canBuy} onBuy={buy} />

        <Card className="gap-3">
          <Text variant="h3">What kind of report?</Text>
          <View className="gap-2">
            {REPORT_TYPE_OPTIONS.map((option) => {
              const on = type === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setType(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  className={cn('gap-0.5 rounded-md border px-4 py-3', on ? 'border-primary bg-primary-soft' : 'border-border bg-surface dark:border-transparent')}
                  testID={`ai-report-type-${option.value}`}
                >
                  <Text variant="body-strong">{option.label}</Text>
                  <Text variant="caption" tone="secondary">
                    {option.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text variant="caption" tone="secondary">{`A report costs ${costWords(cost)}, more than a question, because it reads more and writes more.`}</Text>
          {failure ? (
            <Text variant="body" tone="danger" testID="ai-report-error">
              {aiErrorMessage(failure)}
            </Text>
          ) : null}
          {out ? (
            canBuy ? (
              <Button variant="primary" fullWidth onPress={buy} testID="ai-buy-out">
                Buy credits to carry on
              </Button>
            ) : (
              <Text variant="caption" tone="secondary">
                You do not have enough requests left today. Ask the Treasurer or Administrator to buy credits.
              </Text>
            )
          ) : (
            <Button variant="primary" fullWidth loading={make.isPending} onPress={run} testID="ai-report-make">
              {report ? 'Write it again' : 'Write the report'}
            </Button>
          )}
        </Card>

        {report ? (
          <Card className="gap-4" testID="ai-report-result">
            <View className="gap-1">
              <Text variant="h2">{report.title}</Text>
              <Text variant="caption" tone="secondary">
                {report.period}
              </Text>
            </View>
            <Text variant="body">{report.summary}</Text>
            {report.sections.map((section) => (
              <View key={section.heading} className="gap-1">
                <Text variant="h3">{section.heading}</Text>
                <Text variant="body">{section.content}</Text>
              </View>
            ))}
            {report.highlights.length > 0 ? (
              <View className="gap-1">
                <Text variant="h3">Highlights</Text>
                {report.highlights.map((h) => (
                  <Text key={h} variant="body">{`• ${h}`}</Text>
                ))}
              </View>
            ) : null}
            {report.recommendations && report.recommendations.length > 0 ? (
              <View className="gap-1">
                <Text variant="h3">Recommendations</Text>
                {report.recommendations.map((r) => (
                  <Text key={r} variant="body">{`• ${r}`}</Text>
                ))}
              </View>
            ) : null}
            <Text variant="caption" tone="secondary">
              Written from your own figures. Check them against Reports before you act on them. This report is not saved; share it to keep a copy.
            </Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
