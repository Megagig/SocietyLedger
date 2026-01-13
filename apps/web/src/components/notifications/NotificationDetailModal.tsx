'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, Notification } from '@/lib/api/notifications';
import { IconX, IconCheck, IconTrash, IconClock, IconUser, IconBuilding } from '@tabler/icons-react';
import { formatDistanceToNow, format } from 'date-fns';

interface NotificationDetailModalProps {
  notification: Notification | null;
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDetailModal({
  notification,
  isOpen,
  onClose,
}: NotificationDetailModalProps) {
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      queryClient.invalidateQueries(['unread-count']);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      queryClient.invalidateQueries(['unread-count']);
      onClose();
    },
  });

  const handleMarkAsRead = () => {
    if (notification && !notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleDelete = () => {
    if (notification && confirm('Are you sure you want to delete this notification?')) {
      deleteMutation.mutate(notification.id);
    }
  };

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
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'payment_received':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'system':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'approval':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'announcement':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  if (!isOpen || !notification) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-2xl ${getNotificationColor(
                notification.type
              )}`}
            >
              {getNotificationIcon(notification.type)}
            </span>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {notification.title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {notification.type.replace('_', ' ').toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <IconX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Success Message */}
          {showSuccess && (
            <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
              <IconCheck className="text-green-600 dark:text-green-400" size={20} />
              <p className="text-green-800 dark:text-green-200 font-medium text-sm">
                Marked as read
              </p>
            </div>
          )}

          {/* Message */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Message
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {notification.message}
              </p>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <IconCheck
                  className={`${
                    notification.isRead
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-yellow-600 dark:text-yellow-400'
                  }`}
                  size={20}
                />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {notification.isRead ? 'Read' : 'Unread'}
                  </p>
                </div>
              </div>

              {/* Created At */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <IconClock className="text-blue-600 dark:text-blue-400" size={20} />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(notification.createdAt), 'PPP p')}
                  </p>
                </div>
              </div>

              {/* User ID */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <IconUser className="text-purple-600 dark:text-purple-400" size={20} />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">User ID</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {notification.userId}
                  </p>
                </div>
              </div>

              {/* Association ID */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <IconBuilding className="text-teal-600 dark:text-teal-400" size={20} />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Association ID</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {notification.associationId}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Notification ID */}
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400">Notification ID</p>
            <p className="font-mono text-sm text-gray-900 dark:text-gray-100">
              {notification.id}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          {!notification.isRead && (
            <button
              onClick={handleMarkAsRead}
              disabled={markAsReadMutation.isPending}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IconCheck size={20} />
              Mark as Read
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <IconTrash size={20} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
