import type { FaqCategoryGroupDTO } from '@/types/api/help';

/** Keeps only the questions whose question or answer contains every word typed — plain, local, case-insensitive. */
export function filterFaqs(groups: FaqCategoryGroupDTO[], query: string): FaqCategoryGroupDTO[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const haystack = `${item.question} ${item.answer}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
      }),
    }))
    .filter((group) => group.items.length > 0);
}
