import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'SocietyLedger Terms of Service - User agreement, acceptable use policy, and service terms for our association management platform.',
  keywords: ['terms of service', 'user agreement', 'terms and conditions', 'service agreement'],
  openGraph: {
    title: 'Terms of Service | SocietyLedger',
    description: 'SocietyLedger Terms of Service and user agreement.',
    url: 'https://societyledger.com.ng/terms',
    type: 'website',
  },
  alternates: {
    canonical: 'https://societyledger.com.ng/terms',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
