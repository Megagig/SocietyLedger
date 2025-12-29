/**
 * SMS Service - Termii Integration
 * 
 * Handles sending SMS messages using Termii API for:
 * - Payment reminders
 * - Meeting notifications
 * - Announcements
 * - Bulk SMS campaigns
 * 
 * Termii API Documentation: https://developers.termii.com/
 */

import axios, { AxiosInstance } from 'axios';

// Termii API Configuration
interface TermiiConfig {
  apiKey: string;
  senderId: string;
  baseUrl: string;
  channel: 'generic' | 'dnd' | 'whatsapp';
}

// SMS Send Options
export interface SMSOptions {
  to: string | string[];  // Phone number(s) - can be single or array
  message: string;
  senderId?: string;      // Override default sender ID
  channel?: 'generic' | 'dnd' | 'whatsapp';
}

// Termii API Response Types
interface TermiiSendResponse {
  code: string;
  message_id: string;
  message: string;
  balance: number;
  user: string;
}

interface TermiiBalanceResponse {
  user: string;
  balance: number;
  currency: string;
}

interface TermiiStatusResponse {
  message_id: string;
  status: string;
  date_created: string;
  date_sent: string;
}

// SMS Send Result
export interface SMSSendResult {
  success: boolean;
  messageId?: string;
  message: string;
  balance?: number;
  error?: string;
}

