import { useRouter } from 'expo-router';
import { FileText, Lock } from 'lucide-react-native';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { IconCircle } from '@/components/ui/IconCircle';
import { Text } from '@/components/ui/Text';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { useReportList } from '@/features/ajo/reportQueries';

const reportHref = (name: string) => `/(app)/(tabs)/manage/thrift/reports/${name}` as never;

/** The reports hub: the eight Ajo reports, with the ones this person or this Ajo tier cannot open shown and explained, not hidden. */
export default function ReportsHubScreen() {
  const router = useRouter();
  const list = useReportList();

  return (
    <AjoScreen title="Reports" access={['AJO_REPORTS']} refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <Text variant="caption" tone="secondary">
        Every figure is worked out from the circle's ledger and the schedule, the same way here, on the web and in every file.
      </Text>
      {list.isPending ? (
        <AjoLoading rows={4} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <View className="gap-3" testID="ajo-reports-list">
          <ListGroup>
            {list.data.map((r) => (
              <ListItem
                key={r.name}
                leading={<IconCircle icon={r.lock ? Lock : FileText} tone={r.lock ? 'warning' : 'primary'} />}
                title={r.title}
                meta={r.lock ? r.lock.message : r.description}
                showChevron={!r.lock}
                disabled={!!r.lock}
                onPress={r.lock ? undefined : () => router.push(reportHref(r.name))}
                testID={`ajo-report-${r.name}`}
              />
            ))}
          </ListGroup>
        </View>
      )}
    </AjoScreen>
  );
}
