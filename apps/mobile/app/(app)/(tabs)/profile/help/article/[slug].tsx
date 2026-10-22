import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { HelpArticleBody } from '@/features/help/components/HelpArticleBody';
import { categoryLabel } from '@/features/help/labels';
import { useHelpArticle, useVoteArticle } from '@/features/help/queries';
import { formatDate } from '@/lib/dates';

/** project-overview.md §6.7 P6 — a help article with "Was this helpful?". */
export default function HelpArticleScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const articleQuery = useHelpArticle(slug ?? '');
  const vote = useVoteArticle(slug ?? '');
  // The server counts every call, so one answer per visit is enforced here.
  const [answered, setAnswered] = useState(false);

  const article = articleQuery.data;

  const answer = (helpful: boolean) => {
    if (!article || answered) return;
    vote.mutate(
      { id: article.id, helpful },
      {
        onSuccess: () => setAnswered(true),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not send your feedback. Try again.'),
      },
    );
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Help article" onBack={() => router.back()} />

      {articleQuery.isPending ? (
        <View className="gap-3">
          <Skeleton width="80%" height={28} />
          <Skeleton width="100%" height={16} />
          <Skeleton width="100%" height={16} />
          <Skeleton width="60%" height={16} />
        </View>
      ) : articleQuery.isError || !article ? (
        <ErrorState
          title="This article isn't available."
          description="It may have been removed, or isn't meant for your role."
          error={articleQuery.error}
          onRetry={() => articleQuery.refetch()}
        />
      ) : (
        <View className="gap-5 pb-8">
          <View className="gap-2">
            <Text variant="h1">{article.title}</Text>
            <View className="flex-row flex-wrap items-center gap-2">
              <Badge tone="primary">{categoryLabel(article.category)}</Badge>
              <Text variant="caption" tone="secondary">{`Updated ${formatDate(article.updatedAt, 'long')}`}</Text>
            </View>
          </View>

          <HelpArticleBody content={article.content} />

          <Card className="gap-3">
            {answered ? (
              <Text variant="body-strong" align="center">
                Thanks for your feedback.
              </Text>
            ) : (
              <>
                <Text variant="body-strong" align="center">
                  Was this helpful?
                </Text>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button variant="secondary" fullWidth loading={vote.isPending} onPress={() => answer(true)}>
                      Yes
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button variant="secondary" fullWidth loading={vote.isPending} onPress={() => answer(false)}>
                      No
                    </Button>
                  </View>
                </View>
              </>
            )}
          </Card>
        </View>
      )}
    </Screen>
  );
}
