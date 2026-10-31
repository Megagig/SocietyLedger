import type { Metadata, Viewport } from 'next';
// import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Providers } from './providers';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import './globals.css';

// Temporarily using system fonts due to network issues with Google Fonts
// const inter = Inter({ 
//   subsets: ['latin'],
//   display: 'swap',
//   fallback: ['system-ui', 'arial'],
// });

const fontClass = 'font-sans'; // Uses Tailwind's default system font stack

export const metadata: Metadata = {
  metadataBase: new URL('https://societyledger.com.ng'),
  title: {
    default: 'SocietyLedger - Association Management Software',
    template: '%s | SocietyLedger',
  },
  description: 'Comprehensive financial management system for cooperatives, HOAs, clubs, town unions, and associations across Africa. Manage dues, levies, members, welfare funds, and more.',
  keywords: [
    'cooperative management software',
    'association management system',
    'HOA management Nigeria',
    'cooperative financial management',
    'member management software',
    'association accounting',
    'town union management',
    'welfare fund management',
    'African cooperative software',
    'society management',
  ],
  authors: [{ name: 'SocietyLedger Team' }],
  creator: 'SocietyLedger',
  publisher: 'SocietyLedger',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: 'https://societyledger.com.ng',
    siteName: 'SocietyLedger',
    title: 'SocietyLedger - Association Management Software',
    description: 'Comprehensive financial management system for cooperatives, HOAs, and associations across Africa.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SocietyLedger - Association Management Software',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SocietyLedger - Association Management Software',
    description: 'Comprehensive financial management system for cooperatives, HOAs, and associations across Africa.',
    images: ['/og-image.png'],
    creator: '@societyledger',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SocietyLedger',
  },
  formatDetection: {
    telephone: false,
  },
  verification: {
    // google: 'YOUR_GOOGLE_VERIFICATION_CODE', // Add after Google Search Console setup
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

// Pinch-zoom stays on (WCAG 1.4.4); inputs are 16px on phones so iOS does not zoom by itself. The status-bar colour is set from the
// app's own theme by the inline script below, not from the phone's light/dark setting.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Inline script to set theme before React hydration to prevent flash
  const themeScript = `
    (function() {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
      }
      // Browser and installed-app chrome follows the app's theme (the page defaults to dark and the user can switch it).
      var meta = document.createElement('meta');
      meta.name = 'theme-color';
      var sync = function() {
        meta.content = document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff';
      };
      sync();
      document.head.appendChild(meta);
      new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    })();
  `;

  // Organization Schema for SEO
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SocietyLedger',
    url: 'https://societyledger.com.ng',
    logo: 'https://societyledger.com.ng/icons/icon-512.png',
    description: 'Association management software for cooperatives, HOAs, and community organizations across Africa.',
    email: 'support@societyledger.com.ng',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'NG',
    },
    sameAs: [
      'https://twitter.com/societyledger',
      'https://facebook.com/societyledger',
      'https://linkedin.com/company/societyledger',
    ],
  };

  // WebSite Schema for SEO
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'SocietyLedger',
    url: 'https://societyledger.com.ng',
    description: 'Association management software for cooperatives and community organizations.',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://societyledger.com.ng/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        {/* PWA Meta Tags */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SocietyLedger" />
      </head>
      <body className={fontClass}>
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-8R6Q5WT9Z1"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-8R6Q5WT9Z1');
          `}
        </Script>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}