import { client } from '../client';
import { unwrap } from '../envelope';
import { reportParams } from './ajoReportParams';
import type { ReportFilters, ReportListItem, ReportName, ReportResult } from '@/types/api/ajoReports';

/**
 * The Ajo reports (T10). The phone shows exactly what the API works out, with the same filters, so the phone, the web and the files can
 * never disagree. Verified against apps/api modules/ajo/reports/report.controller.ts (2026-10-30).
 */
export const ajoReportsApi = {
  /** GET /ajo/reports: the eight reports, each with why it is locked if it is. */
  list: () => unwrap<ReportListItem[]>(client.get('/ajo/reports')),
  /** GET /ajo/reports/:name: figures for every circle and one page of rows. */
  page: (name: ReportName, filters: ReportFilters, page: number, pageSize: number) => unwrap<ReportResult>(client.get(`/ajo/reports/${name}`, { params: reportParams(filters, { page, pageSize }) })),
  /** GET /ajo/reports/:name/export?format=csv|pdf: the file itself, every row. The export is recorded in the audit log. */
  async file(name: ReportName, filters: ReportFilters, format: 'csv' | 'pdf'): Promise<ArrayBuffer> {
    const response = await client.get<ArrayBuffer>(`/ajo/reports/${name}/export`, { params: reportParams(filters, { format }), responseType: 'arraybuffer', timeout: 60_000 });
    return response.data;
  },
};
