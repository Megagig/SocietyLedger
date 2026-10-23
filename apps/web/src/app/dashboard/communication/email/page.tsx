'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import {
  IconMail, IconSend, IconTemplate, IconUsers, IconChartBar,
  IconPlus, IconArrowRight, IconClock, IconCheck, IconAlertTriangle
} from '@tabler/icons-react';

// Email campaigns will use the existing notification system for now
// Full email campaign functionality can be added in a future phase

export default function EmailCampaignsPage() {
  const router = useRouter();
  const [showCompose, setShowCompose] = useState(false);
  const [emailData, setEmailData] = useState({
    subject: '',
    recipients: 'all',
    message: '',
  });
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!emailData.subject || !emailData.message) {
      toast.error('Please enter subject and message');
      return;
    }
    
    setIsSending(true);
    // TODO: Implement email sending via backend
    setTimeout(() => {
      toast.info('Email campaign feature coming soon! For now, use the Announcements feature.');
      setIsSending(false);
      setShowCompose(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-2">
            Email Campaigns
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Send email campaigns to your members
          </p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all w-full sm:w-auto"
        >
          <IconPlus size={18} />
          New Campaign
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <IconMail className="text-purple-600 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <h3 className="font-semibold text-purple-800 dark:text-purple-200 text-sm sm:text-base">Email Integration</h3>
            <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300 mt-1">
              Email campaigns use your association&apos;s configured email provider (Resend). 
              Members receive emails at their registered email addresses.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Emails Sent</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600 mt-1">0</p>
            </div>
            <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <IconMail className="text-purple-600" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Open Rate</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">0%</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <IconCheck className="text-green-600" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Campaigns</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">0</p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <IconUsers className="text-blue-600" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Templates</p>
              <p className="text-xl sm:text-2xl font-bold text-teal-600 mt-1">0</p>
            </div>
            <div className="p-2 sm:p-3 bg-teal-100 dark:bg-teal-900/30 rounded-full">
              <IconTemplate className="text-teal-600" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="space-y-2 sm:space-y-3">
            <button
              onClick={() => setShowCompose(true)}
              className="w-full flex items-center justify-between p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconSend className="text-purple-600" size={18} />
                <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Compose Email</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>

            <button
              onClick={() => router.push('/dashboard/communication/announcements')}
              className="w-full flex items-center justify-between p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconMail className="text-blue-600" size={18} />
                <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Send Announcement</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>

            <button
              className="w-full flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconTemplate className="text-gray-600" size={18} />
                <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Manage Templates</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Campaigns
          </h2>
          <div className="text-center py-6 sm:py-8 text-gray-500">
            <IconMail className="mx-auto mb-2 opacity-50" size={28} />
            <p className="text-sm sm:text-base">No email campaigns sent yet</p>
            <p className="text-xs sm:text-sm mt-1">Create your first campaign to get started</p>
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Compose Email Campaign
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recipients
                  </label>
                  <select
                    value={emailData.recipients}
                    onChange={(e) => setEmailData({ ...emailData, recipients: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="all">All Members</option>
                    <option value="active">Active Members Only</option>
                    <option value="owing">Owing Members</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={emailData.subject}
                    onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="Enter email subject..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Message *
                  </label>
                  <textarea
                    value={emailData.message}
                    onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="Enter your email message..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowCompose(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={isSending}
                    className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSending ? (
                      <>
                        <IconClock className="animate-spin" size={18} />
                        Sending...
                      </>
                    ) : (
                      <>
                        <IconSend size={18} />
                        Send Campaign
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
