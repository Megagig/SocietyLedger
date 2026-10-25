type LocalAuthModule = typeof import('expo-local-authentication');

export type AuthenticateResult = { success: boolean; error?: string };

/** Resolved on first call rather than at module scope. `expo-local-authentication` calls
 * `requireNativeModule` while its own module body evaluates, which throws outright when the
 * native module is absent (Expo Go, or a dev build cut before the package was added). A
 * top-level import would propagate that throw to every screen that transitively imports this
 * file, leaving them blank. */
function loadLocalAuth(): LocalAuthModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication') as LocalAuthModule;
  } catch {
    return null;
  }
}

/** library-docs.md's expo-local-authentication note — check before ever offering the opt-in
 * toggle (no point asking if the device can't do it). */
export async function isBiometricAuthAvailable(): Promise<boolean> {
  const LocalAuthentication = loadLocalAuth();
  if (!LocalAuthentication) return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

/** `disableDeviceFallback: false` — lets the OS fall back to the device passcode/pattern when
 * biometrics fail or aren't enrolled, per library-docs.md. Returns `error` too (not just a plain
 * boolean) — `useReauth()` needs to tell "nothing is enrolled on this device at all" (error code
 * `'not_enrolled'`/`'passcode_not_set'`, in practice from the OS layer) apart from an ordinary
 * user cancellation, which isn't an error worth surfacing. */
export async function authenticateWithDevice(promptMessage: string, cancelLabel?: string): Promise<AuthenticateResult> {
  const LocalAuthentication = loadLocalAuth();
  if (!LocalAuthentication) return { success: false, error: 'not_available' };
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false,
      cancelLabel,
    });
    return result.success ? { success: true } : { success: false, error: result.error };
  } catch {
    return { success: false, error: 'not_available' };
  }
}
