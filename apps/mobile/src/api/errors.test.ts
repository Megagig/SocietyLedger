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
    expect(error.accessKind).toBe('subscription');
    expect(error.message).toBe("Your association's subscription has ended. Ask your administrator to renew it.");
    expect(error.serverMessage).toBe('No active subscription.');
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

  describe('refusals because of role or plan', () => {
    const refused = (status: number, data: object) => ApiError.fromAxiosError(fakeAxiosError({ response: { status, data } as never }));

    it("a module missing from the plan (tagged in 'error', not 'code') says so, by name", () => {
      const error = refused(403, { success: false, error: 'MODULE_DISABLED', module: 'meetings', message: 'The Meetings & Attendance module is not available for your plan.' });
      expect(error.accessKind).toBe('plan');
      expect(error.code).toBe('MODULE_DISABLED');
      expect(error.module).toBe('meetings');
      expect(error.message).toBe("Meetings isn't part of your association's plan. Ask your administrator to add it.");
    });

    it('a role without the permission says so in plain words', () => {
      const error = refused(403, { success: false, message: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' });
      expect(error.accessKind).toBe('permission');
      expect(error.message).toBe("You don't have permission to do this. Ask your association administrator if you need access.");
      expect(error.serverMessage).toBe('Insufficient permissions');
    });

    it('the older permission checks that answer with a stock sentence and no code are recognised too', () => {
      expect(refused(403, { success: false, message: 'Permission denied' }).accessKind).toBe('permission');
    });

    it('a suspended association, a closed one and a full member list each have their own wording', () => {
      expect(refused(403, { code: 'ASSOCIATION_SUSPENDED', message: 'x' }).accessKind).toBe('suspended');
      expect(refused(403, { code: 'ASSOCIATION_CANCELLED', message: 'x' }).accessKind).toBe('cancelled');
      expect(refused(403, { code: 'MEMBER_LIMIT_REACHED', message: 'x' }).accessKind).toBe('limit');
    });

    it('leaves a business rule exactly as the server wrote it: a 403 that is not an access problem', () => {
      const error = refused(403, { success: false, code: 'OWN_REQUEST', message: 'This is your own request, so another officer needs to decide it.' });
      expect(error.accessKind).toBeUndefined();
      expect(error.message).toBe('This is your own request, so another officer needs to decide it.');
    });

    it('leaves other statuses alone', () => {
      expect(refused(404, { message: 'Not found' }).accessKind).toBeUndefined();
      expect(refused(500, { message: 'Boom' }).message).toBe('Boom');
    });
  });
});

describe('an error that comes back as bytes (a report file that was refused)', () => {
  const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

  it('reads the API\'s own explanation out of the bytes, so the person sees it', () => {
    const error = ApiError.fromAxiosError(
      fakeAxiosError({ response: { status: 400, data: bytes(JSON.stringify({ success: false, code: 'REPORT_TOO_LARGE_FOR_PDF', message: 'A PDF holds up to 5,000 rows and this report has 6,000. Download the CSV instead, or narrow the dates.' })) } as never }),
    );
    expect(error.status).toBe(400);
    expect(error.code).toBe('REPORT_TOO_LARGE_FOR_PDF');
    expect(error.message).toMatch(/Download the CSV instead/);
  });

  it('falls back to the plain request message when the bytes are not JSON', () => {
    const error = ApiError.fromAxiosError(fakeAxiosError({ message: 'Request failed with status code 500', response: { status: 500, data: bytes('<html>oops</html>') } as never }));
    expect(error.status).toBe(500);
    expect(error.message).toBe('Request failed with status code 500');
  });
});
