import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { FileUp, Landmark, Plus, Sparkles } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ReasonSheet } from '@/features/cash/components/ReasonSheet';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { ImportRow, LineRow, MatchCard, SuggestionCard } from '@/features/reconciliation/components/Cards';
import { RECON_ANY_ACCESS, RECON_DECIDE_ACCESS, RECON_IMPORT_ACCESS, recommendedKeys, STATUS_LABELS, suggestionKey, toMatchRequest } from '@/features/reconciliation/labels';
import { useApplyMatches, useDecideMatch } from '@/features/reconciliation/mutations';
import { useImports, useMatches, useSuggestions, useUnmatchedLines } from '@/features/reconciliation/queries';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';
import { useSessionStore } from '@/stores/session';
import type { ReconciliationDTO, ReconciliationStatus, StatementEntryDTO, StatementImportDTO, SuggestionDTO } from '@/types/api/reconciliation';

type Tab = 'SUGGESTED' | 'MATCHES' | 'LINES' | 'IMPORTS';
const TABS: { label: string; value: Tab }[] = [
  { label: 'Suggested', value: 'SUGGESTED' },
  { label: 'Matches', value: 'MATCHES' },
  { label: 'Unmatched', value: 'LINES' },
  { label: 'Imports', value: 'IMPORTS' },
];
const MATCH_STATUSES: ReconciliationStatus[] = ['PENDING', 'CONFIRMED', 'DISPUTED'];

const goTo = (path: string) => `/(app)/(tabs)/manage/payments/reconciliation/${path}` as never;

/** What went wrong in plain words: the server's reason when it gave one. */
const failure = (fallback: string) => (error: unknown) => toast.error(error instanceof ApiError ? error.message : fallback);

/**
 * project-overview.md §6.9 PY8 — Reconciliation: import a bank statement, see which charge each line of money received probably
 * paid, propose the matches, and have another officer confirm them. Nothing is recorded as a payment until a match is confirmed.
 */
export default function ReconciliationScreen() {
  const router = useRouter();
  const canView = useCan(RECON_ANY_ACCESS);
  const canImport = useCan(RECON_IMPORT_ACCESS);
  const [tab, setTab] = useState<Tab>('SUGGESTED');
  const back = () => router.back();

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Reconciliation" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Reconciliation"
        onBack={back}
        docsKey="PY8"
        rightActions={canImport ? <IconButton icon={Plus} accessibilityLabel="Import a statement" onPress={() => router.push(goTo('import'))} testID="recon-import" /> : undefined}
      />
      <View className="pb-3">
        <SegmentedControl options={TABS} value={tab} onChange={setTab} testID="recon-tabs" />
      </View>

      {tab === 'SUGGESTED' ? <SuggestedTab canImport={canImport} /> : null}
      {tab === 'MATCHES' ? <MatchesTab /> : null}
      {tab === 'LINES' ? <LinesTab /> : null}
      {tab === 'IMPORTS' ? <ImportsTab canImport={canImport} /> : null}
    </Screen>
  );
}

// ---------------------------------------------------------------- suggested

