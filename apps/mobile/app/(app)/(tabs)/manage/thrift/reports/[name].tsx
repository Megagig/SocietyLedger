import { useLocalSearchParams } from 'expo-router';
import { FileQuestion, Lock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ajoReportsApi } from '@/api/endpoints/ajoReports';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OptionDropdown } from '@/components/forms/OptionDropdown';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { BoardCard } from '@/features/ajo/components/board/BoardParts';
import { ReportFigures, ReportRowCard } from '@/features/ajo/components/reports/ReportParts';
import { useCollectorCandidates, useGroups, usePeople } from '@/features/ajo/queries';
import { RANGE_OPTIONS, rangeFor, reportFileName, type RangeChoice } from '@/features/ajo/reportFormat';
import { useReportList, useReportPages } from '@/features/ajo/reportQueries';
import { CSV_MIME, PDF_MIME, saveAndShareFile } from '@/features/ajo/shareFile';
import type { ReportFilters, ReportName } from '@/types/api/ajoReports';

const ALL = 'all';

/**
 * One report: the circle and dates to look at (and the person or collector where the report understands them), the figures for each
 * circle, every row a page at a time as cards that keep all the web table's columns, and the PDF and CSV the API makes, shared through
 * the phone's own share sheet. The rule the report counts by is printed first.
 */
export default function ReportScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const name = params.name as ReportName;
  const list = useReportList();
  const def = list.data?.find((r) => r.name === name);

  const groups = useGroups();
  const [circle, setCircle] = useState(ALL);
  const [range, setRange] = useState<RangeChoice>('month');
  const [person, setPerson] = useState(ALL);
  const [collector, setCollector] = useState(ALL);
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);

  const groupId = circle === ALL ? 0 : Number(circle);
  const people = usePeople(def?.filters.member ? groupId : 0);
  const collectors = useCollectorCandidates();

  const filters = useMemo<ReportFilters>(
    () => ({ groupId: groupId || null, ...rangeFor(range, new Date()), membershipId: person === ALL ? null : Number(person), collectorUserId: collector === ALL ? null : Number(collector) }),
    [groupId, range, person, collector],
  );
  const q = useReportPages(name, filters, !!def && !def.lock);

  const share = async (format: 'csv' | 'pdf') => {
    if (!q.first) return;
    setBusy(format);
    try {
      const bytes = await ajoReportsApi.file(name, filters, format);
      await saveAndShareFile(reportFileName(name, q.first.filters.from, q.first.filters.to, format), bytes, format === 'pdf' ? PDF_MIME : CSV_MIME);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not make the file. Try again, or choose fewer dates.');
    } finally {
      setBusy(null);
    }
  };

  const circleOptions = [{ label: 'All circles', value: ALL }, ...(groups.data ?? []).map((g) => ({ label: g.name, value: String(g.id) }))];
  const personOptions = [{ label: 'Everyone', value: ALL }, ...(people.data ?? []).map((p) => ({ label: p.name, value: String(p.membershipId) }))];
  const collectorOptions = [{ label: 'All collectors', value: ALL }, ...(collectors.data ?? []).map((c) => ({ label: c.name, value: String(c.userId) }))];
  const timeZone = q.first?.blocks[0]?.timezone ?? 'Africa/Lagos';

  return (
    <AjoScreen title={def?.title ?? 'Report'} access={['AJO_REPORTS']} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {list.isPending ? (
        <AjoLoading rows={3} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !def ? (
        <EmptyState icon={FileQuestion} title="There is no such report" />
      ) : def.lock ? (
        <EmptyState icon={Lock} title={def.title} description={def.lock.message} />
      ) : (
        <View className="gap-4" testID={`ajo-report-screen-${name}`}>
          <Text variant="caption" tone="secondary">
            <Text variant="label" tone="secondary">
              How this is counted.{' '}
            </Text>
            {def.rule}
          </Text>

          <View className="gap-3">
            <View className="flex-row gap-3">
              <OptionDropdown label="Circle" value={circle} options={circleOptions} onChange={(v) => { setCircle(v); setPerson(ALL); }} testID="ajo-report-circle" />
              <OptionDropdown label="Dates" value={range} options={RANGE_OPTIONS} onChange={setRange} testID="ajo-report-range" />
            </View>
            {(def.filters.member && groupId > 0 && people.data) || (def.filters.collector && (collectors.data?.length ?? 0) > 0) ? (
              <View className="flex-row gap-3">
                {def.filters.member && groupId > 0 && people.data ? <OptionDropdown label="Person" value={person} options={personOptions} onChange={setPerson} testID="ajo-report-person" /> : null}
                {def.filters.collector && (collectors.data?.length ?? 0) > 0 ? <OptionDropdown label="Collector" value={collector} options={collectorOptions} onChange={setCollector} testID="ajo-report-collector" /> : null}
              </View>
            ) : null}
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button variant="secondary" loading={busy === 'pdf'} disabled={!q.first || busy !== null} onPress={() => void share('pdf')} testID="ajo-report-share-pdf">
                Share PDF
              </Button>
            </View>
            <View className="flex-1">
              <Button variant="secondary" loading={busy === 'csv'} disabled={!q.first || busy !== null} onPress={() => void share('csv')} testID="ajo-report-share-csv">
                Share CSV
              </Button>
            </View>
          </View>

          {q.isPending ? (
            <AjoLoading rows={4} />
          ) : q.isError || !q.first ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : (
            <View className="gap-4">
              <Text variant="caption" tone="secondary">
                {q.first.filters.from} to {q.first.filters.to}
              </Text>
              {q.first.notes.map((n) => (
                <Text key={n} variant="caption">
                  {n}
                </Text>
              ))}
              {q.first.blocks.length === 0 ? (
                <EmptyState title="No circles to report on yet" description="A circle appears here once it has been opened." />
              ) : (
                <>
                  <ReportFigures blocks={q.first.blocks} totals={q.first.totals} />
                  {q.total === 0 ? (
                    <EmptyState title="Nothing to show for these dates" description="Try more dates, or another circle." />
                  ) : (
                    <BoardCard title={`Details (${q.total.toLocaleString('en-NG')} ${q.total === 1 ? 'row' : 'rows'})`} testID="report-details">
                      {q.rows.map((row, i) => (
                        <ReportRowCard key={i} columns={q.first!.columns} row={row} timeZone={timeZone} showCircle={q.first!.blocks.length > 1} testID={`report-row-${i}`} />
                      ))}
                      {q.hasMore ? (
                        <Button variant="secondary" loading={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()} testID="report-show-more">
                          {`Show more (${(q.total - q.rows.length).toLocaleString('en-NG')} left)`}
                        </Button>
                      ) : null}
                    </BoardCard>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      )}
    </AjoScreen>
  );
}
