import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  AssociationProfileDTO,
  AssociationProfilePayload,
  FinancialSettingsDTO,
  IntegrationsSettingsDTO,
  MembersAccessSettingsDTO,
  MyModulesDTO,
  NotificationsSettingsDTO,
  PaymentsSettingsDTO,
  SubscriptionDTO,
} from '@/types/api/settings';

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/**
 * Association settings. Reading needs `settings.view`; saving needs `settings.edit` (payments also accepts `settings.billing`).
 * The server saves only keys it knows and answers 400 `INVALID_SETTINGS` in plain words for anything else.
 */
export const settingsApi = {
  /** GET /settings/association/profile — name, colour and contact details; the logo is a path under /uploads. */
  async getProfile(): Promise<AssociationProfileDTO> {
    return unwrap<AssociationProfileDTO>(client.get('/settings/association/profile'));
  },

  async updateProfile(payload: AssociationProfilePayload): Promise<AssociationProfileDTO> {
    return unwrap<AssociationProfileDTO>(client.patch('/settings/association/profile', payload));
  },

  /** POST /settings/association/logo (multipart `logo`; JPEG, PNG or WebP up to 2MB, checked on the server by its real contents). */
  async uploadLogo(file: { uri: string; name: string; type: string }): Promise<{ logoUrl: string }> {
    const form = new FormData();
    form.append('logo', { uri: file.uri, name: file.name, type: file.type } as never);
    return unwrap<{ logoUrl: string }>(client.post('/settings/association/logo', form, MULTIPART));
  },

  async deleteLogo(): Promise<unknown> {
    return unwrap<unknown>(client.delete('/settings/association/logo'));
  },

  async getFinancial(): Promise<FinancialSettingsDTO> {
    return unwrap<FinancialSettingsDTO>(client.get('/settings/financial'));
  },

  async updateFinancial(payload: Partial<FinancialSettingsDTO>): Promise<FinancialSettingsDTO> {
    return unwrap<FinancialSettingsDTO>(client.patch('/settings/financial', payload));
  },

  async getPayments(): Promise<PaymentsSettingsDTO> {
    return unwrap<PaymentsSettingsDTO>(client.get('/settings/payments'));
  },

  async updatePayments(payload: Partial<PaymentsSettingsDTO>): Promise<PaymentsSettingsDTO> {
    return unwrap<PaymentsSettingsDTO>(client.patch('/settings/payments', payload));
  },

  /** GET /settings/integrations — only whether Paystack, Nomba and texting are switched on; keys are never shown. */
  async getIntegrations(): Promise<IntegrationsSettingsDTO> {
    return unwrap<IntegrationsSettingsDTO>(client.get('/settings/integrations'));
  },

  async getNotifications(): Promise<NotificationsSettingsDTO> {
    return unwrap<NotificationsSettingsDTO>(client.get('/settings/notifications'));
  },

  async updateNotifications(payload: Partial<NotificationsSettingsDTO>): Promise<NotificationsSettingsDTO> {
    return unwrap<NotificationsSettingsDTO>(client.patch('/settings/notifications', payload));
  },

  async getMembersAccess(): Promise<MembersAccessSettingsDTO> {
    return unwrap<MembersAccessSettingsDTO>(client.get('/settings/members_access'));
  },

  async updateMembersAccess(payload: Partial<MembersAccessSettingsDTO>): Promise<MembersAccessSettingsDTO> {
    return unwrap<MembersAccessSettingsDTO>(client.patch('/settings/members_access', payload));
  },

  /** GET /subscriptions/current — 404 when there is no active plan. Needs settings.view or settings.billing. */
  async getSubscription(): Promise<SubscriptionDTO> {
    return unwrap<SubscriptionDTO>(client.get('/subscriptions/current'));
  },

  /** GET /modules/mine — which modules this plan includes. */
  async getMyModules(): Promise<MyModulesDTO> {
    return unwrap<MyModulesDTO>(client.get('/modules/mine'));
  },
};
