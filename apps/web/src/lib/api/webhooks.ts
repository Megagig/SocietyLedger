import axios from 'axios';
import { API_ROUTES } from '@/utils/constants';

// Types
export interface WebhookStats {
  paystack: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    successRate: number;
    failureRate: number;
    lastEventTime: string | null;
  };
  custom: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    successRate: number;
    failureRate: number;
    lastEventTime: string | null;
  };
  overall: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    successRate: number;
    failureRate: number;
    lastEventTime: string | null;
  };
  recentEvents: Array<{
    id: number;
    eventType: string;
    status: 'success' | 'failed' | 'pending' | 'retrying';
    timestamp: string;
    source: string;
  }>;
}

export interface WebhookEvent {
  id: number;
  eventType: string;
  status: 'success' | 'failed' | 'pending' | 'retrying';
  statusCode?: number;
  timestamp: string;
  source: string;
  duration?: number;
  retryCount?: number;
  errorMessage?: string;
  payload?: any;
  endpoint?: string;
  responseCode?: number | null;
  createdAt?: string;
  associationId?: number;
}

export interface WebhookTestRequest {
  eventType: string;
  payload: any;
}

export interface WebhookTestResponse {
  success: boolean;
  responseCode: number;
  responseBody: any;
  responseTime: number;
  error?: string;
}

// API Client Functions
export const webhooksApi = {
  // Get webhook statistics
  getStats: async (): Promise<WebhookStats> => {
    const response = await axios.get(API_ROUTES.WEBHOOKS.STATS);
    return response.data;
  },

  // Get webhook events with pagination and filters
  getEvents: async (params?: {
    page?: number;
    limit?: number;
    eventType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<{ events: WebhookEvent[]; total: number; page: number; limit: number }> => {
    const response = await axios.get(API_ROUTES.WEBHOOKS.EVENTS, { params });
    return response.data;
  },

  // Get single webhook event
  getEvent: async (id: number): Promise<WebhookEvent> => {
    const response = await axios.get(API_ROUTES.WEBHOOKS.EVENT_BY_ID(id));
    return response.data;
  },

  // Retry failed webhook event
  retryEvent: async (id: number): Promise<void> => {
    await axios.post(API_ROUTES.WEBHOOKS.RETRY_EVENT(id));
  },

  // Retry all failed webhook events
  retryFailed: async (): Promise<void> => {
    await axios.post(`${API_ROUTES.WEBHOOKS.EVENTS}/retry-failed`);
  },

  // Clear webhook logs
  clearLogs: async (params?: {
    olderThan?: string;
    status?: string;
  }): Promise<void> => {
    await axios.delete(API_ROUTES.WEBHOOKS.CLEAR_LOGS, { params });
  },

  // Test webhook
  testWebhook: async (data: WebhookTestRequest): Promise<WebhookTestResponse> => {
    const response = await axios.post(API_ROUTES.WEBHOOKS.TEST, data);
    return response.data;
  },

  // Get webhook event types
  getEventTypes: async (): Promise<string[]> => {
    const response = await axios.get(API_ROUTES.WEBHOOKS.EVENT_TYPES);
    return response.data;
  },
};

export default webhooksApi;
