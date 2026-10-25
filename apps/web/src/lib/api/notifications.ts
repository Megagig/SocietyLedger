import api from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'payment_due' | 'payment_received' | 'system' | 'approval' | 'announcement';
  entityId?: number | null;
  pushType?: string | null;
  isRead: boolean;
  createdAt: string;
  userId: number;
  associationId: number;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const notificationsApi = {
  /**
   * Get notifications list
   */
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    unread?: boolean;
  }) {
    const response = await api.get(`${API_URL}/api/notifications`, { params });
    return response.data as { success: boolean; data: NotificationListResponse };
  },

  /**
   * Get unread count
   */
  async getUnreadCount() {
    const response = await api.get(`${API_URL}/api/notifications/unread-count`);
    return response.data as { success: boolean; data: { unreadCount: number } };
  },

  /**
   * Mark notification as read
   */
  async markAsRead(id: number) {
    const response = await api.put(`${API_URL}/api/notifications/${id}/read`);
    return response.data;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    const response = await api.put(`${API_URL}/api/notifications/read-all`);
    return response.data;
  },

  /**
   * Delete notification
   */
  async deleteNotification(id: number) {
    const response = await api.delete(`${API_URL}/api/notifications/${id}`);
    return response.data;
  },

  /**
   * Create notification (admin only)
   */
  async createNotification(data: {
    title: string;
    message: string;
    type: 'payment_due' | 'payment_received' | 'system' | 'approval' | 'announcement';
    userId?: number;
    sendEmail?: boolean;
  }) {
    const response = await api.post(`${API_URL}/api/notifications`, data);
    return response.data;
  },

  /**
   * Create announcement (admin only)
   */
  async createAnnouncement(data: AnnouncementInput) {
    const response = await api.post(`${API_URL}/api/notifications/announcement`, data);
    return response.data as { success: boolean; message: string; data: AnnouncementResult };
  },

  /** Who an announcement would reach and miss, and what its texts would cost, before it is sent. */
  async previewAnnouncement(data: AnnouncementInput) {
    const response = await api.post(`${API_URL}/api/notifications/announcement/preview`, data);
    return response.data as { success: boolean; data: AnnouncementPreview };
  },

  /** The announcements the association has sent, newest first. */
  async listAnnouncements(params?: { page?: number; limit?: number }) {
    const response = await api.get(`${API_URL}/api/notifications/announcements`, { params });
    return response.data as { success: boolean; data: { announcements: SentAnnouncement[]; pagination: { page: number; totalPages: number; totalCount: number; hasMore: boolean } } };
  },

  /**
   * Get notification preferences
   */
  async getPreferences() {
    const response = await api.get(`${API_URL}/api/notifications/preferences`);
    return response.data as { success: boolean; data: NotificationPreferences };
  },

  /**
   * Update notification preferences
   */
  async updatePreferences(data: NotificationPreferences) {
    const response = await api.put(`${API_URL}/api/notifications/preferences`, data);
    return response.data;
  },
};

export interface AnnouncementInput {
  title: string;
  message: string;
  priority?: 'info' | 'warning' | 'urgent';
  audience?: 'ALL' | 'CATEGORY' | 'SELECTED';
  categories?: string[];
  memberIds?: number[];
  sendEmail?: boolean;
  sendSms?: boolean;
  smsText?: string;
}

export interface AnnouncementReach {
  members: number;
  withLogin: number;
  noLogin: number;
  withEmail: number;
  willText: number;
  noPhone: number;
  optedOut: number;
}

export interface AnnouncementPreview {
  reach: AnnouncementReach;
  smsText: string;
  sms: { segments: number; credits: number; balance: number; enough: boolean; shortBy: number } | null;
}

export interface AnnouncementResult {
  id: number;
  count: number;
  inApp: number;
  noLogin: number;
  emailsSent: number;
  smsSent: number;
  smsFailed: number;
  smsInProgress: boolean;
  reach: AnnouncementReach;
}

export interface SentAnnouncement {
  id: number;
  title: string;
  message: string;
  priority: string;
  audience: 'ALL' | 'CATEGORY' | 'SELECTED';
  sendEmail: boolean;
  sendSms: boolean;
  status: 'SENDING' | 'COMPLETED' | 'INTERRUPTED';
  memberCount: number;
  inAppCount: number;
  noLoginCount: number;
  emailCount: number;
  smsRequested: number;
  smsSent: number;
  smsFailed: number;
  noPhoneCount: number;
  optedOutCount: number;
  creditsUsed: number;
  sentBy: string;
  createdAt: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  paymentDueEmail: boolean;
  paymentDueSMS: boolean;
  paymentDueInApp: boolean;
  paymentReceivedEmail: boolean;
  paymentReceivedSMS: boolean;
  paymentReceivedInApp: boolean;
  systemEmail: boolean;
  systemSMS: boolean;
  systemInApp: boolean;
  approvalEmail: boolean;
  approvalSMS: boolean;
  approvalInApp: boolean;
  announcementEmail: boolean;
  announcementSMS: boolean;
  /** "Don't send me text messages": stops announcement and campaign texts from officers. */
  announcementSmsOptOut: boolean;
  announcementInApp: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
}
