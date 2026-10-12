import { CardGrid, Card } from './card-grid';

export interface RelatedItem {
  title: string;
  description?: string;
  href: string;
}

/**
 * Up to 3 related cards (`ui-rules.md §11.4`), resolved from frontmatter
 * `related` by the page route (it has `source`; this component just
 * renders what it's given — `architecture.md §14.5`).
 */
export function Related({ items }: { items: RelatedItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="my-6">
      <h2>Related</h2>
      <CardGrid>
        {items.slice(0, 3).map((item) => (
          <Card key={item.href} title={item.title} description={item.description} href={item.href} />
        ))}
      </CardGrid>
    </section>
  );
}
