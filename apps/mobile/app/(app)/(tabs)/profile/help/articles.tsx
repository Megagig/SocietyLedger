import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { IconCircle } from '@/components/ui/IconCircle';
import { Skeleton } from '@/components/ui/Skeleton';
import { categoryLabel } from '@/features/help/labels';
import { useCategoryArticles } from '@/features/help/queries';

/** Articles in one category — where "Browse by category" on the Help Center lands. */
export default function HelpCategoryScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const name = category ?? '';
  const query = useCategoryArticles(name);
  const articles = query.data?.articles ?? [];

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader title={name ? categoryLabel(name) : 'Articles'} onBack={() => router.back()} />

      <View className="pb-6">
        {query.isPending ? (
          <Skeleton width="100%" height={160} radius="lg" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : articles.length === 0 ? (
          <InlineEmpty icon={FileText} message="No articles in this category yet." />
        ) : (
          <ListGroup>
            {articles.map((article) => (
              <ListItem
                key={article.id}
                leading={<IconCircle icon={FileText} tone="primary" />}
                title={article.title}
                meta={article.excerpt ?? undefined}
                showChevron
                onPress={() => router.push(`/(app)/(tabs)/profile/help/article/${article.slug}` as never)}
              />
            ))}
          </ListGroup>
        )}
      </View>
    </Screen>
  );
}
