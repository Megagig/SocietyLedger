import { client } from '../client';
import type { ApiFailureEnvelope } from '../envelope';
import type { HelpArticleDTO } from '@/types/api/help';
import type {
  CreateTicketPayload,
  EscalateTicketPayload,
  ReplySuggestionDTO,
  TicketAudience,
  TicketCategorizationDTO,
  TicketDTO,
  TicketListDTO,
  TicketPriority,
  TicketResponseDTO,
  TicketStatus,
} from '@/types/api/support';

type TicketFile = { uri: string; name: string; type: string };

/** The support API answers `{ success, data }` (and `attachmentError` beside `data` when a file upload failed). */
type SupportEnvelope<T> = { success: true; data: T; attachmentError?: string } | ApiFailureEnvelope;

/** Returns `data` plus any `attachmentError` — the ticket or reply itself was saved even when its files were not. */
async function unwrapSupport<T>(request: Promise<{ data: SupportEnvelope<T> }>): Promise<{ data: T; attachmentError?: string }> {
  const { data: body } = await request;
  if (!body.success) throw new Error(body.message);
  return { data: body.data, attachmentError: body.attachmentError };
}

/** Multipart body: text fields (undefined ones skipped, in the order given) then each file under `files`. */
function multipart(fields: [string, string | number | undefined][], files: TicketFile[] | undefined): FormData {
  const form = new FormData();
  for (const [key, value] of fields) {
    if (value !== undefined && value !== '') form.append(key, String(value));
  }
  for (const file of files ?? []) {
    form.append('files', { uri: file.uri, name: file.name, type: file.type } as never);
  }
  return form;
}

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/**
 * `/support/*` — scoped server-side. A member sees only their own tickets; staff (support.view_all) see every member
 * ticket in the association; a Tier 2 ticket (audience PLATFORM) is only ever visible to the admin who opened it.
 * Attachments ride along as multipart `files` (max 3, 5MB each).
 */
