'use client';

import { useEffect, useState } from 'react';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import { useSearchParams } from 'next/navigation';
import { Container, Stack, Title, Text, LoadingOverlay, Alert, Card, Group, Badge, Anchor, TextInput } from '@mantine/core';
import { IconBook, IconAlertCircle, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { API_ROUTES } from '@/utils/constants';

interface SearchResult {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  section?: {
    name: string;
    slug: string;
  } | null;
}

export default function DocumentationSearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(query);

  useEffect(() => {
    setSearchQuery(query);
    if (query) {
      performSearch(query);
    } else {
      setResults([]);
    }
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_ROUTES.DOCUMENTATION.SEARCH}?q=${encodeURIComponent(searchQuery)}`);

      if (!response.ok) {
        throw new Error('Failed to search');
      }

      const data = await response.json();
      const searchResults = data.data?.results || [];
      setResults(searchResults);
    } catch (err) {
      console.error('Error searching:', err);
      setError('Failed to search. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery.trim());
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />

      <section className="pt-32 pb-12 px-4">
        <Container size="lg">
          <div className="text-center mb-12">
            <Title order={1} className="mb-4">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                Search Documentation
              </span>
            </Title>
            <Text size="lg" c="dimmed" maw={600} mx="auto">
              Find answers to your questions quickly and easily.
            </Text>
          </div>

          <form onSubmit={handleSearch} className="mb-8">
            <TextInput
              size="lg"
              placeholder="Search for documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<IconSearch size={20} />}
              className="search-input"
            />
          </form>

          {loading && (
            <LoadingOverlay visible={loading} />
          )}

          {error && (
            <Alert icon={<IconAlertCircle size={20} />} color="red" title="Error">
              {error}
            </Alert>
          )}

          {!loading && !error && query && (
            <div>
              <Text size="sm" c="dimmed" mb="md">
                {results.length === 0
                  ? `No results found for "${query}"`
                  : `Found ${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
              </Text>

              <Stack gap="md">
                {results.map((result) => (
                  <Card
                    key={result.id}
                    p="md"
                    withBorder
                    radius="md"
                    component={Link}
                    href={`/documentation/${result.slug}`}
                    className="search-result-card"
                  >
                    <Group justify="space-between" mb="xs">
                      <Text size="md" fw={600} lineClamp={1}>
                        {result.title}
                      </Text>
                      {result.section && (
                        <Badge size="xs" variant="light" color="teal">
                          {result.section.name}
                        </Badge>
                      )}
                    </Group>
                    {result.excerpt && (
                      <Text
                        size="sm"
                        c="dimmed"
                        lineClamp={2}
                        dangerouslySetInnerHTML={{
                          __html: highlightText(result.excerpt, query),
                        }}
                      />
                    )}
                  </Card>
                ))}
              </Stack>

              {results.length === 0 && (
                <Alert icon={<IconAlertCircle size={20} />} color="blue" title="No Results">
                  <Text>
                    No documentation found for "<strong>{query}</strong>". Try different keywords or browse the
                    documentation sections.
                  </Text>
                </Alert>
              )}
            </div>
          )}

          {!query && (
            <Alert icon={<IconSearch size={20} />} color="blue" title="Start Searching">
              Enter a search term above to find documentation pages.
            </Alert>
          )}
        </Container>
      </section>

      <Footer />

      <style jsx global>{`
        .search-input input {
          border-radius: 0.5rem;
        }
        .search-result-card {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .search-result-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .dark .search-result-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        .search-result-card mark {
          background-color: #fef08a;
          color: #854d0e;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
