'use client';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { TenantProvider } from '@/contexts/TenantContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export function Providers({ children }: { children: React.ReactNode }) {
  // Create a client that won't be shared between requests
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TenantProvider>
          <MantineProvider>
            <ModalsProvider>
              <Notifications />
              {children}
            </ModalsProvider>
          </MantineProvider>
        </TenantProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}