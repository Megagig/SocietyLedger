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
      // Nomba uses same URL for sandbox and production (credentials determine environment)
      baseUrl: process.env.NOMBA_BASE_URL || 'https://api.nomba.com/v1',
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check if Nomba is configured
   */
  isConfigured(): boolean {
    const hasApiKey = !!this.config.apiKey;
    const hasAccountId = !!this.config.accountId;
    const hasApiSecret = !!process.env.NOMBA_API_SECRET;
    
    console.log('Nomba config check:', {
      hasApiKey,
      hasAccountId, 
      hasApiSecret,
      baseUrl: this.config.baseUrl,
    });
    
    return hasApiKey && hasAccountId && hasApiSecret;
  }

  /**
   * Authenticate with Nomba API using OAuth2
   */
  private async authenticate(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const clientSecret = process.env.NOMBA_API_SECRET || '';
    
    if (!clientSecret) {
      throw new Error('NOMBA_API_SECRET environment variable is not configured');
    }

    const authUrl = `${this.config.baseUrl}/auth/token/issue`;
    const authPayload = {
      grant_type: 'client_credentials',
      client_id: this.config.apiKey,
      client_secret: clientSecret,
    };

    console.log('Nomba auth request to:', authUrl);

    try {
      const response = await axios.post<NombaAuthResponse>(
        authUrl,
        authPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'accountId': this.config.accountId, // Required for all Nomba API calls including auth
          },
          timeout: 30000, // 30 second timeout
        }
      );

      // Token is nested in response.data.data.access_token
      this.accessToken = response.data.data.access_token;
      
      // Calculate expiry from expiresAt timestamp
      const expiresAt = new Date(response.data.data.expiresAt).getTime();
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = expiresAt - (5 * 60 * 1000);

      console.log('Nomba authentication successful, token obtained');

      return this.accessToken;
    } catch (error: any) {
      console.error('Nomba authentication failed:');
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.error('  Network Error: Cannot reach Nomba API at', authUrl);
        console.error('  Error Code:', error.code);
        throw new Error(`Cannot reach Nomba API: ${error.code}. Check your internet connection and the API URL.`);
      }
      
      if (error.response) {
        // Server responded with error status
        console.error('  Status:', error.response.status);
        console.error('  Response Data:', JSON.stringify(error.response.data, null, 2));
        
        const errorMessage = error.response.data?.description 
          || error.response.data?.message 
          || error.response.statusText
          || 'Unknown server error';
        
        throw new Error(`Nomba authentication failed (${error.response.status}): ${errorMessage}`);
      } else if (error.request) {
        // Request made but no response received
        console.error('  No response received from Nomba API');
        throw new Error('No response from Nomba API. The service may be unavailable.');
      } else {
        // Error setting up request
        console.error('  Error setting up request:', error.message);
        throw new Error(`Failed to connect to Nomba: ${error.message}`);
      }
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
    if (!this.isConfigured()) {
      throw new Error('Nomba API credentials not configured. Please set NOMBA_API_KEY and NOMBA_ACCOUNT_ID environment variables.');
    }

    try {
      const headers = await this.getHeaders();

      // Nomba expects the payload wrapped in an "order" object
      const payload = {
        order: {
          orderReference: params.reference,
          customerId: params.metadata?.memberId || params.email,
          customerEmail: params.email,
          amount: String(params.amount), // Nomba expects amount as string
          currency: 'NGN',
        },
        callbackUrl: params.callbackUrl,
      };

      console.log('Nomba checkout request payload:', JSON.stringify(payload, null, 2));
      console.log('Nomba checkout headers:', {
        ...headers,
        Authorization: headers.Authorization ? `Bearer ${headers.Authorization.substring(7, 20)}...` : 'missing',
      });

      // Use axios directly instead of this.client to ensure headers are applied
      const response = await axios.post<NombaCheckoutOrderResponse>(
        `${this.config.baseUrl}/checkout/order`,
        payload,
        { headers }
      );

      console.log('Nomba checkout response:', JSON.stringify(response.data, null, 2));

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

      // Use axios directly instead of this.client to ensure headers are applied
      const response = await axios.get<NombaVerifyTransactionResponse>(
        `${this.config.baseUrl}/checkout/order/${reference}`,
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