// Bulk SMS Result
export interface BulkSMSResult {
  totalSent: number;
  totalFailed: number;
  results: Array<{
    phone: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
  remainingBalance?: number;
}

// Lazy-load configuration
let termiiConfig: TermiiConfig | null = null;
let termiiClient: AxiosInstance | null = null;

function getTermiiConfig(): TermiiConfig {
  if (!termiiConfig) {
    const apiKey = process.env.TERMII_API_KEY;
    if (!apiKey) {
      throw new Error('TERMII_API_KEY environment variable is not set');
    }
    
    termiiConfig = {
      apiKey,
      senderId: process.env.TERMII_SENDER_ID || 'SocLedger',
      baseUrl: process.env.TERMII_BASE_URL || 'https://api.ng.termii.com/api',
      channel: (process.env.TERMII_CHANNEL as 'generic' | 'dnd' | 'whatsapp') || 'generic',
    };
  }
  return termiiConfig;
}

function getTermiiClient(): AxiosInstance {
  if (!termiiClient) {
    const config = getTermiiConfig();
    termiiClient = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  return termiiClient;
}

/**
 * Format phone number to international format
 * Handles Nigerian numbers (converts 0xxx to 234xxx)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle Nigerian numbers
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    // Convert 0xxx to 234xxx
    cleaned = '234' + cleaned.substring(1);
  } else if (cleaned.startsWith('234') && cleaned.length === 13) {
    // Already in correct format
  } else if (cleaned.length === 10 && !cleaned.startsWith('234')) {
    // Assume Nigerian number without leading 0
    cleaned = '234' + cleaned;
  }
  
  return cleaned;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  // Nigerian numbers should be 13 digits (234 + 10 digits)
  return /^234[0-9]{10}$/.test(formatted);
}

/**
 * Helper function to retry operations with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a retryable error
      const isRetryableError = 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        error.response?.status >= 500;
      
      if (isRetryableError && attempt < maxRetries) {
        const delay = baseDelayMs * attempt;
        console.log(`⏳ [SMS] Network error, retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Send a single SMS message
 */
export async function sendSMS(options: SMSOptions): Promise<SMSSendResult> {
  const { to, message, senderId, channel } = options;
  
  try {
    const config = getTermiiConfig();
    const client = getTermiiClient();
    
    // Format phone number
    const phoneNumber = Array.isArray(to) ? formatPhoneNumber(to[0]) : formatPhoneNumber(to);
    
    // Validate phone number
    if (!isValidPhoneNumber(phoneNumber)) {
      return {
        success: false,
        message: 'Invalid phone number format',
        error: `Phone number ${phoneNumber} is not valid`,
      };
    }
    
    console.log(`📱 [SMS] Sending to ${phoneNumber}`);
    
    const response = await withRetry(async () => {
      return client.post<TermiiSendResponse>('/sms/send', {
        api_key: config.apiKey,
        to: phoneNumber,
        from: senderId || config.senderId,
        sms: message,
        type: 'plain',
        channel: channel || config.channel,
      });
    });
    
    if (response.data.code === 'ok') {
      console.log(`✅ [SMS] Sent successfully to ${phoneNumber} (ID: ${response.data.message_id})`);
      return {
        success: true,
        messageId: response.data.message_id,
        message: 'SMS sent successfully',
        balance: response.data.balance,
      };
    } else {
      console.error(`❌ [SMS] Failed to send to ${phoneNumber}: ${response.data.message}`);
      return {
        success: false,
        message: response.data.message || 'Failed to send SMS',
        error: response.data.message,
      };
    }
  } catch (error: any) {
    console.error(`❌ [SMS] Error sending SMS:`, error.message || error);
    return {
      success: false,
      message: 'Failed to send SMS',
      error: error.response?.data?.message || error.message || 'Unknown error',
    };
  }
}

/**
 * Send bulk SMS to multiple recipients
 */
export async function sendBulkSMS(options: SMSOptions): Promise<BulkSMSResult> {
  const { to, message, senderId, channel } = options;
  
  const recipients = Array.isArray(to) ? to : [to];
  const results: BulkSMSResult['results'] = [];
  let totalSent = 0;
  let totalFailed = 0;
  let remainingBalance: number | undefined;
  
  console.log(`📱 [SMS] Starting bulk send to ${recipients.length} recipients`);
  
  // Process in batches of 10 to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    // Send each SMS in the batch
    const batchPromises = batch.map(async (phone) => {
      const result = await sendSMS({
        to: phone,
        message,
        senderId,
        channel,
      });
      
      if (result.success) {
        totalSent++;
        remainingBalance = result.balance;
      } else {
        totalFailed++;
      }
      
      return {
        phone: formatPhoneNumber(phone),
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`📱 [SMS] Bulk send complete: ${totalSent} sent, ${totalFailed} failed`);
  
  return {
    totalSent,
    totalFailed,
    results,
    remainingBalance,
  };
}

/**
 * Get SMS account balance
 */
export async function getSMSBalance(): Promise<{ balance: number; currency: string } | null> {
  try {
    const config = getTermiiConfig();
    const client = getTermiiClient();
    
    const response = await withRetry(async () => {
      return client.get<TermiiBalanceResponse>('/get-balance', {
        params: { api_key: config.apiKey },
      });
    });
    
    return {
      balance: response.data.balance,
      currency: response.data.currency || 'NGN',
    };
  } catch (error: any) {
    console.error(`❌ [SMS] Error getting balance:`, error.message || error);
    return null;
  }
}

/**
 * Get SMS delivery status
 */
export async function getSMSStatus(messageId: string): Promise<TermiiStatusResponse | null> {
  try {
    const config = getTermiiConfig();
    const client = getTermiiClient();
    
    const response = await withRetry(async () => {
      return client.get<TermiiStatusResponse>('/sms/inbox', {
        params: {
          api_key: config.apiKey,
          message_id: messageId,
        },
      });
    });
    
    return response.data;
  } catch (error: any) {
    console.error(`❌ [SMS] Error getting status:`, error.message || error);
    return null;
  }
}

/**
 * Calculate SMS cost estimate
 * Termii charges per SMS segment (160 chars for plain text)
 */
export function calculateSMSSegments(message: string): number {
  const maxLength = 160;
  const multipartMaxLength = 153; // Each segment in multipart SMS
  
  if (message.length <= maxLength) {
    return 1;
  }
  
  return Math.ceil(message.length / multipartMaxLength);
}

/**
 * Truncate message to fit within SMS limits
 */
export function truncateMessage(message: string, maxSegments: number = 3): string {
  const maxLength = maxSegments === 1 ? 160 : 153 * maxSegments;
  
  if (message.length <= maxLength) {
    return message;
  }
  
  return message.substring(0, maxLength - 3) + '...';
}

/**
 * Replace template placeholders in message
 */
export function applyMessageTemplate(
  template: string,
  data: Record<string, string | number>
): string {
  let message = template;
  
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    message = message.replace(placeholder, String(value));
  }
  
  return message;
}

// Development mode logging
if (process.env.NODE_ENV === 'development') {
  console.log('📱 [SMS] Termii SMS service initialized');
}
