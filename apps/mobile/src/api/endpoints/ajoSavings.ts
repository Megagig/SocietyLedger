import { client } from '../client';
import { unwrap } from '../envelope';
import type { CashTrackerDTO, CollectorInfoDTO, RecordDTO, SavingsDTO, SavingsPaymentsDTO } from '@/types/api/ajoSavings';

const get = <T>(url: string) => unwrap<T>(client.get(url));

/**
 * A collector-thrift saver's own view (spec §16.6). The saver or an officer only; anyone else is told the membership does not exist.
 * Verified against apps/api ajo-savings.controller.ts (2026-10-29).
 */
export const ajoSavingsApi = {
  /** GET /ajo/memberships/:id/savings: summary and calendar. */
  savings: (membershipId: number) => get<SavingsDTO>(`/ajo/memberships/${membershipId}/savings`),
  /** GET /ajo/memberships/:id/payments */
  payments: (membershipId: number) => get<SavingsPaymentsDTO>(`/ajo/memberships/${membershipId}/payments`),
  /** GET /ajo/memberships/:id/cash: where each cash payment is. */
  cash: (membershipId: number) => get<CashTrackerDTO>(`/ajo/memberships/${membershipId}/cash`),
  /** GET /ajo/memberships/:id/collector */
  collector: (membershipId: number) => get<CollectorInfoDTO>(`/ajo/memberships/${membershipId}/collector`),
  /** GET /ajo/memberships/:id/record */
  record: (membershipId: number) => get<RecordDTO>(`/ajo/memberships/${membershipId}/record`),
  /** GET /ajo/memberships/:id/statement?format=pdf|csv and GET /ajo/contributions/:id/receipt.pdf: the file itself. */
  async file(path: string): Promise<ArrayBuffer> {
    const response = await client.get<ArrayBuffer>(path, { responseType: 'arraybuffer', timeout: 60_000 });
    return response.data;
  },
};
