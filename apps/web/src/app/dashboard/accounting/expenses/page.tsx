'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  Loader,
  Modal,
  NumberInput,
  Pagination,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { IconAlertTriangle, IconPlus, IconReceipt, IconSearch } from '@tabler/icons-react';
import { expensesApi, type BudgetPosition, type Expense, type ExpenseDetail, type ExpenseInput, type ExpenseOptions, type ExpenseStatus } from '@/lib/api/expenses';
import { entryHref, formatNaira } from '@/lib/accounting-drill';
import { PERMISSIONS } from '@/lib/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/lib/toast';

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Waiting for approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  VOIDED: 'Voided',
};
const STATUS_COLORS: Record<ExpenseStatus, string> = { DRAFT: 'gray', PENDING_APPROVAL: 'yellow', APPROVED: 'green', REJECTED: 'red', VOIDED: 'dark' };
const STATUS_OPTIONS = [{ value: '', label: 'All' }, ...(Object.keys(STATUS_LABELS) as ExpenseStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))];

const day = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
const dayLong = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
/** The calendar day a date picker holds, on the person's own clock, as "2026-10-24". */
const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Where a category stands against its budget line, in words: what is left, or how far over this voucher takes it. */
function BudgetNote({ position }: { position: BudgetPosition }) {
  const over = Number(position.overBy) > 0;
  return (
    <Alert color={over ? 'yellow' : 'gray'} variant="light" icon={over ? <IconAlertTriangle size={18} /> : undefined} title={position.budgetName} data-testid="budget-note">
      <Text size="sm">
        {over
          ? `This takes the category ${formatNaira(position.overBy)} over its budget (${formatNaira(position.planned)} planned, ${formatNaira(position.spent)} already spent).`
          : `${formatNaira(Number(position.spent) + Number(position.thisVoucher))} of ${formatNaira(position.planned)} used. ${formatNaira(position.left)} left in the budget.`}
      </Text>
    </Alert>
  );
}

