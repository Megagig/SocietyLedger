import { MetadataRoute } from 'next';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchBlogPosts(): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/blog/posts?status=PUBLISHED`, {
      next: { revalidate: 3600 }, // Revalidate every hour
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data?.posts || [];
  } catch (error) {
    console.error('Error fetching blog posts for sitemap:', error);
    return [];
  }
}

async function fetchDocPages(): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/docs/pages?status=PUBLISHED`, {
      next: { revalidate: 3600 }, // Revalidate every hour
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data?.pages || [];
  } catch (error) {
    console.error('Error fetching doc pages for sitemap:', error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://societyledger.com.ng';
  const currentDate = new Date();

  // Fetch dynamic content
  const [blogPosts, docPages] = await Promise.all([
    fetchBlogPosts(),
    fetchDocPages(),
  ]);

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/features`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/documentation`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/testimonials`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/licenses`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // Blog posts
  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt ? new Date(post.updatedAt) : currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Documentation pages
  const docPagesSitemap: MetadataRoute.Sitemap = docPages.map((page) => ({
    url: `${baseUrl}/documentation/${page.slug}`,
    lastModified: page.updatedAt ? new Date(page.updatedAt) : currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...blogPages, ...docPagesSitemap];
}
