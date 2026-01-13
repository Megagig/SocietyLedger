'use client';

import { IconFilter, IconX } from '@tabler/icons-react';

export interface NotificationFilters {
  type: 'all' | 'payment_due' | 'payment_received' | 'system' | 'approval' | 'announcement';
  status: 'all' | 'unread' | 'read';
  search: string;
  startDate: string;
  endDate: string;
}

interface NotificationFilterProps {
  filters: NotificationFilters;
  onFiltersChange: (filters: NotificationFilters) => void;
  onClearFilters: () => void;
  notificationCount?: number;
}

export function NotificationFilter({
  filters,
  onFiltersChange,
  onClearFilters,
  notificationCount,
}: NotificationFilterProps) {
  const hasActiveFilters =
    filters.type !== 'all' ||
    filters.status !== 'all' ||
    filters.search !== '' ||
    filters.startDate !== '' ||
    filters.endDate !== '';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        {/* Header */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <IconFilter size={20} className="text-teal-600 dark:text-teal-400" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            Filters
          </span>
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Active Filters Count */}
        {notificationCount !== undefined && notificationCount > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {notificationCount} notification{notificationCount !== 1 ? 's' : ''} found
          </span>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col lg:flex-row gap-4 w-full">
        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            Type:
          </label>
          <select
            value={filters.type}
            onChange={(e) => onFiltersChange({ ...filters, type: e.target.value as any })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white text-sm"
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
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            Status:
          </label>
          <select
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as any })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder="Search notifications..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white text-sm"
          />
        </div>

        {/* Clear Search Button */}
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ ...filters, search: '' })}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Clear search"
          >
            <IconX size={20} />
          </button>
        )}
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
          Date Range:
        </label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white text-sm"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white text-sm"
          />
          {(filters.startDate || filters.endDate) && (
            <button
              onClick={() => onFiltersChange({ ...filters, startDate: '', endDate: '' })}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Clear date range"
            >
              <IconX size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Filter Buttons */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => onFiltersChange({ ...filters, type: 'all', status: 'all' })}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filters.type === 'all' && filters.status === 'all'
              ? 'bg-teal-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          All Notifications
        </button>
        <button
          onClick={() => onFiltersChange({ ...filters, type: 'all', status: 'unread' })}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filters.type === 'all' && filters.status === 'unread'
              ? 'bg-teal-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Unread Only
        </button>
        <button
          onClick={() => onFiltersChange({ ...filters, type: 'payment_due', status: 'all' })}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filters.type === 'payment_due'
              ? 'bg-teal-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Payment Due
        </button>
        <button
          onClick={() => onFiltersChange({ ...filters, type: 'system', status: 'all' })}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filters.type === 'system'
              ? 'bg-teal-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          System
        </button>
      </div>
    </div>
  );
}
