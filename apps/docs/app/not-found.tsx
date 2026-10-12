'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { docsRoute } from '@/lib/shared';

export default function NotFound() {
  const { setOpenSearch } = useSearchContext();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-sm font-semibold text-fd-muted-foreground">404</p>
      <h1 className="text-2xl font-bold text-fd-foreground">We couldn&apos;t find that page</h1>
      <p className="max-w-md text-fd-muted-foreground">
        It may have moved, or the link might be out of date. Try searching, or try a different
        word, e.g. dues, levy, receipt.
      </p>
      <button
        type="button"
        onClick={() => setOpenSearch(true)}
        className="flex items-center gap-2 rounded-md border border-fd-border bg-fd-secondary px-4 py-2 text-sm font-medium text-fd-secondary-foreground hover:bg-fd-accent"
      >
        <Search size={16} />
        Search the documentation
      </button>
      <Link href={docsRoute} className="text-sm font-medium text-fd-primary hover:underline">
        Back to docs
      </Link>
    </div>
  );
}
