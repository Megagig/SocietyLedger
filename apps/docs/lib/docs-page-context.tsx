'use client';
import { createContext, useContext, type ReactNode } from 'react';

/**
 * The plain, serializable subset of a page's frontmatter these components
 * need — never the full Fumadocs `page.data` (it also carries the compiled
 * MDX body function, `getText`/`getMDAST`/`preload`, etc., none of which
 * can cross into a Client Component).
 */
export interface PageFrontmatter {
  audience: string[];
  platforms: string[];
  permission?: string;
  module?: string;
}

/**
 * Lets MDX components written as bare self-closing tags — `<AppliesTo />`,
 * `<PermissionNote />`, `<PlanNote />` — read the current page's frontmatter
 * without the author passing it in by hand. The page route provides this
 * once per page, wrapping the MDX body.
 */
const DocsPageContext = createContext<PageFrontmatter | null>(null);

export function DocsPageProvider({
  data,
  children,
}: {
  data: PageFrontmatter;
  children: ReactNode;
}) {
  return <DocsPageContext.Provider value={data}>{children}</DocsPageContext.Provider>;
}

export function useDocsPageData(): PageFrontmatter {
  const data = useContext(DocsPageContext);
  if (!data) throw new Error('useDocsPageData must be used within <DocsPageProvider>');
  return data;
}
