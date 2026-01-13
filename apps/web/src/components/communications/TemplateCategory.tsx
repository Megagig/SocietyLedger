'use client';

import { Badge, Group, Text, Stack } from '@mantine/core';
import { IconFolder } from '@tabler/icons-react';

interface TemplateCategoryProps {
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  categoryCounts?: Record<string, number>;
}

export function TemplateCategory({
  categories,
  selectedCategory,
  onCategoryChange,
  categoryCounts = {},
}: TemplateCategoryProps) {
  return (
    <Stack gap="md">
      <Text size="sm" fw={500} mb="xs">Filter by Category</Text>
      <Group gap="xs">
        <Badge
          variant={selectedCategory === null ? 'filled' : 'outline'}
          color="blue"
          size="lg"
          style={{ cursor: 'pointer' }}
          onClick={() => onCategoryChange(null)}
        >
          All ({Object.values(categoryCounts).reduce((a, b) => a + b, 0)})
        </Badge>

        {categories.map((category) => (
          <Badge
            key={category}
            variant={selectedCategory === category ? 'filled' : 'outline'}
            color="blue"
            size="lg"
            leftSection={<IconFolder size={14} />}
            style={{ cursor: 'pointer' }}
            onClick={() => onCategoryChange(category)}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
            {categoryCounts[category] !== undefined && (
              <Text size="xs" ml="xs">({categoryCounts[category]})</Text>
            )}
          </Badge>
        ))}
      </Group>
    </Stack>
  );
}
