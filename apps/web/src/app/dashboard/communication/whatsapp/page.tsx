'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconBrandWhatsapp, IconSend, IconTemplate, IconUsers,
  IconPlus, IconArrowRight, IconClock, IconAlertTriangle,
  IconCheck, IconSettings
} from '@tabler/icons-react';

export default function WhatsAppPage() {
  const router = useRouter();
  const [showCompose, setShowCompose] = useState(false);
  const [messageData, setMessageData] = useState({
    recipients: 'all',
    template: '',
    message: '',
  });
  const [isSending, setIsSending] = useState(false);

  // WhatsApp Business API requires approved templates
  const templates = [
    { id: 'payment_reminder', name: 'Payment Reminder', content: 'Dear {{name}}, your payment of ₦{{amount}} is due on {{date}}.' },
    { id: 'meeting_notice', name: 'Meeting Notice', content: 'Dear {{name}}, you are invited to {{meeting}} on {{date}} at {{time}}.' },
    { id: 'welcome', name: 'Welcome Message', content: 'Welcome to {{association}}, {{name}}! We are glad to have you.' },
  ];

  const handleSend = async () => {
    setIsSending(true);
    // TODO: Implement WhatsApp Business API integration
    setTimeout(() => {
      alert('WhatsApp Business API integration coming soon! This requires Meta Business verification.');
      setIsSending(false);
      setShowCompose(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent mb-2">
            WhatsApp Messaging
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Send WhatsApp messages to your members
          </p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all w-full sm:w-auto"
        >
          <IconSend size={18} />
          Send Message
        </button>
      </div>

      {/* Setup Required Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <IconAlertTriangle className="text-amber-600 mt-0.5 flex-shrink-0" size={20} />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 text-sm sm:text-base">WhatsApp Business API Setup Required</h3>
            <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 mt-1">
              To send WhatsApp messages, you need to set up the WhatsApp Business API through Meta Business Suite. 
              This requires business verification and approved message templates.
            </p>
            <a 
              href="https://business.whatsapp.com/products/business-platform" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs sm:text-sm text-amber-800 dark:text-amber-200 underline hover:no-underline"
            >
              Learn more about WhatsApp Business API →
            </a>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Messages Sent</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">0</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <IconBrandWhatsapp className="text-green-600" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Delivered</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">0</p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <IconCheck className="text-blue-600" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Read</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600 mt-1">0</p>
            </div>
            <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <IconCheck className="text-purple-600" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Templates</p>
              <p className="text-xl sm:text-2xl font-bold text-teal-600 mt-1">{templates.length}</p>
            </div>
            <div className="p-2 sm:p-3 bg-teal-100 dark:bg-teal-900/30 rounded-full">
              <IconTemplate className="text-teal-600" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions & Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="space-y-2 sm:space-y-3">
            <button
              onClick={() => setShowCompose(true)}
              className="w-full flex items-center justify-between p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconSend className="text-green-600" size={18} />
                <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Send WhatsApp Message</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>

            <button
              className="w-full flex items-center justify-between p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconTemplate className="text-blue-600" size={18} />
                <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Manage Templates</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>

            <button
              className="w-full flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconSettings className="text-gray-600" size={18} />
                <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">API Settings</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Message Templates
          </h2>
          <div className="space-y-2 sm:space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{template.name}</p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">{template.content}</p>
                  </div>
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full ml-2 flex-shrink-0">
                    Approved
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <IconBrandWhatsapp className="text-green-500" size={28} />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Send WhatsApp Message
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recipients
                  </label>
                  <select
                    value={messageData.recipients}
                    onChange={(e) => setMessageData({ ...messageData, recipients: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="all">All Members with WhatsApp</option>
                    <option value="active">Active Members Only</option>
                    <option value="owing">Owing Members</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template *
                  </label>
                  <select
                    value={messageData.template}
                    onChange={(e) => {
                      const template = templates.find(t => t.id === e.target.value);
                      setMessageData({ 
                        ...messageData, 
                        template: e.target.value,
                        message: template?.content || ''
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select a template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    WhatsApp Business API requires pre-approved templates
                  </p>
                </div>

                {messageData.template && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Preview
                    </label>
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                      {messageData.message}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowCompose(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={isSending || !messageData.template}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSending ? (
                      <>
                        <IconClock className="animate-spin" size={18} />
                        Sending...
                      </>
                    ) : (
                      <>
                        <IconBrandWhatsapp size={18} />
                        Send via WhatsApp
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
