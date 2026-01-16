import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about SocietyLedger - our mission to empower African associations with modern financial management tools. Discover our story, values, and impact across Nigeria.',
  keywords: [
    'about societyledger',
    'association management company',
    'cooperative software Nigeria',
    'our mission',
  ],
  openGraph: {
    title: 'About Us | SocietyLedger',
    description: 'Learn about SocietyLedger and our mission to empower African associations.',
    url: 'https://societyledger.com.ng/about',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'About Us | SocietyLedger',
    description: 'Learn about SocietyLedger and our mission.',
  },
  alternates: {
    canonical: 'https://societyledger.com.ng/about',
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
