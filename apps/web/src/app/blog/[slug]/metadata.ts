import { Metadata } from 'next';
import { generateArticleJsonLd, generateBreadcrumbJsonLd } from '@/lib/json-ld';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SITE_URL = 'https://societyledger.com.ng';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  publishedAt: string | null;
  updatedAt: string;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string[];
  author?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  category?: {
    name: string;
  };
}

export async function generateBlogPostMetadata(slug: string): Promise<{
  metadata: Metadata;
  jsonLd: string;
  breadcrumbJsonLd: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/blog/posts/${slug}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error('Post not found');
    }

    const data = await response.json();
    const post: BlogPost = data.data?.post;

    if (!post) {
      throw new Error('Post not found');
    }

    const title = post.metaTitle || post.title;
    const description = post.metaDescription || post.excerpt || post.content.substring(0, 160);
    const keywords = post.metaKeywords?.join(', ') || 'association management, cooperative finance, community leadership';
    const authorName = post.author
      ? `${post.author.firstName || ''} ${post.author.lastName || ''}`.trim() || post.author.email
      : 'SocietyLedger Team';
    const categoryName = post.category?.name || 'General';

    // Generate metadata
    const metadata: Metadata = {
      title,
      description,
      keywords,
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/blog/${post.slug}`,
        siteName: 'SocietyLedger',
        type: 'article',
        publishedTime: post.publishedAt || undefined,
        modifiedTime: post.updatedAt,
        authors: [authorName],
        section: categoryName,
        images: post.coverImage
          ? [
              {
                url: post.coverImage,
                width: 1200,
                height: 630,
                alt: title,
              },
            ]
          : undefined,
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: post.coverImage ? [post.coverImage] : undefined,
      },
      alternates: {
        canonical: `${SITE_URL}/blog/${post.slug}`,
      },
    };

    // Generate JSON-LD
    const articleJsonLd = generateArticleJsonLd({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage || undefined,
      publishedAt: post.publishedAt || undefined,
      updatedAt: post.updatedAt,
      authorName,
      slug: post.slug,
    });

    // Generate breadcrumb JSON-LD
    const breadcrumbJsonLd = generateBreadcrumbJsonLd([
      { name: 'Home', href: SITE_URL },
      { name: 'Blog', href: `${SITE_URL}/blog` },
      { name: post.title, href: `${SITE_URL}/blog/${post.slug}` },
    ]);

    return { metadata, jsonLd: articleJsonLd, breadcrumbJsonLd };
  } catch (error) {
    console.error('Error generating blog post metadata:', error);

    // Fallback metadata
    const metadata: Metadata = {
      title: 'Blog Post - SocietyLedger',
      description: 'Read the latest insights and tips from SocietyLedger.',
    };

    const jsonLd = generateArticleJsonLd({
      title: 'Blog Post',
      excerpt: 'Read the latest insights and tips from SocietyLedger.',
      content: '',
      slug,
    });

    const breadcrumbJsonLd = generateBreadcrumbJsonLd([
      { name: 'Home', href: SITE_URL },
      { name: 'Blog', href: `${SITE_URL}/blog` },
    ]);

    return { metadata, jsonLd, breadcrumbJsonLd };
  }
}
