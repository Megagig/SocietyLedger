import { invalidateFor } from '@societyledger/query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { collectionsApi } from '@/api/endpoints/collections';
import { saveAndShareFile, PDF_MIME } from '@/features/ajo/shareFile';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';
import type { CollectionExportParams, RecordPaymentsPayload } from '@/types/api/collections';
import { exportFilename } from './labels';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Who may record a received payment (the same permission as the single-payment screen) and who may export a list. */
export const RECORD_ACCESS: PermissionAlias = 'PAYMENT_CREATE';
export const EXPORT_ACCESS: PermissionAlias = 'EXPORT_FINANCIAL';

export const collectionsKeys = {
  openCharges: (tenant: string, memberId: number | null) => [tenant, 'payments', 'open-charges', memberId ?? 'none'] as const,
};

/** A member's open debts for the Record payment sheet. Money, so it is read each time the sheet opens and never kept. */
export function useOpenCharges(memberId: number | null) {
  const tenant = useTenantKey();
  const canRecord = useCan(RECORD_ACCESS);
  return useQuery({
    queryKey: collectionsKeys.openCharges(tenant, memberId),
    queryFn: () => collectionsApi.getOpenCharges(memberId as number),
    enabled: canRecord && memberId !== null,
    gcTime: 0,
  });
}

/** Records the payments (all or nothing), then refreshes everything that shows that money. Never optimistic. */
export function useRecordPayments() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return useMutation({
    mutationFn: (payload: RecordPaymentsPayload) => collectionsApi.recordPayments(payload),
    onSuccess: () => invalidateFor(queryClient, tenant, 'payment.changed'),
  });
}

/** Asks the server for the filtered list as a file and hands it to the share sheet. It holds every row, not just the ones on screen. */
export async function shareCollection(params: CollectionExportParams): Promise<void> {
  const bytes = await collectionsApi.exportFile(params);
  await saveAndShareFile(exportFilename(params.screen, params.status, params.format), bytes, params.format === 'xlsx' ? XLSX_MIME : PDF_MIME);
}
