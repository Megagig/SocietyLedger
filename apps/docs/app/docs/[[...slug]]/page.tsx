import { source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getPageImageUrl, getPageMarkdownUrl } from '@/lib/shared';
import { DocsPageProvider } from '@/lib/docs-page-context';
import { AppliesTo } from '@/components/mdx/applies-to';
import { CardGrid, Card } from '@/components/mdx/card-grid';
import { Related } from '@/components/mdx/related';
import { Feedback } from '@/components/mdx/feedback';
import { LastUpdated } from '@/components/mdx/last-updated';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;
  const showAppliesTo = page.data.type !== 'overview' && page.data.type !== 'faq';

  const related = page.data.related
    .map((href) => {
      const entry = source.getPageByHref(href);
      return entry
        ? { title: entry.page.data.title, description: entry.page.data.description, href }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const childPages =
    page.data.type === 'overview'
      ? source.getPages().filter((candidate) => {
          if (candidate.url === page.url) return false;
          const rest = candidate.url.slice(page.url.length);
          return candidate.url.startsWith(page.url) && rest.startsWith('/') && !rest.slice(1).includes('/');
        })
      : [];

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
      </div>
      <DocsPageProvider
        data={{
          audience: page.data.audience,
          platforms: page.data.platforms,
          permission: page.data.permission,
          module: page.data.module,
        }}
      >
        {showAppliesTo && <AppliesTo />}
        <DocsBody>
          <MDX
            components={getMDXComponents({
              // this allows you to link to other pages with relative file paths
              a: createRelativeLink(source, page),
            })}
          />
          {childPages.length > 0 && (
            <CardGrid>
              {childPages.map((child) => (
                <Card key={child.url} title={child.data.title} description={child.data.description} href={child.url} />
              ))}
            </CardGrid>
          )}
        </DocsBody>
      </DocsPageProvider>
      <Related items={related} />
      <Feedback slug={page.url} />
      <LastUpdated date={page.data.lastVerified} />
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImageUrl(page).url,
    },
  };
}
