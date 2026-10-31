'use client';

import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { TenantProvider } from '@/contexts/TenantContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { QueryBoundary } from '@/lib/query';

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
  // One query client per signed-in identity, so nothing cached for one person or association can reach another (lib/query/QueryBoundary.tsx).
  return (
    <QueryBoundary>
      <ThemeProvider>
        <TenantProvider>
          <MantineThemeWrapper>
            {children}
          </MantineThemeWrapper>
        </TenantProvider>
      </ThemeProvider>
    </QueryBoundary>
  );
}
