import type { PermissionAlias } from '@/lib/permissions';
import type { ColumnKey, ColumnMapping, MatchRequest, ReconciliationStatus, SuggestionDTO } from '@/types/api/reconciliation';

/** Importing a statement (`ledger.create`). */
export const RECON_IMPORT_ACCESS: PermissionAlias = 'LEDGER_CREATE';
/** Matching, confirming and disputing (`payments.approve`). */
export const RECON_DECIDE_ACCESS: PermissionAlias = 'FINANCE_APPROVE';
/** Reading imports, lines and matches (`ledger.view`). */
export const RECON_VIEW_ACCESS: PermissionAlias = 'FINANCE_VIEW';
export const RECON_ANY_ACCESS: PermissionAlias[] = ['FINANCE_VIEW', 'LEDGER_CREATE', 'FINANCE_APPROVE'];

export const STATUS_LABELS: Record<ReconciliationStatus, string> = { PENDING: 'To confirm', CONFIRMED: 'Confirmed', DISPUTED: 'Turned down' };
const STATUS_KEYS: Record<ReconciliationStatus, string> = { PENDING: 'pending', CONFIRMED: 'confirmed', DISPUTED: 'rejected' };
export const matchStatusKey = (s: ReconciliationStatus): string => STATUS_KEYS[s];

/** How sure a suggestion is, in words. */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 90) return 'Very likely';
  if (confidence >= 60) return 'Likely';
  return 'Possible';
}

/** The columns an officer can choose for, in the order they appear in the choices. */
export const COLUMN_CHOICES: { key: ColumnKey; label: string; required?: boolean }[] = [
  { key: 'date', label: 'Date', required: true },
  { key: 'description', label: 'Description', required: true },
  { key: 'credit', label: 'Money in (credit)' },
  { key: 'debit', label: 'Money out (debit)' },
  { key: 'amount', label: 'One amount column' },
  { key: 'reference', label: 'Reference' },
  { key: 'balance', label: 'Balance' },
];

/** The value the "none" choice has in a column dropdown. */
export const NO_COLUMN = '-';

/** Turns the dropdown choices ("3", "-") back into a mapping of column positions. */
export function mappingFromChoices(choices: Partial<Record<ColumnKey, string>>): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const [key, value] of Object.entries(choices) as [ColumnKey, string][]) {
    if (value !== undefined && value !== NO_COLUMN && value !== '') mapping[key] = Number(value);
  }
  return mapping;
}

export function choicesFromMapping(mapping: ColumnMapping): Partial<Record<ColumnKey, string>> {
  const choices: Partial<Record<ColumnKey, string>> = {};
  for (const { key } of COLUMN_CHOICES) choices[key] = mapping[key] === undefined ? NO_COLUMN : String(mapping[key]);
  return choices;
}

/** The suggestions ticked when the screen opens: only the ones the server says are confident enough. */
export function recommendedKeys(suggestions: SuggestionDTO[]): string[] {
  return suggestions.filter((s) => s.recommended).map(suggestionKey);
}

export const suggestionKey = (s: SuggestionDTO): string => `${s.source}:${s.statementEntryId ?? s.bankTransferId}:${s.transactionId}`;

export function toMatchRequest(s: SuggestionDTO): MatchRequest {
  return {
    transactionId: s.transactionId,
    ...(s.statementEntryId ? { statementEntryId: s.statementEntryId } : {}),
    ...(s.bankTransferId ? { bankTransferId: s.bankTransferId } : {}),
    confidence: s.confidence,
    matchType: s.matchType,
  };
}

/** A statement file is CSV or Excel (.xlsx), judged by its name. */
export function isStatementFile(name: string): boolean {
  return /\.(csv|txt|xlsx)$/i.test(name);
}

/** The MIME type to send for a picked file, from its name (phones often report a wrong or empty one). */
export function statementMime(name: string): string {
  return /\.xlsx$/i.test(name) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv';
}
