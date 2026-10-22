'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { IconArrowLeft, IconArticle, IconChevronRight, IconSearch } from '@tabler/icons-react';
import { listArticles, HelpArticle } from '@/lib/api/help';
import { toast } from '@/lib/toast';

function formatCategoryLabel(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/** The articles in one category (or all of them) — where "Browse by Category" on the Help Center lands. */
function ArticlesList() {
  const searchParams = useSearchParams();
  const category = searchParams.get('category') || undefined;

  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    listArticles({ category, limit: 100 })
      .then((result) => {
        if (!cancelled) setArticles(result.articles || []);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setArticles([]);
          toast.error(err.message || 'Failed to load articles');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const term = filter.trim().toLowerCase();
  const visible = term
    ? articles.filter((a) => a.title.toLowerCase().includes(term) || (a.excerpt || '').toLowerCase().includes(term))
    : articles;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/dashboard/help" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-600 mb-3">
          <IconArrowLeft size={16} /> Help Center
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          {category ? formatCategoryLabel(category) : 'All Articles'}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          {category ? 'Help articles in this category' : 'Every help article available to you'}
        </p>
      </div>

      <div className="relative">
        <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter these articles"
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
          <IconArticle size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            {term ? 'No articles match your filter.' : 'No articles in this category yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
          {visible.map((article) => (
            <Link
              key={article.id}
              href={`/dashboard/help/articles/${article.slug}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">{article.title}</p>
                {article.excerpt && <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{article.excerpt}</p>}
              </div>
              <IconChevronRight size={18} className="text-gray-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HelpArticlesPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto text-gray-500">Loading articles...</div>}>
      <ArticlesList />
    </Suspense>
  );
}
