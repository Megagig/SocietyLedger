'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Container, Stack, Title, Text, LoadingOverlay, Alert, Breadcrumbs, Anchor, Group, AspectRatio, Image } from '@mantine/core';
import { IconArticle, IconAlertCircle, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import { PostContent } from '@/components/blog/PostContent';
import { PostMeta } from '@/components/blog/PostMeta';
import { CategoryBadge } from '@/components/blog/CategoryBadge';
import { TagList } from '@/components/blog/TagList';
import { CommentSection } from '@/components/blog/CommentSection';
import { RelatedPosts } from '@/components/blog/RelatedPosts';
import { ShareButtons } from '@/components/blog/ShareButtons';
import { JsonLd } from '@/components/seo/JsonLd';
import { API_ROUTES } from '@/utils/constants';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  publishedAt: string | null;
  viewCount: number;
  readTimeMinutes: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string[];
  author?: {
    id: number;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  category?: {
    id: number;
    name: string;
    slug: string;
    color: string | null;
  };
  tags?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
}

interface Comment {
  id: number;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'SPAM';
  createdAt: Date;
  author?: {
    id: number;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  guestName?: string;
  guestEmail?: string;
  parentId?: number;
}

interface RelatedPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  readTimeMinutes: number | null;
  category?: {
    id: number;
    name: string;
    slug: string;
    color: string | null;
  };
}

export default function BlogPostPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [jsonLd, setJsonLd] = useState<string>('');
  const [breadcrumbJsonLd, setBreadcrumbJsonLd] = useState<string>('');

  useEffect(() => {
    if (slug) {
      fetchPost();
      checkAuth();
    }
  }, [slug]);

  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsAuthenticated(true);
        setCurrentUser(user);
      } catch (err) {
        console.error('Error parsing user:', err);
      }
    }
  };

  const fetchPost = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ROUTES.BLOG.POST_BY_SLUG(slug));

      if (!response.ok) {
        if (response.status === 404) {
          router.push('/blog');
          return;
        }
        throw new Error('Failed to fetch post');
      }

      const data = await response.json();
      const postData = data.data?.post || null;
      setPost(postData);

      if (postData) {
        // Generate JSON-LD schemas
        const { generateArticleJsonLd, generateBreadcrumbJsonLd } = await import('@/lib/json-ld');

        const authorName = postData.author
          ? `${postData.author.firstName || ''} ${postData.author.lastName || ''}`.trim() || postData.author.email
          : 'SocietyLedger Team';

        const articleJsonLd = generateArticleJsonLd({
          title: postData.title,
          excerpt: postData.excerpt,
          content: postData.content,
          coverImage: postData.coverImage || undefined,
          publishedAt: postData.publishedAt || undefined,
          updatedAt: postData.updatedAt,
          authorName,
          slug: postData.slug,
        });

        const breadcrumbJsonLd = generateBreadcrumbJsonLd([
          { name: 'Home', href: 'https://societyledger.com.ng' },
          { name: 'Blog', href: 'https://societyledger.com.ng/blog' },
          { name: postData.title, href: `https://societyledger.com.ng/blog/${postData.slug}` },
        ]);

        setJsonLd(articleJsonLd);
        setBreadcrumbJsonLd(breadcrumbJsonLd);

        // Fetch comments
        fetchComments(postData.id);

        // Fetch related posts
        fetchRelatedPosts(postData.id);

        // Increment view count
        incrementViewCount(postData.id);
      }
    } catch (err) {
      console.error('Error fetching post:', err);
      setError('Failed to load blog post. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (postId: number) => {
    try {
      const response = await fetch(API_ROUTES.BLOG.POST_COMMENTS(postId));
      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      const commentsData = data.data?.comments || [];
      // Convert date strings to Date objects
      const formattedComments = commentsData.map((comment: any) => ({
        ...comment,
        createdAt: new Date(comment.createdAt),
      }));
      setComments(formattedComments);
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  const fetchRelatedPosts = async (postId: number) => {
    try {
      const response = await fetch(API_ROUTES.BLOG.POST_RELATED(postId));
      if (!response.ok) {
        throw new Error('Failed to fetch related posts');
      }

      const data = await response.json();
      const postsData = data.data?.posts || [];
      // Convert date strings to Date objects
      const formattedPosts = postsData.map((post: any) => ({
        ...post,
        publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
      }));
      setRelatedPosts(formattedPosts);
    } catch (err) {
      console.error('Error fetching related posts:', err);
    }
  };

  const incrementViewCount = async (postId: number) => {
    try {
      await fetch(API_ROUTES.BLOG.POST_VIEW(postId), {
        method: 'POST',
      });
    } catch (err) {
      console.error('Error incrementing view count:', err);
    }
  };

  const handleCommentSubmit = async (content: string, parentId?: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ROUTES.BLOG.POST_COMMENTS(post!.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          content,
          postId: post!.id,
          parentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit comment');
      }

      // Refresh comments
      await fetchComments(post!.id);
    } catch (err) {
      console.error('Error submitting comment:', err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <LoadingOverlay visible={loading} />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Container size="lg" py="xl">
          <Alert icon={<IconAlertCircle size={20} />} color="red" title="Error">
            {error || 'Post not found'}
          </Alert>
        </Container>
      </div>
    );
  }

  const postUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {jsonLd && <JsonLd data={jsonLd} />}
      {breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
      <nav className="glass-strong fixed top-0 left-0 right-0 z-50 border-b border-gray-200/50 dark:border-gray-700/50">
        <Container size="xl" className="py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center">
                <IconArticle className="text-white" size={24} />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                SocietyLedger
              </span>
            </Link>
            <Anchor component={Link} href="/blog" size="sm">
              <Group gap="xs">
                <IconArrowLeft size={16} />
                Back to Blog
              </Group>
            </Anchor>
          </div>
        </Container>
      </nav>

      <section className="pt-32 pb-12 px-4">
        <Container size="lg">
          <Breadcrumbs mb="md">
            <Anchor component={Link} href="/">Home</Anchor>
            <Anchor component={Link} href="/blog">Blog</Anchor>
            <Text c="dimmed">{post.title}</Text>
          </Breadcrumbs>

          <Stack gap="lg">
            {post.category && <CategoryBadge category={post.category} />}

            <Title order={1}>{post.title}</Title>

            {post.excerpt && (
              <Text size="xl" c="dimmed">
                {post.excerpt}
              </Text>
            )}

            <PostMeta
              publishedAt={post.publishedAt ? new Date(post.publishedAt) : null}
              readTimeMinutes={post.readTimeMinutes}
              viewCount={post.viewCount}
            />

            {post.tags && post.tags.length > 0 && <TagList tags={post.tags} />}

            <Group justify="space-between">
              <ShareButtons url={postUrl} title={post.title} />
            </Group>
          </Stack>
        </Container>
      </section>

      {post.coverImage && (
        <section className="pb-12 px-4">
          <Container size="lg">
            <AspectRatio ratio={16 / 9}>
              <Image
                src={post.coverImage}
                alt={post.title}
                fit="cover"
                className="rounded-2xl"
              />
            </AspectRatio>
          </Container>
        </section>
      )}

      <section className="pb-20 px-4">
        <Container size="lg">
          <Stack gap="xl">
            <PostContent content={post.content} />

            <Group justify="space-between">
              <ShareButtons url={postUrl} title={post.title} />
            </Group>

            {relatedPosts.length > 0 && (
              <RelatedPosts posts={relatedPosts} />
            )}

            <CommentSection
              postId={post.id}
              comments={comments}
              isAuthenticated={isAuthenticated}
              currentUser={currentUser}
              onCommentSubmit={handleCommentSubmit}
            />
          </Stack>
        </Container>
      </section>

      <footer className="py-12 px-4 border-t border-gray-200 dark:border-gray-800">
        <Container size="xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center">
                <IconArticle className="text-white" size={20} />
              </div>
              <span className="font-bold text-gray-900 dark:text-white">SocietyLedger</span>
            </div>
            <Text size="sm" c="dimmed">
              © {new Date().getFullYear()} SocietyLedger
            </Text>
          </div>
        </Container>
      </footer>
    </div>
  );
}
