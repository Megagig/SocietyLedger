// Get auth token from localStorage
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const { state } = JSON.parse(authStorage);
      return state?.token || null;
    }
  } catch (error) {
    console.error('[Webhooks API] Error parsing auth storage:', error);
  }
  return null;
};

// Create headers for Super Admin API calls (no tenant context needed)
const createSuperAdminHeaders = (): HeadersInit => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Webhook API Routes
const WEBHOOK_ROUTES = {
  STATS: `${API_BASE_URL}/api/webhooks/stats`,
  EVENTS: `${API_BASE_URL}/api/webhooks/events`,
  EVENT_BY_ID: (id: number) => `${API_BASE_URL}/api/webhooks/events/${id}`,
  RETRY_EVENT: (id: number) => `${API_BASE_URL}/api/webhooks/events/${id}/retry`,
  RETRY_FAILED: `${API_BASE_URL}/api/webhooks/events/retry-failed`,
  CLEAR_LOGS: `${API_BASE_URL}/api/webhooks/logs/clear`,
  TEST: `${API_BASE_URL}/api/webhooks/test`,
  EVENT_TYPES: `${API_BASE_URL}/api/webhooks/event-types`,
};

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
    const response = await fetch(WEBHOOK_ROUTES.STATS, {
      method: 'GET',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
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
    const url = new URL(WEBHOOK_ROUTES.EVENTS);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, value.toString());
        }
      });
    }
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  },

  // Get single webhook event
  getEvent: async (id: number): Promise<WebhookEvent> => {
    const response = await fetch(WEBHOOK_ROUTES.EVENT_BY_ID(id), {
      method: 'GET',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  },

  // Retry failed webhook event
  retryEvent: async (id: number): Promise<void> => {
    const response = await fetch(WEBHOOK_ROUTES.RETRY_EVENT(id), {
      method: 'POST',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  },

  // Retry all failed webhook events
  retryFailed: async (): Promise<void> => {
    const response = await fetch(WEBHOOK_ROUTES.RETRY_FAILED, {
      method: 'POST',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  },

  // Clear webhook logs
  clearLogs: async (params?: {
    olderThan?: string;
    status?: string;
  }): Promise<void> => {
    const url = new URL(WEBHOOK_ROUTES.CLEAR_LOGS);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, value.toString());
        }
      });
    }
    
    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  },

  // Test webhook
  testWebhook: async (data: WebhookTestRequest): Promise<WebhookTestResponse> => {
    const response = await fetch(WEBHOOK_ROUTES.TEST, {
      method: 'POST',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  },

  // Get webhook event types
  getEventTypes: async (): Promise<string[]> => {
    const response = await fetch(WEBHOOK_ROUTES.EVENT_TYPES, {
      method: 'GET',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  },
};

export default webhooksApi;
