// import { API_ROUTES } from '../utils/constants'; // Removed - using hardcoded routes

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
    console.error('[Cron API] Error parsing auth storage:', error);
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

// Cron API Routes (hardcoded temporarily to fix import issue)
const CRON_ROUTES = {
  STATUS: `${API_BASE_URL}/api/cron/status`,
  TRIAL_EXPIRY: `${API_BASE_URL}/api/cron/trial-expiry`,
  RENEWAL_REMINDERS: `${API_BASE_URL}/api/cron/renewal-reminders`,
  LATE_FEES: `${API_BASE_URL}/api/cron/late-fees`,
  UPDATE_OVERDUE: `${API_BASE_URL}/api/cron/update-overdue`,
  LOGS: `${API_BASE_URL}/api/cron/logs`,
  LOG_BY_ID: (id: number) => `${API_BASE_URL}/api/cron/logs/${id}`,
  CONFIG: (jobId: string) => `${API_BASE_URL}/api/cron/jobs/${jobId}/config`,
  TOGGLE: (jobId: string) => `${API_BASE_URL}/api/cron/jobs/${jobId}/toggle`,
};

// Types
export interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  status: 'active' | 'disabled' | 'running' | 'failed';
  lastRunAt: string | null;
  nextRunAt: string | null;
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
}

export interface CronJobStats {
  jobsRunning: boolean;
  subscriptionStats: {
    [key: string]: number;
  };
  lastChecked: string;
}

// Add the missing type that the page is trying to import
export interface CronJobStatus {
  jobsRunning: boolean;
  subscriptionStats: {
    [key: string]: number;
  };
  lastChecked: string;
}

export interface JobExecutionLog {
  id: number;
  jobId: string;
  jobName: string;
  status: 'success' | 'failed' | 'running';
  timestamp: string;
  duration: number;
  output?: string;
  errorMessage?: string;
}

export interface CronJobConfig {
  jobId: string;
  schedule: string;
  enabled: boolean;
  parameters?: Record<string, any>;
}

// API Client Functions
export const cronApi = {
  // Get cron job status
  getStatus: async (): Promise<CronJobStats> => {
    const response = await fetch(CRON_ROUTES.STATUS, {
      method: 'GET',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.data;
  },

  // Trigger trial expiry check
  triggerTrialExpiry: async (): Promise<{
    success: boolean;
    message: string;
    data: {
      expiringSoon: number;
      expired: number;
    };
  }> => {
    const response = await fetch(CRON_ROUTES.TRIAL_EXPIRY, {
      method: 'POST',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  },

  // Add aliases for the functions the page expects
  runTrialExpiry: async (): Promise<{
    success: boolean;
    message: string;
    data: {
      expiringSoon: number;
      expired: number;
    };
  }> => {
    const response = await fetch(CRON_ROUTES.TRIAL_EXPIRY, {
      method: 'POST',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  },

  // Trigger renewal reminders
  triggerRenewalReminders: async (): Promise<{
    success: boolean;
    message: string;
    data: {
      expiringSoon: number;
      expired: number;
    };
  }> => {
    const response = await fetch(CRON_ROUTES.RENEWAL_REMINDERS, {
      method: 'POST',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  },

  // Add alias
  runRenewalReminders: async (): Promise<{
    success: boolean;
    message: string;
    data: {
      expiringSoon: number;
      expired: number;
    };
  }> => {
    const response = await fetch(CRON_ROUTES.RENEWAL_REMINDERS, {
      method: 'POST',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  },

  // Trigger late fees processing
  triggerLateFees: async (): Promise<{
    success: boolean;
    message: string;
    data: {
      processed: number;
      totalPenalties: number;
      totalAmount: number;
      errors: string[];
    };
  }> => {
    const response = await fetch(CRON_ROUTES.LATE_FEES, {
      method: 'POST',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  },

  // Add alias
  runLateFees: async (): Promise<{
    success: boolean;
    message: string;
    data: {
      processed: number;
      totalPenalties: number;
      totalAmount: number;
      errors: string[];
    };
  }> => {
    const response = await fetch(CRON_ROUTES.LATE_FEES, {
      method: 'POST',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  },

  // Trigger overdue status update
  triggerUpdateOverdue: async (): Promise<{
    success: boolean;
    message: string;
    data: {
      updated: number;
      errors: string[];
    };
  }> => {
    const response = await fetch(CRON_ROUTES.UPDATE_OVERDUE, {
      method: 'POST',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  },

  // Add alias
  runUpdateOverdue: async (): Promise<{
    success: boolean;
    message: string;
    data: {
      updated: number;
      errors: string[];
    };
  }> => {
    const response = await fetch(CRON_ROUTES.UPDATE_OVERDUE, {
      method: 'POST',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  },

  // Get job execution logs
  getLogs: async (params?: {
    page?: number;
    limit?: number;
    jobId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ logs: JobExecutionLog[]; total: number; page: number; limit: number }> => {
    const url = new URL(CRON_ROUTES.LOGS);
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
    
    const result = await response.json();
    return result.data;
  },

  // Get single job log
  getLog: async (id: number): Promise<JobExecutionLog> => {
    const response = await fetch(CRON_ROUTES.LOG_BY_ID(id), {
      method: 'GET',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.data;
  },

  // Update job configuration
  updateConfig: async (jobId: string, config: CronJobConfig): Promise<void> => {
    const response = await fetch(CRON_ROUTES.CONFIG(jobId), {
      method: 'PUT',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  },

  // Get job configuration
  getConfig: async (jobId: string): Promise<CronJobConfig> => {
    const response = await fetch(CRON_ROUTES.CONFIG(jobId), {
      method: 'GET',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.data;
  },

  // Enable/disable job
  toggleJob: async (jobId: string, enabled: boolean): Promise<void> => {
    const response = await fetch(CRON_ROUTES.TOGGLE(jobId), {
      method: 'PATCH',
      headers: createSuperAdminHeaders(),
      credentials: 'include',
      body: JSON.stringify({ enabled }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  },
};

export default cronApi;
