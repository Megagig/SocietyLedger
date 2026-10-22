import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supportApi } from '@/api/endpoints/support';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';
import { useSessionStore } from '@/stores/session';
import type { CreateTicketPayload, EscalateTicketPayload, TicketPriority, TicketStatus } from '@/types/api/support';

export const supportKeys = {
  all: (tenant: string) => [tenant, 'support'] as const,
  tickets: (tenant: string) => [...supportKeys.all(tenant), 'tickets'] as const,
  list: (tenant: string, scope: string) => [...supportKeys.tickets(tenant), scope] as const,
  ticket: (tenant: string, id: number) => [...supportKeys.all(tenant), 'ticket', id] as const,
  suggestions: (tenant: string, text: string) => [...supportKeys.all(tenant), 'suggestions', text] as const,
};

/** Seeing your own tickets / opening one. Members hold both; the API enforces the same keys. */
export const SUPPORT_VIEW_ACCESS: PermissionAlias[] = ['SUPPORT_VIEW_OWN', 'SUPPORT_VIEW_ALL'];
export const SUPPORT_CREATE_ACCESS: PermissionAlias = 'SUPPORT_CREATE';
/** Working every member ticket in the association — the association's admins and officers. */
export const SUPPORT_STAFF_ACCESS: PermissionAlias = 'SUPPORT_VIEW_ALL';
/** Contacting SocietyLedger support, and escalating a member ticket to it (Tier 2). */
export const SUPPORT_ESCALATE_ACCESS: PermissionAlias = 'SUPPORT_ESCALATE';

export function useCanViewTickets(): boolean {
  return useCan(SUPPORT_VIEW_ACCESS);
}

/** The tickets I opened as a member (Tier 1). Staff pass their own id so they don't get everyone's here. */
export function useMyTickets() {
  const tenant = useTenantKey();
  const enabled = useCanViewTickets();
  const userId = useSessionStore((s) => s.user?.id);
  return useQuery({
    queryKey: supportKeys.list(tenant, `mine:${userId ?? 'none'}`),
    queryFn: () => supportApi.listTickets({ userId }),
    enabled: enabled && userId !== undefined,
  });
}

/** The tickets I opened to SocietyLedger support (Tier 2). Only the admin who opened a Tier 2 ticket can list it. */
export function useMyPlatformTickets() {
  const tenant = useTenantKey();
  const enabled = useCan(SUPPORT_ESCALATE_ACCESS);
  return useQuery({
    queryKey: supportKeys.list(tenant, 'platform'),
    queryFn: () => supportApi.listTickets({ audience: 'PLATFORM' }),
    enabled,
  });
}

/** Every member ticket in the association — for staff with support.view_all. */
export function useStaffTickets() {
  const tenant = useTenantKey();
  const enabled = useCan(SUPPORT_STAFF_ACCESS);
  return useQuery({
    queryKey: supportKeys.list(tenant, 'staff'),
    queryFn: () => supportApi.listTickets(),
    enabled,
    refetchInterval: 60_000,
  });
}

/** One ticket with its thread. Polls while the ticket is open, so a reply shows up without leaving the screen. */
export function useTicket(id: number) {
  const tenant = useTenantKey();
  const enabled = useCanViewTickets() && Number.isFinite(id);
  return useQuery({
    queryKey: supportKeys.ticket(tenant, id),
    queryFn: () => supportApi.getTicket(id),
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && status !== 'CLOSED' && status !== 'RESOLVED' ? 20_000 : false;
    },
  });
}

/** Article suggestions + a category guess while the member types (pass an already-debounced description of 20+ characters). */
export function useTicketAssist(description: string, enabled: boolean) {
  const tenant = useTenantKey();
  const text = description.trim();
  return useQuery({
    queryKey: supportKeys.suggestions(tenant, text),
    queryFn: async () => {
      const [articles, categorization] = await Promise.all([supportApi.suggestArticles(text, 3), supportApi.categorize(text)]);
      return { articles, categorization };
    },
    enabled: enabled && text.length >= 20,
    staleTime: 5 * 60 * 1000,
  });
}

function useInvalidateSupport() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return (ticketId?: number) => {
    queryClient.invalidateQueries({ queryKey: supportKeys.tickets(tenant) });
    if (ticketId !== undefined) queryClient.invalidateQueries({ queryKey: supportKeys.ticket(tenant, ticketId) });
  };
}

export function useCreateTicket() {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: (payload: CreateTicketPayload) => supportApi.createTicket(payload),
    onSuccess: () => invalidate(),
  });
}

/** An association admin's own ticket to SocietyLedger (Tier 2). */
export function useCreatePlatformTicket() {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: (payload: CreateTicketPayload) => supportApi.createPlatformTicket(payload),
    onSuccess: () => invalidate(),
  });
}

/** An officer escalating a member ticket — opens a new Tier 2 ticket; the member's ticket gets a staff-only note. */
export function useEscalateTicket(ticketId: number) {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: (payload: EscalateTicketPayload) => supportApi.escalateTicket(ticketId, payload),
    onSuccess: () => invalidate(ticketId),
  });
}

export function useReplyToTicket(ticketId: number) {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: ({ message, files, isInternal }: { message: string; files?: { uri: string; name: string; type: string }[]; isInternal?: boolean }) =>
      supportApi.reply(ticketId, message, files, { isInternal }),
    onSuccess: () => invalidate(ticketId),
  });
}

/** Staff: change status, priority or assignee. */
export function useUpdateTicket(ticketId: number) {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: (body: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: number | null }) => supportApi.updateTicket(ticketId, body),
    onSuccess: () => invalidate(ticketId),
  });
}

export function useCloseTicket(ticketId: number) {
  const invalidate = useInvalidateSupport();
  return useMutation({ mutationFn: () => supportApi.closeTicket(ticketId), onSuccess: () => invalidate(ticketId) });
}

export function useReopenTicket(ticketId: number) {
  const invalidate = useInvalidateSupport();
  return useMutation({ mutationFn: () => supportApi.reopenTicket(ticketId), onSuccess: () => invalidate(ticketId) });
}

/** A draft reply for staff from the AI service — null when it is off or fails. */
export function useReplySuggestion() {
  return useMutation({ mutationFn: (ticket: { subject: string; description: string; category: string }) => supportApi.suggestReply(ticket) });
}
