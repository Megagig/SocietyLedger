import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { SourceCard } from '@/features/accounting/components/LedgerParts';
import { PostEntrySheet } from '@/features/accounting/components/PostEntrySheet';
import { ACCOUNTING_APPROVE_ACCESS, ACCOUNTING_CREATE_ACCESS, ACCOUNTING_EDIT_ACCESS, isAutomatic, isEditable, JOURNAL_STATUS_LABELS, journalStatusKey, ledgerHref, sourceLabel } from '@/features/accounting/labels';
import { useDecideEntry, usePostEntry, useSubmitEntry } from '@/features/accounting/mutations';
import { useAccountingAccess, useEntry } from '@/features/accounting/queries';
import { ReasonSheet } from '@/features/coopManage/components/ReasonSheet';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import { useSessionStore } from '@/stores/session';

const when = (iso: string) => `${formatDate(iso, 'long')}, ${formatDate(iso, 'time')}`;

/** project-overview.md §6.9 AC4 — one journal entry: its lines, who did what, and the next step for the officer. */
export default function JournalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = Number(id);
  const allowed = useAccountingAccess();
  const canCreate = useCan(ACCOUNTING_CREATE_ACCESS);
  const canEdit = useCan(ACCOUNTING_EDIT_ACCESS);
  const canApprove = useCan(ACCOUNTING_APPROVE_ACCESS);
  const me = useSessionStore((s) => s.user?.id);
  const query = useEntry(Number.isInteger(entryId) ? entryId : undefined);
  const submit = useSubmitEntry(entryId);
  const decide = useDecideEntry(entryId);
  const post = usePostEntry(entryId);
  const [postError, setPostError] = useState<string | null>(null);
  const approveRef = useRef<BottomSheetModal>(null);
  const rejectRef = useRef<BottomSheetModal>(null);
  const postRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Journal entry" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }
  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Journal entry" onBack={back} docsKey="AC4" />
        <View className="gap-4">
          <Skeleton width="100%" height={90} radius="md" />
          <Skeleton width="100%" height={180} radius="md" />
        </View>
      </Screen>
    );
  }
  const entry = query.data;
  if (query.isError || !entry) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Journal entry" onBack={back} docsKey="AC4" />
        <ErrorState error={query.error} title={query.isError ? undefined : 'Entry not found'} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const isMine = me !== undefined && entry.createdBy === me;
  const fail = (fallback: string) => (error: unknown) => toast.error(error instanceof ApiError ? error.message : fallback);

  const send = () => submit.mutate(undefined, { onSuccess: () => toast.success('Sent for approval'), onError: fail('Could not send the entry. Try again.') });
  const approve = () => {
    approveRef.current?.dismiss();
    decide.mutate({ action: 'approve' }, { onSuccess: () => toast.success('Entry approved'), onError: fail('Could not approve the entry. Try again.') });
  };
  const reject = (reason: string) => {
    rejectRef.current?.dismiss();
    decide.mutate({ action: 'reject', reason }, { onSuccess: () => toast.success('Entry rejected'), onError: fail('Could not reject the entry. Try again.') });
  };
  const confirmPost = (password: string) => {
    setPostError(null);
    post.mutate(password, {
      onSuccess: () => {
        postRef.current?.dismiss();
        toast.success('Entry posted');
      },
      onError: (error) => {
        // A wrong password (or too many of them) stays on the sheet with its reason; anything else closes it
        if (error instanceof ApiError && (error.code === 'REAUTH_FAILED' || error.code === 'REAUTH_LOCKED')) setPostError(error.message);
        else {
          postRef.current?.dismiss();
          fail('Could not post the entry. Try again.')(error);
        }
      },
    });
  };

  const showSend = entry.status === 'DRAFT' && canCreate;
  const showDecide = entry.status === 'PENDING_APPROVAL' && canApprove && !isMine;
  const showPost = entry.status === 'APPROVED' && canApprove;
  const showEdit = isEditable(entry.status) && canEdit;
  const hasActions = showSend || showDecide || showPost || showEdit;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={entry.entryNumber} onBack={back} docsKey="AC4" />

      <View className="gap-6 pb-8">
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <StatusChip status={journalStatusKey(entry.status)} label={JOURNAL_STATUS_LABELS[entry.status]} testID="entry-status" />
            {isAutomatic(entry) ? <Badge tone="neutral">Automatic</Badge> : null}
          </View>
          <Text variant="h3">{entry.description}</Text>
          <Text variant="caption" tone="secondary">
            {formatDate(entry.entryDate, 'long')}
            {entry.reference ? ` · ${entry.reference}` : ''}
          </Text>
        </View>

        {entry.status === 'REJECTED' && entry.rejectionReason ? (
          <View className="rounded-lg bg-danger-soft p-4" testID="entry-rejection">
            <Text variant="body-strong" tone="danger">
              Rejected{entry.rejectedAt ? ` on ${formatDate(entry.rejectedAt, 'long')}` : ''}
            </Text>
            <Text variant="body">{entry.rejectionReason}</Text>
          </View>
        ) : null}

        <Section title="Lines">
          <View className="overflow-hidden rounded-md border border-border bg-surface dark:border-transparent" testID="entry-lines">
            {entry.lines.map((line, i) => {
              const debit = Number(line.debitAmount) > 0;
              return (
                <View key={line.id}>
                  {i > 0 ? <Divider /> : null}
                  <Pressable
                    onPress={() => router.push(ledgerHref({ accountId: line.accountId, title: line.accountName }) as never)}
                    accessibilityRole="button"
                    accessibilityLabel={`${line.accountName}. Opens its ledger.`}
                    testID={`entry-line-${line.id}`}
                    className="min-h-[56px] flex-row items-center justify-between gap-3 px-4 py-3"
                  >
                    <View className="flex-1">
                      <Text variant="body" numberOfLines={2}>
                        {line.accountName}
                      </Text>
                      <Text variant="caption" tone="secondary" numberOfLines={1}>
                        {line.accountCode} · {debit ? 'Debit' : 'Credit'}
                        {line.description ? ` · ${line.description}` : ''}
                      </Text>
                    </View>
                    <Money value={debit ? line.debitAmount : line.creditAmount} size="body-strong" />
                  </Pressable>
                </View>
              );
            })}
            <Divider />
            <View className="flex-row items-center justify-between gap-3 bg-surface-sunken px-4 py-3">
              <Text variant="body-strong">Total</Text>
              <Money value={entry.totalDebit} size="body-strong" />
            </View>
          </View>
        </Section>

        {entry.source ? (
          <Section title="Where this came from">
            <SourceCard source={entry.source} onOpen={(href) => router.push(href as never)} />
          </Section>
        ) : null}

        <Section title="History">
          <View className="gap-2">
            <Text variant="body">{sourceLabel(entry)}</Text>
            <Text variant="caption" tone="secondary">
              Written {when(entry.createdAt)}
              {entry.createdByEmail ? ` by ${entry.createdByEmail}` : ''}
            </Text>
            {entry.approvedAt ? (
              <Text variant="caption" tone="secondary">
                Approved {when(entry.approvedAt)}
                {entry.approvedByEmail ? ` by ${entry.approvedByEmail}` : ''}
              </Text>
            ) : null}
            {entry.postedAt ? (
              <Text variant="caption" tone="secondary">
                Posted {when(entry.postedAt)}
              </Text>
            ) : null}
            {entry.status === 'PENDING_APPROVAL' && isMine ? (
              <Text variant="caption" tone="secondary" testID="entry-own-note">
                You wrote this entry, so another officer has to approve it.
              </Text>
            ) : null}
          </View>
        </Section>
      </View>

      {hasActions ? (
        <StickyFooter>
          {showEdit ? (
            <View className="flex-1">
              <Button variant="secondary" fullWidth onPress={() => router.push({ pathname: '/(app)/(tabs)/manage/accounting/journal/form', params: { id: String(entry.id) } } as never)} testID="entry-edit">
                Change
              </Button>
            </View>
          ) : null}
          {showSend ? (
            <View className="flex-1">
              <Button variant="primary" fullWidth loading={submit.isPending} onPress={send} testID="entry-send">
                Send for approval
              </Button>
            </View>
          ) : null}
          {showDecide ? (
            <>
              <View className="flex-1">
                <Button variant="secondary" fullWidth onPress={() => rejectRef.current?.present()} testID="entry-reject">
                  Reject
                </Button>
              </View>
              <View className="flex-1">
                <Button variant="primary" fullWidth loading={decide.isPending} onPress={() => approveRef.current?.present()} testID="entry-approve">
                  Approve
                </Button>
              </View>
            </>
          ) : null}
          {showPost ? (
            <View className="flex-1">
              <Button variant="primary" fullWidth onPress={() => { setPostError(null); postRef.current?.present(); }} testID="entry-post">
                Post to the books
              </Button>
            </View>
          ) : null}
        </StickyFooter>
      ) : null}

      <ConfirmSheet
        ref={approveRef}
        title="Approve this entry?"
        description="It can then be posted to the books. You cannot approve an entry you wrote."
        confirmLabel="Approve entry"
        destructive={false}
        onConfirm={approve}
      />
      <ReasonSheet ref={rejectRef} title="Reject this entry?" description="The officer who wrote it will see your reason, and can change it and send it again." confirmLabel="Reject entry" loading={decide.isPending} onConfirm={reject} />
      <PostEntrySheet ref={postRef} entryNumber={entry.entryNumber} loading={post.isPending} error={postError} onConfirm={confirmPost} onDismiss={() => setPostError(null)} />
    </Screen>
  );
}
