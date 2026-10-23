import { client } from '../client';
import { unwrap } from '../envelope';
import type { ProofDecisionPayload, ProofDetailDTO, ProofFileLinkDTO, ProofListDTO, ProofListParams } from '@/types/api/paymentProofsManage';

/**
 * Officer side of the payment proofs. Listing and opening need `payments.view`; deciding needs `payments.approve`. A decision is
 * final and can only be made once — the API answers 409 for a proof that was already decided, and 403 for the officer's own proof.
 */
export const paymentProofsManageApi = {
  /** GET /payments/nigerian/proofs — newest first, one status at a time. */
  async listProofs(params: ProofListParams): Promise<ProofListDTO> {
    return unwrap<ProofListDTO>(client.get('/payments/nigerian/proofs', { params }));
  },

  /** GET /payments/nigerian/proofs/:id — with the declared charges expanded. 404 for a proof of another association. */
  async getProof(id: number): Promise<ProofDetailDTO> {
    return unwrap<ProofDetailDTO>(client.get(`/payments/nigerian/proofs/${id}`));
  },

  /** GET /payments/nigerian/proofs/:id/file-url — a signed link, valid for an hour; 404 when no file is attached. */
  async getFileLink(id: number): Promise<ProofFileLinkDTO> {
    return unwrap<ProofFileLinkDTO>(client.get(`/payments/nigerian/proofs/${id}/file-url`));
  },

  /** POST /payments/nigerian/proofs/:id/verify — approve (records the payments) or reject (a reason is required). */
  async decideProof(id: number, payload: ProofDecisionPayload): Promise<{ id: number; status: string }> {
    return unwrap<{ id: number; status: string }>(client.post(`/payments/nigerian/proofs/${id}/verify`, payload));
  },
};
