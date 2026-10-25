import { renderHook } from '@testing-library/react-native';

const mockAuthenticateWithDevice = jest.fn();
jest.mock('@/lib/biometrics', () => ({ authenticateWithDevice: mockAuthenticateWithDevice }));

jest.mock('sonner-native', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- must run after the jest.mock calls above
const { useReauth } = require('./useReauth');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toast } = require('sonner-native');

describe('useReauth', () => {
  beforeEach(() => {
    mockAuthenticateWithDevice.mockReset();
    (toast.error as jest.Mock).mockClear();
  });

  it('resolves true on a successful device authentication', async () => {
    mockAuthenticateWithDevice.mockResolvedValue({ success: true });
    const { result } = await renderHook(() => useReauth());

    await expect(result.current('auth.reauth.vote' as never)).resolves.toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('resolves false with no toast on an ordinary cancellation', async () => {
    mockAuthenticateWithDevice.mockResolvedValue({ success: false, error: 'user_cancel' });
    const { result } = await renderHook(() => useReauth());

    await expect(result.current('auth.reauth.vote' as never)).resolves.toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('resolves false with a toast when nothing is enrolled on the device', async () => {
    mockAuthenticateWithDevice.mockResolvedValue({ success: false, error: 'not_enrolled' });
    const { result } = await renderHook(() => useReauth());

    await expect(result.current('auth.reauth.vote' as never)).resolves.toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });
});
