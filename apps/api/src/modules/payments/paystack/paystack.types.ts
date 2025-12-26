export interface PaystackWebhookEvent {
  event: string;
  data: {
    id: number;
    domain: string;
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: {
      associationId?: number;
      transactionId?: number;
      memberId?: number;
      custom_fields?: Array<{
        display_name: string;
        variable_name: string;
        value: string;
      }>;
      [key: string]: any;
    };
    fees?: number;
    fees_split?: any;
    authorization?: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
      account_name?: string | null;
    };
    customer: {
      id: number;
      first_name?: string | null;
      last_name?: string | null;
      email: string;
      customer_code: string;
      phone?: string | null;
      metadata?: any;
      risk_action?: string;
    };
    plan?: any;
    subaccount?: any;
    split?: any;
    order_id?: any;
    paidAt?: string;
    createdAt?: string;
    requested_amount?: number;
    transaction_date?: string;
    plan_object?: any;
    subaccount_object?: any;
  };
}

export interface PaymentGatewayTransaction {
  id: number;
  associationId: number;
  transactionId?: number;
  provider: 'paystack' | 'nomba';
  reference: string;
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'abandoned';
  metadata?: Record<string, any>;
  webhookReceived: boolean;
  paystackResponse?: any;
  createdAt: Date;
  updatedAt: Date;
}
