import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { communicationApi } from '@/api/endpoints/communication';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import type {
  AnnouncementPayload,
  AudiencePreviewPayload,
  SmsCampaignStatus,
  SmsMessageStatus,
} from '@/types/api/communication';
import { ANNOUNCE_ACCESS, COMMUNICATION_MODULE, SMS_ANY_ACCESS } from './labels';

export const communicationKeys = {
  all: (tenant: string) => [tenant, 'communication'] as const,
  dashboard: (tenant: string) => [...communicationKeys.all(tenant), 'dashboard'] as const,
  balance: (tenant: string) => [...communicationKeys.all(tenant), 'balance'] as const,
  announcements: (tenant: string) => [...communicationKeys.all(tenant), 'announcements'] as const,
  announcementPreview: (tenant: string, payload: object) => [...communicationKeys.all(tenant), 'announcement-preview', payload] as const,
  audiencePreview: (tenant: string, payload: object) => [...communicationKeys.all(tenant), 'audience-preview', payload] as const,
  campaigns: (tenant: string, status: string) => [...communicationKeys.all(tenant), 'campaigns', status] as const,
  campaign: (tenant: string, id: number) => [...communicationKeys.all(tenant), 'campaign', id] as const,
  templates: (tenant: string) => [...communicationKeys.all(tenant), 'templates'] as const,
  messages: (tenant: string, status: string, campaignId: number | undefined) => [...communicationKeys.all(tenant), 'messages', status, campaignId ?? 0] as const,
  credits: (tenant: string) => [...communicationKeys.all(tenant), 'credits'] as const,
};

const PAGE = 20;

/** Seeing texts and credits: an SMS permission, and the SMS module on the plan. */
function useSmsAccess(): boolean {
  return useModuleAccess(SMS_ANY_ACCESS, COMMUNICATION_MODULE);
}

export function useSmsDashboard() {
  const tenant = useTenantKey();
  const enabled = useSmsAccess();
  return useQuery({ queryKey: communicationKeys.dashboard(tenant), queryFn: () => communicationApi.getSmsDashboard(), enabled });
}

export function useCreditBalance() {
  const tenant = useTenantKey();
  const enabled = useSmsAccess();
  return useQuery({ queryKey: communicationKeys.balance(tenant), queryFn: () => communicationApi.getBalance(), enabled });
}

export function useAnnouncementsInfinite() {
  const tenant = useTenantKey();
  const enabled = useCan(ANNOUNCE_ACCESS);
  return useInfiniteQuery({
    queryKey: communicationKeys.announcements(tenant),
    queryFn: ({ pageParam }) => communicationApi.listAnnouncements({ page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    // Texts of a big announcement carry on in the background: keep the counts moving until they stop
    refetchInterval: (query) => (query.state.data?.pages.some((p) => p.announcements.some((a) => a.status === 'SENDING')) ? 4000 : false),
    enabled,
  });
}

/** Who an announcement would reach and what its texts cost: asked for as the form is filled in, never sent. */
export function useAnnouncementPreview(payload: AnnouncementPayload | null) {
  const tenant = useTenantKey();
  const allowed = useCan(ANNOUNCE_ACCESS);
  return useQuery({
    queryKey: communicationKeys.announcementPreview(tenant, payload ?? {}),
    queryFn: () => communicationApi.previewAnnouncement(payload as AnnouncementPayload),
    enabled: allowed && payload !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** Who a text would reach and miss, and the cost, before it is sent. */
export function useAudiencePreview(payload: AudiencePreviewPayload | null) {
  const tenant = useTenantKey();
  const allowed = useSmsAccess();
  return useQuery({
    queryKey: communicationKeys.audiencePreview(tenant, payload ?? {}),
    queryFn: () => communicationApi.previewAudience(payload as AudiencePreviewPayload),
    enabled: allowed && payload !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useCampaignsInfinite(status: SmsCampaignStatus | '') {
  const tenant = useTenantKey();
  const enabled = useSmsAccess();
  return useInfiniteQuery({
    queryKey: communicationKeys.campaigns(tenant, status),
    queryFn: ({ pageParam }) => communicationApi.listCampaigns({ page: pageParam, limit: PAGE, status: status || undefined }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled,
  });
}

/** One campaign; while it is sending it is read again every few seconds so the progress moves. */
export function useCampaign(id: number) {
  const tenant = useTenantKey();
  const enabled = useSmsAccess() && Number.isFinite(id);
  return useQuery({
    queryKey: communicationKeys.campaign(tenant, id),
    queryFn: () => communicationApi.getCampaign(id),
    refetchInterval: (query) => (query.state.data?.status === 'IN_PROGRESS' ? 3000 : false),
    enabled,
  });
}

export function useTemplatesInfinite() {
  const tenant = useTenantKey();
  const enabled = useSmsAccess();
  return useInfiniteQuery({
    queryKey: communicationKeys.templates(tenant),
    queryFn: ({ pageParam }) => communicationApi.listTemplates({ page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled,
  });
}

export function useMessagesInfinite(status: SmsMessageStatus | '', campaignId?: number) {
  const tenant = useTenantKey();
  const enabled = useSmsAccess();
  return useInfiniteQuery({
    queryKey: communicationKeys.messages(tenant, status, campaignId),
    queryFn: ({ pageParam }) => communicationApi.listMessages({ page: pageParam, limit: PAGE, status: status || undefined, campaignId }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled,
  });
}

export function useCreditHistoryInfinite() {
  const tenant = useTenantKey();
  const enabled = useSmsAccess();
  return useInfiniteQuery({
    queryKey: communicationKeys.credits(tenant),
    queryFn: ({ pageParam }) => communicationApi.getCreditHistory({ page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled,
  });
}
