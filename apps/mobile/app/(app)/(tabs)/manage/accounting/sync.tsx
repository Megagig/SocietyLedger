import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { SyncErrorRow } from '@/features/accounting/components/Rows';
import { ACCOUNTING_EDIT_ACCESS, SYNC_KINDS } from '@/features/accounting/labels';
import { useRunSync } from '@/features/accounting/mutations';
import { useAccountingAccess, useSyncErrors, useSyncStatus } from '@/features/accounting/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { useCan } from '@/hooks/useCan';
import type { SyncKind } from '@/types/api/accounting';

const GROUPS = ['Finance', 'Welfare', 'Cooperatives'];

/** The same as the website's Accounting Integration page: how much of each kind of activity is in the books, and a catch-up for each kind. */
export default function SyncStatusScreen() {
  const router = useRouter();
  const allowed = useAccountingAccess();
  const canSync = useCan(ACCOUNTING_EDIT_ACCESS);
  const status = useSyncStatus();
  const errors = useSyncErrors();
  const sync = useRunSync();
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Sync status" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const catchUp = (kind?: SyncKind) =>
    sync.mutate(kind, {
      onSuccess: ({ synced, failed }) => (failed > 0 ? toast.error(`${synced} entered in the books, ${failed} could not be entered`) : toast.success(synced === 0 ? 'Nothing was missing' : `${synced} entered in the books`)),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not catch up the books. Try again.'),
    });

  const data = status.data;
  const list = errors.data ?? [];

  return (
    <Screen edges={['top']} refreshing={status.isRefetching} onRefresh={() => { void status.refetch(); void errors.refetch(); }}>
      <ScreenHeader title="Sync status" onBack={back} docsKey="AC1" />

      {status.isPending ? (
        <View className="gap-4">
          <Skeleton width="100%" height={90} radius="md" />
          <Skeleton width="100%" height={160} radius="md" />
        </View>
      ) : status.isError || !data ? (
        <ErrorState error={status.error} onRetry={() => status.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="gap-2 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="sync-overall">
            <Text variant="label" tone="secondary">
              In the books
            </Text>
            <Text variant="h3">
              {data.overall.synced} of {data.overall.total}
            </Text>
            <Text variant="caption" tone="secondary">
              {data.overall.unsynced === 0 ? 'Everything is in the books.' : `${data.overall.unsynced} ${data.overall.unsynced === 1 ? 'record is' : 'records are'} not in the books yet.`}
            </Text>
            {canSync && data.overall.unsynced > 0 ? (
              <Button variant="primary" fullWidth loading={sync.isPending} onPress={() => catchUp()} testID="sync-all">
                Catch up everything
              </Button>
            ) : null}
          </View>

          {GROUPS.map((group) => (
            <Section key={group} title={group}>
              <ListGroup>
                {SYNC_KINDS.filter((k) => k.group === group).map((k) => {
                  const count = k.count(data);
                  return (
                    <ListItem
                      key={k.kind}
                      title={k.label}
                      meta={`${count.synced} of ${count.total} in the books`}
                      trailing={
                        count.unsynced > 0 ? (
                          canSync ? (
                            <Button variant="soft" size="sm" loading={sync.isPending} onPress={() => catchUp(k.kind)} testID={`sync-${k.kind}`}>
                              {`Catch up ${count.unsynced}`}
                            </Button>
                          ) : (
                            <Badge tone="warning">{`${count.unsynced} missing`}</Badge>
                          )
                        ) : (
                          <Badge tone="success">All in</Badge>
                        )
                      }
                      testID={`sync-row-${k.kind}`}
                    />
                  );
                })}
              </ListGroup>
            </Section>
          ))}

          {list.length > 0 ? (
            <Section title="Could not be entered">
              <View>
                {list.map((e, i) => (
                  <SyncErrorRow key={e.id} item={e} position={positionOf(i, list.length)} />
                ))}
              </View>
            </Section>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
