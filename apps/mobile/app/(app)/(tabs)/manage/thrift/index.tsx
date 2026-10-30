import { useRouter } from 'expo-router';
import { CalendarCheck, FileText, PiggyBank, Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { IconCircle } from '@/components/ui/IconCircle';
import { Text } from '@/components/ui/Text';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { OnboardingResume } from '@/features/ajo/components/OnboardingResume';
import { AjoStatusBadge } from '@/features/ajo/components/AjoStatusBadge';
import { formatDay, formatKobo, frequencyText, MODEL_LABEL } from '@/features/ajo/format';
import { AJO_COLLECT_ACCESS, AJO_STAFF_ACCESS, useGroups } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';
import { useAjoNav } from '@/features/ajo/useAjoNav';
import { useSessionStore } from '@/stores/session';
import { useCan } from '@/hooks/useCan';

export const circleHref = (groupId: number, sub = '') => `/(app)/(tabs)/manage/thrift/${groupId}${sub}` as never;

/** THO1: every circle in the association with its status, seats and contribution, plus the collector's "Today" shortcut. */
export default function CirclesScreen() {
  const router = useRouter();
  const { canWrite } = useAjoWrite();
  const { manage, reports } = useAjoCan();
  const collector = useCan(AJO_COLLECT_ACCESS);
  const staff = useCan(AJO_STAFF_ACCESS);
  const groups = useGroups();
  const nav = useAjoNav();
  const isAdmin = useSessionStore((st) => st.user?.role === 'admin' && !st.user?.platformRole);

  return (
    <AjoScreen
      title="Thrift circles"
      access={[...AJO_STAFF_ACCESS, ...AJO_COLLECT_ACCESS]}
      refreshing={groups.isRefetching}
      onRefresh={() => void groups.refetch()}
      rightActions={manage && canWrite ? <IconButton icon={Plus} accessibilityLabel="New circle" onPress={() => router.push('/(app)/(tabs)/manage/thrift/new' as never)} testID="ajo-new-circle" /> : undefined}
    >
      <OnboardingResume />
      {nav.thriftOnly && isAdmin ? (
        <Button variant="ghost" onPress={() => router.push('/(app)/onboarding/thrift?rerun=true' as never)} testID="ajo-setup-guide">
          Setup guide
        </Button>
      ) : null}
      {collector ? (
        <ListGroup>
          <ListItem
            leading={<IconCircle icon={CalendarCheck} tone="primary" />}
            title="Today's collection"
            meta="Your contributors, record cash, end-of-day handover"
            showChevron
            onPress={() => router.push('/(app)/(tabs)/manage/thrift/today' as never)}
            testID="ajo-today-link"
          />
        </ListGroup>
      ) : null}

      {reports ? (
        <ListGroup>
          <ListItem
            leading={<IconCircle icon={FileText} tone="primary" />}
            title="Reports"
            meta="Contributions, ledger, payouts, arrears and more, with PDF and CSV"
            showChevron
            onPress={() => router.push('/(app)/(tabs)/manage/thrift/reports' as never)}
            testID="ajo-reports-link"
          />
        </ListGroup>
      ) : null}

      {!staff ? null : groups.isPending ? (
        <AjoLoading />
      ) : groups.isError ? (
        <ErrorState error={groups.error} onRetry={() => groups.refetch()} />
      ) : groups.data.length > 0 ? (
        <View className="gap-3">
          {groups.data.map((g) => (
            <Card key={g.id} testID={`ajo-circle-${g.id}`}>
              <View className="gap-3">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <Text variant="h3">{g.name}</Text>
                    <Text variant="caption" tone="secondary">
                      {MODEL_LABEL[g.model]} · {frequencyText(g)}
                    </Text>
                  </View>
                  <AjoStatusBadge status={g.status} />
                </View>
                <View className="flex-row justify-between">
                  <View>
                    <Text variant="caption" tone="tertiary">
                      Each pays
                    </Text>
                    <Text variant="body-strong">{formatKobo(g.contributionKobo)}</Text>
                  </View>
                  <View>
                    <Text variant="caption" tone="tertiary">
                      Seats
                    </Text>
                    <Text variant="body-strong">
                      {g.seats.taken} of {g.seats.total}
                    </Text>
                  </View>
                  <View>
                    <Text variant="caption" tone="tertiary">
                      Starts
                    </Text>
                    <Text variant="body-strong">{formatDay(g.startDate)}</Text>
                  </View>
                </View>
                <Button variant="secondary" onPress={() => router.push(circleHref(g.id))} testID={`ajo-open-circle-${g.id}`}>
                  Open
                </Button>
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          icon={PiggyBank}
          title="No circles yet."
          description={manage ? 'Create the first circle to start recording contributions.' : 'An officer with permission to manage Ajo creates the circles.'}
          actionLabel={manage && canWrite ? 'New circle' : undefined}
          onAction={manage && canWrite ? () => router.push('/(app)/(tabs)/manage/thrift/new' as never) : undefined}
        />
      )}
    </AjoScreen>
  );
}
