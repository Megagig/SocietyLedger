import { useCallback } from 'react';
import { toast } from 'sonner-native';

import { authenticateWithDevice } from '@/lib/biometrics';
import { t, type TranslationKey } from '@/lib/i18n';

/** Error codes `expo-local-authentication` returns when the device has nothing configured to
 * authenticate with at all (neither biometrics nor a passcode) — distinct from an ordinary user
 * cancellation, which isn't worth surfacing as an error. */
const NOTHING_ENROLLED_ERRORS = new Set(['not_enrolled', 'passcode_not_set']);

/**
 * architecture.md §7.5 — re-auth before a sensitive action (casting a vote, void-and-replace,
 * deleting transactions, disbursing loans/welfare, posting journal entries — none built yet;
 * this is the reusable primitive those features will call). Independent of the `prefs.ts`
 * app-lock *toggle*: `authenticateAsync`'s own `disableDeviceFallback: false` already prompts
 * biometrics-or-device-passcode regardless of whether the user opted into app lock.
 *
 * **Simplified from library-docs.md's note** ("if none set, shows password confirm sheet"): a
 * device with no biometrics enrolled *and* no passcode set is rare, and no real sensitive-action
 * screen exists yet to validate a global confirm-sheet singleton against — resolves `false` with
 * an explanatory toast instead. Revisit with a real confirm-sheet fallback when the first actual
 * caller (F3.5's ballot, most likely) lands.
 */
export function useReauth() {
  return useCallback(async (reasonKey: TranslationKey): Promise<boolean> => {
    const result = await authenticateWithDevice(t(reasonKey), t('common.cancel'));
    if (result.success) return true;

    if (result.error && NOTHING_ENROLLED_ERRORS.has(result.error)) {
      toast.error(t('auth.reauth.noDeviceAuth'));
    }
    return false;
  }, []);
}
