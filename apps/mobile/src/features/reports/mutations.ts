import { useMutation, useQueryClient } from '@tanstack/react-query';

import { reportsApi } from '@/api/endpoints/reports';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { FinancialExportPayload, MembersExportPayload, StatementExportPayload } from '@/types/api/reports';
import { saveAndShare } from './share';

function useRefreshExports() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [tenant, 'reports', 'exports'] });
  };
}

export function useExportFinancial() {
  const refresh = useRefreshExports();
  return useMutation({ mutationFn: (payload: FinancialExportPayload) => reportsApi.exportFinancial(payload), onSettled: refresh });
}

export function useExportMembers() {
  const refresh = useRefreshExports();
  return useMutation({ mutationFn: (payload: MembersExportPayload) => reportsApi.exportMembers(payload), onSettled: refresh });
}

export function useExportStatement() {
  const refresh = useRefreshExports();
  return useMutation({ mutationFn: ({ memberId, payload }: { memberId: number; payload: StatementExportPayload }) => reportsApi.exportMemberStatement(memberId, payload), onSettled: refresh });
}

/** Download a generated file to the phone and open the share sheet (WhatsApp, email, Files). */
export function useShareExport() {
  return useMutation({
    mutationFn: async (item: { id: number; filename: string; format: 'pdf' | 'excel' }) => {
      const bytes = await reportsApi.downloadExport(item.id);
      await saveAndShare(item.filename, bytes, item.format);
    },
  });
}
