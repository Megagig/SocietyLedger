import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ajoSavingsApi } from '@/api/endpoints/ajoSavings';
import { client } from '@/api/client';
import { unwrap } from '@/api/envelope';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { useTenantKey } from '@/hooks/useTenantKey';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { AccountabilityDTO } from '@/types/api/ajoAccountability';
import { AjoMoney } from '@/features/ajo/components/AjoMoney';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { BoardCard } from '@/features/ajo/components/board/BoardParts';
import { formatMomentIn, shortDay } from '@/features/ajo/boardFormat';
import { formatKobo } from '@/features/ajo/format';
import { AJO_STAFF_ACCESS, ajoKeys } from '@/features/ajo/queries';
import { CSV_MIME, saveAndShareFile } from '@/features/ajo/shareFile';

/**
 * What officers answer to (spec §16.7): who prepared, approved and recorded each payout, how long payments wait for confirmation,
 * cash by collector and day, and every exception with its reason. For the group's own meetings and auditors.
 */
export default function AccountabilityScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId) || 0;
  const tenant = useTenantKey();
  const { color } = useThemeTokens();
  const q = useQuery({ queryKey: [...ajoKeys.all(tenant), 'accountability', groupId] as const, queryFn: () => unwrap<AccountabilityDTO>(client.get(`/ajo/groups/${groupId}/accountability`)), enabled: groupId > 0, staleTime: 30_000 });
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      await saveAndShareFile('accountability.csv', await ajoSavingsApi.file(`/ajo/groups/${groupId}/accountability/export.csv`), CSV_MIME);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not make the report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AjoScreen title="Accountability" access={AJO_STAFF_ACCESS} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {q.isPending ? (
        <AjoLoading rows={3} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <View className="gap-3" testID="ajo-accountability">
          <Text variant="caption" tone="secondary">
            Officers answer to members as well as the other way round. Members see how many payments are waiting; this shows who each one is.
          </Text>
          <Button variant="secondary" loading={busy} onPress={() => void share()} testID="ajo-accountability-export">
            Share report (CSV)
          </Button>

          <BoardCard title="Who prepared, approved and recorded each payout">
            {q.data.separation.payouts.length === 0 ? (
              <Text variant="body" tone="secondary">
                No payouts yet.
              </Text>
            ) : (
              q.data.separation.payouts.map((p) => (
                <View key={p.id} className="gap-1 border-b border-border pb-2">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text variant="body-strong" className="flex-1">
                      {p.recipient} · {p.round !== null ? `round ${p.round}` : `cycle ${p.cycleNo}`}
                    </Text>
                    <AjoMoney kobo={p.netKobo} />
                  </View>
                  <Text variant="caption" tone="secondary">
                    {p.status} · prepared by {p.preparedBy ?? 'unknown'} · approved by {p.approvedBy ?? 'not yet'} · recorded paid by {p.recordedPaidBy ?? 'not yet'}
                  </Text>
                  {p.singleAdminApproval || p.sameRecorder ? (
                    <View className="flex-row items-center gap-1">
                      <TriangleAlert size={14} color={color.warning} strokeWidth={2} />
                      <Text variant="caption" tone="warning">
                        {p.singleAdminApproval ? 'One person prepared and approved this.' : 'The person who recorded it also prepared or approved it.'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </BoardCard>

          <BoardCard title="Payments waiting for confirmation">
            <Text variant="body">
              {q.data.backlog.total === 0 ? 'Nothing is waiting.' : `${q.data.backlog.total} waiting, ${q.data.backlog.pastTarget} past the ${q.data.backlog.targetHours}-hour target${q.data.backlog.oldestHours !== null ? `, the oldest for ${q.data.backlog.oldestHours} hours` : ''}.`}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {q.data.backlog.buckets.map((b) => (
                <StatTile key={b.key} label={b.label} value={String(b.count)} tone={b.key === 'OVER_TARGET' || b.key === 'OVER_7D' ? 'warning' : 'info'} />
              ))}
            </View>
            {q.data.backlog.oldest.map((w) => (
              <View key={w.id} className="flex-row items-center justify-between gap-2">
                <Text variant="body" className="flex-1">
                  {w.member} · {w.method === 'CASH' ? 'cash' : 'transfer'}
                </Text>
                <AjoMoney kobo={w.amountKobo} />
                <Text variant="caption" tone={w.ageHours >= q.data.backlog.targetHours ? 'warning' : 'secondary'}>
                  {w.ageHours} h
                </Text>
              </View>
            ))}
          </BoardCard>

          {q.data.cash ? (
            <BoardCard title="Cash by collector and day">
              {q.data.cash.length === 0 ? (
                <Text variant="body" tone="secondary">
                  No handovers yet.
                </Text>
              ) : (
                q.data.cash.map((c) => (
                  <View key={c.id} className="gap-1 border-b border-border pb-2">
                    <Text variant="body-strong">
                      {shortDay(c.date)} · {c.collector}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      Expected {formatKobo(c.expectedKobo)} · collected {formatKobo(c.collectedKobo)} · handed in {formatKobo(c.handedOverKobo)}
                    </Text>
                    <Text variant="caption" tone={c.reconciled ? 'secondary' : 'warning'}>
                      {c.countedKobo === null ? 'Not counted yet' : `Counted ${formatKobo(c.countedKobo)} by ${c.reconciledBy ?? 'the office'}`}
                      {BigInt(c.differenceKobo) !== BigInt(0) ? ` · difference ${formatKobo(c.differenceKobo)}` : ''}
                    </Text>
                  </View>
                ))
              )}
            </BoardCard>
          ) : null}

          <BoardCard title="Exceptions">
            {q.data.exceptions.length === 0 ? (
              <Text variant="body" tone="secondary">
                Nothing has been reversed, waived or changed.
              </Text>
            ) : (
              q.data.exceptions.map((e, i) => (
                <View key={`${e.at}-${i}`} className="gap-1 border-b border-border pb-2">
                  <Text variant="body">{e.text}</Text>
                  <Text variant="caption" tone="secondary">
                    {formatMomentIn(e.at, q.data.timezone)}
                    {e.by ? ` · ${e.by}` : ''}
                    {e.reason ? ` · reason: ${e.reason}` : ''}
                  </Text>
                </View>
              ))
            )}
          </BoardCard>
        </View>
      )}
    </AjoScreen>
  );
}
