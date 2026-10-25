import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { PostEntrySheet } from '@/features/accounting/components/PostEntrySheet';
import { ACCOUNTING_APPROVE_ACCESS, ACCOUNTING_CREATE_ACCESS, entryHref } from '@/features/accounting/labels';
import { useAccountingAccess } from '@/features/accounting/queries';
import { ReasonSheet } from '@/features/coopManage/components/ReasonSheet';
import { BudgetNote, ReceiptCard } from '@/features/expenses/components/ExpenseParts';
import { VoidExpenseSheet } from '@/features/expenses/components/VoidExpenseSheet';
import { CANNOT_DECIDE_NOTE, EXPENSE_STATUS_LABELS, expenseStatusKey, NO_APPROVER_NOTE } from '@/features/expenses/labels';
import { useApproveExpense, useDeleteExpense, useRejectExpense, useSubmitExpense, useVoidExpense, useWithdrawExpense } from '@/features/expenses/mutations';
import { useExpense } from '@/features/expenses/queries';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import { useSessionStore } from '@/stores/session';

const when = (iso: string) => `${formatDate(iso, 'long')}, ${formatDate(iso, 'time')}`;

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View className="min-h-[44px] flex-row items-start justify-between gap-4 px-4 py-3">
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="body" className="flex-1 text-right">
        {value}
      </Text>
    </View>
  );
}

