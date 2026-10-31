import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, Switch, View } from 'react-native';
import { toast } from 'sonner-native';

import { client } from '@/api/client';
import { ApiError } from '@/api/errors';
import { unwrap } from '@/api/envelope';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Text } from '@/components/ui/Text';
import { useTenantKey } from '@/hooks/useTenantKey';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { BoardCard } from '@/features/ajo/components/board/BoardParts';
import { AJO_MEMBER_ACCESS, ajoKeys } from '@/features/ajo/queries';

type Prefs = { roundFunded: boolean; payoutRecorded: boolean; yourTurn: boolean; weeklySummary: boolean };

const CHOICES: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: 'roundFunded', label: 'When a round is fully paid', hint: 'For example: "Round 4 is fully paid. Musa I. receives ₦100,000.00 on 31 Oct."' },
  { key: 'payoutRecorded', label: 'When a payout is recorded', hint: 'For example: "Payout to Musa I. was recorded as paid."' },
  { key: 'yourTurn', label: 'When your turn is two rounds away', hint: 'For example: "Your turn is in 2 rounds (31 Dec)."' },
  { key: 'weeklySummary', label: 'A weekly summary of the circle', hint: 'Off unless you turn it on. Sent on Mondays: how many have paid, how many are behind, and when the next payout is.' },
];

/** A member's choices about circle notifications (spec §16.4.9). A reminder about your own overdue payment is not here: it always reaches you. */
export default function CircleNotificationsScreen() {
  const tenant = useTenantKey();
  const { color } = useThemeTokens();
  const queryClient = useQueryClient();
  const key = [...ajoKeys.all(tenant), 'notification-preferences'] as const;
  const q = useQuery({ queryKey: key, queryFn: () => unwrap<Prefs>(client.get('/ajo/notification-preferences')) });
  const save = useMutation({
    mutationFn: (change: Partial<Prefs>) => unwrap<Prefs>(client.put('/ajo/notification-preferences', change)),
    networkMode: 'always',
    onSuccess: (data) => queryClient.setQueryData(key, data),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save that choice.'),
  });

  return (
    <AjoScreen title="Circle notifications" access={AJO_MEMBER_ACCESS}>
      {q.isPending ? (
        <AjoLoading rows={3} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <View className="gap-3" testID="ajo-notification-prefs">
          <Text variant="body" tone="secondary">
            Choose what you are told about the circles you are in. Each one can be switched off.
          </Text>
          <BoardCard>
            {CHOICES.map((c) => (
              <Pressable key={c.key} onPress={() => save.mutate({ [c.key]: !q.data[c.key] })} accessibilityRole="switch" accessibilityState={{ checked: q.data[c.key] }} className="flex-row items-start justify-between gap-3 py-2" testID={`ajo-pref-${c.key}`}>
                <View className="flex-1 gap-1">
                  <Text variant="body-strong">{c.label}</Text>
                  <Text variant="caption" tone="secondary">
                    {c.hint}
                  </Text>
                </View>
                <Switch value={q.data[c.key]} onValueChange={(v) => save.mutate({ [c.key]: v })} disabled={save.isPending} trackColor={{ true: color.primary }} />
              </Pressable>
            ))}
          </BoardCard>
          <Text variant="caption" tone="tertiary">
            Reminders about your own payments, and notices from your circle&apos;s officers, are not affected by these choices.
          </Text>
        </View>
      )}
    </AjoScreen>
  );
}
