import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { NoPermission } from '@/components/feedback/NoPermission';
import { OptionDropdown } from '@/components/forms/OptionDropdown';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { COLUMN_CHOICES, choicesFromMapping, mappingFromChoices, NO_COLUMN, RECON_IMPORT_ACCESS } from '@/features/reconciliation/labels';
import { useImportStatement, usePreviewStatement } from '@/features/reconciliation/mutations';
import { pickStatement } from '@/features/reconciliation/pickStatement';
import { useBankAccounts } from '@/features/nigerianPayments/queries';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { ColumnKey, StatementFile, StatementPreviewDTO } from '@/types/api/reconciliation';

const SOURCE_LABELS = { saved: 'Remembered from this bank account’s last statement', detected: 'Recognised from the file', manual: 'Set by you' } as const;

const line = (label: string, value: string, tone?: 'warning' | 'success') => (
  <View key={label} className="flex-row items-center justify-between gap-3">
    <Text variant="body" tone="secondary" className="flex-1">
      {label}
    </Text>
    <Text variant="body-strong" tone={tone}>
      {value}
    </Text>
  </View>
);

/**
 * project-overview.md §6.9 PY8 — Import a statement: choose the bank account and the file (CSV or Excel), check how its columns were
 * read, and import only the lines that are new. The server reads the file and shows what it understood before anything is saved.
 */
