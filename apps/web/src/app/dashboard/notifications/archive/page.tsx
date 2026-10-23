'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, Notification } from '@/lib/api/notifications';
import { IconArchive, IconTrash, IconRefresh, IconSearch, IconFilter } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { useConfirm } from '@/hooks/useConfirm';

export default function NotificationArchivePage() {
  const { confirm, element: confirmElement } = useConfirm();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch archived notifications (older than 90 days)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['archived-notifications', page, searchQuery],
    queryFn: () => notificationsApi.getNotifications({
      page,
      limit: 20,
    }),
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['archived-notifications']);
      queryClient.invalidateQueries(['notifications']);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => notificationsApi.deleteNotification(id))),
    onSuccess: () => {
      setSelectedNotifications([]);
      queryClient.invalidateQueries(['archived-notifications']);
      queryClient.invalidateQueries(['notifications']);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  const handleDelete = async (id: number) => {
    if (await confirm({ message: 'Are you sure you want to permanently delete this notification?', danger: true })) {
      deleteMutation.mutate(id);
    }
  };

  const handleBulkDelete = async () => {
    if ((await confirm({ message: `Are you sure you want to permanently delete ${selectedNotifications.length} notification(s)?`, danger: true }))) {
      bulkDeleteMutation.mutate(selectedNotifications);
    }
  };

  const handleSelectAll = () => {
    if (selectedNotifications.length === data?.data.notifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(data?.data.notifications.map(n => n.id) || []);
    }
  };

  const handleSelectNotification = (id: number) => {
    if (selectedNotifications.includes(id)) {
      setSelectedNotifications(selectedNotifications.filter(nid => nid !== id));
    } else {
      setSelectedNotifications([...selectedNotifications, id]);
    }
  };

  const filteredNotifications = data?.data.notifications.filter(notification =>
    notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    notification.message.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment_due':
        return '💳';
      case 'payment_received':
        return '✅';
      case 'system':
        return '📢';
      case 'approval':
        return '👤';
      case 'announcement':
        return '📣';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'payment_due':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'payment_received':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'system':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'approval':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'announcement':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      {confirmElement}
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <IconArchive className="text-teal-600 dark:text-teal-400" size={28} />
          Notification Archive
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          View and manage archived notifications (older than 90 days)
        </p>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <span className="text-green-800 dark:text-green-200 font-medium">
            Action completed successfully
          </span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search archived notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
          >
            <IconRefresh size={20} />
            Refresh
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedNotifications.length > 0 && (
        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-teal-800 dark:text-teal-200 font-medium">
            {selectedNotifications.length} notification(s) selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconTrash size={20} />
            Delete Selected
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <IconArchive className="text-gray-400 dark:text-gray-600 mx-auto mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No archived notifications
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Notifications older than 90 days will appear here
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={selectedNotifications.length === filteredNotifications.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
              </div>
              <div className="col-span-2 font-medium text-gray-700 dark:text-gray-300">Type</div>
              <div className="col-span-5 font-medium text-gray-700 dark:text-gray-300">Notification</div>
              <div className="col-span-2 font-medium text-gray-700 dark:text-gray-300">Date</div>
              <div className="col-span-2 font-medium text-gray-700 dark:text-gray-300">Actions</div>
            </div>

            {/* Notifications */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <div className="col-span-1 flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.includes(notification.id)}
                      onChange={() => handleSelectNotification(notification.id)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getNotificationColor(
                        notification.type
                      )}`}
                    >
                      <span className="mr-1">{getNotificationIcon(notification.type)}</span>
                      {notification.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="col-span-5">
                    <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {notification.title}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {notification.message}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(notification.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete permanently"
                    >
                      <IconTrash size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {data?.data && data.data.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.data.total)} of {data.data.total} notifications
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
              Page {page} of {data.data.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(data.data.totalPages, p + 1))}
              disabled={page === data.data.totalPages}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <IconArchive className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              About Archived Notifications
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Notifications are automatically archived after 90 days. Archived notifications can be viewed and permanently deleted, but cannot be restored to your main inbox.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
