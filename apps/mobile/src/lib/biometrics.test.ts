import * as LocalAuthentication from 'expo-local-authentication';

import { authenticateWithDevice, isBiometricAuthAvailable } from './biometrics';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

describe('isBiometricAuthAvailable', () => {
  afterEach(() => jest.clearAllMocks());

  it('is false when there is no biometric hardware', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);
    expect(await isBiometricAuthAvailable()).toBe(false);
    expect(LocalAuthentication.isEnrolledAsync).not.toHaveBeenCalled();
  });

  it('is false when hardware exists but nothing is enrolled', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);
    expect(await isBiometricAuthAvailable()).toBe(false);
  });

  it('is true when hardware exists and something is enrolled', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    expect(await isBiometricAuthAvailable()).toBe(true);
  });
});

describe('authenticateWithDevice', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns success:true on a successful prompt, no error field', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
    expect(await authenticateWithDevice('Confirm')).toEqual({ success: true });
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: 'Confirm',
      disableDeviceFallback: false,
      cancelLabel: undefined,
    });
  });

  it('returns success:false with the error code when the prompt fails or is cancelled', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false, error: 'user_cancel' });
    expect(await authenticateWithDevice('Confirm')).toEqual({ success: false, error: 'user_cancel' });
  });
});