export default function ImportStatementScreen() {
  const router = useRouter();
  const allowed = useCan(RECON_IMPORT_ACCESS);
  const accounts = useBankAccounts('active', allowed);
  const preview = usePreviewStatement();
  const save = useImportStatement();
  const confirmRef = useRef<BottomSheetModal>(null);
  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<StatementFile | null>(null);
  const [fileError, setFileError] = useState('');
  const [choices, setChoices] = useState<Partial<Record<ColumnKey, string>>>({});
  const [read, setRead] = useState<StatementPreviewDTO | null>(null);
  const [readError, setReadError] = useState('');
  const back = () => router.back();

  const options = (accounts.data ?? []).map((a) => ({ label: `${a.bankName} · ${a.accountNumber}`, value: String(a.id) }));
  // With one account there is nothing to choose
  const account = accountId || (options.length === 1 ? options[0]!.value : '');

  const readFile = (nextFile: StatementFile, account: string, mapping?: ReturnType<typeof mappingFromChoices>, headerRow?: number) => {
    setReadError('');
    preview.mutate(
      { bankAccountId: Number(account), file: nextFile, mapping, headerRow },
      {
        onSuccess: (data) => {
          setRead(data);
          setChoices(choicesFromMapping(data.layout.mapping));
        },
        onError: (error) => {
          setRead(null);
          setReadError(error instanceof ApiError ? error.message : 'Could not read this file. Try again.');
        },
      },
    );
  };

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Import a statement" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const choose = async () => {
    setFileError('');
    const result = await pickStatement();
    if (!result) return;
    if ('error' in result) {
      setFileError(result.error);
      return;
    }
    setRead(null);
    setFile(result.file);
    // read it as soon as both the account and the file are chosen
    if (account) readFile(result.file, account);
  };

  const headerOptions = [{ label: 'Not in this file', value: NO_COLUMN }, ...(read?.layout.headers ?? []).map((h, i) => ({ label: h || `Column ${i + 1}`, value: String(i) }))];
  const changeColumn = (key: ColumnKey, value: string) => {
    const next = { ...choices, [key]: value };
    setChoices(next);
    if (file && account && read) readFile(file, account, mappingFromChoices(next), read.layout.headerRow);
  };

  const doImport = () => {
    if (!file || !read) return;
    const manual = read.layout.source === 'manual' ? mappingFromChoices(choices) : undefined;
    save.mutate(
      { bankAccountId: Number(account), file, mapping: manual, headerRow: read.layout.headerRow },
      {
        onSuccess: (result) => {
          toast.success(`${result.entriesCreated} ${result.entriesCreated === 1 ? 'line' : 'lines'} imported${result.alreadyImported > 0 ? `, ${result.alreadyImported} were already imported` : ''}`);
          router.replace(`/(app)/(tabs)/manage/payments/reconciliation` as never);
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not import the statement. Try again.'),
      },
    );
  };

  const counts = read?.counts;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Import a statement" onBack={back} docsKey="PY8" />

      <View className="gap-6 pb-6">
        <Section title="Which statement">
          <View className="gap-4">
            {accounts.isPending ? (
              <Skeleton width="100%" height={72} radius="md" />
            ) : options.length === 0 ? (
              <Text variant="body" tone="secondary">
                Add a bank account first (Payments, Bank accounts), then import its statement.
              </Text>
            ) : (
              <View className="flex-row">
                <OptionDropdown
                  label="Bank account"
                  value={account}
                  options={options}
                  onChange={(next) => {
                    setAccountId(next);
                    if (file) readFile(file, next);
                  }}
                  testID="import-account"
                />
              </View>
            )}
            <View className="gap-2">
              <Button variant="secondary" fullWidth onPress={() => void choose()} testID="import-file">
                {file ? 'Choose a different file' : 'Choose the statement file'}
              </Button>
              <Text variant="caption" tone={fileError ? 'danger' : 'secondary'}>
                {fileError || (file ? file.name : 'A CSV or Excel (.xlsx) statement downloaded from your bank. PDF statements can’t be read reliably.')}
              </Text>
            </View>
          </View>
        </Section>

        {preview.isPending ? (
          <View className="gap-3">
            <Skeleton width="100%" height={120} radius="md" />
            <Skeleton width="100%" height={160} radius="md" />
          </View>
        ) : null}

        {readError ? (
          <Card>
            <Text variant="body" tone="danger" testID="import-error">
              {readError}
            </Text>
          </Card>
        ) : null}

        {read && counts ? (
          <>
            <Section title="What we found">
              <Card>
                <View className="gap-2" testID="import-counts">
                  {line('Lines in the file', String(counts.lines))}
                  {line('Money received (credits)', String(counts.credits))}
                  {line('Already imported before', String(counts.alreadyImported))}
                  {line('New lines to add', String(counts.newLines), counts.newLines > 0 ? 'success' : 'warning')}
                  {counts.newCreditTotal ? line('New money received', formatMoney(counts.newCreditTotal), 'success') : null}
                  {read.period.startDate && read.period.endDate ? line('Period', `${formatDate(read.period.startDate, 'long')} to ${formatDate(read.period.endDate, 'long')}`) : null}
                </View>
              </Card>
              {counts.unreadable > 0 ? (
                <Text variant="caption" tone="warning">
                  {`${counts.unreadable} ${counts.unreadable === 1 ? 'line' : 'lines'} couldn’t be read and will be left out. ${read.unreadableRows[0] ? `For example, row ${read.unreadableRows[0].row}: ${read.unreadableRows[0].reason}` : ''}`}
                </Text>
              ) : null}
              {counts.newLines === 0 && read.problems.length === 0 ? (
                <Text variant="caption" tone="secondary">
                  Every line in this file was imported before, so there is nothing to add.
                </Text>
              ) : null}
            </Section>

            <Section title="How the columns were read">
              <Text variant="caption" tone="secondary">
                {SOURCE_LABELS[read.layout.source]}. Change a column if it is wrong.
              </Text>
              {read.problems.map((p) => (
                <Text key={p} variant="caption" tone="danger">
                  {p}
                </Text>
              ))}
              <View className="gap-3">
                {COLUMN_CHOICES.map((c) => (
                  <View key={c.key} className="flex-row">
                    <OptionDropdown label={c.label} value={choices[c.key] ?? NO_COLUMN} options={headerOptions} onChange={(v) => changeColumn(c.key, v)} testID={`import-col-${c.key}`} />
                  </View>
                ))}
              </View>
            </Section>

            {read.sample.length > 0 ? (
              <Section title="The first lines">
                <Card>
                  <View className="gap-3">
                    {read.sample.slice(0, 5).map((s) => (
                      <View key={s.row} className="flex-row items-start gap-3">
                        <View className="flex-1 gap-0.5">
                          <Text variant="body" numberOfLines={2}>
                            {s.description}
                          </Text>
                          <Text variant="caption" tone="tertiary">{`${formatDate(s.transactionDate, 'long')}${s.reference ? ` · ${s.reference}` : ''}`}</Text>
                        </View>
                        {s.creditAmount ? <Money value={s.creditAmount} size="body-strong" tone="success" /> : <Text variant="body-strong" tone="secondary">{`−${formatMoney(s.debitAmount ?? 0)}`}</Text>}
                      </View>
                    ))}
                  </View>
                </Card>
              </Section>
            ) : null}
          </>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth disabled={!read?.canImport} loading={save.isPending} onPress={() => confirmRef.current?.present()} testID="import-save">
            {counts && counts.newLines > 0 ? `Import ${counts.newLines} ${counts.newLines === 1 ? 'line' : 'lines'}` : 'Import statement'}
          </Button>
        </View>
      </StickyFooter>

      <ConfirmSheet
        ref={confirmRef}
        title="Import this statement?"
        description={counts ? `${counts.newLines} new ${counts.newLines === 1 ? 'line' : 'lines'} will be added${counts.alreadyImported > 0 ? ` and ${counts.alreadyImported} that were imported before will be skipped` : ''}. Nothing is recorded as a payment until a match is confirmed.` : ''}
        confirmLabel="Import"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={() => {
          confirmRef.current?.dismiss();
          doImport();
        }}
      />
    </Screen>
  );
}
