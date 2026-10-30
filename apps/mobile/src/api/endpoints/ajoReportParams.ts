import type { ReportFilters } from '@/types/api/ajoReports';

/** The filters as the API expects them. An empty filter is left out so the API's own default (the running month, every circle) applies. */
export function reportParams(filters: ReportFilters, extra: Record<string, string | number> = {}): Record<string, string | number> {
  const params: Record<string, string | number> = { ...extra };
  if (filters.groupId) params.groupId = filters.groupId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.membershipId) params.membershipId = filters.membershipId;
  if (filters.collectorUserId) params.collectorUserId = filters.collectorUserId;
  return params;
}
