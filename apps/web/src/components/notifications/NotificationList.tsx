'use client';

import { IconCheck, IconTrash } from '@tabler/icons-react';
import { notificationsApi } from '@/lib/api/notifications';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationListProps {
  notifications: Notification[];
  selectedIds: number[];
  onSelect: (id: number) => void;
  onMarkAsRead: (id: number) => void;
  onDelete: (id: number) => void;
  isLoading?: boolean;
}

export function NotificationList({
  notifications,
  selectedIds,
  onSelect,
  onMarkAsRead,
  onDelete,
  isLoading = false,
}: NotificationListProps) {
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

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No notifications found</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {notifications.map((notification) => (
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
              checked={selectedIds.includes(notification.id)}
              onChange={() => onSelect(notification.id)}
              className="mt-1 w-4 h-4 text-teal-600 focus:ring-teal-500 rounded cursor-pointer"
            />

            {/* Icon */}
            <div className={`text-2xl ${getTypeColor(notification.type)} p-2 rounded-lg flex-shrink-0`}>
              {getTypeIcon(notification.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3
                  className={`text-base font-semibold ${
                    !notification.isRead
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {notification.title}
                </h3>
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                  {formatTime(notification.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {notification.message}
              </p>
              <div className="flex items-center gap-2 mt-3">
                {!notification.isRead && (
                  <button
                    onClick={() => onMarkAsRead(notification.id)}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center gap-1"
                  >
                    <IconCheck size={14} /> Mark read
                  </button>
                )}
                <button
                  onClick={() => onDelete(notification.id)}
                  className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                >
                  <IconTrash size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
