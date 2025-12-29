'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getSMSDashboard,
  getSMSTemplates,
  sendQuickSMS,
  SMSDashboard,
  SMSTemplate,
} from '@/lib/api/communication';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import {
  IconMessage, IconSend, IconTemplate, IconCoin, IconUsers,
  IconCheck, IconX, IconClock, IconChartBar, IconPlus,
  IconArrowRight, IconRefresh, IconAlertTriangle
} from '@tabler/icons-react';

export default function SMSDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState<SMSDashboard | null>(null);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Quick SMS Modal State
  const [showQuickSMS, setShowQuickSMS] = useState(false);
  const [quickSMSData, setQuickSMSData] = useState({
    recipients: '',
    message: '',
    templateId: '',
  });
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const canSend = user?.role && hasPermission(user.role, PERMISSIONS.SMS_SEND);
  const canManageCampaigns = user?.role && hasPermission(user.role, PERMISSIONS.SMS_CAMPAIGN_MANAGE);
  const canManageTemplates = user?.role && hasPermission(user.role, PERMISSIONS.SMS_TEMPLATE_MANAGE);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [dashboardRes, templatesRes] = await Promise.all([
        getSMSDashboard(),
        getSMSTemplates({ limit: 10, isActive: true }),
      ]);
      setDashboard(dashboardRes.data);
      setTemplates(templatesRes.data?.templates || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSMS = async () => {
    if (!quickSMSData.recipients.trim() || !quickSMSData.message.trim()) {
      setSendResult({ success: false, message: 'Please enter recipients and message' });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const recipients = quickSMSData.recipients
        .split(/[,\n]/)
        .map(r => r.trim())
        .filter(r => r);

      const result = await sendQuickSMS({
        recipients,
        message: quickSMSData.message,
        templateId: quickSMSData.templateId ? parseInt(quickSMSData.templateId) : undefined,
      });

      setSendResult({
        success: true,
        message: `Sent to ${result.data.totalSent} recipients. ${result.data.totalFailed} failed. Credits used: ${result.data.creditsUsed}`,
      });
      
      // Refresh dashboard
      fetchData();
      
      // Reset form after success
      setTimeout(() => {
        setQuickSMSData({ recipients: '', message: '', templateId: '' });
        setShowQuickSMS(false);
        setSendResult(null);
      }, 3000);
    } catch (err: any) {
      setSendResult({ success: false, message: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      DELIVERED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      REJECTED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    };
    return colors[status] || colors.PENDING;
  };

  const getCampaignStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-700',
      SCHEDULED: 'bg-blue-100 text-blue-700',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
      COMPLETED: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-red-100 text-red-700',
      FAILED: 'bg-red-100 text-red-700',
    };
    return colors[status] || colors.DRAFT;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading SMS dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <IconAlertTriangle className="mx-auto text-red-500 mb-2" size={40} />
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            SMS Communication
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Send SMS messages and manage campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="Refresh"
          >
            <IconRefresh size={20} />
          </button>
          {canSend && (
            <button
              onClick={() => setShowQuickSMS(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-lg hover:from-teal-600 hover:to-green-600 transition-all"
            >
              <IconSend size={18} />
              Quick SMS
            </button>
          )}
        </div>
      </div>

      {/* Credit Balance Alert */}
      {dashboard && dashboard.creditBalance < 100 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <IconCoin className="text-amber-600" size={24} />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">Low SMS Credits</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                You have {dashboard.creditBalance} credits remaining. Top up to continue sending SMS.
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/communication/sms/credits')}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Top Up
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Messages Sent</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {dashboard?.totalMessagesSent || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {dashboard?.totalMessagesDelivered || 0} delivered
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <IconMessage className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Delivery Rate</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {(dashboard?.deliveryRate || 0).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {dashboard?.totalMessagesFailed || 0} failed
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <IconCheck className="text-green-600 dark:text-green-400" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Campaigns</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {dashboard?.totalCampaigns || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {dashboard?.activeCampaigns || 0} active
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <IconUsers className="text-purple-600 dark:text-purple-400" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">SMS Credits</p>
              <p className="text-2xl font-bold text-teal-600 mt-1">
                {dashboard?.creditBalance || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {dashboard?.totalTemplates || 0} templates
              </p>
            </div>
            <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-full">
              <IconCoin className="text-teal-600 dark:text-teal-400" size={24} />
            </div>
          </div>
        </div>
      </div>


      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            {canSend && (
              <button
                onClick={() => setShowQuickSMS(true)}
                className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <IconSend className="text-blue-600" size={20} />
                  <span className="font-medium text-gray-900 dark:text-white">Send Quick SMS</span>
                </div>
                <IconArrowRight className="text-gray-400" size={16} />
              </button>
            )}

            {canManageCampaigns && (
              <button
                onClick={() => router.push('/dashboard/communication/sms/campaigns?action=create')}
                className="w-full flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <IconPlus className="text-purple-600" size={20} />
                  <span className="font-medium text-gray-900 dark:text-white">Create Campaign</span>
                </div>
                <IconArrowRight className="text-gray-400" size={16} />
              </button>
            )}

            {canManageTemplates && (
              <button
                onClick={() => router.push('/dashboard/communication/sms/templates')}
                className="w-full flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <IconTemplate className="text-green-600" size={20} />
                  <span className="font-medium text-gray-900 dark:text-white">Manage Templates</span>
                </div>
                <IconArrowRight className="text-gray-400" size={16} />
              </button>
            )}

            <button
              onClick={() => router.push('/dashboard/communication/sms/history')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconChartBar className="text-gray-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">View Message History</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>
          </div>
        </div>

        {/* Recent Messages */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Messages
            </h2>
            <button
              onClick={() => router.push('/dashboard/communication/sms/history')}
              className="text-sm text-teal-600 hover:text-teal-800"
            >
              View All
            </button>
          </div>

          {dashboard?.recentMessages && dashboard.recentMessages.length > 0 ? (
            <div className="space-y-3">
              {dashboard.recentMessages.slice(0, 5).map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {msg.recipientName || msg.recipientPhone}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{msg.message}</p>
                  </div>
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getStatusColor(msg.status)}`}>
                    {msg.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No messages sent yet</p>
          )}
        </div>
      </div>

      {/* Recent Campaigns */}
      {dashboard?.recentCampaigns && dashboard.recentCampaigns.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Campaigns
            </h2>
            <button
              onClick={() => router.push('/dashboard/communication/sms/campaigns')}
              className="text-sm text-teal-600 hover:text-teal-800"
            >
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b dark:border-gray-700">
                  <th className="pb-3 font-medium">Campaign</th>
                  <th className="pb-3 font-medium">Recipients</th>
                  <th className="pb-3 font-medium">Sent</th>
                  <th className="pb-3 font-medium">Delivered</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentCampaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => router.push(`/dashboard/communication/sms/campaigns/${campaign.id}`)}
                  >
                    <td className="py-3 font-medium text-gray-900 dark:text-white">
                      {campaign.name}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {campaign.totalRecipients}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {campaign.sentCount}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {campaign.deliveredCount}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${getCampaignStatusColor(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick SMS Modal */}
      {showQuickSMS && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Send Quick SMS
                </h2>
                <button
                  onClick={() => {
                    setShowQuickSMS(false);
                    setSendResult(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <IconX size={24} />
                </button>
              </div>

              {sendResult && (
                <div className={`mb-4 p-3 rounded-lg ${
                  sendResult.success 
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' 
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                }`}>
                  {sendResult.message}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recipients (phone numbers, comma or newline separated)
                  </label>
                  <textarea
                    value={quickSMSData.recipients}
                    onChange={(e) => setQuickSMSData({ ...quickSMSData, recipients: e.target.value })}
                    placeholder="08012345678, 08098765432&#10;or one per line"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {templates.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Use Template (optional)
                    </label>
                    <select
                      value={quickSMSData.templateId}
                      onChange={(e) => {
                        const template = templates.find(t => t.id === parseInt(e.target.value));
                        setQuickSMSData({
                          ...quickSMSData,
                          templateId: e.target.value,
                          message: template?.content || quickSMSData.message,
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select a template...</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template.category})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Message ({quickSMSData.message.length}/160 characters)
                  </label>
                  <textarea
                    value={quickSMSData.message}
                    onChange={(e) => setQuickSMSData({ ...quickSMSData, message: e.target.value })}
                    placeholder="Enter your message..."
                    rows={4}
                    maxLength={918}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.ceil(quickSMSData.message.length / 160)} SMS segment(s)
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowQuickSMS(false);
                      setSendResult(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleQuickSMS}
                    disabled={isSending || !quickSMSData.recipients || !quickSMSData.message}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-lg hover:from-teal-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSending ? (
                      <>
                        <IconClock className="animate-spin" size={18} />
                        Sending...
                      </>
                    ) : (
                      <>
                        <IconSend size={18} />
                        Send SMS
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
