'use client';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  TagsList,
  TagsListItem,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { useStaticSearch } from 'fumadocs-core/search/client';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import { useEffect, useRef, useState } from 'react';
import { sections } from '@/scripts/sitemap-data';
import { trackEvent } from '@/lib/analytics';

export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n(); // (optional) for i18n
  const [tag, setTag] = useState<string | undefined>();
  const search = useStaticSearch({
    locale,
    tag,
  });

  // docs_search (architecture.md §14.6) — once per completed query, not per keystroke.
  const lastTracked = useRef<string>('');
  useEffect(() => {
    if (!search.data || search.data.query === lastTracked.current) return;
    lastTracked.current = search.data.query;
    trackEvent('docs_search', { query: search.data.query, result_count: search.data.items.length });
  }, [search.data]);

  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        {/* Section grouping (ui-rules.md §11.5) — filters results by the tag set in app/api/search/route.ts. */}
        <TagsList tag={tag} onTagChange={setTag} className="px-3">
          {sections.map((section) => (
            <TagsListItem key={section.slug} value={section.slug}>
              {section.title}
            </TagsListItem>
          ))}
        </TagsList>
        <SearchDialogList />
      </SearchDialogContent>
    </SearchDialog>
  );
}
