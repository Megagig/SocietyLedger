import { useMutation, useQueryClient } from '@tanstack/react-query';

import { memberFinanceApi } from '@/api/endpoints/memberFinance';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { DonateRequestDTO } from '@/types/api/memberFinance';
import { memberFinanceKeys } from './queries';

/** POST /members/me/donate — invalidates donations + summary on success. */
export function useMakeDonation() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (data: DonateRequestDTO) => memberFinanceApi.makeDonation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberFinanceKeys.donations(tenant) });
      queryClient.invalidateQueries({ queryKey: memberFinanceKeys.summary(tenant) });
    },
  });
}

/** F2.8: POST /payments/paystack/initialize — returns the authorization URL to open in browser. */
export function useInitializePaystackPayment() {
  return useMutation({
    mutationFn: ({ transactionId, callbackUrl }: { transactionId: number; callbackUrl: string }) =>
      memberFinanceApi.initializePaystackPayment(transactionId, callbackUrl),
  });
}

/** F2.9: POST /nigerian-payments/proofs (multipart) — after success invalidate levies/summary. */
export function useSubmitPaymentProof() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: async ({
      transactionId,
      file,
      declarationNote,
      notes,
    }: {
      transactionId: number;
      file?: { uri: string; name: string; type: string };
      declarationNote?: string;
      notes?: string;
    }) => {
      const formData = new FormData();
      formData.append('transactionId', String(transactionId));
      formData.append('paymentMethod', 'bank_transfer');
      if (file) {
        formData.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
      }
      if (declarationNote) formData.append('declarationNote', declarationNote);
      if (notes) formData.append('notes', notes);

      const { client } = await import('@/api/client');
      const res = await client.post('/payments/nigerian/proofs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!res.data?.success) throw new Error(res.data?.message ?? 'Upload failed');
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberFinanceKeys.levies(tenant) });
      queryClient.invalidateQueries({ queryKey: memberFinanceKeys.summary(tenant) });
      queryClient.invalidateQueries({ queryKey: memberFinanceKeys.outstanding(tenant) });
    },
  });
}
