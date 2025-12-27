'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_ROUTES } from '@/utils/constants';
import { IconSend, IconMail } from '@tabler/icons-react';

export default function AnnouncementsPage() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'info' as 'info' | 'warning' | 'urgent',
    sendEmail: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setSuccess(false);

    try {
      const response = await axios.post(
        API_ROUTES.NOTIFICATIONS.ANNOUNCEMENT,
        formData,
        { withCredentials: true }
      );

      setSuccess(true);
      setFormData({
        title: '',
        message: '',
        priority: 'info',
        sendEmail: false,
      });

      // Show success for 3 seconds then reset
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send announcement');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Send Announcement
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Broadcast important messages to all members of your association
        </p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
            {/* Title */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Announcement Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                maxLength={200}
                placeholder="Enter announcement title"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Message */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Message *
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                maxLength={2000}
                rows={6}
                placeholder="Write your announcement message..."
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formData.message.length}/2000 characters
              </p>
            </div>

            {/* Priority */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority Level
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'info', label: 'Info', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: 'ℹ️' },
                  { value: 'warning', label: 'Warning', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: '⚠️' },
                  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: '🚨' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: option.value as any })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.priority === option.value
                        ? `${option.color} border-current`
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <span className="text-xl">{option.icon}</span>
                    <p className="text-sm font-medium mt-1">{option.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Send Email Option */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.sendEmail}
                  onChange={(e) => setFormData({ ...formData, sendEmail: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                />
                <div className="flex items-center gap-2">
                  <IconMail size={20} className="text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Also send via email
                  </span>
                </div>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-8">
                Members will receive this announcement in their inbox
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-green-600 dark:text-green-400">
                  ✅ Announcement sent successfully!
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={sending || !formData.title || !formData.message}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-green-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-green-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <IconSend size={20} />
                  Send Announcement
                </>
              )}
            </button>
          </div>

          {/* Preview */}
          {(formData.title || formData.message) && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Preview</h3>
              <div className={`p-4 rounded-xl ${
                formData.priority === 'urgent' 
                  ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'
                  : formData.priority === 'warning'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
              }`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📢</span>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                      {formData.title || 'Announcement Title'}
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">
                      {formData.message || 'Your announcement message will appear here...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </>
  );
}