function SuggestedTab({ canImport }: { canImport: boolean }) {
  const router = useRouter();
  const canDecide = useCan(RECON_DECIDE_ACCESS);
  const query = useSuggestions();
  const apply = useApplyMatches();
  // null until the officer ticks or unticks something: until then only the confident suggestions are ticked, and they follow the data
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const suggestions = useMemo(() => query.data?.suggestions ?? [], [query.data]);
  const selected = useMemo(() => picked ?? new Set(recommendedKeys(suggestions)), [picked, suggestions]);

  if (!canDecide) {
    return <EmptyState icon={Sparkles} title="Matching needs another permission" description="Ask an officer who can approve payments to match statement lines." />;
  }
  if (query.isPending) {
    return (
      <View className="gap-3">
        <Skeleton width="100%" height={180} radius="md" />
        <Skeleton width="100%" height={180} radius="md" />
      </View>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const counts = query.data.counts;
  const chosen = suggestions.filter((s) => selected.has(suggestionKey(s)));
  const total = chosen.reduce((sum, s) => sum + Number(s.line.amount), 0);

  const toggle = (item: SuggestionDTO) =>
    setPicked((current) => {
      const next = new Set(current ?? selected);
      const key = suggestionKey(item);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const submit = () =>
    apply.mutate(chosen.map(toMatchRequest), {
      onSuccess: (result) => {
        setPicked(null);
        if (result.failed > 0) {
          const why = result.results.find((r) => !r.success)?.error;
          toast.error(`${result.successful} proposed, ${result.failed} could not be: ${why ?? 'see Matches'}`);
        } else {
          toast.success(`${result.successful} ${result.successful === 1 ? 'match' : 'matches'} proposed. Another officer confirms them.`);
        }
      },
      onError: failure('Could not propose the matches. Try again.'),
    });

  return (
    <View className="flex-1">
      <FlatList
        data={suggestions}
        keyExtractor={suggestionKey}
        contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListHeaderComponent={
          <Text variant="caption" tone="secondary" className="pb-2" testID="recon-counts">
            {`${counts.unmatchedLines} money-in ${counts.unmatchedLines === 1 ? 'line' : 'lines'} waiting · ${counts.suggested} with a suggestion (${counts.recommended} confident)${counts.withoutSuggestion > 0 ? ` · ${counts.withoutSuggestion} need you to choose the charge` : ''}`}
          </Text>
        }
        renderItem={({ item }) => <SuggestionCard item={item} selected={selected.has(suggestionKey(item))} onToggle={toggle} />}
        ListEmptyComponent={
          <EmptyState
            icon={Landmark}
            title={counts.unmatchedLines > 0 ? 'No suggestions' : 'Nothing to match'}
            description={counts.unmatchedLines > 0 ? 'None of the money received matches a charge closely enough. Open Unmatched to choose the charge yourself.' : 'Import a bank statement to see which charges the money paid.'}
            actionLabel={counts.unmatchedLines === 0 && canImport ? 'Import a statement' : undefined}
            onAction={counts.unmatchedLines === 0 && canImport ? () => router.push(goTo('import')) : undefined}
          />
        }
      />
      {suggestions.length > 0 ? (
        <StickyFooter>
          <View className="flex-1 gap-1">
            <Button variant="primary" fullWidth disabled={chosen.length === 0} loading={apply.isPending} onPress={submit} testID="recon-propose">
              {chosen.length === 0 ? 'Choose matches to propose' : `Propose ${chosen.length} ${chosen.length === 1 ? 'match' : 'matches'} · ${formatMoney(total)}`}
            </Button>
            <Text variant="caption" tone="tertiary" align="center">
              Nothing is recorded until another officer confirms.
            </Text>
          </View>
        </StickyFooter>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- matches

function MatchesTab() {
  const [status, setStatus] = useState<ReconciliationStatus>('PENDING');
  const query = useMatches(status);
  const decide = useDecideMatch();
  const me = useSessionStore((s) => s.user?.id);
  const canDecide = useCan(RECON_DECIDE_ACCESS);
  const confirmRef = useRef<BottomSheetModal>(null);
  const disputeRef = useRef<BottomSheetModal>(null);
  const [target, setTarget] = useState<ReconciliationDTO | null>(null);
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.reconciliations) ?? [], [query.data]);
  const name = target ? `${target.transaction.member.firstName} ${target.transaction.member.lastName}`.trim() : '';

  return (
    <View className="flex-1">
      <View className="pb-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {MATCH_STATUSES.map((s) => (
            <FilterChip key={s} label={STATUS_LABELS[s]} active={status === s} onPress={() => setStatus(s)} />
          ))}
        </ScrollView>
      </View>
      <PagedList
        query={query}
        items={items}
        keyOf={(m) => String(m.id)}
        skeletonHeight={180}
        renderItem={(m: ReconciliationDTO) => (
          <View className="pb-3">
            <MatchCard
              item={m}
              mine={m.createdBy !== null && m.createdBy === me}
              busy={decide.isPending || !canDecide}
              onConfirm={(item) => {
                setTarget(item);
                confirmRef.current?.present();
              }}
              onDispute={(item) => {
                setTarget(item);
                disputeRef.current?.present();
              }}
            />
          </View>
        )}
        empty={<EmptyState icon={Landmark} title={status === 'PENDING' ? 'Nothing waiting' : 'Nothing here'} description={status === 'PENDING' ? 'Matches you propose from Suggested wait here for another officer to confirm.' : 'No matches in this list yet.'} />}
      />

      <ConfirmSheet
        ref={confirmRef}
        title="Confirm this match?"
        description={target ? `This records ${formatMoney(target.matchedAmount)} as paid by ${name}, dated the day it reached the bank. It can’t be undone.` : ''}
        confirmLabel="Confirm and record payment"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={() => {
          confirmRef.current?.dismiss();
          if (!target) return;
          decide.mutate(
            { id: target.id, status: 'CONFIRMED' },
            { onSuccess: () => toast.success('Payment recorded'), onError: failure('Could not confirm the match. Try again.') },
          );
        }}
      />
      <ReasonSheet
        ref={disputeRef}
        title="Turn this match down?"
        description="The bank line goes back to Unmatched so it can be matched to the right charge. Nothing is recorded."
        placeholder="Why is it wrong? (for example: a different member)"
        confirmLabel="Turn it down"
        keepLabel="Keep it"
        loading={decide.isPending}
        onSubmit={(reason) => {
          if (!target) return;
          decide.mutate(
            { id: target.id, status: 'DISPUTED', notes: reason },
            {
              onSuccess: () => {
                disputeRef.current?.dismiss();
                toast.success('Match turned down. The line is free again.');
              },
              onError: failure('Could not turn the match down. Try again.'),
            },
          );
        }}
        testID="recon-dispute"
      />
    </View>
  );
}

// ---------------------------------------------------------------- unmatched lines

function LinesTab() {
  const router = useRouter();
  const canDecide = useCan(RECON_DECIDE_ACCESS);
  const query = useUnmatchedLines();
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.entries) ?? [], [query.data]);
  return (
    <PagedList
      query={query}
      items={items}
      keyOf={(e) => String(e.id)}
      skeletonHeight={76}
      renderItem={(e: StatementEntryDTO, i, n) => (
        <LineRow
          item={e}
          position={positionOf(i, n)}
          onPress={canDecide ? (line) => router.push(`${goTo('match')}?entryId=${line.id}&amount=${encodeURIComponent(String(line.creditAmount))}&description=${encodeURIComponent(line.description)}&date=${encodeURIComponent(line.transactionDate)}` as never) : undefined}
        />
      )}
      empty={<EmptyState icon={Landmark} title="Every line is matched" description="Money received that no charge was matched to would show here." />}
    />
  );
}

// ---------------------------------------------------------------- imports

function ImportsTab({ canImport }: { canImport: boolean }) {
  const router = useRouter();
  const query = useImports();
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.imports) ?? [], [query.data]);
  return (
    <PagedList
      query={query}
      items={items}
      keyOf={(i) => String(i.id)}
      skeletonHeight={80}
      renderItem={(i: StatementImportDTO, idx, n) => <ImportRow item={i} position={positionOf(idx, n)} />}
      empty={
        <EmptyState
          icon={FileUp}
          title="No statements yet"
          description="Import the statement from your bank (CSV or Excel) to see which charges the money paid."
          actionLabel={canImport ? 'Import a statement' : undefined}
          onAction={canImport ? () => router.push(goTo('import')) : undefined}
        />
      }
    />
  );
}