/** One expense voucher: what was paid, to whom, the receipt, the budget, and the next step for the officer. */
export default function ExpenseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const allowed = useAccountingAccess();
  const canCreate = useCan(ACCOUNTING_CREATE_ACCESS);
  const canApprove = useCan(ACCOUNTING_APPROVE_ACCESS);
  const me = useSessionStore((s) => s.user?.id);
  const query = useExpense(Number.isInteger(expenseId) ? expenseId : undefined);
  const submit = useSubmitExpense(expenseId);
  const withdraw = useWithdrawExpense(expenseId);
  const approve = useApproveExpense(expenseId);
  const reject = useRejectExpense(expenseId);
  const voidIt = useVoidExpense(expenseId);
  const remove = useDeleteExpense(expenseId);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);
  const approveRef = useRef<BottomSheetModal>(null);
  const rejectRef = useRef<BottomSheetModal>(null);
  const voidRef = useRef<BottomSheetModal>(null);
  const deleteRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Expense" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }
  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Expense" onBack={back} docsKey="AC7" />
        <View className="gap-4">
          <Skeleton width="100%" height={90} radius="md" />
          <Skeleton width="100%" height={180} radius="md" />
        </View>
      </Screen>
    );
  }
  const expense = query.data;
  if (query.isError || !expense) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Expense" onBack={back} docsKey="AC7" />
        <ErrorState error={query.error} title={query.isError ? undefined : 'Expense not found'} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const isMine = me !== undefined && expense.createdBy === me;
  const fail = (fallback: string) => (error: unknown) => toast.error(error instanceof ApiError ? error.message : fallback);
  const isReauth = (error: unknown) => error instanceof ApiError && (error.code === 'REAUTH_FAILED' || error.code === 'REAUTH_LOCKED');

  const send = () => submit.mutate(undefined, { onSuccess: () => toast.success('Sent for approval'), onError: fail('Could not send the expense. Try again.') });
  const takeBack = () => withdraw.mutate(undefined, { onSuccess: () => toast.success('Taken back. You can change it now.'), onError: fail('Could not take it back. Try again.') });
  const confirmApprove = (password: string) => {
    setApproveError(null);
    approve.mutate(password, {
      onSuccess: () => {
        approveRef.current?.dismiss();
        toast.success('Approved and posted to the books');
      },
      onError: (error) => {
        // A wrong password (or too many of them) stays on the sheet with its reason; anything else closes it
        if (isReauth(error)) setApproveError((error as ApiError).message);
        else {
          approveRef.current?.dismiss();
          fail('Could not approve the expense. Try again.')(error);
        }
      },
    });
  };
  const confirmReject = (reason: string) => {
    rejectRef.current?.dismiss();
    reject.mutate(reason, { onSuccess: () => toast.success('Rejected'), onError: fail('Could not reject the expense. Try again.') });
  };
  const confirmVoid = (values: { reason: string; password: string }) => {
    setVoidError(null);
    voidIt.mutate(values, {
      onSuccess: () => {
        voidRef.current?.dismiss();
        toast.success('Voided. The books have a reversing entry.');
      },
      onError: (error) => {
        if (isReauth(error)) setVoidError((error as ApiError).message);
        else {
          voidRef.current?.dismiss();
          fail('Could not void the expense. Try again.')(error);
        }
      },
    });
  };

  const editable = expense.status === 'DRAFT' || expense.status === 'REJECTED';
  const showEdit = editable && isMine && canCreate;
  const showSend = expense.status === 'DRAFT' && isMine && canCreate;
  const showTakeBack = expense.status === 'PENDING_APPROVAL' && isMine && canCreate;
  const showDecide = expense.status === 'PENDING_APPROVAL' && !isMine && canApprove;
  const showVoid = expense.status === 'APPROVED' && canApprove;
  const showDelete = expense.status === 'DRAFT' && isMine && canCreate;
  const hasActions = showEdit || showSend || showTakeBack || showDecide || showVoid;
  // The budget note matters until the money is in the books; after that it is history
  // Someone who can see it waiting but not decide it is told why; and when nobody could decide it, that is said too
  const waiting = expense.status === 'PENDING_APPROVAL';
  const showCannotDecide = waiting && !isMine && !canApprove;
  const showNoApprover = waiting && expense.otherApprovers === 0;
  const showBudget = !!expense.budget && expense.status !== 'APPROVED' && expense.status !== 'VOIDED';

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={expense.voucherNumber} onBack={back} docsKey="AC7" />

      <View className="gap-6 pb-8">
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <StatusChip status={expenseStatusKey(expense.status)} label={EXPENSE_STATUS_LABELS[expense.status]} testID="expense-status" />
            {expense.overBudget ? <Badge tone="warning">Went over budget</Badge> : null}
          </View>
          <Text variant="h3">{expense.payee}</Text>
          <Money value={expense.amount} size="h1" testID="expense-amount" />
          <Text variant="body" tone="secondary">
            {expense.description}
          </Text>
        </View>

        {expense.status === 'REJECTED' && expense.rejectionReason ? (
          <View className="rounded-lg bg-danger-soft p-4" testID="expense-rejection">
            <Text variant="body-strong" tone="danger">
              Rejected{expense.rejectedAt ? ` on ${formatDate(expense.rejectedAt, 'long')}` : ''}
            </Text>
            <Text variant="body">{expense.rejectionReason}</Text>
          </View>
        ) : null}
        {expense.status === 'VOIDED' ? (
          <View className="rounded-lg bg-danger-soft p-4" testID="expense-voided">
            <Text variant="body-strong" tone="danger">
              Voided{expense.voidedAt ? ` on ${formatDate(expense.voidedAt, 'long')}` : ''}
            </Text>
            {expense.voidReason ? <Text variant="body">{expense.voidReason}</Text> : null}
          </View>
        ) : null}

        {showCannotDecide ? (
          <View className="rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="expense-cannot-decide">
            <Text variant="body">{CANNOT_DECIDE_NOTE}</Text>
          </View>
        ) : null}
        {showNoApprover ? (
          <View className="rounded-lg bg-warning-soft p-4" testID="expense-no-approver">
            <Text variant="body-strong" tone="warning">
              Nobody can approve this yet
            </Text>
            <Text variant="body">{NO_APPROVER_NOTE}</Text>
          </View>
        ) : null}

        {showBudget && expense.budget ? <BudgetNote position={expense.budget} /> : null}

        <Section title="Details">
          <View className="overflow-hidden rounded-md border border-border bg-surface dark:border-transparent">
            <Fact label="Paid on" value={formatDate(expense.expenseDate, 'long')} />
            <Fact label="Category" value={`${expense.category.code} ${expense.category.name}`} />
            <Fact label="Paid from" value={`${expense.paidFrom.code} ${expense.paidFrom.name}`} />
            <Fact label="Reference" value={expense.reference} />
          </View>
        </Section>

        <Section title="Receipt">
          <ReceiptCard expenseId={expense.id} hasReceipt={expense.hasReceipt} noReceiptReason={expense.noReceiptReason} />
        </Section>

        {expense.journalEntryId ? (
          <Section title="In the books">
            <ListGroup>
              <ListItem title="See the journal entry" meta="Debit the category, credit the account it was paid from" showChevron onPress={() => router.push(entryHref(expense.journalEntryId as number) as never)} testID="expense-entry" />
              {expense.reversalEntryId ? <ListItem title="See the reversing entry" meta="Made when the expense was voided" showChevron onPress={() => router.push(entryHref(expense.reversalEntryId as number) as never)} testID="expense-reversal" /> : null}
            </ListGroup>
          </Section>
        ) : null}

        <Section title="History">
          <View className="gap-2">
            <Text variant="caption" tone="secondary">
              Recorded {when(expense.createdAt)}
              {expense.createdByEmail ? ` by ${expense.createdByEmail}` : ''}
            </Text>
            {expense.submittedAt ? (
              <Text variant="caption" tone="secondary">
                Sent for approval {when(expense.submittedAt)}
              </Text>
            ) : null}
            {expense.approvedAt ? (
              <Text variant="caption" tone="secondary">
                Approved {when(expense.approvedAt)}
                {expense.approvedByEmail ? ` by ${expense.approvedByEmail}` : ''}
              </Text>
            ) : null}
            {expense.status === 'PENDING_APPROVAL' && isMine ? (
              <Text variant="caption" tone="secondary" testID="expense-own-note">
                You recorded this expense, so another officer has to approve it.
              </Text>
            ) : null}
          </View>
        </Section>

        {showDelete ? (
          <Button variant="danger-ghost" fullWidth onPress={() => deleteRef.current?.present()} testID="expense-delete">
            Delete draft
          </Button>
        ) : null}
      </View>

      {hasActions ? (
        <StickyFooter>
          {showEdit ? (
            <View className="flex-1">
              <Button variant="secondary" fullWidth onPress={() => router.push({ pathname: '/(app)/(tabs)/manage/accounting/expenses/form', params: { id: String(expense.id) } } as never)} testID="expense-edit">
                Change
              </Button>
            </View>
          ) : null}
          {showSend ? (
            <View className="flex-1">
              <Button variant="primary" fullWidth loading={submit.isPending} onPress={send} testID="expense-send">
                Send for approval
              </Button>
            </View>
          ) : null}
          {showTakeBack ? (
            <View className="flex-1">
              <Button variant="secondary" fullWidth loading={withdraw.isPending} onPress={takeBack} testID="expense-withdraw">
                Take it back
              </Button>
            </View>
          ) : null}
          {showDecide ? (
            <>
              <View className="flex-1">
                <Button variant="secondary" fullWidth onPress={() => rejectRef.current?.present()} testID="expense-reject">
                  Reject
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  variant="primary"
                  fullWidth
                  onPress={() => {
                    setApproveError(null);
                    approveRef.current?.present();
                  }}
                  testID="expense-approve"
                >
                  Approve
                </Button>
              </View>
            </>
          ) : null}
          {showVoid ? (
            <View className="flex-1">
              <Button
                variant="secondary"
                fullWidth
                onPress={() => {
                  setVoidError(null);
                  voidRef.current?.present();
                }}
                testID="expense-void"
              >
                Void this expense
              </Button>
            </View>
          ) : null}
        </StickyFooter>
      ) : null}

      <PostEntrySheet
        ref={approveRef}
        entryNumber={expense.voucherNumber}
        title={`Approve ${expense.voucherNumber}?`}
        description="Approving puts this spending in the books: the category is debited and the account it was paid from is credited. Check the receipt first, then enter your password to confirm."
        confirmLabel="Approve and post"
        loading={approve.isPending}
        error={approveError}
        onConfirm={confirmApprove}
        onDismiss={() => setApproveError(null)}
      />
      <ReasonSheet ref={rejectRef} title="Reject this expense?" description="The officer who recorded it will see your reason, and can change it and send it again." confirmLabel="Reject expense" loading={reject.isPending} onConfirm={confirmReject} />
      <VoidExpenseSheet ref={voidRef} voucherNumber={expense.voucherNumber} loading={voidIt.isPending} error={voidError} onConfirm={confirmVoid} onDismiss={() => setVoidError(null)} />
      <ConfirmSheet
        ref={deleteRef}
        title="Delete this draft?"
        description="It was never sent or posted, so nothing in the books changes."
        confirmLabel="Delete draft"
        onConfirm={() => {
          deleteRef.current?.dismiss();
          remove.mutate(undefined, { onSuccess: () => { toast.success('Draft deleted'); router.back(); }, onError: fail('Could not delete the draft. Try again.') });
        }}
      />
    </Screen>
  );
}
