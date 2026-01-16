'use client';

import { useEffect, useState } from 'react';
import Footer from '@/components/layout/Footer';
import { useParams, useRouter } from 'next/navigation';
import { Container, Stack, Title, Text, SimpleGrid, LoadingOverlay, Alert, Breadcrumbs, Anchor, Badge } from '@mantine/core';
import { IconArticle, IconAlertCircle, IconTag } from '@tabler/icons-react';
import Link from 'next/link';
import { PostCard } from '@/components/blog/PostCard';
import { API_ROUTES } from '@/utils/constants';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  status: string;
  publishedAt: string | null;
  viewCount: number;
  readTimeMinutes: number | null;
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

interface Tag {
  id: number;
  name: string;
  slug: string;
}

export default function TagPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [tag, setTag] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchTag();
      fetchPosts();
    }
  }, [slug]);

  const fetchTag = async () => {
    try {
      const response = await fetch(`${API_ROUTES.BLOG.TAGS}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tag');
      }

      const data = await response.json();
      const tags = data.data?.tags || [];
      const foundTag = tags.find((t: Tag) => t.slug === slug);
      setTag(foundTag || null);

      if (!foundTag) {
        router.push('/blog');
      }
    } catch (err) {
      console.error('Error fetching tag:', err);
      setError('Failed to load tag. Please try again later.');
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_ROUTES.BLOG.POSTS}?tag=${encodeURIComponent(slug)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }

      const data = await response.json();
      setPosts(data.data?.posts || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Failed to load posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <LoadingOverlay visible={loading} />
      </div>
    );
  }

  if (error || !tag) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Container size="lg" py="xl">
          <Alert icon={<IconAlertCircle size={20} />} color="red" title="Error">
            {error || 'Tag not found'}
          </Alert>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
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
          </div>
        </Container>
      </nav>

      <section className="pt-32 pb-12 px-4">
        <Container size="lg">
          <Breadcrumbs mb="md">
            <Anchor component={Link} href="/">Home</Anchor>
            <Anchor component={Link} href="/blog">Blog</Anchor>
            <Text c="dimmed">#{tag.name}</Text>
          </Breadcrumbs>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 flex items-center justify-center">
              <IconTag className="text-teal-500" size={32} />
            </div>
            <div>
              <Title order={1}>
                <Badge
                  variant="filled"
                  size="xl"
                  radius="md"
                  color="teal"
                >
                  #{tag.name}
                </Badge>
              </Title>
              <Text size="lg" c="dimmed">
                Posts tagged with {tag.name}
              </Text>
            </div>
          </div>
        </Container>
      </section>

      <section className="pb-20 px-4">
        <Container size="xl">
          {loading ? (
            <div className="relative min-h-[400px]">
              <LoadingOverlay visible={loading} />
            </div>
          ) : error ? (
            <Alert icon={<IconAlertCircle size={20} />} color="red" title="Error">
              {error}
            </Alert>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <IconArticle size={64} className="mx-auto mb-4 text-gray-400" />
              <Text size="lg" c="dimmed">
                No posts found with this tag.
              </Text>
            </div>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  id={post.id}
                  title={post.title}
                  slug={post.slug}
                  excerpt={post.excerpt}
                  coverImage={post.coverImage}
                  publishedAt={post.publishedAt ? new Date(post.publishedAt) : null}
                  readTimeMinutes={post.readTimeMinutes}
                  viewCount={post.viewCount}
                  category={post.category}
                  tags={post.tags}
                />
              ))}
            </SimpleGrid>
          )}
        </Container>
      </section>

      <Footer />
    </div>
  );
}
