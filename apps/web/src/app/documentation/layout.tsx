import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Complete documentation for SocietyLedger - setup guides, feature tutorials, best practices, and API reference for association management software.',
  keywords: ['societyledger documentation', 'user guide', 'how to use', 'tutorials', 'help center'],
  openGraph: {
    title: 'Documentation | SocietyLedger',
    description: 'Complete guides and tutorials for SocietyLedger.',
    url: 'https://societyledger.com.ng/documentation',
    type: 'website',
  },
  alternates: {
    canonical: 'https://societyledger.com.ng/documentation',
  },
};

export default function DocumentationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
