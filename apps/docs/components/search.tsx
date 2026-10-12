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
import { useState } from 'react';
import { sections } from '@/scripts/sitemap-data';

export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n(); // (optional) for i18n
  const [tag, setTag] = useState<string | undefined>();
  const search = useStaticSearch({
    locale,
    tag,
  });

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
