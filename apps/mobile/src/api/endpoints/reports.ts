import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  AgingDTO,
  CategoryReportDTO,
  ChargeCategoryType,
  ChargeListDTO,
  ChargeListParams,
  CollectionRateDTO,
  ExportHistoryDTO,
  ExportResultDTO,
  FinancialExportPayload,
  FinancialSummaryDTO,
  GroupBy,
  MemberBalancesDTO,
  MemberBalancesParams,
  MembersExportPayload,
  PaymentListDTO,
  PaymentListParams,
  RangeParams,
  StatementExportPayload,
} from '@/types/api/reports';

/**
 * Reports and exports for officers. Reports need `ledger.view` and the reports module; exports need the export permissions
 * (`exports.financial` for the financial files, `exports.members` for the member ones). Every report figure has a list behind it:
 * `charges` and `payments` take the same filters and return totals that equal the figure tapped.
 */
export const reportsApi = {
  async getFinancialSummary(range: RangeParams, includeComparison = true): Promise<FinancialSummaryDTO> {
    return unwrap<FinancialSummaryDTO>(client.get('/reports/financial-summary', { params: { ...range, includeComparison } }));
  },

  async getMemberBalances(params: MemberBalancesParams): Promise<MemberBalancesDTO> {
    return unwrap<MemberBalancesDTO>(client.get('/reports/member-balances', { params }));
  },

  async getAging(): Promise<AgingDTO> {
    return unwrap<AgingDTO>(client.get('/reports/aging-analysis', { params: { includeDetails: true } }));
  },

  async getCollectionRate(range: RangeParams, groupBy: GroupBy): Promise<CollectionRateDTO> {
    return unwrap<CollectionRateDTO>(client.get('/reports/collection-rate', { params: { ...range, groupBy } }));
  },

  async getByCategory(range: Partial<RangeParams>, type?: ChargeCategoryType): Promise<CategoryReportDTO[]> {
    const params = { startDate: range.startDate, endDate: range.endDate, type, includeTransactions: true, transactionLimit: 5 };
    return unwrap<CategoryReportDTO[]>(client.get('/reports/by-category', { params }));
  },

  /** The charges that add up to a figure on a report. Totals cover the whole list, not just the page. */
  async listCharges(params: ChargeListParams, page: number, limit: number): Promise<ChargeListDTO> {
    return unwrap<ChargeListDTO>(client.get('/reports/charges', { params: { ...params, page, limit } }));
  },

  /** The payments that make up "money received". */
  async listPayments(params: PaymentListParams, page: number, limit: number): Promise<PaymentListDTO> {
    return unwrap<PaymentListDTO>(client.get('/reports/payments', { params: { ...params, page, limit } }));
  },

  // ---- exports
  async exportFinancial(payload: FinancialExportPayload): Promise<ExportResultDTO> {
    return unwrap<ExportResultDTO>(client.post(payload.format === 'pdf' ? '/exports/financial-pdf' : '/exports/financial-excel', payload));
  },

  async exportMembers(payload: MembersExportPayload): Promise<ExportResultDTO> {
    return unwrap<ExportResultDTO>(client.post('/exports/members-excel', payload));
  },

  async exportMemberStatement(memberId: number, payload: StatementExportPayload): Promise<ExportResultDTO> {
    return unwrap<ExportResultDTO>(client.post(`/exports/member-statement/${memberId}`, payload));
  },

  async listExports(params: { page: number; limit: number }): Promise<ExportHistoryDTO> {
    return unwrap<ExportHistoryDTO>(client.get('/exports/history', { params }));
  },

  /** GET /exports/download/:id as bytes. 410 `EXPORT_EXPIRED` once the file's 7 days are up; 403 for someone else's export. */
  async downloadExport(id: number): Promise<ArrayBuffer> {
    const response = await client.get<ArrayBuffer>(`/exports/download/${id}`, { responseType: 'arraybuffer', timeout: 60_000 });
    return response.data;
  },
};
