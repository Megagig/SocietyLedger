import type { AxiosResponse } from 'axios';

import { ApiError } from './errors';

export type ApiSuccessEnvelope<T> = { success: true; data: T; message?: string };
export type ApiFailureEnvelope = {
  success: false;
  message: string;
  code?: string;
  error?: string;
  errors?: { path: (string | number)[]; message: string }[];
};

/**
 * architecture.md §5 — "Response passes through unwrapEnvelope → returns data or throws
 * ApiError." `client.ts`'s response interceptor already converts every non-2xx response into a
 * rejected promise carrying an `ApiError` (so most failures never reach here) — this guards the
 * rarer case of a 2xx response whose body is still `{ success: false }`.
 */
export async function unwrap<T>(responsePromise: Promise<AxiosResponse<ApiSuccessEnvelope<T> | ApiFailureEnvelope>>): Promise<T> {
  const response = await responsePromise;
  const body = response.data;

  if (!body.success) {
    throw new ApiError({ status: response.status, code: body.code, message: body.message });
  }

  return body.data;
}
