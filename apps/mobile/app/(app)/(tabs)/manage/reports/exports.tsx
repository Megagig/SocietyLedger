import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { FileDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { DateField } from '@/components/forms/DateField';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterChip } from '@/components/ui/FilterChip';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { GroupedRow, positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { MemberPickerField, type PickedMember } from '@/features/members/components/MemberPickerField';
import { PeriodPicker } from '@/features/reports/components/PeriodPicker';
import {
  defaultPeriod,
  EXPORT_ANY_ACCESS,
  EXPORT_FINANCIAL_ACCESS,
  EXPORT_MEMBERS_ACCESS,
  exportTypeLabel,
  FORMAT_LABELS,
  fileSizeLabel,
  isExpired,
  MEMBER_FILTER_OPTIONS,
  rangeParams,
  type PeriodState,
} from '@/features/reports/labels';
import { useExportFinancial, useExportMembers, useExportStatement, useShareExport } from '@/features/reports/mutations';
import { useExportHistory } from '@/features/reports/queries';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import type { ExportFormat, ExportHistoryItemDTO, ExportResultDTO } from '@/types/api/reports';

type Tab = 'CREATE' | 'HISTORY';

const statementSchema = z
  .object({ member: z.custom<PickedMember | null>(), from: z.string(), to: z.string() })
  .superRefine((v, ctx) => {
    if (!v.member) ctx.addIssue({ code: 'custom', path: ['member'], message: 'Choose a member' });
    if (Boolean(v.from) !== Boolean(v.to)) ctx.addIssue({ code: 'custom', path: ['to'], message: 'Pick both dates, or neither for all time' });
    if (v.from && v.to && new Date(v.to) < new Date(v.from)) ctx.addIssue({ code: 'custom', path: ['to'], message: 'The end date can’t be before the start date' });
  });
type StatementForm = z.infer<typeof statementSchema>;

const failure = (fallback: string) => (error: unknown) =>
  toast.error(
    error instanceof ApiError
      ? error.status === 403
        ? 'You are not allowed to make this file.'
        : error.message
      : error instanceof Error && error.message.startsWith('Sharing needs')
        ? error.message
        : fallback,
  );

/**
 * project-overview.md §6.9 RP7 — Exports: make a financial PDF or Excel, a members Excel or a member statement, then share the file
 * (WhatsApp, email, Files). Files are kept 7 days; the history lists them, and an expired one says so.
 */
export default function ExportsScreen() {
  const router = useRouter();
  const canFinancial = useCan(EXPORT_FINANCIAL_ACCESS);
  const canMembers = useCan(EXPORT_MEMBERS_ACCESS);
  const canAny = useCan(EXPORT_ANY_ACCESS);
  const [tab, setTab] = useState<Tab>('CREATE');
  const [period, setPeriod] = useState<PeriodState>(defaultPeriod());
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [memberFilter, setMemberFilter] = useState<'all' | 'with_balance' | 'overdue'>('all');
  const financial = useExportFinancial();
  const members = useExportMembers();
  const statement = useExportStatement();
  const share = useShareExport();
  const history = useExportHistory();
  const files = useMemo(() => history.data?.pages.flatMap((p) => p.exports) ?? [], [history.data]);
  const { control, handleSubmit, reset } = useForm<StatementForm>({ resolver: zodResolver(statementSchema), defaultValues: { member: null, from: '', to: '' } });
  const back = () => router.back();

  if (!canAny) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Exports" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  /** The file is made on the server, then handed straight to the share sheet. If sharing fails it is still in the history. */
  const finish = (made: ExportResultDTO) => {
    toast.success('Your file is ready');
    share.mutate({ id: made.id, filename: made.filename, format: made.format }, { onError: failure('The file is ready, but it could not be opened. Share it from the history.') });
  };

  const range = rangeParams(period);
  const busy = financial.isPending || members.isPending || statement.isPending || share.isPending;

  return (
    <Screen edges={['top']} scroll={tab === 'CREATE'}>
      <ScreenHeader title="Exports" onBack={back} docsKey="RP7" />

      <View className="gap-4 pb-8">
        <SegmentedControl
          options={[
            { label: 'Make a file', value: 'CREATE' },
            { label: 'History', value: 'HISTORY' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'CREATE' ? (
          <View className="gap-6">
            {canFinancial ? (
              <Section title="Financial summary">
                <Card>
                  <View className="gap-4">
                    <Text variant="caption" tone="secondary">
                      Money received and charges for a period, with how it compares to the period before.
                    </Text>
                    <PeriodPicker value={period} onChange={setPeriod} />
                    <SegmentedControl
                      options={[
                        { label: 'PDF', value: 'pdf' },
                        { label: 'Excel', value: 'excel' },
                      ]}
                      value={format}
                      onChange={setFormat}
                    />
                    <Button
                      variant="primary"
                      fullWidth
                      loading={financial.isPending}
                      disabled={!range || busy}
                      onPress={() => {
                        if (!range) return;
                        financial.mutate({ format, includeComparison: true, period: range.period, startDate: range.startDate, endDate: range.endDate }, { onSuccess: finish, onError: failure('Could not make the file. Try again.') });
                      }}
                      testID="export-financial"
                    >
                      {`Make ${FORMAT_LABELS[format]}`}
                    </Button>
                  </View>
                </Card>
              </Section>
            ) : null}

            {canMembers ? (
              <>
                <Section title="Members list">
                  <Card>
                    <View className="gap-4">
                      <Text variant="caption" tone="secondary">
                        Every member with what they have been charged, paid and still owe, as an Excel sheet.
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {MEMBER_FILTER_OPTIONS.map((o) => (
                          <FilterChip key={o.value} label={o.label} active={memberFilter === o.value} onPress={() => setMemberFilter(o.value)} />
                        ))}
                      </ScrollView>
                      <Button
                        variant="primary"
                        fullWidth
                        loading={members.isPending}
                        disabled={busy}
                        onPress={() => members.mutate({ format: 'excel', status: memberFilter }, { onSuccess: finish, onError: failure('Could not make the file. Try again.') })}
                        testID="export-members"
                      >
                        Make Excel
                      </Button>
                    </View>
                  </Card>
                </Section>

                <Section title="Member statement">
                  <Card>
                    <View className="gap-4">
                      <Text variant="caption" tone="secondary">
                        One member’s charges and payments as a PDF, for all time or between two dates.
                      </Text>
                      <MemberPickerField control={control} name="member" label="Member" testID="statement-member" />
                      <DateField control={control} name="from" label="From (optional)" />
                      <DateField control={control} name="to" label="To (optional)" />
                      <Button
                        variant="primary"
                        fullWidth
                        loading={statement.isPending}
                        disabled={busy}
                        onPress={() =>
                          void handleSubmit((v) => {
                            statement.mutate(
                              {
                                memberId: (v.member as PickedMember).id,
                                payload: { format: 'pdf', ...(v.from && v.to ? { startDate: new Date(v.from).toISOString(), endDate: new Date(v.to).toISOString() } : {}) },
                              },
                              {
                                onSuccess: (made) => {
                                  reset({ member: null, from: '', to: '' });
                                  finish(made);
                                },
                                onError: failure('Could not make the statement. Try again.'),
                              },
                            );
                          })()
                        }
                        testID="export-statement"
                      >
                        Make PDF
                      </Button>
                    </View>
                  </Card>
                </Section>
              </>
            ) : null}
          </View>
        ) : null}
      </View>

      {tab === 'HISTORY' ? (
        <View className="min-h-[420px] flex-1">
          <PagedList
            query={history}
            items={files}
            keyOf={(f) => String(f.id)}
            skeletonHeight={84}
            renderItem={(f: ExportHistoryItemDTO, i, n) => {
              const expired = isExpired(f.expiresAt);
              return (
                <GroupedRow position={positionOf(i, n)} accessibilityLabel={`${exportTypeLabel(f.type)}, ${FORMAT_LABELS[f.format]}`} testID={`export-row-${f.id}`} minHeight={84}>
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1 gap-0.5">
                      <Text variant="body-lg" numberOfLines={1}>{exportTypeLabel(f.type)}</Text>
                      <Text variant="caption" tone="secondary" numberOfLines={1}>
                        {`${FORMAT_LABELS[f.format]} · ${fileSizeLabel(f.fileSize)} · ${formatDate(f.createdAt, 'long')}`}
                      </Text>
                      <Text variant="caption" tone="tertiary" numberOfLines={1}>{`By ${f.createdBy.name}`}</Text>
                    </View>
                    {expired ? (
                      <StatusChip status="closed" label="Expired" />
                    ) : (
                      <Button
                        variant="secondary"
                        disabled={share.isPending}
                        onPress={() => share.mutate({ id: f.id, filename: f.filename, format: f.format }, { onError: (e) => (e instanceof ApiError && e.status === 410 ? toast.error('This file has expired. Make it again.') : failure('Could not open the file. Try again.')(e)) })}
                        testID={`export-share-${f.id}`}
                      >
                        Share
                      </Button>
                    )}
                  </View>
                </GroupedRow>
              );
            }}
            empty={<EmptyState icon={FileDown} title="No files yet" description="Files you make are kept here for 7 days." />}
          />
        </View>
      ) : null}
    </Screen>
  );
}
