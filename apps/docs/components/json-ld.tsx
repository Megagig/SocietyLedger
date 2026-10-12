/**
 * `<script type="application/ld+json">` for the `TechArticle` +
 * `BreadcrumbList` structured data every page carries (`architecture.md
 * §9.9`/§14.9's "In scope" list; `code-standards.md §17` doesn't cover
 * SEO specifically, so this follows the sitemap/metadata conventions
 * built the same session).
 */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
