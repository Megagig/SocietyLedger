import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

export interface PaystackInitializeData {
  email: string;
  amount: number; // In kobo (multiply by 100)
  reference: string;
  callback_url?: string;
  metadata?: Record<string, any>;
  channels?: string[];
  currency?: string;
}

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
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
    metadata: Record<string, any>;
    fees: number;
    customer: {
      id: number;
      email: string;
      customer_code: string;
    };
    authorization: {
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
    };
  };
}

export class PaystackService {
  private apiKey: string;
  private baseUrl: string;
  private client: AxiosInstance;

  constructor() {
    this.apiKey = process.env.PAYSTACK_SECRET_KEY || '';
    this.baseUrl = 'https://api.paystack.co';

    // Don't throw in constructor - check at runtime when making API calls
    // This allows the module to load even if env vars aren't set yet

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });
  }

  private ensureApiKey(): void {
    if (!this.apiKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }
  }

  /**
   * Initialize a payment transaction
   */
  async initializePayment(data: PaystackInitializeData): Promise<PaystackInitializeResponse> {
    this.ensureApiKey();
    try {
      const response = await this.client.post<PaystackInitializeResponse>(
        '/transaction/initialize',
        {
          email: data.email,
          amount: data.amount,
          reference: data.reference,
          callback_url: data.callback_url,
          metadata: data.metadata,
          channels: data.channels || ['card', 'bank', 'ussd', 'bank_transfer'],
          currency: data.currency || 'NGN',
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Paystack initialization error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || 'Failed to initialize payment with Paystack'
      );
    }
  }

  /**
   * Verify a payment transaction
   */
  async verifyPayment(reference: string): Promise<PaystackVerifyResponse> {
    this.ensureApiKey();
    try {
      const response = await this.client.get<PaystackVerifyResponse>(
        `/transaction/verify/${reference}`
      );

      return response.data;
    } catch (error: any) {
      console.error('Paystack verification error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || 'Failed to verify payment with Paystack'
      );
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    this.ensureApiKey();
    const hash = crypto
      .createHmac('sha512', this.apiKey)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Generate a unique payment reference
   */
  static generateReference(prefix: string = 'PAY'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Convert Naira to Kobo (Paystack uses kobo)
   */
  static nairaToKobo(naira: number): number {
    return Math.round(naira * 100);
  }

  /**
   * Convert Kobo to Naira
   */
  static koboToNaira(kobo: number): number {
    return kobo / 100;
  }
}
