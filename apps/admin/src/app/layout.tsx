import type { Metadata } from 'next';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@/theme/admin.css';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryProvider } from '@/lib/query-client';
import { adminTheme } from '@/theme/mantine-theme';

export const metadata: Metadata = {
  title: 'SocietyLedger Admin',
  description: 'Platform administration console',
  robots: 'noindex, nofollow',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={adminTheme} defaultColorScheme="light">
          <Notifications />
          <QueryProvider>
            {children}
          </QueryProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
