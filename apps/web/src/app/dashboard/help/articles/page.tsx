'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  IconSearch,
  IconArticle,
  IconChevronRight,
  IconThumbUp,
  IconFilter,
  IconX,
  IconArrowLeft,
} from '@tabler/icons-react';
import { listArticles, searchArticles, getArticleCategories, HelpArticle } from '@/lib/api/help';

export default function ArticlesPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [categories, setCategories] = useState<{ name: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const limit = 12;

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadArticles();
  }, [selectedCategory, page]);

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  async function loadCategories() {
    try {
      const cats = await getArticleCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  async function loadArticles() {
    setLoading(true);
    try {
      const result = await listArticles({
        category: selectedCategory || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setArticles(result.articles);
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load articles:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.length < 2) {
      loadArticles();
      return;
    }

    setLoading(true);
    try {
      const results = await searchArticles(query, 20);
      setArticles(results);
      setTotal(results.length);
      setHasMore(false);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatCategoryLabel(category: string): string {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function clearFilters() {
    setSearchQuery('');
    setSelectedCategory('');
    setPage(1);
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/help"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400 mb-4"
        >
          <IconArrowLeft size={18} />
          Back to Help Center
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Help Articles</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Browse our knowledge base to find answers
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.name} value={cat.name}>
                {cat.label}
              </option>
            ))}
          </select>
          {(searchQuery || selectedCategory) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <IconX size={18} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        {loading ? 'Loading...' : `${total} article${total !== 1 ? 's' : ''} found`}
      </div>

      {/* Articles Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-3"></div>
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-1"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/dashboard/help/articles/${article.slug}`}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-teal-500 dark:hover:border-teal-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded">
                  {formatCategoryLabel(article.category)}
                </span>
                {article.isFeatured && (
                  <span className="text-xs px-2 py-1 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded">
                    Featured
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {article.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                {article.excerpt}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <IconThumbUp size={14} />
                  {article.helpfulCount} found helpful
                </span>
                <IconChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <IconArticle size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No articles found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery
              ? `No articles match "${searchQuery}"`
              : 'No articles available in this category'}
          </p>
          {(searchQuery || selectedCategory) && (
            <button
              onClick={clearFilters}
              className="text-teal-600 dark:text-teal-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && total > limit && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
