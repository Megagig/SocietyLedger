'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Container, Stack, Title, Text, LoadingOverlay, Alert, Grid, Box } from '@mantine/core';
import { IconBook, IconAlertCircle, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import { DocContent } from '@/components/documentation/DocContent';
import { DocSidebar } from '@/components/documentation/DocSidebar';
import { TableOfContents } from '@/components/documentation/TableOfContents';
import { DocFeedback } from '@/components/documentation/DocFeedback';
import { DocBreadcrumbs } from '@/components/documentation/DocBreadcrumbs';
import { DocNavigation } from '@/components/documentation/DocNavigation';
import { API_ROUTES } from '@/utils/constants';

interface DocPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  order: number;
  sectionId?: number | null;
  section?: {
    id: number;
    name: string;
    slug: string;
    description?: string | null;
    icon?: string | null;
  } | null;
  author?: {
    id: number;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  publishedAt?: string | null;
  updatedAt: string;
}

interface RelatedPage {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
}

export default function DocPagePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [page, setPage] = useState<DocPage | null>(null);
  const [relatedPages, setRelatedPages] = useState<RelatedPage[]>([]);
  const [prevPage, setPrevPage] = useState<{ title: string; slug: string } | null>(null);
  const [nextPage, setNextPage] = useState<{ title: string; slug: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchPage();
    }
  }, [slug]);

  const fetchPage = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ROUTES.DOCUMENTATION.PAGE_BY_SLUG(slug));

      if (!response.ok) {
        if (response.status === 404) {
          router.push('/documentation');
          return;
        }
        throw new Error('Failed to fetch documentation page');
      }

      const data = await response.json();
      const pageData = data.data?.page || null;
      setPage(pageData);

      if (pageData) {
        // Fetch related pages
        fetchRelatedPages(pageData.id);

        // Fetch navigation (prev/next)
        fetchNavigation(pageData.id, pageData.sectionId);

        // Increment view count
        incrementViewCount(pageData.id);
      }
    } catch (err) {
      console.error('Error fetching page:', err);
      setError('Failed to load documentation page. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedPages = async (pageId: number) => {
    try {
      const response = await fetch(API_ROUTES.DOCUMENTATION.PAGE_RELATED(pageId));
      if (!response.ok) {
        throw new Error('Failed to fetch related pages');
      }

      const data = await response.json();
      const pagesData = data.data?.pages || [];
      setRelatedPages(pagesData);
    } catch (err) {
      console.error('Error fetching related pages:', err);
    }
  };

  const fetchNavigation = async (pageId: number, sectionId?: number | null) => {
    try {
      // Fetch all pages in the same section
      let url = API_ROUTES.DOCUMENTATION.PAGES;
      if (sectionId) {
        url += `?sectionId=${sectionId}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch navigation');
      }

      const data = await response.json();
      const pages = data.data?.pages || [];
      const sortedPages = pages.sort((a: DocPage, b: DocPage) => a.order - b.order);

      const currentIndex = sortedPages.findIndex((p: DocPage) => p.id === pageId);

      if (currentIndex > 0) {
        setPrevPage({
          title: sortedPages[currentIndex - 1].title,
          slug: sortedPages[currentIndex - 1].slug,
        });
      }

      if (currentIndex < sortedPages.length - 1) {
        setNextPage({
          title: sortedPages[currentIndex + 1].title,
          slug: sortedPages[currentIndex + 1].slug,
        });
      }
    } catch (err) {
      console.error('Error fetching navigation:', err);
    }
  };

  const incrementViewCount = async (pageId: number) => {
    try {
      await fetch(API_ROUTES.DOCUMENTATION.PAGE_VIEW(pageId), {
        method: 'POST',
      });
    } catch (err) {
      console.error('Error incrementing view count:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <LoadingOverlay visible={loading} />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Container size="lg" py="xl">
          <Alert icon={<IconAlertCircle size={20} />} color="red" title="Error">
            {error || 'Page not found'}
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
                <IconBook className="text-white" size={24} />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                SocietyLedger
              </span>
            </Link>
            <Box component={Link} href="/documentation">
              <Text size="sm" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <IconArrowLeft size={16} />
                Back to Docs
              </Text>
            </Box>
          </div>
        </Container>
      </nav>

      <section className="pt-32 pb-12 px-4">
        <Container size="xl">
          <Grid>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Box className="hidden md:block">
                <DocSidebar currentSlug={slug} />
              </Box>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="xl">
                <DocBreadcrumbs
                  currentPage={{ title: page.title, slug: page.slug }}
                  section={page.section}
                />

                <Title order={1}>{page.title}</Title>

                {page.excerpt && (
                  <Text size="lg" c="dimmed">
                    {page.excerpt}
                  </Text>
                )}

                <DocContent content={page.content} />

                <Box className="mt-8">
                  <DocFeedback pageId={page.id} />
                </Box>

                <DocNavigation prevPage={prevPage} nextPage={nextPage} />
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 3 }}>
              <Box className="hidden md:block">
                <TableOfContents content={page.content} />
              </Box>
            </Grid.Col>
          </Grid>
        </Container>
      </section>

      <footer className="py-12 px-4 border-t border-gray-200 dark:border-gray-800">
        <Container size="xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center">
                <IconBook className="text-white" size={20} />
              </div>
              <Text fw={600} c="gray">SocietyLedger</Text>
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