const apiMessage = (error: unknown, fallback: string): string => (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
const apiCode = (error: unknown): string | undefined => (error as { response?: { data?: { code?: string } } })?.response?.data?.code;

/**
 * Spending, recorded after it is paid: who was paid, for what, how much, which category, which account it was paid from, and the receipt.
 * A different officer approves it with their password, and approval posts it to the books. A wrong one is voided, never deleted.
 */
export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const { can, user } = usePermissions();
  const canCreate = can(PERMISSIONS.FINANCE_CREATE);
  const canApprove = can(PERMISSIONS.FINANCE_APPROVE);

  const [status, setStatus] = useState(params.get('status') ?? '');
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseDetail | null>(null);
  const [viewId, setViewId] = useState<number | null>(Number(params.get('expense')) || null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['expenses', status, debounced, page],
    queryFn: () => expensesApi.list({ status: status || undefined, search: debounced || undefined, page, limit: 20 }),
    keepPreviousData: true,
    retry: false,
  });
  const options = useQuery({ queryKey: ['expense-options'], queryFn: () => expensesApi.getOptions(), enabled: formOpen });
  const detail = useQuery({ queryKey: ['expense', viewId], queryFn: () => expensesApi.get(viewId as number), enabled: viewId !== null, retry: false });
  const expense: ExpenseDetail | undefined = detail.data?.data;
  const receipt = useQuery({ queryKey: ['expense-receipt', viewId], queryFn: () => expensesApi.receiptUrl(viewId as number), enabled: viewId !== null && !!expense?.hasReceipt });

  const vouchers: Expense[] = list.data?.data?.vouchers ?? [];
  const totals = list.data?.data?.totals;
  const pagination = list.data?.data?.pagination;
  const opts: ExpenseOptions | undefined = options.data?.data;
  const limit = Number(opts?.receiptRequiredAbove ?? 5000);

  const form = useForm({
    initialValues: { payee: '', description: '', amount: 0 as number | string, expenseDate: new Date() as Date | null, categoryAccountId: '', paidFromAccountId: '', reference: '', noReceiptReason: '', receipt: null as File | null },
    validate: {
      payee: (v) => (v.trim().length < 2 ? 'Enter who was paid' : null),
      description: (v) => (v.trim().length < 2 ? 'Say what it was for' : null),
      amount: (v) => (Number(v) > 0 ? null : 'Enter the amount'),
      expenseDate: (v) => (v ? null : 'Choose the date it was paid'),
      categoryAccountId: (v) => (v ? null : 'Choose a category'),
      paidFromAccountId: (v) => (v ? null : 'Choose the account it was paid from'),
    },
  });
  const amountNumber = Number(form.values.amount) || 0;
  const budgetCheck = useQuery({
    queryKey: ['expense-budget', form.values.categoryAccountId, amountNumber, form.values.expenseDate ? toDay(form.values.expenseDate) : ''],
    queryFn: () => expensesApi.checkBudget({ categoryAccountId: Number(form.values.categoryAccountId), amount: amountNumber, date: toDay(form.values.expenseDate as Date) }),
    enabled: formOpen && !!form.values.categoryAccountId && amountNumber > 0 && !!form.values.expenseDate,
    retry: false,
  });

  // An address with ?expense= opens that voucher (a ledger's "Where this came from" card lands here)
  useEffect(() => {
    const target = Number(params.get('expense'));
    if (target) setViewId(target);
  }, [params]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['expenses'] });
    void queryClient.invalidateQueries({ queryKey: ['expense'] });
    // Approving or voiding moves the books
    void queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
  };

  const openForm = (existing?: ExpenseDetail) => {
    setEditing(existing ?? null);
    form.setValues(
      existing
        ? {
            payee: existing.payee,
            description: existing.description,
            amount: Number(existing.amount),
            expenseDate: new Date(existing.expenseDate),
            categoryAccountId: String(existing.category.id),
            paidFromAccountId: String(existing.paidFrom.id),
            reference: existing.reference ?? '',
            noReceiptReason: existing.noReceiptReason ?? '',
            receipt: null,
          }
        : { payee: '', description: '', amount: 0, expenseDate: new Date(), categoryAccountId: '', paidFromAccountId: '', reference: '', noReceiptReason: '', receipt: null },
    );
    setFormOpen(true);
  };

  /** Save (a new voucher, or the one being changed), attach the receipt picked, and send it for approval when asked. */
  const save = useMutation({
    mutationFn: async ({ values, send }: { values: typeof form.values; send: boolean }) => {
      const input: ExpenseInput = {
        payee: values.payee.trim(),
        description: values.description.trim(),
        amount: Number(values.amount),
        expenseDate: toDay(values.expenseDate as Date),
        categoryAccountId: Number(values.categoryAccountId),
        paidFromAccountId: Number(values.paidFromAccountId),
        reference: values.reference.trim() || null,
        noReceiptReason: values.noReceiptReason.trim() || null,
      };
      const saved = (editing ? await expensesApi.update(editing.id, input) : await expensesApi.create(input)).data as ExpenseDetail;
      let receiptError: unknown;
      let sendError: unknown;
      let sent = false;
      if (values.receipt) {
        try {
          await expensesApi.uploadReceipt(saved.id, values.receipt);
        } catch (error) {
          receiptError = error;
        }
      }
      if (send && !receiptError) {
        try {
          await expensesApi.submit(saved.id);
          sent = true;
        } catch (error) {
          sendError = error;
        }
      }
      return { id: saved.id, sent, receiptError, sendError };
    },
    onSuccess: ({ id, sent, receiptError, sendError }) => {
      // The voucher is saved even when a later step failed, so say what happened to each
      if (receiptError) toast.error(apiMessage(receiptError, 'The expense was saved, but the receipt could not be attached.'));
      else if (sendError) toast.error(apiMessage(sendError, 'The expense was saved as a draft, but could not be sent.'));
      else toast.success(sent ? 'Sent for approval' : 'Draft saved');
      setFormOpen(false);
      setViewId(id);
      refresh();
    },
    onError: (error) => toast.apiError(error, 'Failed to save the expense'),
  });

  /** Runs one of the quick actions (send, take back, delete), says so, and reads the lists again. */
  const act = (task: () => Promise<unknown>, done: string) =>
    task().then(
      () => {
        toast.success(done);
        refresh();
      },
      (error) => toast.apiError(error, 'That did not work'),
    );

  const approve = useMutation({
    mutationFn: () => expensesApi.approve(viewId as number, password),
    onSuccess: () => {
      toast.success('Approved and posted to the books');
      setApproveOpen(false);
      setPassword('');
      refresh();
    },
    onError: (error) => {
      // A wrong password (or too many of them) stays on the dialog with its reason
      if (apiCode(error) === 'REAUTH_FAILED' || apiCode(error) === 'REAUTH_LOCKED') setPasswordError(apiMessage(error, 'That password is not correct.'));
      else {
        setApproveOpen(false);
        toast.apiError(error, 'Failed to approve the expense');
      }
    },
  });
  const reject = useMutation({
    mutationFn: () => expensesApi.reject(viewId as number, reason.trim()),
    onSuccess: () => {
      toast.success('Rejected');
      setRejectOpen(false);
      setReason('');
      refresh();
    },
    onError: (error) => toast.apiError(error, 'Failed to reject the expense'),
  });
  const voidIt = useMutation({
    mutationFn: () => expensesApi.voidExpense(viewId as number, { reason: reason.trim(), password }),
    onSuccess: () => {
      toast.success('Voided. The books have a reversing entry.');
      setVoidOpen(false);
      setPassword('');
      setReason('');
      refresh();
    },
    onError: (error) => {
      if (apiCode(error) === 'REAUTH_FAILED' || apiCode(error) === 'REAUTH_LOCKED') setPasswordError(apiMessage(error, 'That password is not correct.'));
      else {
        setVoidOpen(false);
        toast.apiError(error, 'Failed to void the expense');
      }
    },
  });

  const isMine = !!expense && !!user && expense.createdBy === Number((user as { id?: number }).id);
  const editable = expense?.status === 'DRAFT' || expense?.status === 'REJECTED';

  const categoryData = useMemo(() => (opts?.categories ?? []).map((c) => ({ value: String(c.id), label: `${c.code} ${c.name}` })), [opts]);
  const paidFromData = useMemo(() => (opts?.paidFrom ?? []).map((a) => ({ value: String(a.id), label: `${a.code} ${a.name}` })), [opts]);

  const receiptHint =
    amountNumber <= 0
      ? `A receipt is needed for spending above ${formatNaira(limit)}.`
      : amountNumber > limit
        ? `This needs its receipt: spending above ${formatNaira(limit)} cannot be sent without one.`
        : `Attach the receipt, or say why there is none below. A receipt is only required above ${formatNaira(limit)}.`;

  const closeView = () => {
    setViewId(null);
    if (typeof window !== 'undefined' && window.location.search.includes('expense=')) window.history.replaceState(null, '', '/dashboard/accounting/expenses');
  };

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">Expenses</h1>
          <p className="text-gray-600 dark:text-gray-400">Record spending with its receipt. A second officer approves it, and then it is in the books.</p>
        </div>
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => openForm()} data-testid="expense-new">
            Record Expense
          </Button>
        )}
      </div>

      {totals && (
        <Group mb="md" gap="md">
          <Card withBorder padding="md" data-testid="expense-totals-approved">
            <Text size="xs" c="dimmed">
              Approved ({totals.approvedCount})
            </Text>
            <Text size="xl" fw={700}>
              {formatNaira(totals.approvedAmount)}
            </Text>
          </Card>
          <Card withBorder padding="md" data-testid="expense-totals-waiting">
            <Text size="xs" c="dimmed">
              Waiting for approval
            </Text>
            <Text size="xl" fw={700}>
              {totals.waitingForApproval}
            </Text>
          </Card>
        </Group>
      )}

      <Group mb="md" align="flex-end">
        <TextInput
          label="Search"
          placeholder="Payee, number or description"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          className="flex-1 min-w-[220px]"
        />
        <Select
          label="Show"
          data={STATUS_OPTIONS}
          value={status}
          onChange={(v) => {
            setStatus(v ?? '');
            setPage(1);
          }}
          allowDeselect={false}
          w={220}
        />
      </Group>

      {list.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : list.error ? (
        <Alert icon={<IconReceipt size={20} />} title="Unable to load expenses" color="red">
          <Text size="sm">{apiMessage(list.error, 'The expenses could not be loaded. Try again.')}</Text>
        </Alert>
      ) : (
        <Card withBorder padding={0}>
          <Table.ScrollContainer minWidth={760}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Voucher</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Payee</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {vouchers.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text c="dimmed" ta="center" py="md">
                        {status || debounced ? 'No expenses match.' : 'No expenses yet. Record spending once it is paid, with the receipt.'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  vouchers.map((v) => (
                    <Table.Tr key={v.id} onClick={() => setViewId(v.id)} className="cursor-pointer" data-testid={`expense-row-${v.id}`}>
                      <Table.Td>
                        <Text fw={500}>{v.voucherNumber}</Text>
                      </Table.Td>
                      <Table.Td>{day(v.expenseDate)}</Table.Td>
                      <Table.Td>{v.payee}</Table.Td>
                      <Table.Td>{v.category.name}</Table.Td>
                      <Table.Td ta="right">{formatNaira(v.amount)}</Table.Td>
                      <Table.Td>
                        <Group gap={6}>
                          <Badge color={STATUS_COLORS[v.status]} variant="light">
                            {STATUS_LABELS[v.status]}
                          </Badge>
                          {v.overBudget && (
                            <Badge color="yellow" variant="outline">
                              Over budget
                            </Badge>
                          )}
                          {!v.hasReceipt && v.status !== 'DRAFT' && (
                            <Badge color="gray" variant="outline">
                              No receipt
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={pagination.totalPages} value={page} onChange={setPage} />
        </Group>
      )}

      {/* Record or change an expense */}
      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Change ${editing.voucherNumber}` : 'Record an Expense'} size="lg">
        {options.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader />
          </div>
        ) : (
          <form onSubmit={(e) => e.preventDefault()}>
            <Stack gap="md">
              {editing?.status === 'REJECTED' && editing.rejectionReason && (
                <Alert color="red" title="Rejected">
                  {editing.rejectionReason}. Change it and send it again.
                </Alert>
              )}
              <TextInput label="Who was paid?" placeholder="Ade Hall Ltd" required {...form.getInputProps('payee')} />
              <Textarea label="What was it for?" placeholder="Hall hire for the AGM" required autosize minRows={2} {...form.getInputProps('description')} />
              <Group grow align="flex-start">
                <NumberInput label="Amount paid (₦)" required min={0} decimalScale={2} fixedDecimalScale thousandSeparator="," {...form.getInputProps('amount')} />
                <DateInput label="Date paid" required maxDate={new Date()} valueFormat="D MMM YYYY" {...form.getInputProps('expenseDate')} />
              </Group>
              <Select label="Category" placeholder="Choose a category" data={categoryData} searchable required {...form.getInputProps('categoryAccountId')} />
              {budgetCheck.data?.data && <BudgetNote position={budgetCheck.data.data} />}
              <Select label="Paid from" placeholder="Choose the account it was paid from" data={paidFromData} searchable required {...form.getInputProps('paidFromAccountId')} />
              <TextInput label="Reference (optional)" placeholder="Invoice or receipt number" {...form.getInputProps('reference')} />
              <div>
                <Text size="sm" fw={500} mb={4}>
                  Receipt
                </Text>
                <Text size="xs" c="dimmed" mb={6} data-testid="expense-receipt-rule">
                  {receiptHint}
                </Text>
                {editing?.hasReceipt && (
                  <Text size="sm" mb={6}>
                    A receipt is attached. Choosing a new one below replaces it.
                  </Text>
                )}
                <FileInput placeholder="Choose a photo or PDF (up to 5MB)" accept="image/jpeg,image/png,image/webp,application/pdf" clearable {...form.getInputProps('receipt')} />
              </div>
              {!form.values.receipt && !editing?.hasReceipt && (
                <TextInput label="No receipt? Say why" placeholder="For example: bus fare, no receipt" description={`Only allowed for spending up to ${formatNaira(limit)}.`} {...form.getInputProps('noReceiptReason')} />
              )}
              <Group justify="flex-end" mt="md">
                <Button variant="light" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button variant="default" loading={save.isPending} onClick={() => form.onSubmit((values) => save.mutate({ values, send: false }))()} data-testid="expense-save-draft">
                  Save draft
                </Button>
                <Button loading={save.isPending} onClick={() => form.onSubmit((values) => save.mutate({ values, send: true }))()} data-testid="expense-send">
                  Send for approval
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>

      {/* One expense */}
      <Modal opened={viewId !== null} onClose={closeView} title={expense ? `Expense ${expense.voucherNumber}` : 'Expense'} size="lg">
        {detail.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader />
          </div>
        ) : !expense ? (
          <Alert color="red" title="Unable to load this expense">
            The expense could not be found.
          </Alert>
        ) : (
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text size="xl" fw={700}>
                  {expense.payee}
                </Text>
                <Text size="xl" fw={700} data-testid="expense-amount">
                  {formatNaira(expense.amount)}
                </Text>
              </div>
              <Group gap={6}>
                <Badge color={STATUS_COLORS[expense.status]} size="lg">
                  {STATUS_LABELS[expense.status]}
                </Badge>
                {expense.overBudget && <Badge color="yellow">Went over budget</Badge>}
              </Group>
            </Group>
            <Text>{expense.description}</Text>

            {expense.status === 'REJECTED' && expense.rejectionReason && (
              <Alert color="red" title={`Rejected${expense.rejectedAt ? ` on ${dayLong(expense.rejectedAt)}` : ''}`} data-testid="expense-rejection">
                {expense.rejectionReason}
              </Alert>
            )}
            {expense.status === 'VOIDED' && (
              <Alert color="red" title={`Voided${expense.voidedAt ? ` on ${dayLong(expense.voidedAt)}` : ''}`} data-testid="expense-voided">
                {expense.voidReason}
              </Alert>
            )}
            {expense.status === 'PENDING_APPROVAL' && !isMine && !canApprove && (
              <Alert color="gray" variant="light" data-testid="expense-cannot-decide">
                Waiting for an officer who can approve payments. You can see it, but not decide it.
              </Alert>
            )}
            {expense.status === 'PENDING_APPROVAL' && expense.otherApprovers === 0 && (
              <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Nobody can approve this yet" data-testid="expense-no-approver">
                No other officer can approve this yet. Give the Treasurer role to someone, or let another officer approve payments.
              </Alert>
            )}
            {expense.budget && expense.status !== 'APPROVED' && expense.status !== 'VOIDED' && <BudgetNote position={expense.budget} />}

            <Table>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td c="dimmed">Paid on</Table.Td>
                  <Table.Td>{dayLong(expense.expenseDate)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td c="dimmed">Category</Table.Td>
                  <Table.Td>
                    {expense.category.code} {expense.category.name}
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td c="dimmed">Paid from</Table.Td>
                  <Table.Td>
                    {expense.paidFrom.code} {expense.paidFrom.name}
                  </Table.Td>
                </Table.Tr>
                {expense.reference && (
                  <Table.Tr>
                    <Table.Td c="dimmed">Reference</Table.Td>
                    <Table.Td>{expense.reference}</Table.Td>
                  </Table.Tr>
                )}
                <Table.Tr>
                  <Table.Td c="dimmed">Recorded</Table.Td>
                  <Table.Td>
                    {dayLong(expense.createdAt)}
                    {expense.createdByEmail ? ` by ${expense.createdByEmail}` : ''}
                  </Table.Td>
                </Table.Tr>
                {expense.approvedAt && (
                  <Table.Tr>
                    <Table.Td c="dimmed">Approved</Table.Td>
                    <Table.Td>
                      {dayLong(expense.approvedAt)}
                      {expense.approvedByEmail ? ` by ${expense.approvedByEmail}` : ''}
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>

            <div>
              <Text size="sm" fw={600} mb={6}>
                Receipt
              </Text>
              {!expense.hasReceipt ? (
                <Text size="sm" c="dimmed" data-testid="receipt-none">
                  No receipt was attached.{expense.noReceiptReason ? ` Reason given: ${expense.noReceiptReason}` : ''}
                </Text>
              ) : receipt.isLoading ? (
                <Loader size="sm" />
              ) : receipt.data?.data ? (
                receipt.data.data.type?.startsWith('image/') ? (
                  <a href={receipt.data.data.url} target="_blank" rel="noreferrer" data-testid="receipt-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={receipt.data.data.url} alt="Receipt" className="max-h-80 rounded border border-gray-200 dark:border-gray-700" />
                  </a>
                ) : (
                  <Button component="a" href={receipt.data.data.url} target="_blank" rel="noreferrer" variant="light" size="xs" data-testid="receipt-open">
                    Open receipt (PDF)
                  </Button>
                )
              ) : (
                <Text size="sm" c="red">
                  The receipt could not be loaded.
                </Text>
              )}
            </div>

            {expense.journalEntryId && (
              <Group gap="md">
                <Anchor component={Link} href={entryHref(expense.journalEntryId)} size="sm" data-testid="expense-entry">
                  See the journal entry
                </Anchor>
                {expense.reversalEntryId && (
                  <Anchor component={Link} href={entryHref(expense.reversalEntryId)} size="sm" data-testid="expense-reversal">
                    See the reversing entry
                  </Anchor>
                )}
              </Group>
            )}
            {expense.status === 'PENDING_APPROVAL' && isMine && (
              <Text size="sm" c="dimmed" data-testid="expense-own-note">
                You recorded this expense, so another officer has to approve it.
              </Text>
            )}

            <Group justify="flex-end" mt="sm">
              {editable && isMine && canCreate && (
                <>
                  {expense.status === 'DRAFT' && (
                    <Button
                      variant="subtle"
                      color="red"
                      onClick={() => {
                        if (window.confirm('Delete this draft? It was never sent or posted, so nothing in the books changes.')) {
                          void act(() => expensesApi.remove(expense.id).then(closeView), 'Draft deleted');
                        }
                      }}
                      data-testid="expense-delete"
                    >
                      Delete draft
                    </Button>
                  )}
                  <Button variant="default" onClick={() => openForm(expense)} data-testid="expense-edit">
                    Change
                  </Button>
                  {expense.status === 'DRAFT' && (
                    <Button onClick={() => void act(() => expensesApi.submit(expense.id), 'Sent for approval')} data-testid="expense-submit">
                      Send for approval
                    </Button>
                  )}
                </>
              )}
              {expense.status === 'PENDING_APPROVAL' && isMine && canCreate && (
                <Button variant="default" onClick={() => void act(() => expensesApi.withdraw(expense.id), 'Taken back. You can change it now.')} data-testid="expense-withdraw">
                  Take it back
                </Button>
              )}
              {expense.status === 'PENDING_APPROVAL' && !isMine && canApprove && (
                <>
                  <Button variant="default" onClick={() => setRejectOpen(true)} data-testid="expense-reject">
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setPasswordError(null);
                      setApproveOpen(true);
                    }}
                    data-testid="expense-approve"
                  >
                    Approve
                  </Button>
                </>
              )}
              {expense.status === 'APPROVED' && canApprove && (
                <Button
                  variant="default"
                  color="red"
                  onClick={() => {
                    setPasswordError(null);
                    setVoidOpen(true);
                  }}
                  data-testid="expense-void"
                >
                  Void this expense
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Approve: posts to the books, so it asks for the password */}
      <Modal opened={approveOpen} onClose={() => setApproveOpen(false)} title={expense ? `Approve ${expense.voucherNumber}?` : 'Approve'}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Approving puts this spending in the books: the category is debited and the account it was paid from is credited. Check the receipt first, then enter your password to confirm.
          </Text>
          <PasswordInput label="Your password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} error={passwordError} data-testid="approve-password" />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setApproveOpen(false)}>
              Not yet
            </Button>
            <Button loading={approve.isPending} disabled={!password.trim()} onClick={() => approve.mutate()} data-testid="approve-confirm">
              Approve and post
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Reject */}
      <Modal opened={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject this expense?">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            The officer who recorded it will see your reason, and can change it and send it again.
          </Text>
          <Textarea label="Reason" placeholder="Say why, in a sentence" value={reason} onChange={(e) => setReason(e.currentTarget.value)} data-testid="reject-reason" />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setRejectOpen(false)}>
              Not now
            </Button>
            <Button color="red" loading={reject.isPending} disabled={reason.trim().length < 3} onClick={() => reject.mutate()} data-testid="reject-confirm">
              Reject expense
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Void: cancels spending already in the books, so it asks why and for the password */}
      <Modal opened={voidOpen} onClose={() => setVoidOpen(false)} title={expense ? `Void ${expense.voucherNumber}?` : 'Void'}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            The spending is taken out of the books with a reversing entry. The voucher stays, marked as voided, so there is a record of it.
          </Text>
          <Textarea label="Why is it being voided?" placeholder="For example: paid twice" value={reason} onChange={(e) => setReason(e.currentTarget.value)} data-testid="void-reason" />
          <PasswordInput label="Your password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} error={passwordError} data-testid="void-password" />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setVoidOpen(false)}>
              Keep it
            </Button>
            <Button color="red" loading={voidIt.isPending} disabled={reason.trim().length < 3 || !password.trim()} onClick={() => voidIt.mutate()} data-testid="void-confirm">
              Void expense
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
