'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IconHelp,
  IconSearch,
  IconArticle,
  IconQuestionMark,
  IconTicket,
  IconChevronRight,
  IconThumbUp,
  IconRocket,
  IconUpload,
  IconShield,
  IconChartBar,
  IconSettings,
  IconCurrencyDollar,
  IconBook,
  IconFileText,
  IconScale,
  IconUser,
  IconCreditCard,
  IconClock,
  IconMessageCircle,
  IconSparkles,
  IconPencil,
  IconBook2,
} from '@tabler/icons-react';
import { getHelpCenter, searchArticles, HelpArticle, FAQItem, QuickAction } from '@/lib/api/help';
import { getOpenTicketCount } from '@/lib/api/support';
import { AIChatbot } from '@/components/help/AIChatbot';
import { docsUrl } from '@/lib/docs';

// Icon mapping for quick actions
const iconMap: Record<string, React.ReactNode> = {
  rocket: <IconRocket size={24} />,
  upload: <IconUpload size={24} />,
  shield: <IconShield size={24} />,
  'chart-bar': <IconChartBar size={24} />,
  cog: <IconSettings size={24} />,
  'currency-dollar': <IconCurrencyDollar size={24} />,
  'book-open': <IconBook size={24} />,
  'document-text': <IconFileText size={24} />,
  scale: <IconScale size={24} />,
  'presentation-chart-line': <IconChartBar size={24} />,
  document: <IconFileText size={24} />,
  'credit-card': <IconCreditCard size={24} />,
  clock: <IconClock size={24} />,
  user: <IconUser size={24} />,
  'chat-bubble-left-right': <IconMessageCircle size={24} />,
};


export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HelpArticle[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [featuredArticles, setFeaturedArticles] = useState<HelpArticle[]>([]);
  const [topFAQs, setTopFAQs] = useState<FAQItem[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    loadHelpCenter();
    loadTicketCount();
  }, []);

  async function loadHelpCenter() {
    try {
      const data = await getHelpCenter();
      console.log('Help center data:', data);
      setFeaturedArticles(data.featuredArticles || []);
      setTopFAQs(data.topFAQs || []);
      setQuickActions(data.quickActions || []);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to load help center:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTicketCount() {
    try {
      const count = await getOpenTicketCount();
      setOpenTicketCount(count);
    } catch (error) {
      console.error('Failed to load ticket count:', error);
    }
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchArticles(query, 5);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }

  function formatCategoryLabel(category: string): string {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-8"></div>
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Help & Support
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Find answers, browse articles, or create a support ticket
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-8">
        <div className="relative">
          <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search for help articles, FAQs, or topics..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
          />
          {isSearching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-5 w-5 border-2 border-teal-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {searchResults.map((article) => (
              <Link
                key={article.id}
                href={`/dashboard/help/articles/${article.slug}`}
                className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <IconArticle size={20} className="text-teal-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{article.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{article.excerpt}</p>
                </div>
                <IconChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              </Link>
            ))}
            <Link
              href={`/dashboard/help/articles?q=${encodeURIComponent(searchQuery)}`}
              className="block p-3 text-center text-sm text-teal-600 dark:text-teal-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700"
            >
              View all results
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {quickActions.slice(0, 5).map((action) => (
              <Link
                key={action.id}
                href={action.href}
                className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-teal-500 dark:hover:border-teal-500 hover:shadow-md transition-all text-center group"
              >
                <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-3 group-hover:scale-110 transition-transform">
                  {iconMap[action.icon] || <IconHelp size={24} />}
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{action.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Articles & FAQs */}
        <div className="lg:col-span-2 space-y-8">
          {/* Featured Articles */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <IconArticle size={20} className="text-teal-500" />
                Featured Articles
              </h2>
              <Link href="/dashboard/help/articles" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {featuredArticles.length > 0 ? (
                featuredArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/dashboard/help/articles/${article.slug}`}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">{article.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{article.excerpt}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                          {formatCategoryLabel(article.category)}
                        </span>
                        <span className="flex items-center gap-1">
                          <IconThumbUp size={12} /> {article.helpfulCount}
                        </span>
                      </div>
                    </div>
                    <IconChevronRight size={20} className="text-gray-400 flex-shrink-0" />
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <IconArticle size={40} className="mx-auto mb-2 opacity-50" />
                  <p>No articles available yet</p>
                </div>
              )}
            </div>
          </div>

          {/* FAQs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <IconQuestionMark size={20} className="text-purple-500" />
                Frequently Asked Questions
              </h2>
              <Link href="/dashboard/help/faqs" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {topFAQs.length > 0 ? (
                topFAQs.map((faq) => (
                  <div key={faq.id} className="p-4">
                    <button
                      onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <span className="font-medium text-gray-900 dark:text-white pr-4">{faq.question}</span>
                      <IconChevronRight
                        size={20}
                        className={`text-gray-400 flex-shrink-0 transition-transform ${
                          expandedFAQ === faq.id ? 'rotate-90' : ''
                        }`}
                      />
                    </button>
                    {expandedFAQ === faq.id && (
                      <div className="mt-3 text-gray-600 dark:text-gray-400 text-sm pl-0 pr-8">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <IconQuestionMark size={40} className="mx-auto mb-2 opacity-50" />
                  <p>No FAQs available yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Support & Categories */}
        <div className="space-y-6">
          {/* Support Ticket Card */}
          <div className="bg-gradient-to-br from-teal-500 to-green-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <IconTicket size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Need More Help?</h3>
                <p className="text-white/80 text-sm">Create a support ticket</p>
              </div>
            </div>
            <p className="text-white/90 text-sm mb-4">
              Can&apos;t find what you&apos;re looking for? Our support team is here to help.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/help/tickets/new"
                className="flex-1 bg-white text-teal-600 font-medium py-2 px-4 rounded-lg text-center hover:bg-white/90 transition-colors"
              >
                Create Ticket
              </Link>
              {openTicketCount > 0 && (
                <Link
                  href="/dashboard/help/tickets"
                  className="bg-white/20 text-white font-medium py-2 px-4 rounded-lg hover:bg-white/30 transition-colors"
                >
                  {openTicketCount} Open
                </Link>
              )}
            </div>
          </div>

          {/* AI Assistant Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <IconSparkles size={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">AI Assistant</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Get instant answers</p>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Ask our AI assistant any question about using SocietyLedger.
            </p>
            <button
              className="w-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium py-2 px-4 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors flex items-center justify-center gap-2"
              onClick={() => {/* TODO: Open AI chatbot */}}
            >
              <IconMessageCircle size={18} />
              Start Chat
            </button>
          </div>

          {/* User Manual Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                <IconBook2 size={20} className="text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">User Manual</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">The full SocietyLedger guide</p>
              </div>
            </div>
            <a
              href={docsUrl('/docs', 'web_help_center')}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full block text-center bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-medium py-2 px-4 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
            >
              Read the full user manual
            </a>
          </div>

          {/* Browse by Category */}
          {categories.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Browse by Category</h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {categories.map((category) => (
                  <Link
                    key={category.name}
                    href={`/dashboard/help/articles?category=${category.name}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <span className="text-gray-700 dark:text-gray-300">{formatCategoryLabel(category.name)}</span>
                    <span className="text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {category.count}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Contact Info */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Need urgent help? Email us at{' '}
              <a href="mailto:support@societyledger.com.ng" className="text-teal-600 dark:text-teal-400 hover:underline">
                support@societyledger.com.ng
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* AI Chatbot */}
      <AIChatbot />
    </div>
  );
}
