'use client';

import { useEffect, useState } from 'react';
import { Box, Text, Stack, Anchor } from '@mantine/core';

interface TableOfContentsProps {
  content: string;
}

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const [items, setItems] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    // Parse headings from HTML content
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');

    const tocItems: TOCItem[] = Array.from(headings).map((heading, index) => {
      const id = `heading-${index}`;
      heading.id = id;
      return {
        id,
        text: heading.textContent || '',
        level: parseInt(heading.tagName.substring(1)),
      };
    });

    setItems(tocItems);

    // Add IDs to actual content
    const contentElement = document.querySelector('.doc-content');
    if (contentElement) {
      const contentHeadings = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
      contentHeadings.forEach((heading, index) => {
        heading.id = `heading-${index}`;
      });
    }
  }, [content]);

  useEffect(() => {
    // Intersection Observer for active heading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0% -70% 0%',
        threshold: 0,
      }
    );

    const headings = document.querySelectorAll('.doc-content h1, .doc-content h2, .doc-content h3, .doc-content h4, .doc-content h5, .doc-content h6');
    headings.forEach((heading) => observer.observe(heading));

    return () => {
      headings.forEach((heading) => observer.unobserve(heading));
    };
  }, [items]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // Header height
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <Box>
      <Text fw={600} size="sm" mb="md" c="dimmed">
        On this page
      </Text>
      <Stack gap="xs">
        {items.map((item) => (
          <Anchor
            key={item.id}
            size="sm"
            onClick={() => scrollToHeading(item.id)}
            c={activeId === item.id ? 'teal' : 'dimmed'}
            fw={activeId === item.id ? 600 : 400}
            style={{
              paddingLeft: `${(item.level - 1) * 12}px`,
              display: 'block',
              transition: 'all 0.2s ease',
            }}
            className="toc-item"
          >
            {item.text}
          </Anchor>
        ))}
      </Stack>
      <style jsx global>{`
        .toc-item:hover {
          color: #0d9488 !important;
        }
        .dark .toc-item:hover {
          color: #2dd4bf !important;
        }
      `}</style>
    </Box>
  );
}
