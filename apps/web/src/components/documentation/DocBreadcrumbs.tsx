'use client';

import { Breadcrumbs, Anchor, Text } from '@mantine/core';
import Link from 'next/link';

interface DocBreadcrumbsProps {
  currentPage: {
    title: string;
    slug: string;
  };
  section?: {
    name: string;
    slug: string;
  } | null;
}

export function DocBreadcrumbs({ currentPage, section }: DocBreadcrumbsProps) {
  const items = [
    { title: 'Home', href: '/' },
    { title: 'Documentation', href: '/documentation' },
  ];

  if (section) {
    items.push({
      title: section.name,
      href: `/documentation?section=${section.slug}`,
    });
  }

  items.push({
    title: currentPage.title,
    href: `/documentation/${currentPage.slug}`,
  });

  return (
    <Breadcrumbs mb="md">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (isLast) {
          return <Text key={item.href} c="dimmed">{item.title}</Text>;
        }
        return (
          <Anchor key={item.href} component={Link} href={item.href} size="sm">
            {item.title}
          </Anchor>
        );
      })}
    </Breadcrumbs>
  );
}
