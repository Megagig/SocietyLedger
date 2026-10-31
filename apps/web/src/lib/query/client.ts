import axios from 'axios';
import { createQueryClient } from '@societyledger/query';

/**
 * A failed read is worth trying again only when nothing reached the server's logic: no response at all (network, timeout) or a server/gateway
 * error. A 4xx (not signed in, not allowed, not found, invalid) would fail the same way again. Writes are never retried by the cache.
 */
export function isRetryableRead(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  const status = error.response.status;
  return status === 408 || status === 429 || status >= 500;
}

export const createWebQueryClient = () => createQueryClient({ isRetryable: isRetryableRead });
