import type { AxiosError } from 'axios';

import { ApiError } from './errors';

function fakeAxiosError(overrides: Partial<AxiosError>): AxiosError {
  return { isAxiosError: true, toJSON: () => ({}), name: 'AxiosError', message: 'Request failed', ...overrides } as AxiosError;
}

describe('ApiError.fromAxiosError', () => {
  it('maps a network error (no response) to isNetwork: true', () => {
    const error = ApiError.fromAxiosError(fakeAxiosError({ code: 'ERR_NETWORK' }));
    expect(error.isNetwork).toBe(true);
    expect(error.isTimeout).toBe(false);
    expect(error.status).toBe(0);
  });

  it('maps a timeout (ECONNABORTED) to isTimeout: true', () => {
    const error = ApiError.fromAxiosError(fakeAxiosError({ code: 'ECONNABORTED' }));
    expect(error.isTimeout).toBe(true);
    expect(error.isNetwork).toBe(false);
  });

  it('carries the real status/code/message from the response body', () => {
    const error = ApiError.fromAxiosError(
      fakeAxiosError({
        response: { status: 403, data: { success: false, code: 'SUBSCRIPTION_INACTIVE', message: 'No active subscription.' } } as never,
      }),
    );
    expect(error.status).toBe(403);
    expect(error.code).toBe('SUBSCRIPTION_INACTIVE');
    expect(error.message).toBe('No active subscription.');
    expect(error.isNetwork).toBe(false);
  });

  it('maps Zod errors[] to fieldErrors', () => {
    const error = ApiError.fromAxiosError(
      fakeAxiosError({
        response: {
          status: 400,
          data: { success: false, message: 'Validation failed', errors: [{ path: ['email'], message: 'Invalid email' }] },
        } as never,
      }),
    );
    expect(error.fieldErrors).toEqual([{ path: ['email'], message: 'Invalid email' }]);
  });

  it('falls back to the axios message when the response has no message field', () => {
    const error = ApiError.fromAxiosError(fakeAxiosError({ message: 'Request failed with status code 500', response: { status: 500, data: {} } as never }));
    expect(error.message).toBe('Request failed with status code 500');
  });
});
