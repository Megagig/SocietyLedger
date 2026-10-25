import { useMutation, useQueryClient } from '@tanstack/react-query';

import { expensesApi } from '@/api/endpoints/expenses';
import { accountingKeys } from '@/features/accounting/queries';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { ExpensePayload } from '@/types/api/expenses';

/** Approving or voiding moves the books, and any change moves the lists: the whole accounting group is read again. */
function useInvalidate() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    void queryClient.invalidateQueries({ queryKey: accountingKeys.all(tenant) });
  };
}

/**
 * Records a new voucher, or changes the one given (a draft, or one that was rejected); attaches the receipt picked; and sends it for
 * approval when asked. Each step is its own request, so if a later one fails the voucher is still saved and the reason comes back with it.
 */
export function useSaveExpense(id?: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ payload, receipt, send }: { payload: ExpensePayload; receipt?: { uri: string; name: string; type: string } | null; send: boolean }) => {
      let expense = id ? await expensesApi.update(id, payload) : await expensesApi.create(payload);
      let receiptError: unknown;
      let sendError: unknown;
      let sent = false;
      if (receipt) {
        try {
          expense = await expensesApi.uploadReceipt(expense.id, receipt);
        } catch (error) {
          receiptError = error;
        }
      }
      if (send && !receiptError) {
        try {
          expense = await expensesApi.submit(expense.id);
          sent = true;
        } catch (error) {
          sendError = error;
        }
      }
      return { expense, sent, sendError, receiptError };
    },
    onSettled: invalidate,
  });
}

export function useUploadReceipt(id: number) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (file: { uri: string; name: string; type: string }) => expensesApi.uploadReceipt(id, file), onSuccess: invalidate });
}

export function useRemoveReceipt(id: number) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: () => expensesApi.removeReceipt(id), onSuccess: invalidate });
}

export function useSubmitExpense(id: number) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: () => expensesApi.submit(id), onSettled: invalidate });
}

export function useWithdrawExpense(id: number) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: () => expensesApi.withdraw(id), onSettled: invalidate });
}

export function useApproveExpense(id: number) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (password: string) => expensesApi.approve(id, password), onSettled: invalidate });
}

export function useRejectExpense(id: number) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (reason: string) => expensesApi.reject(id, reason), onSettled: invalidate });
}

export function useVoidExpense(id: number) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (payload: { reason: string; password: string }) => expensesApi.voidVoucher(id, payload), onSettled: invalidate });
}

export function useDeleteExpense(id: number) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: () => expensesApi.remove(id), onSuccess: invalidate });
}
