'use client';

import { useState, useEffect, useRef } from 'react';
import { TextInput, Stack, Paper, Text, Group, Badge } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import Link from 'next/link';

interface SearchResult {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  category?: {
    name: string;
    slug: string;
  };
}

interface BlogSearchProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  showResults?: boolean;
  results?: SearchResult[];
  loading?: boolean;
}

export function BlogSearch({
  onSearch,
  placeholder = 'Search articles...',
  showResults = false,
  results = [],
  loading = false,
}: BlogSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const onSearchRef = useRef(onSearch);
  
  // Keep the ref updated
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (onSearchRef.current) {
        onSearchRef.current(query);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
    if (onSearch) {
      onSearch('');
    }
  };

  return (
    <Stack gap="md">
      <TextInput
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        leftSection={<IconSearch size={16} />}
        rightSection={
          query && (
            <button
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: 'inherit',
              }}
            >
              ✕
            </button>
          )
        }
        size="md"
        radius="md"
      />

      {showResults && debouncedQuery && (
        <Paper withBorder p="md" radius="md" shadow="sm">
          {loading ? (
            <Text size="sm" c="dimmed" ta="center">
              Searching...
            </Text>
          ) : results.length > 0 ? (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                {results.length} {results.length === 1 ? 'result' : 'results'} for &quot;{debouncedQuery}&quot;
              </Text>
              {results.map((result) => (
                <Paper
                  key={result.id}
                  p="sm"
                  radius="md"
                  withBorder
                  component={Link}
                  href={`/blog/${result.slug}`}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors block"
                >
                  <Stack gap="xs">
                    <Group gap="xs" wrap="nowrap">
                      {result.category && (
                        <Badge variant="light" size="xs">
                          {result.category.name}
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" fw={500} lineClamp={1}>
                      {result.title}
                    </Text>
                    {result.excerpt && (
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {result.excerpt}
                      </Text>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed" ta="center">
              No results found for &quot;{debouncedQuery}&quot;
            </Text>
          )}
        </Paper>
      )}
    </Stack>
  );
}