export const supportApi = {
  /**
   * GET /support/tickets, newest activity first. `userId` narrows a staff member's list to tickets they opened — it is
   * ignored for everyone else, who only ever get their own. `audience: 'PLATFORM'` lists my tickets to SocietyLedger.
   */
  async listTickets(params: { audience?: TicketAudience; userId?: number } = {}): Promise<TicketListDTO> {
    const { data } = await unwrapSupport<TicketListDTO>(
      client.get('/support/tickets', { params: { sortBy: 'updatedAt', sortOrder: 'desc', limit: 100, audience: params.audience, userId: params.userId } }),
    );
    return data;
  },

  /** GET /support/tickets/:id — with replies (staff-only notes removed for non-staff) and attachments. 404 for a ticket the caller can't see. */
  async getTicket(id: number): Promise<TicketDTO> {
    const { data } = await unwrapSupport<TicketDTO>(client.get(`/support/tickets/${id}`));
    return data;
  },

  /** POST /support/tickets (multipart). The ticket exists even when `attachmentError` is set. */
  async createTicket(payload: CreateTicketPayload): Promise<{ ticket: TicketDTO; attachmentError?: string }> {
    const form = multipart(
      [
        ['subject', payload.subject],
        ['description', payload.description],
        ['category', payload.category],
        ['priority', payload.priority],
        ['aiCategory', payload.aiCategory],
        ['aiCategoryConfidence', payload.aiCategoryConfidence],
      ],
      payload.files,
    );
    const { data, attachmentError } = await unwrapSupport<TicketDTO>(client.post('/support/tickets', form, MULTIPART));
    return { ticket: data, attachmentError };
  },

  /** POST /support/platform-tickets (multipart) — an association admin's own ticket to SocietyLedger support (Tier 2). Needs support.escalate. */
  async createPlatformTicket(payload: CreateTicketPayload): Promise<{ ticket: TicketDTO; attachmentError?: string }> {
    const form = multipart(
      [
        ['subject', payload.subject],
        ['description', payload.description],
        ['category', payload.category],
        ['priority', payload.priority],
      ],
      payload.files,
    );
    const { data, attachmentError } = await unwrapSupport<TicketDTO>(client.post('/support/platform-tickets', form, MULTIPART));
    return { ticket: data, attachmentError };
  },

  /** POST /support/tickets/:id/escalate (multipart) — opens a new Tier 2 ticket from the officer's summary; nothing of the member's ticket is shared. */
  async escalateTicket(ticketId: number, payload: EscalateTicketPayload): Promise<{ ticket: TicketDTO; attachmentError?: string }> {
    const form = multipart(
      [
        ['subject', payload.subject],
        ['summary', payload.summary],
        ['category', payload.category],
        ['priority', payload.priority],
      ],
      payload.files,
    );
    const { data, attachmentError } = await unwrapSupport<TicketDTO>(client.post(`/support/tickets/${ticketId}/escalate`, form, MULTIPART));
    return { ticket: data, attachmentError };
  },

  /** POST /support/tickets/:id/respond (multipart). `isInternal` (staff only) leaves a note the member never sees. */
  async reply(ticketId: number, message: string, files?: TicketFile[], options: { isInternal?: boolean } = {}): Promise<{ reply: TicketResponseDTO; attachmentError?: string }> {
    const form = multipart([['message', message], ['isInternal', options.isInternal === undefined ? undefined : String(options.isInternal)]], files);
    const { data, attachmentError } = await unwrapSupport<TicketResponseDTO>(client.post(`/support/tickets/${ticketId}/respond`, form, MULTIPART));
    return { reply: data, attachmentError };
  },

  /** PATCH /support/tickets/:id — staff only (support.manage): status, priority or assignee. */
  async updateTicket(id: number, body: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: number | null }): Promise<TicketDTO> {
    const { data } = await unwrapSupport<TicketDTO>(client.patch(`/support/tickets/${id}`, body));
    return data;
  },

  /** POST /support/tickets/:id/close — the caller's own ticket, or any ticket for staff (404 otherwise). */
  async closeTicket(id: number): Promise<TicketDTO> {
    const { data } = await unwrapSupport<TicketDTO>(client.post(`/support/tickets/${id}/close`));
    return data;
  },

  /** POST /support/tickets/:id/reopen — a resolved or closed ticket of the caller's (or any, for staff). */
  async reopenTicket(id: number): Promise<TicketDTO> {
    const { data } = await unwrapSupport<TicketDTO>(client.post(`/support/tickets/${id}/reopen`));
    return data;
  },

  /** GET /support/attachments/:id — a short-lived link to open one file. */
  async getAttachmentUrl(id: number): Promise<{ url: string; filename: string; mimeType: string }> {
    const { data } = await unwrapSupport<{ url: string; filename: string; mimeType: string }>(client.get(`/support/attachments/${id}`));
    return data;
  },

  /** POST /help/ai/categorize — best-effort: any failure (module off, no permission) is "no suggestion", never an error. */
  async categorize(description: string): Promise<TicketCategorizationDTO | null> {
    try {
      const { data } = await unwrapSupport<TicketCategorizationDTO>(client.post('/help/ai/categorize', { description }));
      return data.aiAvailable ? data : null;
    } catch {
      return null;
    }
  },

  /** POST /help/ai/suggest-articles — best-effort, as above. Returns up to `limit` matching help articles. */
  async suggestArticles(query: string, limit = 3): Promise<HelpArticleDTO[]> {
    try {
      const { data } = await unwrapSupport<{ suggestions: { article: HelpArticleDTO }[] }>(client.post('/help/ai/suggest-articles', { query, limit }));
      return data.suggestions.map((s) => s.article);
    } catch {
      return [];
    }
  },

  /** POST /help/ai/suggest-response — a draft reply for staff. Best-effort: null when the AI service is off or the call fails. */
  async suggestReply(ticket: { subject: string; description: string; category: string }): Promise<ReplySuggestionDTO | null> {
    try {
      const { data } = await unwrapSupport<ReplySuggestionDTO>(client.post('/help/ai/suggest-response', ticket));
      return data.suggestion ? data : null;
    } catch {
      return null;
    }
  },
};
