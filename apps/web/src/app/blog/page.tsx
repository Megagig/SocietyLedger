'use client';

import { useEffect, useState } from 'react';
import { Container, Stack, Title, Text, SimpleGrid, LoadingOverlay, Alert } from '@mantine/core';
import { IconArticle, IconAlertCircle } from '@tabler/icons-react';
import { PostCard } from '@/components/blog/PostCard';
import { BlogSearch } from '@/components/blog/BlogSearch';
import { API_ROUTES } from '@/utils/constants';
import { generateBlogMetadata } from './metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = generateBlogMetadata();

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
  color: string | null;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  useEffect(() => {
    fetchPosts();
    fetchCategories();
  }, [selectedCategory]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const url = selectedCategory
        ? `${API_ROUTES.BLOG.POSTS}?categoryId=${selectedCategory}`
        : API_ROUTES.BLOG.POSTS;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }

      const data = await response.json();
      setPosts(data.data?.posts || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Failed to load blog posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(API_ROUTES.BLOG.CATEGORIES);
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }

      const data = await response.json();
      setCategories(data.data?.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleSearch = async (query: string) => {
    try {
      setLoading(true);
      const url = query
        ? `${API_ROUTES.BLOG.POSTS}?search=${encodeURIComponent(query)}`
        : API_ROUTES.BLOG.POSTS;

      const response = await fetch(url);
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
            <a href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center">
                <IconArticle className="text-white" size={24} />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                SocietyLedger
              </span>
            </a>
          </div>
        </Container>
      </nav>

      <section className="pt-32 pb-12 px-4">
        <Container size="lg">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 mb-6">
              <IconArticle className="text-teal-500" size={40} />
            </div>
            <Title order={1} className="mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                Blog
              </span>
            </Title>
            <Text size="xl" c="dimmed" className="max-w-2xl mx-auto">
              Tips, guides, and insights on association management, cooperative finance, and community leadership.
            </Text>
          </div>

          <div className="max-w-md mx-auto mb-12">
            <BlogSearch onSearch={handleSearch} />
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === null
                    ? 'bg-teal-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                All Posts
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-teal-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}
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
                No blog posts found.
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
