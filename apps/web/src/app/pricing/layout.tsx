import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing Plans - Affordable Association Management',
  description: 'Transparent pricing for associations of all sizes. Start free, upgrade as you grow. Plans for cooperatives, HOAs, and town unions. No hidden fees.',
  keywords: [
    'societyledger pricing',
    'association management pricing',
    'cooperative software cost',
    'HOA management pricing Nigeria',
    'affordable association software',
  ],
  openGraph: {
    title: 'Pricing | SocietyLedger',
    description: 'Transparent pricing for associations of all sizes. Start free, upgrade as you grow.',
    url: 'https://societyledger.com.ng/pricing',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Pricing | SocietyLedger',
    description: 'Transparent pricing for associations of all sizes.',
  },
  alternates: {
    canonical: 'https://societyledger.com.ng/pricing',
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
