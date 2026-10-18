'use client';

import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete as apiDeleteRequest } from '@/utils/api';
import { API_ROUTES } from '@/utils/constants';
import { IconBell, IconCheck, IconTrash } from '@tabler/icons-react';
import { useAuthStore } from '@/store/authStore';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasAssociation, setHasAssociation] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  const canFetchNotifications = !!user?.associationId;

  useEffect(() => {
    if (canFetchNotifications) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30 seconds
      return () => clearInterval(interval);
    }
  }, [canFetchNotifications]);

  useEffect(() => {
    if (isOpen && canFetchNotifications) {
      fetchNotifications();
    }
  }, [isOpen, canFetchNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await apiGet(API_ROUTES.NOTIFICATIONS.UNREAD_COUNT);
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.data.unreadCount);
        setHasAssociation(true);
      }
    } catch (error: any) {
      // Silently handle association not found errors (expected for super admins)
      setHasAssociation(false);
    }
  };

  const fetchNotifications = async () => {
    if (!hasAssociation) return;
    setLoading(true);
    try {
      const response = await apiGet(`${API_ROUTES.NOTIFICATIONS.LIST}?limit=10`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch (error: any) {
      // Silently handle association not found errors
      setHasAssociation(false);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      const response = await apiPatch(API_ROUTES.NOTIFICATIONS.MARK_READ(id), {});
      if (response.ok) {
        setNotifications(notifications.map(n => 
          n.id === id ? { ...n, isRead: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await apiPatch(API_ROUTES.NOTIFICATIONS.MARK_ALL_READ, {});
      if (response.ok) {
        setNotifications(notifications.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      const response = await apiDeleteRequest(API_ROUTES.NOTIFICATIONS.DELETE(id));
      if (response.ok) {
        const notification = notifications.find(n => n.id === id);
        setNotifications(notifications.filter(n => n.id !== id));
        if (notification && !notification.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <IconBell size={24} className="text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <IconBell size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    !notification.isRead ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{getTypeIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${
                          !notification.isRead 
                            ? 'text-gray-900 dark:text-gray-100' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {notification.title}
                        </p>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 flex items-center gap-1"
                          >
                            <IconCheck size={14} /> Mark read
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                        >
                          <IconTrash size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
            <a
              href="/dashboard/notifications"
              className="flex-1 text-center text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium py-2 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
            >
              View All
            </a>
            <a
              href="/dashboard/notifications/preferences"
              className="flex-1 text-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              Preferences
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
