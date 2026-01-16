import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features - Complete Association Management Tools',
  description: 'Explore SocietyLedger features: member management, financial tracking, welfare funds, SMS communications, reports, elections, and more for African associations.',
  keywords: [
    'association management features',
    'cooperative software features',
    'member management tools',
    'financial tracking software',
    'welfare fund management',
    'SMS notifications',
  ],
  openGraph: {
    title: 'Features | SocietyLedger',
    description: 'Complete association management tools for cooperatives, HOAs, and community organizations.',
    url: 'https://societyledger.com.ng/features',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Features | SocietyLedger',
    description: 'Complete association management tools.',
  },
  alternates: {
    canonical: 'https://societyledger.com.ng/features',
  },
};

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
