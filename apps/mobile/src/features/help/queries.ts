import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { helpApi } from '@/api/endpoints/help';
import { useTenantKey } from '@/hooks/useTenantKey';

export const helpKeys = {
  all: (tenant: string) => [tenant, 'help'] as const,
  center: (tenant: string) => [...helpKeys.all(tenant), 'center'] as const,
  search: (tenant: string, query: string) => [...helpKeys.all(tenant), 'search', query] as const,
  category: (tenant: string, category: string) => [...helpKeys.all(tenant), 'category', category] as const,
  article: (tenant: string, slug: string) => [...helpKeys.all(tenant), 'article', slug] as const,
  faqs: (tenant: string) => [...helpKeys.all(tenant), 'faqs'] as const,
};

const FIVE_MINUTES = 5 * 60 * 1000;

export function useHelpCenter() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: helpKeys.center(tenant), queryFn: helpApi.getHelpCenter, staleTime: FIVE_MINUTES });
}

/** Runs only for 2+ characters — the API rejects anything shorter. Pass the already-debounced term. */
export function useArticleSearch(query: string) {
  const tenant = useTenantKey();
  const term = query.trim();
  return useQuery({ queryKey: helpKeys.search(tenant, term), queryFn: () => helpApi.searchArticles(term), enabled: term.length >= 2 });
}

export function useCategoryArticles(category: string) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: helpKeys.category(tenant, category),
    queryFn: () => helpApi.listArticles({ category }),
    enabled: category.length > 0,
    staleTime: FIVE_MINUTES,
  });
}

export function useHelpArticle(slug: string) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: helpKeys.article(tenant, slug), queryFn: () => helpApi.getArticle(slug), enabled: slug.length > 0, staleTime: FIVE_MINUTES });
}

export function useFaqs() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: helpKeys.faqs(tenant), queryFn: helpApi.getFaqsByCategory, staleTime: FIVE_MINUTES });
}

/** "Was this helpful?" — updates the cached article's counters so the screen reflects the vote. */
export function useVoteArticle(slug: string) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return useMutation({
    mutationFn: ({ id, helpful }: { id: number; helpful: boolean }) => helpApi.voteArticle(id, helpful),
    onSuccess: (counts) => {
      queryClient.setQueryData(helpKeys.article(tenant, slug), (current: Awaited<ReturnType<typeof helpApi.getArticle>> | undefined) =>
        current ? { ...current, ...counts } : current,
      );
    },
  });
}
