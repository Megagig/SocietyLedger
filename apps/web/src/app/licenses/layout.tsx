import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Open-Source Licences',
  description: 'The open-source software SocietyLedger is built with, and the licences it is used under.',
  keywords: ['open source licences', 'third-party software', 'software licences', 'attributions'],
  openGraph: {
    title: 'Open-Source Licences | SocietyLedger',
    description: 'The open-source software SocietyLedger is built with, and the licences it is used under.',
    url: 'https://societyledger.com.ng/licenses',
    type: 'website',
  },
  alternates: {
    canonical: 'https://societyledger.com.ng/licenses',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LicensesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
