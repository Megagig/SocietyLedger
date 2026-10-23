'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { notificationHref } from '@/lib/notification-link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import { IconBell, IconCheck, IconTrash, IconSearch, IconFilter, IconX } from '@tabler/icons-react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { useConfirm } from '@/hooks/useConfirm';

export default function NotificationsCenterPage() {
  const { confirm, element: confirmElement } = useConfirm();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    type: 'all' as 'all' | 'payment_due' | 'payment_received' | 'system' | 'approval' | 'announcement',
    status: 'all' as 'all' | 'unread' | 'read',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Fetch notifications
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', page, filters],
    queryFn: () => notificationsApi.getNotifications({
      page,
      limit: 20,
      unread: filters.status === 'unread' ? true : undefined,
    }),
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      queryClient.invalidateQueries(['unread-count']);
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      queryClient.invalidateQueries(['unread-count']);
      setSelectedNotifications([]);
      setShowBulkActions(false);
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      queryClient.invalidateQueries(['unread-count']);
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => notificationsApi.deleteNotification(id))),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      queryClient.invalidateQueries(['unread-count']);
      setSelectedNotifications([]);
      setShowBulkActions(false);
    },
  });

  const handleSelectNotification = (id: number) => {
    setSelectedNotifications(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setShowBulkActions(true);
  };

  const handleSelectAll = () => {
    if (data?.data.notifications) {
      const allIds = data.data.notifications.map(n => n.id);
      setSelectedNotifications(allIds);
      setShowBulkActions(true);
    }
  };

  const handleClearSelection = () => {
    setSelectedNotifications([]);
    setShowBulkActions(false);
  };

  const handleBulkMarkAsRead = () => {
    selectedNotifications.forEach(id => markAsReadMutation.mutate(id));
  };

  const handleBulkDelete = async () => {
    if ((await confirm({ message: `Are you sure you want to delete ${selectedNotifications.length} notifications?`, danger: true }))) {
      bulkDeleteMutation.mutate(selectedNotifications);
    }
  };

  const getTypeIcon = (type: string) => {
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'payment_due':
        return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300';
      case 'payment_received':
        return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300';
      case 'system':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300';
      case 'approval':
        return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300';
      case 'announcement':
        return 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications = data?.data.notifications?.filter(notification => {
    // Type filter
    if (filters.type !== 'all' && notification.type !== filters.type) {
      return false;
    }
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const titleMatch = notification.title.toLowerCase().includes(searchLower);
      const messageMatch = notification.message.toLowerCase().includes(searchLower);
      if (!titleMatch && !messageMatch) {
        return false;
      }
    }
    // Date range filter
    if (filters.startDate) {
      const notificationDate = new Date(notification.createdAt);
      const startDate = new Date(filters.startDate);
      if (notificationDate < startDate) return false;
    }
    if (filters.endDate) {
      const notificationDate = new Date(notification.createdAt);
      const endDate = new Date(filters.endDate);
      if (notificationDate > endDate) return false;
    }
    return true;
  }) || [];

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Notifications
          </h1>
          {data?.data?.unreadCount !== undefined && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {data.data.unreadCount} unread notification{data.data.unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(data?.data?.unreadCount ?? 0) > 0 && (
            <button
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search notifications..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type:</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="payment_due">Payment Due</option>
              <option value="payment_received">Payment Received</option>
              <option value="system">System</option>
              <option value="approval">Approval</option>
              <option value="announcement">Announcement</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>

          {/* Clear Filters */}
          {(filters.type !== 'all' || filters.status !== 'all' || filters.search || filters.startDate || filters.endDate) && (
            <button
              onClick={() => setFilters({
                type: 'all',
                status: 'all',
                search: '',
                startDate: '',
                endDate: '',
              })}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-sm font-medium transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {showBulkActions && selectedNotifications.length > 0 && (
        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-teal-700 dark:text-teal-300">
              {selectedNotifications.length} notification{selectedNotifications.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleClearSelection}
              className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkMarkAsRead}
              disabled={markAsReadMutation.isPending}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <IconCheck size={16} /> Mark read
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <IconTrash size={16} /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon={<IconBell size={48} className="text-gray-300 dark:text-gray-600" />}
          title="No notifications"
          description={filters.search || filters.type !== 'all' || filters.status !== 'all'
            ? 'Try adjusting your filters'
            : 'You don\'t have any notifications yet'}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Select All Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedNotifications.length === filteredNotifications.length && selectedNotifications.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-teal-600 focus:ring-teal-500 rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select all ({filteredNotifications.length})
              </span>
            </label>
          </div>

          {/* Notifications */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  !notification.isRead ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedNotifications.includes(notification.id)}
                    onChange={() => handleSelectNotification(notification.id)}
                    className="mt-1 w-4 h-4 text-teal-600 focus:ring-teal-500 rounded cursor-pointer"
                  />

                  {/* Icon */}
                  <div className={`text-2xl ${getTypeColor(notification.type)} p-2 rounded-lg`}>
                    {getTypeIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-base font-semibold ${
                        !notification.isRead
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    {notificationHref(notification.pushType, notification.entityId) && (
                      <button
                        onClick={() => {
                          if (!notification.isRead) markAsReadMutation.mutate(notification.id);
                          router.push(notificationHref(notification.pushType, notification.entityId) as string);
                        }}
                        className="mt-2 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
                      >
                        View details →
                      </button>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsReadMutation.mutate(notification.id)}
                          disabled={markAsReadMutation.isPending}
                          className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <IconCheck size={14} /> Mark read
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (await confirm({ message: 'Are you sure you want to delete this notification?', danger: true })) {
                            deleteNotificationMutation.mutate(notification.id);
                          }
                        }}
                        disabled={deleteNotificationMutation.isPending}
                        className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <IconTrash size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data?.data.totalPages && data.data.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {data.data.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.data.totalPages, p + 1))}
                disabled={page === data.data.totalPages}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
