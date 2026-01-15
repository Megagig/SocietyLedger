import { Metadata } from 'next';
import { generateWebPageJsonLd, generateBreadcrumbJsonLd } from '@/lib/json-ld';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SITE_URL = 'https://societyledger.com.ng';

interface DocPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  metaTitle: string | null;
  metaDescription: string | null;
  section?: {
    id: number;
    name: string;
    slug: string;
  } | null;
  author?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

export async function generateDocPageMetadata(slug: string): Promise<{
  metadata: Metadata;
  jsonLd: string;
  breadcrumbJsonLd: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/docs/pages/${slug}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error('Page not found');
    }

    const data = await response.json();
    const page: DocPage = data.data?.page;

    if (!page) {
      throw new Error('Page not found');
    }

    const title = page.metaTitle || page.title;
    const description = page.metaDescription || page.excerpt || page.content.substring(0, 160);
    const authorName = page.author
      ? `${page.author.firstName || ''} ${page.author.lastName || ''}`.trim() || page.author.email
      : 'SocietyLedger Team';
    const sectionName = page.section?.name || 'Documentation';

    // Generate metadata
    const metadata: Metadata = {
      title,
      description,
      keywords: 'documentation, help, tutorials, guides, societyledger',
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/documentation/${page.slug}`,
        siteName: 'SocietyLedger',
        type: 'website',
        locale: 'en_US',
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
      alternates: {
        canonical: `${SITE_URL}/documentation/${page.slug}`,
      },
    };

    // Generate JSON-LD
    const webpageJsonLd = generateWebPageJsonLd({
      title: page.title,
      description: page.excerpt,
      slug: page.slug,
      publishedAt: page.publishedAt || undefined,
      updatedAt: page.updatedAt,
      authorName,
    });

    // Generate breadcrumb JSON-LD
    const breadcrumbItems = [
      { name: 'Home', href: SITE_URL },
      { name: 'Documentation', href: `${SITE_URL}/documentation` },
    ];

    if (page.section) {
      breadcrumbItems.push({
        name: page.section.name,
        href: `${SITE_URL}/documentation#${page.section.slug}`,
      });
    }

    breadcrumbItems.push({
      name: page.title,
      href: `${SITE_URL}/documentation/${page.slug}`,
    });

    const breadcrumbJsonLd = generateBreadcrumbJsonLd(breadcrumbItems);

    return { metadata, jsonLd: webpageJsonLd, breadcrumbJsonLd };
  } catch (error) {
    console.error('Error generating doc page metadata:', error);

    // Fallback metadata
    const metadata: Metadata = {
      title: 'Documentation - SocietyLedger',
      description: 'Read our documentation to learn how to use SocietyLedger effectively.',
    };

    const jsonLd = generateWebPageJsonLd({
      title: 'Documentation',
      slug,
    });

    const breadcrumbJsonLd = generateBreadcrumbJsonLd([
      { name: 'Home', href: SITE_URL },
      { name: 'Documentation', href: `${SITE_URL}/documentation` },
    ]);

    return { metadata, jsonLd, breadcrumbJsonLd };
  }
}
