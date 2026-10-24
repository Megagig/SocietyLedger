import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { LinesEditor } from '@/features/accounting/components/LinesEditor';
import { ACCOUNTING_CREATE_ACCESS, ACCOUNTING_EDIT_ACCESS, isEditable } from '@/features/accounting/labels';
import { useSaveEntry } from '@/features/accounting/mutations';
import { useAccountingAccess, useAccounts, useEntry } from '@/features/accounting/queries';
import { emptyJournalValues, journalFormSchema, toJournalPayload, type JournalFormValues } from '@/features/accounting/schemas';
import { useCan } from '@/hooks/useCan';
import type { JournalEntryDTO } from '@/types/api/accounting';

const valuesOf = (entry: JournalEntryDTO): JournalFormValues => ({
  entryDate: entry.entryDate,
  description: entry.description,
  reference: entry.reference ?? '',
  lines: entry.lines.map((l) => {
    const debit = Number(l.debitAmount);
    const credit = Number(l.creditAmount);
    return { accountId: String(l.accountId), debit: debit > 0 ? String(l.debitAmount) : '', credit: credit > 0 ? String(l.creditAmount) : '', description: l.description ?? '' };
  }),
});

/** project-overview.md §6.9 AC4 — write a journal entry, or change a draft or a rejected one. It cannot be saved until debits equal credits. */
export default function JournalFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const allowed = useAccountingAccess();
  const canCreate = useCan(ACCOUNTING_CREATE_ACCESS);
  const canEdit = useCan(ACCOUNTING_EDIT_ACCESS);
  const entryQuery = useEntry(editId);
  const accounts = useAccounts(false);
  const saveEntry = useSaveEntry(editId);
  const { control, handleSubmit, reset, formState } = useForm<JournalFormValues>({
    resolver: zodResolver(journalFormSchema),
    defaultValues: emptyJournalValues(new Date().toISOString()),
    mode: 'onTouched',
  });
  const back = () => router.back();
  const title = isEdit ? 'Change entry' : 'Write an entry';

  useEffect(() => {
    if (entryQuery.data) reset(valuesOf(entryQuery.data));
  }, [entryQuery.data, reset]);

  const accountOptions = useMemo(() => (accounts.data ?? []).filter((a) => a.isActive).map((a) => ({ label: `${a.code} ${a.name}`, value: String(a.id) })), [accounts.data]);

  if (!allowed || !(isEdit ? canEdit : canCreate)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }
  if ((isEdit && entryQuery.isPending) || accounts.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={title} onBack={back} docsKey="AC4" />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={180} radius="md" />
        </View>
      </Screen>
    );
  }
  if ((isEdit && (entryQuery.isError || !entryQuery.data)) || accounts.isError) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} docsKey="AC4" />
        <ErrorState error={entryQuery.error ?? accounts.error} onRetry={() => { void entryQuery.refetch(); void accounts.refetch(); }} />
      </Screen>
    );
  }
  if (isEdit && entryQuery.data && !isEditable(entryQuery.data.status)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} docsKey="AC4" />
        <Text variant="body" tone="secondary" testID="entry-locked">
          This entry is {entryQuery.data.status === 'POSTED' ? 'posted' : 'already with an approver'}, so it can no longer be changed.
        </Text>
      </Screen>
    );
  }

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the entry. Try again.');

  const save = (values: JournalFormValues, send: boolean) =>
    saveEntry.mutate(
      { payload: toJournalPayload(values), send },
      {
        onSuccess: ({ entry, sent, sendError }) => {
          // The draft is saved even when sending it failed, so say both
          if (send && !sent) fail(sendError);
          toast.success(sent ? 'Sent for approval' : send ? 'Draft saved, but not sent' : 'Draft saved');
          router.replace({ pathname: '/(app)/(tabs)/manage/accounting/journal/[id]', params: { id: String(entry.id) } } as never);
        },
        onError: fail,
      },
    );

  const busy = saveEntry.isPending;

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="AC4" />

      <View className="gap-6 pb-6">
        {entryQuery.data?.status === 'REJECTED' && entryQuery.data.rejectionReason ? (
          <View className="rounded-lg bg-danger-soft p-4" testID="entry-rejection">
            <Text variant="body-strong" tone="danger">
              Rejected
            </Text>
            <Text variant="body">{entryQuery.data.rejectionReason}</Text>
            <Text variant="caption" tone="secondary">
              Change it and send it again.
            </Text>
          </View>
        ) : null}

        <Section title="The entry">
          <View className="gap-4">
            <DateField control={control} name="entryDate" label="Date" mode="date" testID="entry-date" />
            <TextField control={control} name="description" label="What is it for?" placeholder="Hall hire for the AGM" autoCapitalize="sentences" multiline testID="entry-description" />
            <TextField control={control} name="reference" label="Reference (optional)" placeholder="Receipt or invoice number" autoCapitalize="characters" />
          </View>
        </Section>

        <Section title="Lines">
          <LinesEditor control={control} accountOptions={accountOptions} error={formState.errors.lines?.message ?? formState.errors.lines?.root?.message} />
        </Section>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="secondary" fullWidth loading={busy} onPress={() => { void handleSubmit((v) => save(v, false))(); }} testID="entry-save-draft">
            Save draft
          </Button>
        </View>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={busy} onPress={() => { void handleSubmit((v) => save(v, true))(); }} testID="entry-send">
            Send for approval
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
