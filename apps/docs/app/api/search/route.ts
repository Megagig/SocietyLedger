import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { synonymKeywordsFor } from '@/lib/search-synonyms';

export const revalidate = false;

export const { staticGET: GET } = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  language: 'english',
  async buildIndex(page) {
    const structuredData = page.data.structuredData;

    const extra = synonymKeywordsFor(
      [page.data.title, page.data.description, ...(page.data.keywords ?? []), ...structuredData.contents.map((c) => c.content)].join(
        ' ',
      ),
    );

    return {
      id: page.url,
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      // Section grouping (ui-rules.md §11.5) — filterable via <TagsList> in components/search.tsx.
      tag: page.slugs[0],
      structuredData:
        extra.length > 0
          ? { ...structuredData, contents: [...structuredData.contents, { heading: undefined, content: extra.join(' ') }] }
          : structuredData,
    };
  },
});
