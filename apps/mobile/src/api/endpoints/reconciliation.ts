import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  ApplyMatchesDTO,
  MatchDecisionDTO,
  MatchRequest,
  ReconciliationListDTO,
  ReconciliationStatus,
  StatementEntryListDTO,
  StatementImportListDTO,
  StatementImportResultDTO,
  StatementPreviewDTO,
  StatementUploadPayload,
  SuggestionsDTO,
} from '@/types/api/reconciliation';

/**
 * Bank statement import and reconciliation for officers. Import needs `ledger.create`; matching, confirming and disputing need
 * `payments.approve`; reading needs `ledger.view`. The server reads the file (CSV or Excel), so the phone only uploads it.
 * Rule failures come back as 400/403/404/409 with a plain-words `message` and a `code` — show the message as it is.
 */

function uploadForm(payload: StatementUploadPayload): FormData {
  const form = new FormData();
  form.append('bankAccountId', String(payload.bankAccountId));
  if (payload.mapping) form.append('mapping', JSON.stringify(payload.mapping));
  if (payload.headerRow !== undefined) form.append('headerRow', String(payload.headerRow));
  form.append('file', { uri: payload.file.uri, name: payload.file.name, type: payload.file.type } as never);
  return form;
}

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 };

export const reconciliationApi = {
  /** POST /payments/nigerian/import-statement/preview — how the file was read and what would be added. Saves nothing. */
  async previewStatement(payload: StatementUploadPayload): Promise<StatementPreviewDTO> {
    return unwrap<StatementPreviewDTO>(client.post('/payments/nigerian/import-statement/preview', uploadForm(payload), MULTIPART));
  },

  /** POST /payments/nigerian/import-statement — saves the new lines. 409 NOTHING_NEW when every line was imported before. */
  async importStatement(payload: StatementUploadPayload): Promise<StatementImportResultDTO> {
    return unwrap<StatementImportResultDTO>(client.post('/payments/nigerian/import-statement', uploadForm(payload), MULTIPART));
  },

  async listImports(params: { page: number; limit: number }): Promise<StatementImportListDTO> {
    return unwrap<StatementImportListDTO>(client.get('/payments/nigerian/statement-imports', { params }));
  },

  /** Money-in lines still waiting for a charge. */
  async listUnmatchedLines(params: { page: number; limit: number }): Promise<StatementEntryListDTO> {
    return unwrap<StatementEntryListDTO>(client.get('/payments/nigerian/statement-entries', { params: { ...params, matchStatus: 'UNMATCHED', creditsOnly: true } }));
  },

  /** GET /payments/nigerian/reconciliation/suggestions — each unmatched line with the charge it most likely paid. */
  async getSuggestions(): Promise<SuggestionsDTO> {
    return unwrap<SuggestionsDTO>(client.get('/payments/nigerian/reconciliation/suggestions'));
  },

  /** POST /payments/nigerian/auto-match/apply — proposes each match; one that can't be made says why and the others still go. */
  async applyMatches(matches: MatchRequest[]): Promise<ApplyMatchesDTO> {
    return unwrap<ApplyMatchesDTO>(client.post('/payments/nigerian/auto-match/apply', { matches }));
  },

  /** POST /payments/nigerian/reconcile — one match chosen by hand. 409 ALREADY_MATCHED, LINE_TOO_LARGE, CHARGE_NOT_OPEN. */
  async proposeMatch(match: MatchRequest): Promise<{ id: number }> {
    return unwrap<{ id: number }>(client.post('/payments/nigerian/reconcile', { ...match, matchType: 'MANUAL' }));
  },

  async listMatches(params: { status: ReconciliationStatus; page: number; limit: number }): Promise<ReconciliationListDTO> {
    return unwrap<ReconciliationListDTO>(client.get('/payments/nigerian/reconciliations', { params }));
  },

  /** POST /payments/nigerian/reconciliations/:id/confirm — CONFIRMED records the payment; DISPUTED frees the line. 403 OWN_MATCH. */
  async decideMatch(id: number, status: 'CONFIRMED' | 'DISPUTED', notes?: string): Promise<MatchDecisionDTO> {
    return unwrap<MatchDecisionDTO>(client.post(`/payments/nigerian/reconciliations/${id}/confirm`, { status, notes }));
  },
};
