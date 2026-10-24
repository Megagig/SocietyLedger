import { useMutation, useQueryClient } from '@tanstack/react-query';

import { accountingApi } from '@/api/endpoints/accounting';
import { reportsApi } from '@/api/endpoints/reports';
import { saveAndShare } from '@/features/reports/share';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { AccountPayload, AccountUpdatePayload, BudgetPayload, BudgetUpdatePayload, JournalEntryDTO, JournalPayload, PeriodPayload, SyncKind } from '@/types/api/accounting';
import { accountingKeys } from './queries';

/** Anything written moves balances, statements, the dashboard and the lists, so the whole group is read again. */
function useInvalidateAccounting() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    void queryClient.invalidateQueries({ queryKey: accountingKeys.all(tenant) });
  };
}

/** Catches up the books: every kind of record, or just the kind given. */
export function useRunSync() {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: (kind?: SyncKind) => accountingApi.runSync(kind), onSettled: invalidate });
}

export function useInitializeChart() {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: () => accountingApi.initializeChart(), onSettled: invalidate });
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: (payload: AccountPayload) => accountingApi.createAccount(payload), onSuccess: invalidate });
}

export function useUpdateAccount(id: number) {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: (payload: AccountUpdatePayload) => accountingApi.updateAccount(id, payload), onSuccess: invalidate });
}

export function useDeleteAccount(id: number) {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: () => accountingApi.deleteAccount(id), onSuccess: invalidate });
}

export function useCreateEntry() {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: (payload: JournalPayload) => accountingApi.createEntry(payload), onSuccess: invalidate });
}

export function useUpdateEntry(id: number) {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: (payload: Partial<JournalPayload>) => accountingApi.updateEntry(id, payload), onSuccess: invalidate });
}

export function useSubmitEntry(id: number) {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: () => accountingApi.submitEntry(id), onSettled: invalidate });
}

export function useDecideEntry(id: number) {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: (payload: { action: 'approve' | 'reject'; reason?: string }) => accountingApi.decideEntry(id, payload), onSettled: invalidate });
}

export function usePostEntry(id: number) {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: (password: string) => accountingApi.postEntry(id, password), onSettled: invalidate });
}

export function useCreateBudget() {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: (payload: BudgetPayload) => accountingApi.createBudget(payload), onSuccess: invalidate });
}

export function useUpdateBudget(id: number) {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: (payload: BudgetUpdatePayload) => accountingApi.updateBudget(id, payload), onSuccess: invalidate });
}

export function useApproveBudget(id: number) {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: () => accountingApi.approveBudget(id), onSettled: invalidate });
}

export function useActivateBudget(id: number) {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: () => accountingApi.activateBudget(id), onSettled: invalidate });
}

export function useCreatePeriod() {
  const invalidate = useInvalidateAccounting();
  return useMutation({ mutationFn: (payload: PeriodPayload) => accountingApi.createPeriod(payload), onSuccess: invalidate });
}

export function useChangePeriod() {
  const invalidate = useInvalidateAccounting();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'close' | 'reopen' | 'lock' }) =>
      action === 'close' ? accountingApi.closePeriod(id) : action === 'reopen' ? accountingApi.reopenPeriod(id) : accountingApi.lockPeriod(id),
    onSettled: invalidate,
  });
}

export type SavedEntry = { entry: JournalEntryDTO; sent: boolean; sendError: unknown };

/**
 * Saves an entry as a draft (a new one, or changes to a draft or rejected one) and, when asked, sends it for approval in a second
 * step. If the second step fails the draft is still saved: the result says so, so the officer can send it later.
 */
export function useSaveEntry(editId: number | undefined) {
  const invalidate = useInvalidateAccounting();
  return useMutation({
    mutationFn: async ({ payload, send }: { payload: JournalPayload; send: boolean }): Promise<SavedEntry> => {
      const saved = editId === undefined ? await accountingApi.createEntry(payload) : await accountingApi.updateEntry(editId, payload);
      if (!send) return { entry: saved, sent: false, sendError: null };
      try {
        return { entry: await accountingApi.submitEntry(saved.id), sent: true, sendError: null };
      } catch (sendError) {
        return { entry: saved, sent: false, sendError };
      }
    },
    onSettled: invalidate,
  });
}

/** Makes the statement as a PDF on the server, downloads it, and opens the share sheet (WhatsApp, email, Files). */
export function useShareStatementPdf() {
  return useMutation({
    mutationFn: async (payload: Parameters<typeof accountingApi.exportStatement>[0]) => {
      const made = await accountingApi.exportStatement(payload);
      const bytes = await reportsApi.downloadExport(made.id);
      await saveAndShare(made.filename, bytes, 'pdf');
    },
  });
}
