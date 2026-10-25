import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';

export interface Marker {
  /** Number shown in the marker, matching the step it illustrates. */
  n: number;
  /** Position as a percentage of the image, 0–100. */
  x: number;
  y: number;
}

interface ScreenshotProps {
  caption?: ReactNode;
  variant?: 'desktop' | 'phone';
  /** Set instead of `src`/`alt` while the real capture isn't ready yet. */
  pending?: string;
  src?: string;
  alt?: string;
  markers?: Marker[];
}

const defaultSize = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };

function darkSrc(src: string): string {
  const i = src.lastIndexOf('.');
  return i === -1 ? `${src}-dark` : `${src.slice(0, i)}-dark${src.slice(i)}`;
}

/** Resolved at build time (static export), so a missing capture never ships a broken <img>. */
function hasDarkVariant(src: string): boolean {
  return existsSync(path.join(process.cwd(), 'public', darkSrc(src)));
}

/**
 * Light/dark pair, zoom (lightbox), numbered markers, `pending` placeholder
 * (`ui-rules.md §11.5`, `architecture.md §14.7`). Dark variant is derived
 * from `src` (`-<n>.webp` / `-<n>-dark.webp`, `code-standards.md §17.2`) —
 * never pass it separately; falls back to the light image when no dark file
 * exists. Pass either `pending` or both `src` and `alt`
 * (not enforced at the type level — the two call shapes didn't narrow
 * cleanly through a discriminated union with destructuring; checked at
 * runtime instead, with a dev-only console error if neither is given).
 */
export function Screenshot({ caption, variant = 'desktop', pending, src, alt, markers }: ScreenshotProps) {
  const frameClass =
    'relative overflow-hidden rounded-(--radius-md) border' +
    (variant === 'phone' ? ' mx-auto max-w-[360px]' : '');

  if (pending) {
    return (
      <figure className="my-4 not-prose">
        <div
          className={`${frameClass} flex aspect-video items-center justify-center border-dashed p-6 text-center docs-text-small text-fd-muted-foreground`}
          style={{ borderColor: 'var(--docs-screenshot-frame)' }}
        >
          Screenshot pending: {pending}
        </div>
      </figure>
    );
  }

  if (!src || !alt) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('<Screenshot> needs either `pending` or both `src` and `alt`.');
    }
    return null;
  }

  const { width, height } = defaultSize[variant];
  const dark = hasDarkVariant(src);

  return (
    <figure className="my-4 not-prose">
      <div className={frameClass} style={{ borderColor: 'var(--docs-screenshot-frame)' }}>
        {dark ? (
          <>
            <ImageZoom src={src} alt={alt} width={width} height={height} className="dark:hidden" />
            <ImageZoom src={darkSrc(src)} alt={alt} width={width} height={height} className="hidden dark:block" />
          </>
        ) : (
          // No dark capture yet — the light one serves both themes.
          <ImageZoom src={src} alt={alt} width={width} height={height} />
        )}
        {markers?.map((marker) => (
          <span
            key={marker.n}
            aria-hidden
            className="docs-text-micro absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
            style={{
              left: `${marker.x}%`,
              top: `${marker.y}%`,
              backgroundColor: 'var(--docs-marker-bg)',
              color: 'var(--docs-marker-fg)',
            }}
          >
            {marker.n}
          </span>
        ))}
      </div>
      {caption && <figcaption className="docs-text-small mt-2 text-center text-fd-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}
