'use client';

import { useState, useEffect } from 'react';
import { TextInput, Stack, Text, Paper, Group, Badge, Anchor, LoadingOverlay, Box } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { API_ROUTES } from '@/utils/constants';

interface SearchResult {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  section?: {
    name: string;
    slug: string;
  } | null;
}

interface DocSearchProps {
  onResultClick?: () => void;
}

export function DocSearch({ onResultClick }: DocSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.trim().length >= 2) {
        await performSearch(query);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_ROUTES.DOCUMENTATION.SEARCH}?q=${encodeURIComponent(searchQuery)}`);

      if (!response.ok) {
        throw new Error('Failed to search');
      }

      const data = await response.json();
      const searchResults = data.data?.results || [];
      setResults(searchResults);
      setShowResults(searchResults.length > 0);
    } catch (err) {
      console.error('Error searching:', err);
      setResults([]);
      setShowResults(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = () => {
    setShowResults(false);
    setQuery('');
    if (onResultClick) {
      onResultClick();
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  return (
    <Box pos="relative">
      <TextInput
        placeholder="Search documentation..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        leftSection={<IconSearch size={16} />}
        size="md"
        className="doc-search-input"
      />

      {showResults && (
        <Paper
          withBorder
          shadow="xl"
          p="md"
          pos="absolute"
          top="calc(100% + 8px)"
          left={0}
          right={0}
          style={{ zIndex: 1000 }}
          className="doc-search-results"
        >
          <LoadingOverlay visible={loading} />
          <Stack gap="xs">
            {results.length > 0 ? (
              results.map((result) => (
                <Paper
                  key={result.id}
                  p="sm"
                  withBorder
                  radius="md"
                  component={Link}
                  href={`/documentation/${result.slug}`}
                  onClick={handleResultClick}
                  className="search-result-item"
                >
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={600} lineClamp={1}>
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
                      size="xs"
                      c="dimmed"
                      lineClamp={2}
                      dangerouslySetInnerHTML={{
                        __html: highlightText(result.excerpt, query),
                      }}
                    />
                  )}
                </Paper>
              ))
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="md">
                No results found for &quot;{query}&quot;
              </Text>
            )}
          </Stack>
        </Paper>
      )}

      <style jsx global>{`
        .doc-search-input input {
          border-radius: 0.5rem;
        }
        .doc-search-results {
          max-height: 400px;
          overflow-y: auto;
        }
        .search-result-item {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .search-result-item:hover {
          background-color: #f0fdfa;
        }
        .dark .search-result-item:hover {
          background-color: #1e293b;
        }
        .search-result-item mark {
          background-color: #fef08a;
          color: #854d0e;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </Box>
  );
}
