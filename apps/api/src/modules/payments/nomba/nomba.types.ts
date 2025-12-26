/**
 * Nomba Payment Gateway Types
 * 
 * Type definitions for Nomba API integration
 * Documentation: https://developer.nomba.com/docs
 */

export interface NombaConfig {
  apiKey: string;
  accountId: string;
  baseUrl: string;
}

export interface NombaAuthResponse {
  code: string;
  description: string;
  status: boolean;
  data: {
    access_token: string;
    businessId: string;
    refresh_token: string;
    expiresAt: string;
  };
}

export interface NombaCheckoutOrderRequest {
  order: {
    orderReference: string;
    customerId?: string;
    customerEmail: string;
    amount: string; // Nomba expects amount as string in kobo
    currency: string;
  };
  callbackUrl: string;
}

export interface NombaCheckoutOrderResponse {
  code: string;
  description: string;
  status: boolean;
  data: {
    success: boolean;
    message: string;
    checkoutLink: string;
    orderReference: string;
  };
}

export interface NombaVerifyTransactionResponse {
  code: string;
  description: string;
  data: {
    orderReference: string;
    transactionId: string;
    status: 'pending' | 'success' | 'failed' | 'cancelled';
    amount: number;
    fee: number;
    currency: string;
    customerEmail: string;
    transactionTime: string;
    paymentMethod: string;
  };
}

export interface NombaWebhookPayload {
  event_type: 'payment_success' | 'payment_failed' | 'payment_pending';
  requestId: string;
  data: {
    merchant: {
      userId: string;
      walletId: string;
      walletBalance: number;
    };
    transaction: {
      transactionId: string;
      type: string;
      originatingFrom: string;
      transactionAmount: number;
      fee: number;
      time: string;
      merchantTxRef: string;
    };
    order: {
      accountId: string;
      orderReference: string;
      callbackUrl: string;
      customerEmail: string;
      amount: number;
      currency: string;
      customerId: string;
    };
  };
}

export interface NombaInitializePaymentRequest {
  transactionId: number;
  callbackUrl?: string;
}

export interface NombaInitializePaymentResponse {
  success: boolean;
  message: string;
  data: {
    reference: string;
    checkoutLink: string;
    orderReference: string;
    amount: number;
  };
}

export interface NombaVerifyPaymentResponse {
  success: boolean;
  message: string;
  data: {
    status: 'success' | 'failed' | 'pending';
    reference: string;
    amount: number;
    receiptNumber?: string;
    transactionId?: number;
    transactionStatus?: string;
    paidAt?: string;
    gatewayResponse?: string;
  };
}
