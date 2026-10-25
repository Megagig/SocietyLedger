import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, CircleHelp } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Divider } from '@/components/ui/Divider';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { filterFaqs } from '@/features/help/filterFaqs';
import { categoryLabel } from '@/features/help/labels';
import { useFaqs } from '@/features/help/queries';
import { useThemeTokens } from '@/providers/ThemeProvider';

/** project-overview.md §6.7 P7 — FAQs: accordion by category, with search. */
export default function FaqsScreen() {
  const router = useRouter();
  const { color } = useThemeTokens();
  const faqsQuery = useFaqs();
  const [search, setSearch] = useState('');
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  const groups = useMemo(() => filterFaqs(faqsQuery.data ?? [], search), [faqsQuery.data, search]);

  const toggle = (id: number) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Screen edges={['top']} refreshing={faqsQuery.isRefetching} onRefresh={() => faqsQuery.refetch()}>
      <ScreenHeader title="FAQs" onBack={() => router.back()} />

      <View className="gap-6 pb-6">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search questions" testID="faq-search" />

        {faqsQuery.isPending ? (
          <View className="gap-3">
            <Skeleton width="100%" height={56} radius="lg" />
            <Skeleton width="100%" height={56} radius="lg" />
            <Skeleton width="100%" height={56} radius="lg" />
          </View>
        ) : faqsQuery.isError ? (
          <ErrorState error={faqsQuery.error} onRetry={() => faqsQuery.refetch()} />
        ) : groups.length === 0 ? (
          <InlineEmpty icon={CircleHelp} message={search.trim() ? 'No questions match your search.' : 'No questions have been added yet.'} />
        ) : (
          groups.map((group) => (
            <Section key={group.category} title={categoryLabel(group.category)}>
              <View className="overflow-hidden rounded-md border border-border bg-surface dark:border-transparent">
                {group.items.map((item, index) => {
                  const open = openIds.has(item.id);
                  return (
                    <View key={item.id}>
                      {index > 0 ? <Divider /> : null}
                      <Pressable
                        onPress={() => toggle(item.id)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                        className="flex-row items-center gap-3 px-4 py-3"
                        testID={`faq-${item.id}`}
                      >
                        <Text variant="body-lg" className="flex-1">
                          {item.question}
                        </Text>
                        {open ? (
                          <ChevronUp size={20} color={color.textTertiary} strokeWidth={1.75} />
                        ) : (
                          <ChevronDown size={20} color={color.textTertiary} strokeWidth={1.75} />
                        )}
                      </Pressable>
                      {open ? (
                        <View className="px-4 pb-4">
                          <Text variant="body" tone="secondary">
                            {item.answer}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </Section>
          ))
        )}
      </View>
    </Screen>
  );
}
