/**
 * Nomba Payment Service
 * 
 * Handles all Nomba API interactions for payment processing
 * Documentation: https://developer.nomba.com/docs
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import {
  NombaConfig,
  NombaAuthResponse,
  NombaCheckoutOrderRequest,
  NombaCheckoutOrderResponse,
  NombaVerifyTransactionResponse,
  NombaWebhookPayload,
} from './nomba.types';

export class NombaService {
  private config: NombaConfig;
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.config = {
      apiKey: process.env.NOMBA_API_KEY || '',
      accountId: process.env.NOMBA_ACCOUNT_ID || '',
      baseUrl: process.env.NOMBA_BASE_URL || 'https://api.nomba.com/v1',
    };

    if (!this.config.apiKey || !this.config.accountId) {
      throw new Error('Nomba API credentials not configured');
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Authenticate with Nomba API using OAuth2
   */
  private async authenticate(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post<NombaAuthResponse>(
        `${this.config.baseUrl}/auth/token/issue`,
        {
          grant_type: 'client_credentials',
          client_id: this.config.apiKey,
          client_secret: process.env.NOMBA_API_SECRET || '',
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      return this.accessToken;
    } catch (error: any) {
      console.error('Nomba authentication failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Nomba');
    }
  }

  /**
   * Get authenticated headers for API requests
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.authenticate();
    return {
      'Authorization': `Bearer ${token}`,
      'accountId': this.config.accountId,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Initialize a payment by creating a checkout order
   */
  async initializePayment(params: {
    amount: number;
    email: string;
    reference: string;
    callbackUrl: string;
    metadata?: Record<string, any>;
  }): Promise<NombaCheckoutOrderResponse> {
    try {
      const headers = await this.getHeaders();

      const payload: NombaCheckoutOrderRequest = {
        amount: params.amount,
        currency: 'NGN',
        customerEmail: params.email,
        customerId: params.metadata?.memberId || params.email,
        orderReference: params.reference,
        callbackUrl: params.callbackUrl,
        metadata: params.metadata,
      };

      const response = await this.client.post<NombaCheckoutOrderResponse>(
        '/checkout/order',
        payload,
        { headers }
      );

      return response.data;
    } catch (error: any) {
      console.error('Nomba payment initialization failed:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.description || 'Failed to initialize Nomba payment'
      );
    }
  }

  /**
   * Verify a payment transaction
   */
  async verifyPayment(reference: string): Promise<NombaVerifyTransactionResponse> {
    try {
      const headers = await this.getHeaders();

      const response = await this.client.get<NombaVerifyTransactionResponse>(
        `/checkout/order/${reference}`,
        { headers }
      );

      return response.data;
    } catch (error: any) {
      console.error('Nomba payment verification failed:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.description || 'Failed to verify Nomba payment'
      );
    }
  }

  /**
   * Verify webhook signature
   * Nomba uses HMAC SHA256 with a specific payload format
   * 
   * Signature format: eventType:requestId:userId:walletId:transactionId:transactionType:transactionTime:responseCode:timestamp
   * 
   * Note: The signature key is configured in Nomba dashboard webhook settings
   */
  verifyWebhookSignature(webhookPayload: NombaWebhookPayload, signature: string): boolean {
    try {
      const signatureKey = process.env.NOMBA_WEBHOOK_SECRET || '';
      
      if (!signatureKey) {
        console.error('Nomba webhook signature key not configured');
        return false;
      }

      // Extract required fields from webhook payload
      const { event_type, requestId, data } = webhookPayload;
      const { merchant, transaction } = data;

      // Construct signature payload according to Nomba documentation
      // Format: eventType:requestId:userId:walletId:transactionId:transactionType:transactionTime:responseCode:timestamp
      const signaturePayload = [
        event_type,
        requestId,
        merchant.userId,
        merchant.walletId,
        transaction.transactionId,
        transaction.type,
        transaction.time,
        '00', // responseCode - typically '00' for success
        new Date().toISOString(), // timestamp
      ].join(':');

      // Generate HMAC SHA256 hash
      const hash = crypto
        .createHmac('sha256', signatureKey)
        .update(signaturePayload)
        .digest('base64');

      // Compare signatures
      const isValid = hash === signature;

      if (!isValid) {
        console.error('Nomba webhook signature mismatch:', {
          expected: hash,
          received: signature,
          payload: signaturePayload,
        });
      }

      return isValid;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: string): NombaWebhookPayload {
    try {
      return JSON.parse(payload);
    } catch (error) {
      throw new Error('Invalid webhook payload');
    }
  }

  /**
   * Convert Nomba amount (in kobo) to Naira
   */
  convertToNaira(amountInKobo: number): number {
    return amountInKobo / 100;
  }

  /**
   * Convert Naira to Nomba amount (in kobo)
   */
  convertToKobo(amountInNaira: number): number {
    return Math.round(amountInNaira * 100);
  }
}

export const nombaService = new NombaService();
