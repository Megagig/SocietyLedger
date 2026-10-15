'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Save, Loader2, Plus, X, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { toast } from '@/lib/toast';

interface NotificationsSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  paymentReminderDays: number[];
  overdueReminderFrequency: 'daily' | 'weekly' | 'monthly' | 'none';
  quietHoursStart?: string;
  quietHoursEnd?: string;
  senderName?: string;
  senderEmail?: string;
}

const REMINDER_FREQUENCIES = [
  { value: 'none', label: 'Disabled' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function NotificationsSettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<NotificationsSettings>({
    emailEnabled: true,
    smsEnabled: false,
    paymentReminderDays: [7, 3, 1],
    overdueReminderFrequency: 'weekly',
    senderName: 'SocietyLedger',
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [newReminderDay, setNewReminderDay] = useState('');

  // Fetch settings
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: async () => {
      const response = await api.get('/settings/notifications');
      return response.data.data as NotificationsSettings;
    },
  });

  useEffect(() => {
    if (data) {
      setFormData(data);
      setHasChanges(false);
    }
  }, [data]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (settings: Partial<NotificationsSettings>) => {
      const response = await api.patch('/settings/notifications', settings);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Notification settings updated');
      queryClient.invalidateQueries({ queryKey: ['settings', 'notifications'] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    },
  });

  const handleChange = (field: keyof NotificationsSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const addReminderDay = () => {
    const day = parseInt(newReminderDay);
    if (day > 0 && day <= 30 && !formData.paymentReminderDays.includes(day)) {
      const newDays = [...formData.paymentReminderDays, day].sort((a, b) => b - a);
      handleChange('paymentReminderDays', newDays);
      setNewReminderDay('');
    }
  };

  const removeReminderDay = (day: number) => {
    handleChange('paymentReminderDays', formData.paymentReminderDays.filter(d => d !== day));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl p-4 sm:p-0">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
          Notification Settings
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          Configure how and when notifications are sent to members
        </p>
      </div>

      {/* Quick Links */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">Message Templates</h3>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Link
            href="/dashboard/communications/templates"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors text-sm font-medium"
          >
            SMS Templates
            <ExternalLink className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard/communications"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            SMS Dashboard
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Notification Channels */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Notification Channels
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  Email Notifications
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Send notifications via email
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emailEnabled}
                  onChange={(e) => handleChange('emailEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  SMS Notifications
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Send notifications via SMS (requires SMS credits)
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.smsEnabled}
                  onChange={(e) => handleChange('smsEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Sender Identity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Sender Identity
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sender Name
              </label>
              <input
                type="text"
                value={formData.senderName || ''}
                onChange={(e) => handleChange('senderName', e.target.value)}
                placeholder="Your Association Name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reply-To Email
              </label>
              <input
                type="email"
                value={formData.senderEmail || ''}
                onChange={(e) => handleChange('senderEmail', e.target.value)}
                placeholder="contact@yourassociation.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Payment Reminders */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Payment Reminders
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reminder Days Before Due Date
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.paymentReminderDays.map(day => (
                  <span
                    key={day}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full text-sm"
                  >
                    {day} day{day !== 1 ? 's' : ''}
                    <button
                      type="button"
                      onClick={() => removeReminderDay(day)}
                      className="hover:text-teal-900 dark:hover:text-teal-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={newReminderDay}
                  onChange={(e) => setNewReminderDay(e.target.value)}
                  placeholder="Days"
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={addReminderDay}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Send reminders this many days before the payment due date
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Overdue Reminder Frequency
              </label>
              <select
                value={formData.overdueReminderFrequency}
                onChange={(e) => handleChange('overdueReminderFrequency', e.target.value)}
                className="w-full md:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                {REMINDER_FREQUENCIES.map(freq => (
                  <option key={freq.value} value={freq.value}>{freq.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                How often to remind members about overdue payments
              </p>
            </div>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Quiet Hours
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
            Notifications will not be sent during these hours
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={formData.quietHoursStart || ''}
                onChange={(e) => handleChange('quietHoursStart', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={formData.quietHoursEnd || ''}
                onChange={(e) => handleChange('quietHoursEnd', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
          {hasChanges && (
            <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
              Unsaved changes
            </span>
          )}
          <button
            type="submit"
            disabled={!hasChanges || updateMutation.isPending}
            className="w-full sm:w-auto px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
