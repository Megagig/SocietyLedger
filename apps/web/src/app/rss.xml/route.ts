import { NextResponse } from 'next/server';

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
  author?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  category?: {
    name: string;
  };
}

async function fetchBlogPosts(): Promise<BlogPost[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/blog/posts?status=PUBLISHED`, {
      next: { revalidate: 3600 }, // Revalidate every hour
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data?.posts || [];
  } catch (error) {
    console.error('Error fetching blog posts for RSS:', error);
    return [];
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function generateRSS(posts: BlogPost[]): string {
  const items = posts
    .map((post) => {
      const pubDate = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : new Date(post.updatedAt).toUTCString();
      const description = post.excerpt || stripHtml(post.content).substring(0, 200) + '...';
      const authorName = post.author
        ? `${post.author.firstName || ''} ${post.author.lastName || ''}`.trim() || post.author.email
        : 'SocietyLedger';
      const category = post.category?.name || 'General';

      return `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${SITE_URL}/blog/${post.slug}</link>
      <guid>${SITE_URL}/blog/${post.slug}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${description}]]></description>
      <category><![CDATA[${category}]]></category>
      <author>${authorEmail(authorName)}</author>
      ${post.coverImage ? `<enclosure url="${post.coverImage}" type="image/jpeg" />` : ''}
    </item>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SocietyLedger Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Tips, guides, and insights on association management, cooperative finance, and community leadership.</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;
}

function authorEmail(authorName: string): string {
  // Create a simple email from author name
  const email = authorName
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
  return `${email}@societyledger.com.ng`;
}

export async function GET() {
  const posts = await fetchBlogPosts();
  const rss = generateRSS(posts);

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
