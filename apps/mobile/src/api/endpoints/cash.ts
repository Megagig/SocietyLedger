import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  CashCollectionDTO,
  CashCollectionDetailDTO,
  CashCollectionListDTO,
  CashCollectionStatus,
  CashLodgableDTO,
  CashLodgmentDecisionPayload,
  CashLodgmentDTO,
  CashLodgmentListDTO,
  CashLodgmentStatus,
  CashOverviewDTO,
  CashPayablesDTO,
  CashReceiptDTO,
  CashSlipLinkDTO,
  CreateCashCollectionPayload,
  RecordCashReceiptPayload,
  RecordLodgmentPayload,
} from '@/types/api/cash';

/**
 * Cash collections and lodgments (`/api/cash`). Officers with `cash.collect` open collections and record receipts; `cash.lodge`
 * pays collected cash into the bank; `cash.verify` checks a lodgment against the bank statement (never the officer's own) and
 * voids receipts; `cash.view` sees every officer's cash. Rule failures come back as 400/403/404/409 with a plain-words `message`
 * (ApiError.message) and a `code` — show the message as is.
 */
export const cashApi = {
  /** GET /cash/overview — the caller's own cash position, and every officer's when they can view all cash. */
  async getOverview(): Promise<CashOverviewDTO> {
    return unwrap<CashOverviewDTO>(client.get('/cash/overview'));
  },

  /** GET /cash/collections — newest first. Officers without `cash.view` see only their own. */
  async listCollections(params: { status?: CashCollectionStatus; page?: number; limit?: number; meetingId?: number }): Promise<CashCollectionListDTO> {
    return unwrap<CashCollectionListDTO>(client.get('/cash/collections', { params }));
  },

  /** GET /cash/collections/:id — with its receipts. */
  async getCollection(id: number): Promise<CashCollectionDetailDTO> {
    return unwrap<CashCollectionDetailDTO>(client.get(`/cash/collections/${id}`));
  },

  /** POST /cash/collections — opens a collection owned by the caller. 400 when the association has not enabled cash. */
  async createCollection(payload: CreateCashCollectionPayload): Promise<CashCollectionDTO> {
    return unwrap<CashCollectionDTO>(client.post('/cash/collections', payload));
  },

  /** POST /cash/collections/:id/close — only the collector; the receipts are then fixed and the cash can be lodged. 409 if already closed. */
  async closeCollection(id: number): Promise<CashCollectionDetailDTO> {
    return unwrap<CashCollectionDetailDTO>(client.post(`/cash/collections/${id}/close`));
  },

  /** GET /cash/payables?memberId= — what the member could pay today, by kind. */
  async getPayables(memberId: number): Promise<CashPayablesDTO> {
    return unwrap<CashPayablesDTO>(client.get('/cash/payables', { params: { memberId } }));
  },

  /**
   * POST /cash/collections/:id/receipts — credits the member at once. The idempotency key makes a retry safe: the same key returns
   * the receipt already made. 409 `PARTIALLY_RECORDED` means some payments were saved and one was not (the message says which).
   */
  async recordReceipt(collectionId: number, payload: RecordCashReceiptPayload): Promise<CashReceiptDTO> {
    return unwrap<CashReceiptDTO>(client.post(`/cash/collections/${collectionId}/receipts`, payload));
  },

  /** POST /cash/receipts/:id/void — only while the collection is open, by an officer other than the collector, with a reason. */
  async voidReceipt(id: number, reason: string): Promise<void> {
    await unwrap<unknown>(client.post(`/cash/receipts/${id}/void`, { reason }));
  },

  /** GET /cash/lodgable — the caller's closed collections that still hold cash, oldest first. */
  async getLodgable(): Promise<CashLodgableDTO> {
    return unwrap<CashLodgableDTO>(client.get('/cash/lodgable'));
  },

  /** POST /cash/lodgments (multipart) — pays collected cash into a bank account with a photo of the deposit slip. */
  async recordLodgment(payload: RecordLodgmentPayload): Promise<CashLodgmentDTO> {
    const formData = new FormData();
    formData.append('bankAccountId', String(payload.bankAccountId));
    formData.append('amount', String(payload.amount));
    formData.append('depositDate', payload.depositDate);
    if (payload.bankReference) formData.append('bankReference', payload.bankReference);
    if (payload.shortfallReason) formData.append('shortfallReason', payload.shortfallReason);
    if (payload.collectionIds?.length) formData.append('collectionIds', payload.collectionIds.join(','));
    formData.append('slip', { uri: payload.slip.uri, name: payload.slip.name, type: payload.slip.type } as never);

    return unwrap<CashLodgmentDTO>(client.post('/cash/lodgments', formData, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },

  /** GET /cash/lodgments — newest first, one status at a time. */
  async listLodgments(params: { status?: CashLodgmentStatus; page?: number; limit?: number }): Promise<CashLodgmentListDTO> {
    return unwrap<CashLodgmentListDTO>(client.get('/cash/lodgments', { params }));
  },

  async getLodgment(id: number): Promise<CashLodgmentDTO> {
    return unwrap<CashLodgmentDTO>(client.get(`/cash/lodgments/${id}`));
  },

  /** GET /cash/lodgments/:id/slip-url — a signed link, valid for an hour. */
  async getSlipLink(id: number): Promise<CashSlipLinkDTO> {
    return unwrap<CashSlipLinkDTO>(client.get(`/cash/lodgments/${id}/slip-url`));
  },

  /** POST /cash/lodgments/:id/decision — once. 403 for the officer's own lodgment, 409 when already decided. */
  async decideLodgment(id: number, payload: CashLodgmentDecisionPayload): Promise<CashLodgmentDTO> {
    return unwrap<CashLodgmentDTO>(client.post(`/cash/lodgments/${id}/decision`, payload));
  },
};
