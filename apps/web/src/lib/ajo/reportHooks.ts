'use client';

/**
 * Ajo reports (T10): the list of reports with what is locked, one report with its filters and page, and the file downloads. A report is
 * never worked out in the browser: every figure and row comes from the API, and a file is the API's own CSV or PDF.
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { downloadFile } from './savingsHooks';
import type { ReportFilters, ReportListItem, ReportName, ReportResult } from './reportTypes';

type Envelope<T> = { success: boolean; data: T };

export const REPORT_PAGE_SIZE = 25;

/** The filters as a query string; an empty filter is left out so the API's default (the running month, every circle) applies. */
export function reportQuery(filters: ReportFilters, extra: Record<string, string | number> = {}): string {
  const params = new URLSearchParams();
  if (filters.groupId) params.set('groupId', String(filters.groupId));
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.membershipId) params.set('membershipId', String(filters.membershipId));
  if (filters.collectorUserId) params.set('collectorUserId', String(filters.collectorUserId));
  for (const [k, v] of Object.entries(extra)) params.set(k, String(v));
  return params.toString();
}

export const useReportList = () =>
  useQuery({
    queryKey: ['ajo', 'reports', 'list'],
    queryFn: async () => ((await api.get('/ajo/reports')) as { data: Envelope<ReportListItem[]> }).data.data,
    staleTime: 60_000,
  });

export const useReport = (name: ReportName, filters: ReportFilters, page: number, enabled = true) =>
  useQuery({
    queryKey: ['ajo', 'reports', name, filters, page],
    queryFn: async () => ((await api.get(`/ajo/reports/${name}?${reportQuery(filters, { page, pageSize: REPORT_PAGE_SIZE })}`)) as { data: Envelope<ReportResult> }).data.data,
    enabled,
    keepPreviousData: true,
    staleTime: 30_000,
  });

/** Download the report as a file. The API writes it from the same figures as the screen and records the export in the audit log. */
export function downloadReport(name: ReportName, filters: ReportFilters, format: 'csv' | 'pdf'): Promise<void> {
  return downloadFile(`/ajo/reports/${name}/export?${reportQuery(filters, { format })}`, `ajo-${name}.${format}`);
}
