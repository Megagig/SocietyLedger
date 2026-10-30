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
export async function downloadReport(name: ReportName, filters: ReportFilters, format: 'csv' | 'pdf'): Promise<void> {
  try {
    await downloadFile(`/ajo/reports/${name}/export?${reportQuery(filters, { format })}`, `ajo-${name}.${format}`);
  } catch (error) {
    throw await readBlobError(error);
  }
}

/** A blob's text. `Blob.text()` is missing from older browsers, so a FileReader is the fallback. */
function blobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/**
 * A download asks for a blob, so when the API refuses (a range that is too long, a PDF with too many rows) its explanation arrives as a
 * blob too. Read it back into the error so the screen can show the API's own words instead of a generic message.
 */
export async function readBlobError(error: unknown): Promise<unknown> {
  const response = (error as { response?: { data?: unknown } } | null)?.response;
  if (response && typeof Blob !== 'undefined' && response.data instanceof Blob) {
    try {
      response.data = JSON.parse(await blobText(response.data));
    } catch {
      /* not JSON: leave it as it was */
    }
  }
  return error;
}
