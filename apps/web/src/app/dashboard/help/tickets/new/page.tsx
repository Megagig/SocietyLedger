'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconSend,
  IconSparkles,
  IconArticle,
  IconX,
  IconAlertTriangle,
} from '@tabler/icons-react';
import {
  createTicket,
  createPlatformTicket,
  MEMBER_CATEGORIES,
  PLATFORM_CATEGORIES,
  categorizeTicket,
  TicketCategory,
  TicketPriority,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  CategorizationResult,
} from '@/lib/api/support';
import { suggestArticles, ArticleSuggestion } from '@/lib/api/help';
import { AttachmentPicker } from '@/components/support/AttachmentPicker';
import { toast } from '@/lib/toast';
import { HelpLink } from '@/components/docs/HelpLink';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function NewTicketForm() {
  const router = useRouter();
  // /new?to=platform is an association admin's own ticket to SocietyLedger support (Tier 2).
  const isPlatform = useSearchParams().get('to') === 'platform';
  const categoryOptions = (isPlatform ? PLATFORM_CATEGORIES : MEMBER_CATEGORIES).map((value) => [value, TICKET_CATEGORY_LABELS[value]] as const);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('OTHER');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [files, setFiles] = useState<File[]>([]);

  // AI features
  const [aiSuggestions, setAiSuggestions] = useState<ArticleSuggestion[]>([]);
  const [aiCategorization, setAiCategorization] = useState<CategorizationResult | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [aiCouldntHelp, setAiCouldntHelp] = useState(false);

  // Debounced description for AI
  const debouncedDescription = useDebounce(description, 500);

  // Fetch AI suggestions when description changes
  useEffect(() => {
    if (debouncedDescription.length >= 20 && showSuggestions) {
      fetchAISuggestions(debouncedDescription);
    } else {
      setAiSuggestions([]);
      setAiCategorization(null);
    }
  }, [debouncedDescription, showSuggestions]);

  async function fetchAISuggestions(text: string) {
    setLoadingAI(true);
    try {
      // Fetch article suggestions and categorization in parallel
      const [suggestions, categorization] = await Promise.all([
        suggestArticles(text, 3).catch(() => []),
        categorizeTicket(text).catch(() => null),
      ]);

      setAiSuggestions(suggestions);
      
      if (categorization) {
        setAiCategorization(categorization);
        // Auto-fill category and priority if confidence is high
        if (categorization.confidence > 0.7) {
          setCategory(categorization.category);
          setPriority(categorization.suggestedPriority);
        }
      }
    } catch (error) {
      console.error('AI suggestions failed:', error);
    } finally {
      setLoadingAI(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }
    if (!description.trim()) {
      setError('Please describe your issue');
      return;
    }

    setSubmitting(true);
    try {
      const submit = isPlatform ? createPlatformTicket : createTicket;
      const ticket = await submit({
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        // Include AI data if available
        aiCategory: aiCategorization?.category,
        aiCategoryConfidence: aiCategorization?.confidence,
      }, files);

      if (ticket.attachmentError) toast.error(ticket.attachmentError);
      router.push(`/dashboard/help/tickets/${ticket.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/help/tickets"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <IconArrowLeft size={20} />
          Back to Tickets
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          {isPlatform ? 'Contact SocietyLedger' : 'Create Support Ticket'}
        </h1>
          <HelpLink />
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {isPlatform
            ? "Ask SocietyLedger's support team about billing, bugs, modules, data or features"
            : "Describe your issue and we'll help you resolve it"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
                <IconAlertTriangle size={20} />
                {error}
              </div>
            )}

            {/* Subject */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                maxLength={200}
              />
            </div>

            {/* Category & Priority */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                  {aiCategorization && aiCategorization.confidence > 0.5 && (
                    <span className="ml-2 text-xs text-purple-600 dark:text-purple-400 font-normal">
                      <IconSparkles size={12} className="inline mr-1" />
                      AI suggested
                    </span>
                  )}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {categoryOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, and what you expected to happen."
                rows={8}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                maxLength={5000}
              />
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>{description.length}/5000 characters</span>
                {loadingAI && (
                  <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                    <IconSparkles size={12} className="animate-pulse" />
                    AI analyzing...
                  </span>
                )}
              </div>
            </div>

            {/* Attachments */}
            <div className="mb-6">
              <AttachmentPicker files={files} onChange={setFiles} disabled={submitting} />
            </div>

            {/* AI couldn't help checkbox */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiCouldntHelp}
                  onChange={(e) => setAiCouldntHelp(e.target.checked)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                I've checked the help articles but couldn't find a solution
              </label>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-4">
              <Link
                href="/dashboard/help/tickets"
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-6 py-2 rounded-lg transition-colors"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <IconSend size={18} />
                    {isPlatform ? 'Send to SocietyLedger' : 'Create Ticket'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* AI Suggestions Sidebar */}
        <div className="space-y-6">
          {/* Article Suggestions */}
          {showSuggestions && aiSuggestions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <IconSparkles size={18} className="text-purple-500" />
                  Related Articles
                </h3>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <IconX size={18} />
                </button>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {aiSuggestions.map((suggestion) => (
                  <Link
                    key={suggestion.article.id}
                    href={`/dashboard/help/articles/${suggestion.article.slug}`}
                    target="_blank"
                    className="flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <IconArticle size={18} className="text-teal-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2">
                        {suggestion.article.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {suggestion.matchReason}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-center">
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  These articles might help solve your issue
                </p>
              </div>
            </div>
          )}

          {/* AI Categorization Info */}
          {aiCategorization && aiCategorization.aiAvailable && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <IconSparkles size={18} className="text-purple-600 dark:text-purple-400" />
                <span className="font-medium text-purple-900 dark:text-purple-100 text-sm">AI Analysis</span>
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                {aiCategorization.reasoning}
              </p>
              <div className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                Confidence: {Math.round(aiCategorization.confidence * 100)}%
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Tips for faster resolution</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-teal-500">•</span>
                Include any error messages you see
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500">•</span>
                Describe the steps to reproduce the issue
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500">•</span>
                Mention what you expected to happen
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500">•</span>
                Include screenshots if helpful
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewTicketPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto text-gray-500">Loading...</div>}>
      <NewTicketForm />
    </Suspense>
  );
}
