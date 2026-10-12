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
    icon: '/favicon.png',
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
