'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconSearch,
  IconChevronDown,
  IconQuestionMark,
} from '@tabler/icons-react';
import { listFAQs, getFAQsByCategory, getFAQCategories, FAQItem, FAQByCategory } from '@/lib/api/help';

export default function FAQsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [faqsByCategory, setFaqsByCategory] = useState<FAQByCategory[]>([]);
  const [categories, setCategories] = useState<{ name: string; label: string }[]>([]);
  const [expandedFAQs, setExpandedFAQs] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [faqData, catData] = await Promise.all([
        getFAQsByCategory(),
        getFAQCategories(),
      ]);
      setFaqsByCategory(faqData);
      setCategories(catData);
    } catch (error) {
      console.error('Failed to load FAQs:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleFAQ(faqId: number) {
    setExpandedFAQs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(faqId)) {
        newSet.delete(faqId);
      } else {
        newSet.add(faqId);
      }
      return newSet;
    });
  }

  function expandAll() {
    const allIds = faqsByCategory.flatMap(cat => cat.items.map(faq => faq.id));
    setExpandedFAQs(new Set(allIds));
  }

  function collapseAll() {
    setExpandedFAQs(new Set());
  }

  function formatCategoryLabel(category: string): string {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // Filter FAQs based on search and category
  const filteredFAQs = faqsByCategory
    .map(cat => ({
      ...cat,
      items: cat.items.filter(faq => {
        const matchesSearch = !searchQuery || 
          faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !selectedCategory || cat.category === selectedCategory;
        return matchesSearch && matchesCategory;
      }),
    }))
    .filter(cat => cat.items.length > 0);

  const totalFAQs = filteredFAQs.reduce((sum, cat) => sum + cat.items.length, 0);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-6"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mb-8"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/help"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400 mb-4"
        >
          <IconArrowLeft size={18} />
          Back to Help Center
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Frequently Asked Questions</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Find quick answers to common questions
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search FAQs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results Count and Actions */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {totalFAQs} FAQ{totalFAQs !== 1 ? 's' : ''} found
        </span>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
          >
            Expand all
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            onClick={collapseAll}
            className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* FAQs by Category */}
      {filteredFAQs.length > 0 ? (
        <div className="space-y-6">
          {filteredFAQs.map((category) => (
            <div
              key={category.category}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Category Header */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <IconQuestionMark size={20} className="text-purple-500" />
                  {formatCategoryLabel(category.category)}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({category.items.length})
                  </span>
                </h2>
              </div>

              {/* FAQ Items */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {category.items.map((faq) => (
                  <div key={faq.id} className="px-6">
                    <button
                      onClick={() => toggleFAQ(faq.id)}
                      className="w-full py-4 flex items-start justify-between text-left"
                    >
                      <span className="font-medium text-gray-900 dark:text-white pr-4">
                        {faq.question}
                      </span>
                      <IconChevronDown
                        size={20}
                        className={`flex-shrink-0 text-gray-400 transition-transform ${
                          expandedFAQs.has(faq.id) ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {expandedFAQs.has(faq.id) && (
                      <div className="pb-4 text-gray-600 dark:text-gray-400 whitespace-pre-line">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <IconQuestionMark size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No FAQs found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery
              ? `No FAQs match "${searchQuery}"`
              : 'No FAQs available in this category'}
          </p>
          {(searchQuery || selectedCategory) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('');
              }}
              className="text-teal-600 dark:text-teal-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Still Need Help */}
      <div className="mt-8 bg-gradient-to-br from-teal-500 to-green-600 rounded-xl p-6 text-white text-center">
        <h3 className="text-lg font-semibold mb-2">Can&apos;t find what you&apos;re looking for?</h3>
        <p className="text-white/80 mb-4">
          Our support team is ready to help you with any questions.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/help/tickets/new"
            className="px-6 py-2 bg-white text-teal-600 rounded-lg font-medium hover:bg-white/90 transition-colors"
          >
            Create Support Ticket
          </Link>
          <Link
            href="/dashboard/help/articles"
            className="px-6 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors"
          >
            Browse Articles
          </Link>
        </div>
      </div>
    </div>
  );
}
