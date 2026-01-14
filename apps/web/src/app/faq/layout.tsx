import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions (FAQ)',
  description: 'Find answers to common questions about SocietyLedger - pricing, features, setup, integrations, security, and more. Get help with association management software.',
  keywords: [
    'societyledger faq',
    'association management questions',
    'cooperative software help',
    'pricing questions',
    'how to use societyledger',
  ],
  openGraph: {
    title: 'FAQ | SocietyLedger',
    description: 'Frequently asked questions about SocietyLedger association management software.',
    url: 'https://societyledger.com.ng/faq',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'FAQ | SocietyLedger',
    description: 'Frequently asked questions about SocietyLedger.',
  },
  alternates: {
    canonical: 'https://societyledger.com.ng/faq',
  },
};

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
