import type { Metadata } from 'next';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryProvider } from '@/lib/query-client';

export const metadata: Metadata = {
  title: 'SocietyLedger Admin',
  description: 'Platform administration console',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider defaultColorScheme="light">
          <Notifications />
          <QueryProvider>
            {children}
          </QueryProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
