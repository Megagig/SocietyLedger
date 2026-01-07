import api from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface CronJobStatus {
  jobsRunning: boolean;
  subscriptionStats: Record<string, number>;
  lastChecked: string;
}

export interface CronJobResult {
  processed: number;
  errors: number;
  details?: any;
}

export const cronApi = {
  /**
   * Get cron jobs status
   */
  async getStatus() {
    const response = await api.get(`${API_URL}/api/cron/status`);
    return response.data as { success: boolean; data: CronJobStatus };
  },

  /**
   * Manually trigger trial expiry check
   */
  async runTrialExpiry() {
    const response = await api.post(`${API_URL}/api/cron/trial-expiry`);
    return response.data;
  },

  /**
   * Manually trigger renewal reminders
   */
  async runRenewalReminders() {
    const response = await api.post(`${API_URL}/api/cron/renewal-reminders`);
    return response.data;
  },

  /**
   * Manually trigger late fees processing
   */
  async runLateFees() {
    const response = await api.post(`${API_URL}/api/cron/late-fees`);
    return response.data;
  },

  /**
   * Manually trigger overdue status update
   */
  async runUpdateOverdue() {
    const response = await api.post(`${API_URL}/api/cron/update-overdue`);
    return response.data;
  },
};
