'use client';

import { useEffect, useState } from 'react';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import { useParams, useRouter } from 'next/navigation';
import { Container, Stack, Title, Text, SimpleGrid, LoadingOverlay, Alert, Breadcrumbs, Anchor } from '@mantine/core';
import { IconArticle, IconAlertCircle, IconFolder } from '@tabler/icons-react';
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

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
}

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchCategory();
      fetchPosts();
    }
  }, [slug]);

  const fetchCategory = async () => {
    try {
      const response = await fetch(`${API_ROUTES.BLOG.CATEGORIES}`);
      if (!response.ok) {
        throw new Error('Failed to fetch category');
      }

      const data = await response.json();
      const categories = data.data?.categories || [];
      const foundCategory = categories.find((cat: Category) => cat.slug === slug);
      setCategory(foundCategory || null);

      if (!foundCategory) {
        router.push('/blog');
      }
    } catch (err) {
      console.error('Error fetching category:', err);
      setError('Failed to load category. Please try again later.');
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_ROUTES.BLOG.POSTS}?category=${encodeURIComponent(slug)}`);

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

  if (error || !category) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Container size="lg" py="xl">
          <Alert icon={<IconAlertCircle size={20} />} color="red" title="Error">
            {error || 'Category not found'}
          </Alert>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />

      <section className="pt-32 pb-12 px-4">
        <Container size="lg">
          <Breadcrumbs mb="md">
            <Anchor component={Link} href="/">Home</Anchor>
            <Anchor component={Link} href="/blog">Blog</Anchor>
            <Text c="dimmed">{category.name}</Text>
          </Breadcrumbs>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 flex items-center justify-center">
              <IconFolder className="text-teal-500" size={32} />
            </div>
            <div>
              <Title order={1}>{category.name}</Title>
              {category.description && (
                <Text size="lg" c="dimmed">
                  {category.description}
                </Text>
              )}
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
                No posts found in this category.
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
