import { client } from '../client';
import { unwrap } from '../envelope';
import type { CollectionExportParams, OpenChargesDTO, RecordPaymentsPayload, RecordedPaymentDTO } from '@/types/api/collections';

const clean = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== null));

/** Recording received payments, and the filtered lists as files. The server does every check and every export. */
export const collectionsApi = {
  /** GET /finance/collections/members/:memberId/open-charges (payments.manual_create) */
  getOpenCharges: (memberId: number) => unwrap<OpenChargesDTO>(client.get(`/finance/collections/members/${memberId}/open-charges`)),
  /** POST /finance/payments/batch: all or nothing; on a refusal the error names the charge. */
  async recordPayments(payload: RecordPaymentsPayload): Promise<RecordedPaymentDTO[]> {
    return (await unwrap<{ payments: RecordedPaymentDTO[] }>(client.post('/finance/payments/batch', payload))).payments;
  },
  /** GET /finance/collections/export (exports.financial): the filtered list as an Excel workbook or a PDF. */
  async exportFile(params: CollectionExportParams): Promise<ArrayBuffer> {
    const response = await client.get<ArrayBuffer>('/finance/collections/export', { params: clean(params), responseType: 'arraybuffer', timeout: 60_000 });
    return response.data;
  },
};
