import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { AiGate } from '@/features/ai/components/AiGate';
import { UsageBar } from '@/features/ai/components/AiParts';
import { AI_BUY_ACCESS, AI_SEND_ACCESS, TONE_LABELS, aiErrorMessage, canAfford, costWords, isOutOfRequests } from '@/features/ai/labels';
import { useAiReminders } from '@/features/ai/mutations';
import { useAiCredits } from '@/features/ai/queries';
import { reminderOutcomeSummary } from '@/features/finance/labels';
import { useSendReminders } from '@/features/finance/mutations';
import { useCan } from '@/hooks/useCan';
import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { ReminderSuggestionDTO, ReminderTone } from '@/types/api/ai';

const TONE_BADGE: Record<ReminderTone, 'success' | 'warning' | 'danger'> = { friendly: 'success', formal: 'warning', urgent: 'danger' };

/** project-overview.md §6.9 AI2 — who to remind and what to say. Tick the members and send; each gets a message with their own name and amount. */
export default function AiRemindersScreen() {
  return (
    <AiGate title="Smart reminders">
      <Reminders />
    </AiGate>
  );
}

function Reminders() {
  const router = useRouter();
  const { color } = useThemeTokens();
  const credits = useAiCredits();
  const canBuy = useCan(AI_BUY_ACCESS);
  const canSend = useCan(AI_SEND_ACCESS);
  const find = useAiReminders();
  const send = useSendReminders();
  const [picked, setPicked] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const status = credits.data?.status;
  const affordable = status ? canAfford(status, 'reminders') : true;
  const result = find.data;
  const suggestions = result?.suggestions ?? [];
  const sendable = (s: ReminderSuggestionDTO) => (s.transactionIds?.length ?? 0) > 0;
  const chosen = suggestions.filter((s) => picked.includes(s.memberId) && sendable(s));

  const buy = () => router.push('/(app)/(tabs)/manage/ai/credits' as never);
  const toggle = (id: number) => setPicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));

  function run() {
    setFailure(null);
    find.mutate(undefined, {
      onSuccess: (data) => setPicked(data.suggestions.filter(sendable).map((s) => s.memberId)),
      onError: (error) => setFailure(error),
    });
  }

  async function sendAll() {
    setSending(true);
    const total = { sent: 0, failed: 0, noContact: 0, skippedRecently: 0 };
    try {
      // Each member's message carries their own name and amount, so each goes in its own request
      for (const s of chosen) {
        const outcome = await send.mutateAsync({ transactionIds: s.transactionIds ?? [], message: s.suggestedMessage });
        total.sent += outcome.sent;
        total.failed += outcome.failed;
        total.noContact += outcome.noContact;
        total.skippedRecently += outcome.skippedRecently;
      }
      setPicked([]);
      if (total.sent > 0) toast.success(reminderOutcomeSummary(total));
      else toast(reminderOutcomeSummary(total));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not send the reminders. Try again.');
    } finally {
      setSending(false);
    }
  }

  const out = !affordable || isOutOfRequests(failure);

  return (
    <Screen edges={['top']} scroll>
      <ScreenHeader title="Smart reminders" onBack={() => router.back()} docsKey="AI2" />
      <View className="gap-4 pb-32">
        <UsageBar status={status} canBuy={canBuy} onBuy={buy} />

        {!result ? (
          <Card className="gap-3">
            <Text variant="h3">Who to remind</Text>
            <Text variant="body" tone="secondary">
              Finds the members who owe the most and writes a message for each, friendlier for a late payment and firmer for an old one. You choose who gets one.
            </Text>
            <Text variant="caption" tone="secondary">{`This costs ${costWords(status?.weights.reminders ?? 1)}, however many members there are.`}</Text>
            {failure ? (
              <Text variant="body" tone="danger" testID="ai-reminders-error">
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
                  You have no requests left today. Ask the Treasurer or Administrator to buy credits.
                </Text>
              )
            ) : (
              <Button variant="primary" fullWidth loading={find.isPending} onPress={run} testID="ai-find">
                Find who to remind
              </Button>
            )}
          </Card>
        ) : suggestions.length === 0 ? (
          <Card className="gap-1" testID="ai-reminders-none">
            <Text variant="h3">Nobody is overdue</Text>
            <Text variant="body" tone="secondary">
              Members who miss a due date show up here.
            </Text>
          </Card>
        ) : (
          <>
            <Card className="gap-1" testID="ai-reminders-summary">
              <Text variant="body-strong">{`${result.totalOwingMembers} ${result.totalOwingMembers === 1 ? 'member owes' : 'members owe'} in all`}</Text>
              <Money value={result.totalOutstanding} size="num-lg" />
              <Text variant="caption" tone="secondary">
                {result.aiWritten ? `Showing the ${suggestions.length} who owe the most. Messages written for you.` : 'The assistant could not be reached, so these use our standard words. Nothing was used.'}
              </Text>
            </Card>

            {suggestions.map((s) => {
              const on = picked.includes(s.memberId);
              const ok = sendable(s);
              return (
                <Pressable
                  key={s.memberId}
                  disabled={!canSend || !ok}
                  onPress={() => toggle(s.memberId)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: !canSend || !ok }}
                  accessibilityLabel={`${s.memberName}, owes ${s.outstandingAmount}`}
                  testID={`ai-reminder-${s.memberId}`}
                >
                  <Card className={cn('gap-2', on && 'border-primary')}>
                    <View className="flex-row items-center gap-3">
                      {canSend ? (
                        <View className={cn('h-5 w-5 items-center justify-center rounded-xs border', on ? 'border-primary bg-primary' : 'border-border-strong')}>
                          {on ? <Check size={14} color={color.textInverse} strokeWidth={2.5} /> : null}
                        </View>
                      ) : null}
                      <View className="flex-1 gap-0.5">
                        <Text variant="body-strong">{s.memberName}</Text>
                        <Text variant="caption" tone="secondary">{`${s.daysOverdue} ${s.daysOverdue === 1 ? 'day' : 'days'} overdue`}</Text>
                      </View>
                      <View className="items-end gap-1">
                        <Money value={s.outstandingAmount} />
                        <Badge tone={TONE_BADGE[s.suggestedTone]}>{TONE_LABELS[s.suggestedTone]}</Badge>
                      </View>
                    </View>
                    <Text variant="caption" tone="secondary">
                      {s.suggestedMessage}
                    </Text>
                    {!ok ? (
                      <Text variant="caption" tone="warning">
                        No open charge to remind about.
                      </Text>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}
          </>
        )}
      </View>

      {result && suggestions.length > 0 ? (
        <StickyFooter>
          <View className="flex-1 gap-2">
            {canSend ? (
              <Button variant="primary" fullWidth loading={sending} disabled={chosen.length === 0} onPress={() => void sendAll()} testID="ai-send-reminders">
                {chosen.length === 0 ? 'Choose who to remind' : `Remind ${chosen.length} ${chosen.length === 1 ? 'member' : 'members'}`}
              </Button>
            ) : (
              <Text variant="caption" tone="secondary" align="center">
                You can read these but not send them. Ask someone who can record payments.
              </Text>
            )}
            <Button variant="ghost" fullWidth onPress={run} loading={find.isPending} disabled={!affordable} testID="ai-find-again">
              Find again
            </Button>
          </View>
        </StickyFooter>
      ) : null}
    </Screen>
  );
}
