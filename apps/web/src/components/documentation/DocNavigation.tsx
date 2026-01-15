'use client';

import { Group, Button, Text, Box } from '@mantine/core';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';

interface DocNavigationProps {
  prevPage?: {
    title: string;
    slug: string;
  } | null;
  nextPage?: {
    title: string;
    slug: string;
  } | null;
}

export function DocNavigation({ prevPage, nextPage }: DocNavigationProps) {
  return (
    <Box className="doc-navigation">
      <Group justify="space-between" mt="xl" pt="xl" style={{ borderTop: '1px solid #e2e8f0' }}>
        {prevPage ? (
          <Button
            component={Link}
            href={`/documentation/${prevPage.slug}`}
            variant="subtle"
            size="lg"
            leftSection={<IconArrowLeft size={20} />}
            className="nav-button"
          >
            <Box ta="left">
              <Text size="xs" c="dimmed" fw={500}>
                Previous
              </Text>
              <Text size="sm" fw={600} lineClamp={1}>
                {prevPage.title}
              </Text>
            </Box>
          </Button>
        ) : (
          <Box />
        )}

        {nextPage ? (
          <Button
            component={Link}
            href={`/documentation/${nextPage.slug}`}
            variant="subtle"
            size="lg"
            rightSection={<IconArrowRight size={20} />}
            className="nav-button"
          >
            <Box ta="right">
              <Text size="xs" c="dimmed" fw={500}>
                Next
              </Text>
              <Text size="sm" fw={600} lineClamp={1}>
                {nextPage.title}
              </Text>
            </Box>
          </Button>
        ) : (
          <Box />
        )}
      </Group>

      <style jsx global>{`
        .doc-navigation {
          margin-top: 2rem;
        }
        .nav-button {
          flex: 1;
          max-width: 48%;
          transition: all 0.2s ease;
        }
        .nav-button:hover {
          background-color: #f0fdfa;
        }
        .dark .nav-button:hover {
          background-color: #1e293b;
        }
        .nav-button:hover .mantine-Text-root {
          color: #0d9488;
        }
        .dark .nav-button:hover .mantine-Text-root {
          color: #2dd4bf;
        }
      `}</style>
    </Box>
  );
}
