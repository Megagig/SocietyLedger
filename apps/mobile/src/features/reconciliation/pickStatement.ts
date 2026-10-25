import * as DocumentPicker from 'expo-document-picker';

import type { StatementFile } from '@/types/api/reconciliation';
import { isStatementFile, statementMime } from './labels';

export const STATEMENT_MAX_BYTES = 5 * 1024 * 1024;

/** `null` means the officer cancelled; an `error` is plain wording to show. */
export type StatementPick = { file: StatementFile } | { error: string } | null;

/**
 * Opens the phone's file picker for a bank statement (CSV or Excel). Any file can be chosen in the picker, since phones disagree
 * about what a statement's type is called; the name and size are checked here, and the server checks what is really inside.
 */
export async function pickStatement(): Promise<StatementPick> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return null;
    if (!isStatementFile(asset.name)) return { error: 'Choose a CSV or Excel (.xlsx) statement. PDF statements can’t be read reliably.' };
    if (asset.size && asset.size > STATEMENT_MAX_BYTES) return { error: 'That file is larger than 5 MB.' };
    return { file: { uri: asset.uri, name: asset.name, type: statementMime(asset.name) } };
  } catch {
    return { error: 'Could not open your files. Try again.' };
  }
}
