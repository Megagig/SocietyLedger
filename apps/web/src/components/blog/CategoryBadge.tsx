'use client';

import { Badge } from '@mantine/core';
import Link from 'next/link';

interface CategoryBadgeProps {
  category: {
    id: number;
    name: string;
    slug: string;
    color: string | null;
  };
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  return (
    <Badge
      component={Link}
      href={`/blog/category/${category.slug}`}
      variant="light"
      color={category.color || 'teal'}
      size="sm"
      className="hover:opacity-80 transition-opacity"
    >
      {category.name}
    </Badge>
  );
}
