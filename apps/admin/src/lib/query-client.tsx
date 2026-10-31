'use client';

import axios from 'axios';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@societyledger/query';
import { useState } from 'react';

/**
 * The same rules as the web and mobile apps (@societyledger/query): a failed read is tried again only when no answer came back or the server
 * failed, a write is never repeated by the cache. Nothing is saved on the device here, and signing out is a full page load that drops the cache.
 */
function isRetryableRead(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  const status = error.response.status;
  return status === 408 || status === 429 || status >= 500;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createQueryClient({ isRetryable: isRetryableRead, defaultStaleTime: 30_000 }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
