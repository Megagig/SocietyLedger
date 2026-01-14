import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'SocietyLedger blog - Tips, guides, and insights on association management, cooperative finance, community leadership, and digital transformation in Africa.',
  keywords: ['association management blog', 'cooperative tips', 'HOA management guide', 'community leadership'],
  openGraph: {
    title: 'Blog | SocietyLedger',
    description: 'Tips and insights on association management.',
    url: 'https://societyledger.com.ng/blog',
    type: 'website',
  },
  alternates: {
    canonical: 'https://societyledger.com.ng/blog',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
