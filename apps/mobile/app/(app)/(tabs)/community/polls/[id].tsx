import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { format, isPast } from 'date-fns';
import { toast } from 'sonner-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { usePollDetail, useRespondToPoll } from '@/features/voting/queries';
import { t } from '@/lib/i18n';
import type { PollOptionDetailDTO } from '@/types/api/voting';

function OptionRow({
  option,
  selected,
  onToggle,
  multiSelect,
}: {
  option: PollOptionDetailDTO;
  selected: boolean;
  onToggle: () => void;
  multiSelect: boolean;
}) {
  const { color } = useThemeTokens();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      android_ripple={{ color: `${color.primary}1F` }}
      className={['flex-row items-center gap-3 px-4 py-4 border-b border-border', selected ? 'bg-primary-soft' : 'bg-surface'].join(' ')}
    >
      <View
        className={[
          'h-5 w-5 items-center justify-center border-2',
          multiSelect ? 'rounded-xs' : 'rounded-full',
          selected ? 'border-primary bg-primary' : 'border-border bg-transparent',
        ].join(' ')}
      >
        {selected && (
          <View className={multiSelect ? 'h-3 w-3 bg-text-inverse rounded-xs' : 'h-2.5 w-2.5 rounded-full bg-text-inverse'} />
        )}
      </View>
      <Text variant="body" className="flex-1">{option.optionText}</Text>
    </Pressable>
  );
}

/** project-overview.md §6.5 C10 — Poll detail with respond form + live results. */
export default function PollDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pollId = id ? Number(id) : undefined;

  const query = usePollDetail(pollId);
  const respond = useRespondToPoll();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const poll = query.data;

  function toggleOption(optionId: number) {
    if (!poll) return;
    if (poll.allowMultipleVotes) {
      setSelectedIds((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
      );
    } else {
      setSelectedIds([optionId]);
    }
  }

  function handleSubmit() {
    if (!pollId || selectedIds.length === 0) {
      toast.error('Please select at least one option.');
      return;
    }
    respond.mutate(
      { pollId, optionIds: selectedIds },
      {
        onSuccess: () => {
          toast.success(t('polls.responseSubmitted'));
          setSelectedIds([]);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Response failed'),
      },
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader onBack={() => router.back()} title="" />
        <View className="gap-4">
          <Skeleton width="75%" height={28} />
          <Skeleton width="100%" height={200} />
        </View>
      </Screen>
    );
  }

  if (query.isError || !poll) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader onBack={() => router.back()} title="" />
        <ErrorState onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const isClosed = isPast(new Date(poll.endDate));
  const isActive = poll.status === 'ACTIVE' && !isClosed;
  const totalResponses = poll._count.responses;

  return (
    <Screen edges={['top', 'bottom']} scroll>
      <ScreenHeader title={t('polls.title')} onBack={() => router.back()} />

      <View className="gap-6">
        {/* Hero */}
        <View className="gap-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <StatusChip status={isClosed && poll.status === 'ACTIVE' ? 'CLOSED' : poll.status} />
            <Badge tone="primary">{poll.pollType.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}</Badge>
          </View>
          <Text variant="h2">{poll.title}</Text>
          {poll.description ? (
            <Text variant="body" tone="secondary">{poll.description}</Text>
          ) : null}
          <Text variant="caption" tone="tertiary">
            {isClosed
              ? `Closed ${format(new Date(poll.endDate), 'd MMM yyyy')}`
              : `Closes ${format(new Date(poll.endDate), 'd MMM yyyy')}`}
            {' · '}{totalResponses} response{totalResponses !== 1 ? 's' : ''}
          </Text>
          {poll.allowMultipleVotes && isActive && (
            <Text variant="caption" tone="secondary">
              You may select multiple options.
            </Text>
          )}
        </View>

        {/* Options */}
        <Section title={isActive ? 'Choose an option' : 'Results'}>
          <View className="rounded-xl border border-border overflow-hidden">
            {poll.options.map((option) => (
              isActive ? (
                <OptionRow
                  key={option.id}
                  option={option}
                  selected={selectedIds.includes(option.id)}
                  onToggle={() => toggleOption(option.id)}
                  multiSelect={poll.allowMultipleVotes}
                />
              ) : (
                /* Results view — no percentage data from server, just show options */
                <View key={option.id} className="px-4 py-3 border-b border-border bg-surface">
                  <Text variant="body">{option.optionText}</Text>
                </View>
              )
            ))}
          </View>
        </Section>

        {isActive && (
          <StickyFooter>
            <Button
              variant="primary"
              loading={respond.isPending}
              disabled={selectedIds.length === 0}
              onPress={handleSubmit}
              fullWidth
            >
              {t('polls.respond')}
            </Button>
          </StickyFooter>
        )}
      </View>
    </Screen>
  );
}
