'use client';

import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { TenantProvider } from '@/contexts/TenantContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

// Mantine theme configuration
const mantineTheme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'md',
});

function MantineThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme, mounted } = useTheme();
  
  // Prevent Mantine portals from rendering until client is mounted
  // This fixes hydration mismatch with Portal components
  if (!mounted) {
    return (
      <MantineProvider theme={mantineTheme} forceColorScheme="dark">
        {children}
      </MantineProvider>
    );
  }
  
  return (
    <MantineProvider theme={mantineTheme} forceColorScheme={theme}>
      <ModalsProvider>
        <Notifications position="top-right" />
        {children}
      </ModalsProvider>
    </MantineProvider>
  );
}

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
          <MantineThemeWrapper>
            {children}
          </MantineThemeWrapper>
        </TenantProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}