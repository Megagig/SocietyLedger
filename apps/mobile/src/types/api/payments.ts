/** Paystack — real base path `/api/payments/paystack` (tenant required) — api-contract.md §5. */

/** Request body for POST /payments/paystack/initialize — verified 2026-10-19. Singular transactionId, NOT an array (one item per checkout in v1, architecture.md §8.4). */
export type PaystackInitializeRequestDTO = {
  transactionId: number;
  callbackUrl?: string;
};

export type PaystackInitializeResponseDTO = {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  amount: number;
  amountInKobo: number;
};

export type PaystackVerifyStatus = 'success' | 'failed' | 'abandoned' | 'pending';

/**
 * GET /payments/paystack/verify/:reference — verified 2026-10-19.
 * Already-verified and real-success responses have different field sets (real success adds
 * `receiptNumber`/`transactionStatus`/`paidAt`) — both are 200s, narrow on which fields are present.
 */
export type PaystackVerifyResponseDTO = {
  status: PaystackVerifyStatus;
  reference: string;
  amount: number;
  transactionId?: number;
  gatewayResponse?: string;
  receiptNumber?: string;
  transactionStatus?: 'paid' | 'partial';
  paidAt?: string;
};

export type PaystackStatusResponseDTO = {
  reference: string;
  status: string;
  amount: number;
  provider: 'paystack';
  webhookReceived: boolean;
  transaction: {
    id: number;
    referenceNumber: string;
    amount: number;
    status: string;
    member: { firstName: string; lastName: string };
    category: { name: string };
  } | null;
  createdAt: string;
};
