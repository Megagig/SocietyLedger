import type { ReactNode } from 'react';

/**
 * SVG using docs tokens via `currentColor`/CSS variables (works in both
 * themes); caption + text alternative below, collapsed behind
 * "Describe this diagram" (`ui-rules.md §11.5`/§11.8). Authors hand-author
 * the inline SVG as `children`.
 */
export function Diagram({
  caption,
  alt,
  children,
}: {
  caption?: ReactNode;
  alt: string;
  children: ReactNode;
}) {
  return (
    <figure className="my-6 not-prose" role="img" aria-label={alt}>
      <div className="overflow-x-auto rounded-(--radius-md) border border-fd-border p-4 text-fd-foreground [&_svg]:mx-auto">
        {children}
      </div>
      {caption && <figcaption className="docs-text-small mt-2 text-center text-fd-muted-foreground">{caption}</figcaption>}
      <details className="docs-text-small mt-2 text-fd-muted-foreground">
        <summary className="cursor-pointer">Describe this diagram</summary>
        <p className="mt-1">{alt}</p>
      </details>
    </figure>
  );
}
