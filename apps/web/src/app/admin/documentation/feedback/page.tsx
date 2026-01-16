'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type DocFeedback = {
  id: number;
  isHelpful: boolean;
  comment: string | null;
  email: string | null;
  createdAt: string;
  page: {
    id: number;
    title: string;
    slug: string;
  };
  user?: {
    id: number;
    firstName?: string;
    lastName?: string;
    email: string;
  };
};

export default function DocumentationFeedbackPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [feedback, setFeedback] = useState<DocFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchFeedback();
  }, [token, user, page, typeFilter]);

  const fetchFeedback = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (typeFilter) params.append('isHelpful', typeFilter);

      const res = await fetch(`${API_ROUTES.DOCUMENTATION.ADMIN_FEEDBACK}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        setFeedback(data.data.feedback || []);
        setTotalPages(data.data.totalPages || 1);
      } else {
        toast.error(data.message || 'Failed to fetch feedback');
      }
    } catch (e) {
      console.error('Failed to fetch feedback:', e);
      toast.error('Failed to fetch feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (feedbackId: number) => {
    if (!confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    setActionLoading(feedbackId);

    try {
      const res = await fetch(`${API_ROUTES.DOCUMENTATION.ADMIN_FEEDBACK}/${feedbackId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Feedback deleted successfully');
        fetchFeedback();
      } else {
        toast.error(data.message || 'Failed to delete feedback');
      }
    } catch (e) {
      toast.error('Failed to delete feedback');
    } finally {
      setActionLoading(null);
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <Link href="/admin/documentation" className="hover:text-blue-600">Documentation</Link>
            <span>/</span>
            <span>Feedback</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Documentation Feedback
          </h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">All Feedback</option>
          <option value="true">Helpful</option>
          <option value="false">Not Helpful</option>
        </select>
      </div>

      {/* Feedback List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : feedback.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <p className="text-lg">No feedback found</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {feedback.map((item) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      item.isHelpful
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {item.isHelpful ? (
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          item.isHelpful
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {item.isHelpful ? 'Helpful' : 'Not Helpful'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Link
                        href={`/documentation/${item.page.slug}`}
                        target="_blank"
                        className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate block"
                      >
                        {item.page.title}
                      </Link>
                      {item.comment && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-3">
                          "{item.comment}"
                        </p>
                      )}
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {item.user ? (
                          <>By {item.user.firstName || item.user.email}</>
                        ) : item.email ? (
                          <>By {item.email}</>
                        ) : (
                          <>Anonymous</>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/admin/documentation/pages/${item.page.id}/edit`}
                      className="flex-1 px-3 py-2 text-xs text-center text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                    >
                      View Page
                    </Link>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={actionLoading === item.id}
                      className="flex-1 px-3 py-2 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 disabled:opacity-50"
                    >
                      {actionLoading === item.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Page</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Comment</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">User</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          item.isHelpful
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {item.isHelpful ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                            </svg>
                          )}
                          {item.isHelpful ? 'Helpful' : 'Not Helpful'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/documentation/${item.page.slug}`}
                          target="_blank"
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {item.page.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="max-w-xs truncate text-gray-600 dark:text-gray-300">
                          {item.comment ? `"${item.comment}"` : '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                        {item.user ? (
                          <span>{item.user.firstName || item.user.email}</span>
                        ) : item.email ? (
                          <span>{item.email}</span>
                        ) : (
                          <span className="text-gray-400">Anonymous</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <Link
                            href={`/admin/documentation/pages/${item.page.id}/edit`}
                            className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                          >
                            View Page
                          </Link>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={actionLoading === item.id}
                            className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 disabled:opacity-50"
                          >
                            {actionLoading === item.id ? '...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
