import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with SocietyLedger. Contact our support team for demos, questions, or assistance with your association management needs. We respond within 24 hours.',
  keywords: [
    'contact societyledger',
    'association management support',
    'cooperative software help',
    'customer support Nigeria',
  ],
  openGraph: {
    title: 'Contact Us | SocietyLedger',
    description: 'Get in touch with SocietyLedger support team. We respond within 24 hours.',
    url: 'https://societyledger.com.ng/contact',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Contact Us | SocietyLedger',
    description: 'Get in touch with SocietyLedger support team.',
  },
  alternates: {
    canonical: 'https://societyledger.com.ng/contact',
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
