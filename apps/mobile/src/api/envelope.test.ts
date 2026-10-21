import type { AxiosResponse } from 'axios';

import { unwrap } from './envelope';

function fakeResponse<T>(data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: 'OK', headers: {}, config: {} as never };
}

describe('unwrap', () => {
  it('returns the inner data on a success envelope', async () => {
    const result = await unwrap(Promise.resolve(fakeResponse({ success: true as const, data: { id: 1 } })));
    expect(result).toEqual({ id: 1 });
  });

  it('throws an ApiError when the body is success: false (2xx-with-failure edge case)', async () => {
    await expect(unwrap(Promise.resolve(fakeResponse({ success: false as const, message: 'Unexpected', code: 'WEIRD' })))).rejects.toMatchObject({
      message: 'Unexpected',
      code: 'WEIRD',
    });
  });
});
