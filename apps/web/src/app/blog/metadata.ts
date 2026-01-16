import { Metadata } from 'next';

export function generateBlogMetadata(): Metadata {
  const baseUrl = 'https://societyledger.com.ng';

  return {
    title: 'Blog - SocietyLedger',
    description: 'Tips, guides, and insights on association management, cooperative finance, and community leadership.',
    keywords: ['association management', 'cooperative finance', 'community leadership', 'financial management'],
    openGraph: {
      title: 'Blog - SocietyLedger',
      description: 'Tips, guides, and insights on association management, cooperative finance, and community leadership.',
      url: `${baseUrl}/blog`,
      siteName: 'SocietyLedger',
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Blog - SocietyLedger',
      description: 'Tips, guides, and insights on association management, cooperative finance, and community leadership.',
    },
    alternates: {
      canonical: `${baseUrl}/blog`,
    },
  };
}
