import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { creditsLabel } from '../labels';

/** One line of a summary: what it counts, and how many. */
export function CountLine({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <View className="gap-0.5">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="body" tone="secondary" className="flex-1">
          {label}
        </Text>
        <Text variant="body-strong">{value.toLocaleString('en-NG')}</Text>
      </View>
      {note ? (
        <Text variant="caption" tone="tertiary">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * What a text send would cost against the balance, worked out by the server before anything is sent. When the balance falls short it
 * says by how much, and that credits are bought on the web (they cannot be bought in the app).
 */
export function CostNotice({ segments, credits, balance, enough, shortBy }: { segments: number; credits: number; balance: number; enough: boolean; shortBy: number }) {
  return (
    <View className={cn('gap-1 rounded-md p-3', enough ? 'bg-surface-sunken' : 'bg-danger-soft')} testID="cost-notice">
      <Text variant="body" tone={enough ? 'default' : 'danger'}>
        {`${segments} ${segments === 1 ? 'part' : 'parts'} per text, so this costs ${creditsLabel(credits)}. You have ${creditsLabel(balance)}.`}
      </Text>
      {enough ? null : (
        <Text variant="caption" tone="danger">
          {`You are short by ${creditsLabel(shortBy)}. Buy credits on the web, then send this.`}
        </Text>
      )}
    </View>
  );
}

/** A framed block of lines under a heading — the "who this reaches" summary. */
export function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <View className="gap-3">
        <Text variant="h3">{title}</Text>
        {children}
      </View>
    </Card>
  );
}
