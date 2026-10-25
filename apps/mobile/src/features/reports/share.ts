import { File, Paths } from 'expo-file-system';

import type { ExportFormat } from '@/types/api/reports';
import { MIME_BY_FORMAT, safeFilename } from './labels';

/**
 * Save a downloaded export in the phone's cache and open the share sheet on it. The cache is cleared by the system when it needs the
 * space, so nothing stays on the phone for ever; a file is downloaded again the next time it is shared.
 *
 * `expo-sharing` is a native module, so a phone running a build made before it was added doesn't have it. It is loaded here, when
 * someone shares, rather than when the app starts, so such a build still opens and only this one action says it needs the new version.
 */
export async function saveAndShare(filename: string, bytes: ArrayBuffer, format: ExportFormat): Promise<void> {
  let Sharing: typeof import('expo-sharing');
  try {
    Sharing = await import('expo-sharing');
    if (!(await Sharing.isAvailableAsync())) throw new Error('unavailable');
  } catch {
    throw new Error('Sharing needs the latest version of the app. Update the app, then try again.');
  }

  const file = new File(Paths.cache, safeFilename(filename));
  if (file.exists) file.delete();
  file.create();
  await file.write(new Uint8Array(bytes));
  await Sharing.shareAsync(file.uri, { mimeType: MIME_BY_FORMAT[format], dialogTitle: filename });
}
