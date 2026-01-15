'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Container, Stack, Title, Text, SimpleGrid, LoadingOverlay, Alert } from '@mantine/core';
import { IconArticle, IconAlertCircle, IconSearch } from '@tabler/icons-react';
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

export default function BlogSearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query) {
      fetchPosts();
    } else {
      setPosts([]);
      setLoading(false);
    }
  }, [query]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_ROUTES.BLOG.POSTS}?search=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error('Failed to search posts');
      }

      const data = await response.json();
      setPosts(data.data?.posts || []);
    } catch (err) {
      console.error('Error searching posts:', err);
      setError('Failed to search posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 flex items-center justify-center">
              <IconSearch className="text-teal-500" size={32} />
            </div>
            <div>
              <Title order={1}>Search Results</Title>
              <Text size="lg" c="dimmed">
                {query ? `Searching for "${query}"` : 'Enter a search term'}
              </Text>
            </div>
          </div>
        </Container>
      </section>

      <section className="pb-20 px-4">
        <Container size="xl">
          {!query ? (
            <div className="text-center py-20">
              <IconSearch size={64} className="mx-auto mb-4 text-gray-400" />
              <Text size="lg" c="dimmed">
                Enter a search term to find articles.
              </Text>
            </div>
          ) : loading ? (
            <div className="relative min-h-[400px]">
              <LoadingOverlay visible={loading} />
            </div>
          ) : error ? (
            <Alert icon={<IconAlertCircle size={20} />} color="red" title="Error">
              {error}
            </Alert>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <IconSearch size={64} className="mx-auto mb-4 text-gray-400" />
              <Text size="lg" c="dimmed">
                No results found for "{query}"
              </Text>
              <Text size="sm" c="dimmed" mt="sm">
                Try different keywords or browse our categories.
              </Text>
            </div>
          ) : (
            <>
              <Text size="sm" c="dimmed" mb="md">
                Found {posts.length} {posts.length === 1 ? 'result' : 'results'} for "{query}"
              </Text>
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
            </>
          )}
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
