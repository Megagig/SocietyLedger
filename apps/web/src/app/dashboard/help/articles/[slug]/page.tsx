'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  IconArrowLeft,
  IconThumbUp,
  IconThumbDown,
  IconClock,
  IconEye,
  IconTag,
  IconArticle,
  IconChevronRight,
} from '@tabler/icons-react';
import { getArticleBySlug, markArticleHelpful, searchArticles, HelpArticle } from '@/lib/api/help';

export default function ArticleDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState<'helpful' | 'not_helpful' | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    if (slug) {
      loadArticle();
    }
  }, [slug]);

  async function loadArticle() {
    setLoading(true);
    try {
      const data = await getArticleBySlug(slug);
      setArticle(data);

      // Load related articles based on tags
      if (data && data.tags.length > 0) {
        const related = await searchArticles(data.tags[0], 3);
        setRelatedArticles(related.filter(a => a.id !== data.id).slice(0, 3));
      }
    } catch (error) {
      console.error('Failed to load article:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(helpful: boolean) {
    if (!article || feedbackGiven) return;

    setFeedbackLoading(true);
    try {
      await markArticleHelpful(article.id, helpful);
      setFeedbackGiven(helpful ? 'helpful' : 'not_helpful');
      // Update local count
      setArticle(prev => prev ? {
        ...prev,
        helpfulCount: helpful ? prev.helpfulCount + 1 : prev.helpfulCount,
        notHelpfulCount: helpful ? prev.notHelpfulCount : prev.notHelpfulCount + 1,
      } : null);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setFeedbackLoading(false);
    }
  }

  function formatCategoryLabel(category: string): string {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  // Simple markdown-like rendering
  function renderContent(content: string) {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let inList = false;
    let listItems: string[] = [];

    lines.forEach((line, index) => {
      // Headers
      if (line.startsWith('# ')) {
        if (inList) {
          elements.push(<ul key={`list-${index}`} className="list-disc pl-6 mb-4 space-y-1">{listItems.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          listItems = [];
          inList = false;
        }
        elements.push(<h1 key={index} className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-6">{line.slice(2)}</h1>);
      } else if (line.startsWith('## ')) {
        if (inList) {
          elements.push(<ul key={`list-${index}`} className="list-disc pl-6 mb-4 space-y-1">{listItems.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          listItems = [];
          inList = false;
        }
        elements.push(<h2 key={index} className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-5">{line.slice(3)}</h2>);
      } else if (line.startsWith('### ')) {
        if (inList) {
          elements.push(<ul key={`list-${index}`} className="list-disc pl-6 mb-4 space-y-1">{listItems.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          listItems = [];
          inList = false;
        }
        elements.push(<h3 key={index} className="text-lg font-medium text-gray-900 dark:text-white mb-2 mt-4">{line.slice(4)}</h3>);
      }
      // List items
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        inList = true;
        listItems.push(line.slice(2));
      }
      // Checkbox items
      else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
        const checked = line.startsWith('- [x] ');
        const text = line.slice(6);
        elements.push(
          <div key={index} className="flex items-center gap-2 mb-1">
            <input type="checkbox" checked={checked} readOnly className="rounded" />
            <span className={checked ? 'line-through text-gray-400' : ''}>{text}</span>
          </div>
        );
      }
      // Numbered list
      else if (/^\d+\.\s/.test(line)) {
        if (inList) {
          elements.push(<ul key={`list-${index}`} className="list-disc pl-6 mb-4 space-y-1">{listItems.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          listItems = [];
          inList = false;
        }
        elements.push(<p key={index} className="mb-1 pl-4">{line}</p>);
      }
      // Empty line
      else if (line.trim() === '') {
        if (inList) {
          elements.push(<ul key={`list-${index}`} className="list-disc pl-6 mb-4 space-y-1">{listItems.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          listItems = [];
          inList = false;
        }
      }
      // Regular paragraph
      else {
        if (inList) {
          elements.push(<ul key={`list-${index}`} className="list-disc pl-6 mb-4 space-y-1">{listItems.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          listItems = [];
          inList = false;
        }
        elements.push(<p key={index} className="text-gray-700 dark:text-gray-300 mb-3">{line}</p>);
      }
    });

    // Flush remaining list items
    if (inList && listItems.length > 0) {
      elements.push(<ul key="list-final" className="list-disc pl-6 mb-4 space-y-1">{listItems.map((item, i) => <li key={i}>{item}</li>)}</ul>);
    }

    return elements;
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-6"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-8"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <IconArticle size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Article not found</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          The article you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link
          href="/dashboard/help/articles"
          className="text-teal-600 dark:text-teal-400 hover:underline"
        >
          Browse all articles
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/dashboard/help/articles"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400"
        >
          <IconArrowLeft size={18} />
          Back to Articles
        </Link>
      </div>

      {/* Article Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-sm px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full">
            {formatCategoryLabel(article.category)}
          </span>
          {article.isFeatured && (
            <span className="text-sm px-3 py-1 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full">
              Featured
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {article.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <IconClock size={16} />
            Updated {formatDate(article.updatedAt)}
          </span>
          <span className="flex items-center gap-1">
            <IconEye size={16} />
            {article.viewCount} views
          </span>
          <span className="flex items-center gap-1">
            <IconThumbUp size={16} />
            {article.helpfulCount} found helpful
          </span>
        </div>
      </div>

      {/* Article Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 mb-8">
        <div className="prose dark:prose-invert max-w-none">
          {renderContent(article.content)}
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 flex-wrap">
              <IconTag size={16} className="text-gray-400" />
              {article.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/dashboard/help/articles?q=${encodeURIComponent(tag)}`}
                  className="text-sm px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Feedback Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Was this article helpful?</h3>
        {feedbackGiven ? (
          <p className="text-gray-600 dark:text-gray-400">
            Thank you for your feedback! {feedbackGiven === 'helpful' ? '👍' : 'We\'ll work to improve this article.'}
          </p>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => handleFeedback(true)}
              disabled={feedbackLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50"
            >
              <IconThumbUp size={18} />
              Yes, helpful
            </button>
            <button
              onClick={() => handleFeedback(false)}
              disabled={feedbackLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              <IconThumbDown size={18} />
              Not helpful
            </button>
          </div>
        )}
      </div>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Related Articles</h3>
          <div className="space-y-3">
            {relatedArticles.map(related => (
              <Link
                key={related.id}
                href={`/dashboard/help/articles/${related.slug}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{related.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatCategoryLabel(related.category)}</p>
                </div>
                <IconChevronRight size={18} className="text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Need More Help */}
      <div className="mt-8 text-center">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Still need help? Our support team is here for you.
        </p>
        <Link
          href="/dashboard/help/tickets/new"
          className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          Create Support Ticket
        </Link>
      </div>
    </div>
  );
}
