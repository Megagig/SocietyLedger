import { Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { allowanceLine, costWords } from '@/features/ai/labels';
import type { ChatMessage } from '@/features/ai/history';
import type { AiStatusDTO, AiTableDTO } from '@/types/api/ai';

/** What is left today and in credits, with a way to buy more. The first thing on every assistant screen. */
export function UsageBar({ status, canBuy, onBuy }: { status: AiStatusDTO | undefined; canBuy: boolean; onBuy: () => void }) {
  if (!status) return null;
  const used = status.allowancePerDay > 0 ? (status.allowanceUsed / status.allowancePerDay) * 100 : 100;
  const empty = status.allowanceLeft + status.credits === 0;
  return (
    <Card className="gap-3" testID="ai-usage">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text variant="body-strong" tone={empty ? 'danger' : 'default'} testID="ai-usage-line">
            {allowanceLine(status)}
          </Text>
          <Text variant="caption" tone="secondary">
            {`Free each day on your plan: ${status.allowancePerDay}. A question costs ${costWords(status.weights.question)}, a report ${costWords(status.weights.report)}.`}
          </Text>
        </View>
        {canBuy ? (
          <Button variant="secondary" size="sm" onPress={onBuy} testID="ai-buy">
            Buy credits
          </Button>
        ) : null}
      </View>
      {status.allowancePerDay > 0 ? <ProgressBar percent={used} label="Free requests used today" /> : null}
    </Card>
  );
}

/** A heading and rows with the real names, from the same figures as Reports and Accounting. */
export function TableCard({ table }: { table: AiTableDTO }) {
  return (
    <View className="gap-1 rounded-lg border border-border bg-surface-sunken p-3 dark:border-transparent" testID={`ai-table-${table.id}`}>
      <Text variant="label">{table.title}</Text>
      <View className="flex-row gap-3 pb-1">
        {table.columns.map((column, i) => (
          <Text key={column} variant="caption" tone="secondary" className={i === 0 ? 'flex-1' : 'min-w-[72px]'} align={i === 0 ? 'left' : 'right'}>
            {column}
          </Text>
        ))}
      </View>
      {table.rows.map((row, r) => (
        <View key={`${table.id}-${r}`} className="flex-row gap-3 py-1">
          {row.map((cell, i) => (
            <Text key={`${r}-${i}`} variant={i === 0 ? 'body' : 'num'} className={i === 0 ? 'flex-1' : 'min-w-[72px]'} align={i === 0 ? 'left' : 'right'}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Shows an answer a few words at a time, so it reads as it is written. Only the newest answer does this; older ones appear whole. */
export function useReveal(text: string, animate: boolean): string {
  const words = text.split(/(s+)/);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const step = Math.max(2, Math.ceil(words.length / 24));
    const timer = setInterval(() => {
      setShown((n) => {
        if (n + step >= words.length) {
          clearInterval(timer);
          return words.length;
        }
        return n + step;
      });
    }, 40);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, animate]);
  return animate ? words.slice(0, shown).join('') : text;
}

export function MessageBubble({ message, animate }: { message: ChatMessage; animate: boolean }) {
  const mine = message.role === 'user';
  const text = useReveal(message.content, animate && !mine && !message.failed);
  const done = text.length >= message.content.length;
  return (
    <View className={cn('w-full', mine ? 'items-end' : 'items-start')} testID={`ai-message-${message.id}`}>
      <View className={cn('max-w-[92%] gap-2 rounded-lg px-4 py-3', mine ? 'bg-primary-soft' : message.failed ? 'bg-danger-soft' : 'border border-border bg-surface dark:border-transparent')}>
        <Text variant="body" tone={message.failed ? 'danger' : mine ? 'onPrimarySoft' : 'default'}>
          {text}
        </Text>
        {!mine && done && message.tables?.map((table) => <TableCard key={table.id} table={table} />)}
        {!mine && done && !message.failed && message.period ? (
          <Text variant="caption" tone="secondary">
            {message.confidence === 'low' ? `${message.period} · not much data yet, so treat this as a guide` : message.period}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function ThinkingBubble() {
  return (
    <View className="w-full items-start" testID="ai-thinking">
      <View className="flex-row items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 dark:border-transparent">
        <Spinner />
        <Text variant="body" tone="secondary">
          Working out the figures…
        </Text>
      </View>
    </View>
  );
}

/** Suggested questions for an empty conversation. */
export function PromptChips({ prompts, onPick, disabled }: { prompts: string[]; onPick: (prompt: string) => void; disabled?: boolean }) {
  const { color } = useThemeTokens();
  return (
    <View className="gap-2" testID="ai-prompts">
      {prompts.map((prompt) => (
        <Pressable
          key={prompt}
          disabled={disabled}
          onPress={() => onPick(prompt)}
          accessibilityRole="button"
          className="flex-row items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 active:bg-surface-sunken dark:border-transparent"
        >
          <Sparkles size={16} color={color.primary} />
          <Text variant="body" className="flex-1">
            {prompt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
