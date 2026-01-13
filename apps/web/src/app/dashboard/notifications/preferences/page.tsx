'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, NotificationPreferences } from '@/lib/api/notifications';
import { IconBell, IconCheck, IconX, IconClock, IconMail, IconDeviceMobile } from '@tabler/icons-react';
import { ErrorDisplay } from '@/components/ErrorDisplay';

export default function NotificationPreferencesPage() {
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch preferences
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationsApi.getPreferences(),
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: (preferences: NotificationPreferences) => notificationsApi.updatePreferences(preferences),
    onSuccess: (response) => {
      // Update the cache with the new data
      queryClient.setQueryData(['notification-preferences'], {
        success: true,
        data: response.data
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (error) => {
      console.error('Failed to update preferences:', error);
      // Refetch to get the current state
      refetch();
    }
  });

  const handleToggle = (field: keyof NotificationPreferences) => {
    if (!data?.data) return;
    
    const currentValue = data.data[field];
    const newPreferences = {
      ...data.data,
      [field]: !currentValue,
    };
    
    // Optimistically update the UI
    queryClient.setQueryData(['notification-preferences'], {
      success: true,
      data: newPreferences
    });
    
    // Then make the API call
    updatePreferencesMutation.mutate(newPreferences);
  };

  const handleQuietHoursChange = (field: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    if (!data?.data) return;
    
    const newPreferences = {
      ...data.data,
      [field]: value,
    };
    
    // Optimistically update the UI
    queryClient.setQueryData(['notification-preferences'], {
      success: true,
      data: newPreferences
    });
    
    // Then make the API call
    updatePreferencesMutation.mutate(newPreferences);
  };

  const handleTimezoneChange = (timezone: string) => {
    if (!data?.data) return;
    
    const newPreferences = {
      ...data.data,
      quietHoursTimezone: timezone,
    };
    
    // Optimistically update the UI
    queryClient.setQueryData(['notification-preferences'], {
      success: true,
      data: newPreferences
    });
    
    // Then make the API call
    updatePreferencesMutation.mutate(newPreferences);
  };

  const handleToggleQuietHours = () => {
    if (!data?.data) return;
    
    const newPreferences = {
      ...data.data,
      quietHoursEnabled: !data.data.quietHoursEnabled,
    };
    
    // Optimistically update the UI
    queryClient.setQueryData(['notification-preferences'], {
      success: true,
      data: newPreferences
    });
    
    // Then make the API call
    updatePreferencesMutation.mutate(newPreferences);
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

  const preferences = data?.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Notification Preferences
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Customize how and when you receive notifications
        </p>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <IconCheck className="text-green-600 dark:text-green-400" size={24} />
          <p className="text-green-800 dark:text-green-200 font-medium">
            Preferences saved successfully
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <IconBell className="text-teal-600 dark:text-teal-400" size={24} />
          Quick Actions
        </h2>
        <div className="space-y-4">
          <button
            onClick={() => handleToggleQuietHours()}
            disabled={updatePreferencesMutation.isPending}
            className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-colors ${
              preferences?.quietHoursEnabled
                ? 'bg-teal-600 text-white hover:bg-teal-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <IconClock className="text-teal-600 dark:text-teal-400" size={20} />
                {preferences?.quietHoursEnabled ? 'Quiet Hours Enabled' : 'Quiet Hours Disabled'}
              </span>
              {preferences?.quietHoursEnabled ? <IconCheck size={20} /> : <IconX size={20} />}
            </div>
          </button>
        </div>
      </div>

      {/* Notification Type Preferences */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Notification Types
        </h2>
        <div className="space-y-6">
          {/* Payment Due */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              💳 Payment Due
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconMail className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                </div>
                <button
                  onClick={() => handleToggle('paymentDueEmail')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.paymentDueEmail
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.paymentDueEmail ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconDeviceMobile className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">SMS</span>
                </div>
                <button
                  onClick={() => handleToggle('paymentDueSMS')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.paymentDueSMS
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.paymentDueSMS ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconBell className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">In-App</span>
                </div>
                <button
                  onClick={() => handleToggle('paymentDueInApp')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.paymentDueInApp
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.paymentDueInApp ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Payment Received */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              ✅ Payment Received
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconMail className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                </div>
                <button
                  onClick={() => handleToggle('paymentReceivedEmail')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.paymentReceivedEmail
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.paymentReceivedEmail ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconDeviceMobile className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">SMS</span>
                </div>
                <button
                  onClick={() => handleToggle('paymentReceivedSMS')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.paymentReceivedSMS
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.paymentReceivedSMS ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconBell className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">In-App</span>
                </div>
                <button
                  onClick={() => handleToggle('paymentReceivedInApp')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.paymentReceivedInApp
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.paymentReceivedInApp ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* System */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              📢 System
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconMail className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                </div>
                <button
                  onClick={() => handleToggle('systemEmail')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.systemEmail
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.systemEmail ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconDeviceMobile className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">SMS</span>
                </div>
                <button
                  onClick={() => handleToggle('systemSMS')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.systemSMS
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.systemSMS ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconBell className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">In-App</span>
                </div>
                <button
                  onClick={() => handleToggle('systemInApp')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.systemInApp
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.systemInApp ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Approval */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              👤 Approval
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconMail className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                </div>
                <button
                  onClick={() => handleToggle('approvalEmail')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.approvalEmail
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.approvalEmail ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconDeviceMobile className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">SMS</span>
                </div>
                <button
                  onClick={() => handleToggle('approvalSMS')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.approvalSMS
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.approvalSMS ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconBell className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">In-App</span>
                </div>
                <button
                  onClick={() => handleToggle('approvalInApp')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.approvalInApp
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.approvalInApp ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Announcement */}
          <div className="pb-6">
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              📣 Announcement
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconMail className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                </div>
                <button
                  onClick={() => handleToggle('announcementEmail')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.announcementEmail
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.announcementEmail ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconDeviceMobile className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">SMS</span>
                </div>
                <button
                  onClick={() => handleToggle('announcementSMS')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.announcementSMS
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.announcementSMS ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IconBell className="text-gray-600 dark:text-gray-400" size={18} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">In-App</span>
                </div>
                <button
                  onClick={() => handleToggle('announcementInApp')}
                  disabled={updatePreferencesMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    preferences?.announcementInApp
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences?.announcementInApp ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quiet Hours Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <IconClock className="text-teal-600 dark:text-teal-400" size={24} />
          Quiet Hours
        </h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Silence notifications during specific hours to avoid interruptions
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={preferences?.quietHoursStart || ''}
                onChange={(e) => handleQuietHoursChange('quietHoursStart', e.target.value)}
                disabled={!preferences?.quietHoursEnabled || updatePreferencesMutation.isPending}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Time
              </label>
              <input
                type="time"
                value={preferences?.quietHoursEnd || ''}
                onChange={(e) => handleQuietHoursChange('quietHoursEnd', e.target.value)}
                disabled={!preferences?.quietHoursEnabled || updatePreferencesMutation.isPending}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Timezone
            </label>
            <select
              value={preferences?.quietHoursTimezone || 'UTC'}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              disabled={!preferences?.quietHoursEnabled || updatePreferencesMutation.isPending}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="UTC">UTC (UTC+0)</option>
              <option value="Africa/Lagos">Africa/Lagos (UTC+1)</option>
              <option value="Africa/Accra">Africa/Accra (UTC+0)</option>
              <option value="Africa/Nairobi">Africa/Nairobi (UTC+3)</option>
              <option value="Africa/Cairo">Africa/Cairo (UTC+2)</option>
              <option value="Africa/Johannesburg">Africa/Johannesburg (UTC+2)</option>
              <option value="Europe/London">Europe/London (UTC+0/+1)</option>
              <option value="America/New_York">America/New York (UTC-5/-4)</option>
            </select>
          </div>

          {/* Info */}
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>💡 Tip:</strong> Quiet hours only affect non-urgent notifications. Critical system alerts will still be delivered.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
