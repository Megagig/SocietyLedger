import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'SocietyLedger Privacy Policy - Learn how we collect, use, and protect your data. GDPR and data protection compliance for association management software.',
  keywords: ['privacy policy', 'data protection', 'GDPR compliance', 'user privacy'],
  openGraph: {
    title: 'Privacy Policy | SocietyLedger',
    description: 'Learn how SocietyLedger protects your data and privacy.',
    url: 'https://societyledger.com.ng/privacy',
    type: 'website',
  },
  alternates: {
    canonical: 'https://societyledger.com.ng/privacy',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
