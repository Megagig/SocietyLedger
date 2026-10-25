import { useRouter } from 'expo-router';
import { BookOpen, CircleHelp, FileText, Inbox, LifeBuoy, MessageCircle, Search as SearchIcon } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { openSupportChat } from '@/components/feedback/SupportCard';
import { SearchField } from '@/components/forms/SearchField';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { IconCircle } from '@/components/ui/IconCircle';
import { Skeleton } from '@/components/ui/Skeleton';
import { QuickLinkTile } from '@/features/help/components/QuickLinkTile';
import { categoryLabel } from '@/features/help/labels';
import { useArticleSearch, useHelpCenter } from '@/features/help/queries';
import { SUPPORT_CREATE_ACCESS, SUPPORT_ESCALATE_ACCESS, useCanViewTickets, useMyTickets } from '@/features/support/queries';
import { isOpenTicket } from '@/features/support/labels';
import { useCan } from '@/hooks/useCan';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { openUserManual } from '@/lib/docs';
import type { HelpArticleDTO } from '@/types/api/help';

const openArticle = (router: ReturnType<typeof useRouter>, article: HelpArticleDTO) =>
  router.push(`/(app)/(tabs)/profile/help/article/${article.slug}` as never);

/** project-overview.md §6.7 P5 — Help Center: search, shortcuts, featured articles, categories, top FAQs, contact support. */
export default function HelpCenterScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim(), 300);
  const searching = term.length >= 2;

  const centerQuery = useHelpCenter();
  const searchQuery = useArticleSearch(term);
  const center = centerQuery.data;

  const canViewTickets = useCanViewTickets();
  const canCreateTicket = useCan(SUPPORT_CREATE_ACCESS);
  const canEscalate = useCan(SUPPORT_ESCALATE_ACCESS);
  const ticketsQuery = useMyTickets();
  const openTickets = (ticketsQuery.data?.tickets ?? []).filter((t) => isOpenTicket(t.status)).length;

  return (
    <Screen edges={['top']} refreshing={centerQuery.isRefetching} onRefresh={() => centerQuery.refetch()}>
      <ScreenHeader title="Help & support" onBack={() => router.back()} docsKey="P5" />

      <View className="gap-6 pb-6">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search help articles" testID="help-search" />

        {searching ? (
          <Section title="Search results">
            {searchQuery.isPending ? (
              <Skeleton width="100%" height={72} radius="lg" />
            ) : searchQuery.isError ? (
              <ErrorState error={searchQuery.error} onRetry={() => searchQuery.refetch()} />
            ) : (searchQuery.data ?? []).length === 0 ? (
              <InlineEmpty icon={SearchIcon} message={`No articles match "${term}". Try different words, or browse below.`} />
            ) : (
              <ListGroup>
                {(searchQuery.data ?? []).map((article) => (
                  <ListItem
                    key={article.id}
                    leading={<IconCircle icon={FileText} tone="info" />}
                    title={article.title}
                    meta={article.excerpt ?? categoryLabel(article.category)}
                    showChevron
                    onPress={() => openArticle(router, article)}
                  />
                ))}
              </ListGroup>
            )}
          </Section>
        ) : (
          <>
            <View className="flex-row gap-3">
              <QuickLinkTile icon={BookOpen} label="User manual" tone="primary" onPress={() => void openUserManual('help_center')} testID="help-user-manual" />
              <QuickLinkTile icon={CircleHelp} label="FAQs" tone="info" onPress={() => router.push('/(app)/(tabs)/profile/help/faqs' as never)} testID="help-faqs" />
              <QuickLinkTile
                icon={MessageCircle}
                label="Contact support"
                tone="success"
                onPress={() => openSupportChat('Hello, I need help with the SocietyLedger app.')}
                testID="help-contact"
              />
            </View>

            {canViewTickets || canCreateTicket ? (
              <Section title="Talk to your association">
                <ListGroup>
                  {canViewTickets ? (
                    <ListItem
                      leading={<IconCircle icon={Inbox} tone="info" />}
                      title="My tickets"
                      meta="Questions you've sent to your association's admins"
                      trailing={openTickets > 0 ? <Badge tone="warning">{`${openTickets} open`}</Badge> : undefined}
                      showChevron
                      onPress={() => router.push('/(app)/(tabs)/profile/help/tickets' as never)}
                      testID="help-my-tickets"
                    />
                  ) : null}
                  {canCreateTicket ? (
                    <ListItem
                      leading={<IconCircle icon={LifeBuoy} tone="accent" />}
                      title="Open a new ticket"
                      meta="When the help centre doesn't have your answer"
                      showChevron
                      onPress={() => router.push('/(app)/(tabs)/profile/help/tickets/new' as never)}
                      testID="help-new-ticket"
                    />
                  ) : null}
                  {canEscalate ? (
                    <ListItem
                      leading={<IconCircle icon={MessageCircle} tone="success" />}
                      title="Contact SocietyLedger"
                      meta="Billing, bugs, modules or data — straight to the platform team"
                      showChevron
                      onPress={() => router.push('/(app)/(tabs)/profile/help/tickets/new?to=platform' as never)}
                      testID="help-contact-platform"
                    />
                  ) : null}
                </ListGroup>
              </Section>
            ) : null}

            {centerQuery.isPending ? (
              <View className="gap-3">
                <Skeleton width="100%" height={140} radius="lg" />
                <Skeleton width="100%" height={140} radius="lg" />
              </View>
            ) : centerQuery.isError ? (
              <ErrorState error={centerQuery.error} onRetry={() => centerQuery.refetch()} />
            ) : center ? (
              <>
                <Section title="Featured articles">
                  {center.featuredArticles.length === 0 ? (
                    <InlineEmpty icon={FileText} message="No featured articles yet." />
                  ) : (
                    <ListGroup>
                      {center.featuredArticles.map((article) => (
                        <ListItem
                          key={article.id}
                          leading={<IconCircle icon={FileText} tone="primary" />}
                          title={article.title}
                          meta={article.excerpt ?? categoryLabel(article.category)}
                          showChevron
                          onPress={() => openArticle(router, article)}
                        />
                      ))}
                    </ListGroup>
                  )}
                </Section>

                {center.categories.length > 0 ? (
                  <Section title="Browse by category">
                    <ListGroup>
                      {center.categories.map((category) => (
                        <ListItem
                          key={category.name}
                          title={categoryLabel(category.name)}
                          trailing={<Badge tone="neutral">{String(category.count)}</Badge>}
                          showChevron
                          onPress={() => router.push(`/(app)/(tabs)/profile/help/articles?category=${encodeURIComponent(category.name)}` as never)}
                        />
                      ))}
                    </ListGroup>
                  </Section>
                ) : null}

                {center.topFAQs.length > 0 ? (
                  <Section title="Popular questions" onSeeAll={() => router.push('/(app)/(tabs)/profile/help/faqs' as never)}>
                    <ListGroup>
                      {center.topFAQs.map((faq) => (
                        <ListItem
                          key={faq.id}
                          leading={<IconCircle icon={LifeBuoy} tone="accent" />}
                          title={faq.question}
                          showChevron
                          onPress={() => router.push('/(app)/(tabs)/profile/help/faqs' as never)}
                        />
                      ))}
                    </ListGroup>
                  </Section>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}
