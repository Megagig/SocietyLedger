import { Metadata } from 'next';

export function generateDocumentationMetadata(): Metadata {
  const baseUrl = 'https://societyledger.com.ng';

  return {
    title: 'Documentation - SocietyLedger',
    description: 'Everything you need to know about using SocietyLedger. From setup to advanced features.',
    keywords: ['documentation', 'help', 'tutorials', 'guides', 'user manual'],
    openGraph: {
      title: 'Documentation - SocietyLedger',
      description: 'Everything you need to know about using SocietyLedger. From setup to advanced features.',
      url: `${baseUrl}/documentation`,
      siteName: 'SocietyLedger',
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Documentation - SocietyLedger',
      description: 'Everything you need to know about using SocietyLedger. From setup to advanced features.',
    },
    alternates: {
      canonical: `${baseUrl}/documentation`,
    },
  };
}
