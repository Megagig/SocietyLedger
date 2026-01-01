'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSMSMessages, SMSMessage } from '@/lib/api/communication';
import { IconArrowLeft, IconMessage, IconFilter } from '@tabler/icons-react';

export default function SMSHistoryPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchMessages();
  }, [page, statusFilter]);

  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      const res = await getSMSMessages({ 
        page, 
        limit: 20, 
        status: statusFilter || undefined 
      });
      setMessages(res.data?.messages || []);
      setTotalPages(res.data?.totalPages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      SENT: 'bg-blue-100 text-blue-700',
      DELIVERED: 'bg-green-100 text-green-700',
      FAILED: 'bg-red-100 text-red-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      REJECTED: 'bg-gray-100 text-gray-700',
    };
    return colors[status] || colors.PENDING;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => router.push('/dashboard/communication/sms')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <IconArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Message History
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            View all sent SMS messages
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 sm:gap-4 items-center">
        <IconFilter size={20} className="text-gray-500 hidden sm:block" />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="SENT">Sent</option>
          <option value="DELIVERED">Delivered</option>
          <option value="FAILED">Failed</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Messages Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading messages...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : messages.length === 0 ? (
        <div className="text-center py-8 sm:py-12 bg-white dark:bg-gray-800 rounded-lg">
          <IconMessage className="mx-auto text-gray-400 mb-4" size={40} />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">No messages found</h3>
          <p className="text-sm sm:text-base text-gray-500">Messages you send will appear here</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {messages.map((msg) => (
              <div key={msg.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {msg.recipientName || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500">{msg.recipientPhone}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(msg.status)}`}>
                    {msg.status}
                  </span>
                </div>
                
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {msg.message}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span>{msg.messageType}</span>
                  <span>{msg.sentAt ? formatDate(msg.sentAt) : formatDate(msg.createdAt)}</span>
                </div>
                
                {msg.errorMessage && (
                  <p className="text-xs text-red-500">{msg.errorMessage}</p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {msg.recipientName || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-500">{msg.recipientPhone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-600 dark:text-gray-400 truncate max-w-xs" title={msg.message}>
                        {msg.message}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {msg.messageType}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(msg.status)}`}>
                        {msg.status}
                      </span>
                      {msg.errorMessage && (
                        <p className="text-xs text-red-500 mt-1">{msg.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {msg.sentAt ? formatDate(msg.sentAt) : formatDate(msg.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 sm:px-6 py-4 border-t dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-full sm:w-auto px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-full sm:w-auto px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
