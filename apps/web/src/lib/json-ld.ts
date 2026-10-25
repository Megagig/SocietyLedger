export interface ArticleJsonLd {
  '@type': 'Article';
  headline: string;
  image?: string[];
  datePublished: string;
  dateModified?: string;
  author: {
    '@type': 'Person';
    name: string;
  };
  publisher: {
    '@type': 'Organization';
    name: string;
    logo?: string;
  };
  description?: string;
  url?: string;
}

export interface BreadcrumbJsonLd {
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item?: string;
  }>;
}

export interface WebPageJsonLd {
  '@type': 'WebPage';
  name: string;
  description?: string;
  url?: string;
  datePublished?: string;
  dateModified?: string;
  author?: {
    '@type': 'Person';
    name: string;
  };
}

export interface OrganizationJsonLd {
  '@type': 'Organization';
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
  contactPoint?: {
    '@type': 'ContactPoint';
    telephone?: string;
    contactType: string;
  }[];
}

/**
 * Generate Article JSON-LD schema
 */
export function generateArticleJsonLd(data: {
  title: string;
  excerpt?: string | null;
  content: string;
  coverImage?: string | null;
  publishedAt?: string | null;
  updatedAt?: string;
  authorName?: string;
  slug: string;
}): string {
  const baseUrl = 'https://societyledger.com.ng';
  const description = data.excerpt || data.content.substring(0, 160);

  const article: ArticleJsonLd = {
    '@type': 'Article',
    headline: data.title,
    datePublished: data.publishedAt || new Date().toISOString(),
    author: {
      '@type': 'Person',
      name: data.authorName || 'SocietyLedger Team',
    },
    publisher: {
      '@type': 'Organization',
      name: 'SocietyLedger',
      logo: `${baseUrl}/icons/icon-512.png`,
    },
    description: description.substring(0, 160),
    url: `${baseUrl}/blog/${data.slug}`,
  };

  if (data.updatedAt) {
    article.dateModified = data.updatedAt;
  }

  if (data.coverImage) {
    article.image = [data.coverImage];
  }

  return JSON.stringify(article);
}

/**
 * Generate BreadcrumbList JSON-LD schema
 */
export function generateBreadcrumbJsonLd(items: Array<{ name: string; href?: string }>): string {
  const breadcrumb: BreadcrumbJsonLd = {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.href,
    })),
  };

  return JSON.stringify(breadcrumb);
}

/**
 * Generate WebPage JSON-LD schema
 */
export function generateWebPageJsonLd(data: {
  title: string;
  description?: string | null;
  slug: string;
  publishedAt?: string | null;
  updatedAt?: string;
  authorName?: string;
}): string {
  const baseUrl = 'https://societyledger.com.ng';

  const webpage: WebPageJsonLd = {
    '@type': 'WebPage',
    name: data.title,
    url: `${baseUrl}/documentation/${data.slug}`,
  };

  if (data.description) {
    webpage.description = data.description;
  }

  if (data.publishedAt) {
    webpage.datePublished = data.publishedAt;
  }

  if (data.updatedAt) {
    webpage.dateModified = data.updatedAt;
  }

  if (data.authorName) {
    webpage.author = {
      '@type': 'Person',
      name: data.authorName,
    };
  }

  return JSON.stringify(webpage);
}

/**
 * Generate Organization JSON-LD schema
 */
export function generateOrganizationJsonLd(): string {
  const organization: OrganizationJsonLd = {
    '@type': 'Organization',
    name: 'SocietyLedger',
    url: 'https://societyledger.com.ng',
    logo: 'https://societyledger.com.ng/icons/icon-512.png',
    description: 'Comprehensive management platform for associations, cooperatives, and community organizations.',
    sameAs: [
      'https://twitter.com/societyledger',
      'https://facebook.com/societyledger',
      'https://linkedin.com/company/societyledger',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
      },
    ],
  };

  return JSON.stringify(organization);
}
