import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { Provider } from '@/components/provider';
import { Footer } from '@/components/layout/footer';
import { Analytics } from '@/components/analytics';
import { siteUrl } from '@/lib/shared';
import './global.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={manrope.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Analytics />
        <Provider>
          {children}
          <Footer />
        </Provider>
      </body>
    </html>
  );
}
