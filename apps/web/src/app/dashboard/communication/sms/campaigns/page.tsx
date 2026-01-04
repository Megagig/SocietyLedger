'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getSMSCampaigns,
  createSMSCampaign,
  startSMSCampaign,
  cancelSMSCampaign,
  deleteSMSCampaign,
  getSMSTemplates,
  SMSCampaign,
  SMSTemplate,
} from '@/lib/api/communication';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/lib/toast';
import {
  IconPlus, IconPlayerPlay, IconPlayerStop, IconTrash,
  IconArrowLeft, IconUsers, IconCheck, IconX, IconClock,
  IconAlertTriangle
} from '@tabler/icons-react';

export default function SMSCampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  
  const [campaigns, setCampaigns] = useState<SMSCampaign[]>([]);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  
  // Create Campaign Modal
  const [showCreate, setShowCreate] = useState(searchParams.get('action') === 'create');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    templateId: '',
    recipientType: 'ALL_MEMBERS',
    scheduledAt: '',
  });

  const canManage = user?.permissions && hasPermission(user.permissions, PERMISSIONS.SMS_CAMPAIGN_MANAGE);

  useEffect(() => {
    fetchCampaigns();
    fetchTemplates();
  }, [page, statusFilter]);

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true);
      const res = await getSMSCampaigns({ page, limit: 10, status: statusFilter || undefined });
      setCampaigns(res.data?.campaigns || []);
      setTotalPages(res.data?.totalPages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await getSMSTemplates({ limit: 50, isActive: true });
      setTemplates(res.data?.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.message) {
      setCreateError('Name and message are required');
      return;
    }

    setIsCreating(true);
    setCreateError('');

    try {
      await createSMSCampaign({
        name: formData.name,
        message: formData.message,
        templateId: formData.templateId ? parseInt(formData.templateId) : undefined,
        recipientType: formData.recipientType,
        scheduledAt: formData.scheduledAt || undefined,
      });
      
      setShowCreate(false);
      setFormData({ name: '', message: '', templateId: '', recipientType: 'ALL_MEMBERS', scheduledAt: '' });
      fetchCampaigns();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStart = async (id: number) => {
    try {
      await startSMSCampaign(id);
      toast.success('Campaign started successfully');
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start campaign');
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await cancelSMSCampaign(id);
      toast.success('Campaign cancelled successfully');
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel campaign');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSMSCampaign(id);
      toast.success('Campaign deleted successfully');
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete campaign');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[status] || colors.DRAFT;
  };

  const getRecipientTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ALL_MEMBERS: 'All Members',
      SELECTED_MEMBERS: 'Selected Members',
      MEMBER_CATEGORY: 'By Category',
      CUSTOM_NUMBERS: 'Custom Numbers',
      OWING_MEMBERS: 'Owing Members',
      PAID_MEMBERS: 'Paid Members',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => router.push('/dashboard/communication/sms')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <IconArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              SMS Campaigns
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Create and manage bulk SMS campaigns
            </p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-lg hover:from-teal-600 hover:to-green-600 w-full sm:w-auto"
          >
            <IconPlus size={18} />
            New Campaign
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 sm:gap-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Campaigns Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading campaigns...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-8 sm:py-12 bg-white dark:bg-gray-800 rounded-lg">
          <IconUsers className="mx-auto text-gray-400 mb-4" size={40} />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">No campaigns yet</h3>
          <p className="text-sm sm:text-base text-gray-500 mb-4">Create your first SMS campaign to reach your members</p>
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
            >
              Create Campaign
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{campaign.name}</p>
                    <p className="text-xs text-gray-500">{getRecipientTypeLabel(campaign.recipientType)}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2">
                  <div>
                    <p className="text-xs text-gray-500">Recipients</p>
                    <p className="font-semibold text-sm">{campaign.totalRecipients}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Sent</p>
                    <p className="font-semibold text-green-600 text-sm">{campaign.sentCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Delivered</p>
                    <p className="font-semibold text-blue-600 text-sm">{campaign.deliveredCount}</p>
                  </div>
                </div>
                
                {canManage && (
                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    {campaign.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => handleStart(campaign.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg"
                        >
                          <IconPlayerPlay size={14} /> Start
                        </button>
                        <button
                          onClick={() => handleDelete(campaign.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg"
                        >
                          <IconTrash size={14} /> Delete
                        </button>
                      </>
                    )}
                    {(campaign.status === 'SCHEDULED' || campaign.status === 'IN_PROGRESS') && (
                      <button
                        onClick={() => handleCancel(campaign.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg"
                      >
                        <IconPlayerStop size={14} /> Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipients</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{campaign.name}</p>
                        <p className="text-sm text-gray-500">{getRecipientTypeLabel(campaign.recipientType)}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {campaign.totalRecipients}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-600">{campaign.sentCount} sent</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-blue-600">{campaign.deliveredCount} delivered</span>
                        {campaign.failedCount > 0 && (
                          <>
                            <span className="text-gray-400">|</span>
                            <span className="text-red-600">{campaign.failedCount} failed</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {campaign.status === 'DRAFT' && canManage && (
                          <>
                            <button
                              onClick={() => handleStart(campaign.id)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Start Campaign"
                            >
                              <IconPlayerPlay size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(campaign.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <IconTrash size={18} />
                            </button>
                          </>
                        )}
                        {(campaign.status === 'SCHEDULED' || campaign.status === 'IN_PROGRESS') && canManage && (
                          <button
                            onClick={() => handleCancel(campaign.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Cancel"
                          >
                            <IconPlayerStop size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 sm:px-6 py-4 border-t dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-full sm:w-auto px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-full sm:w-auto px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Create SMS Campaign
              </h2>

              {createError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{createError}</div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., January Dues Reminder"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recipient Type *
                  </label>
                  <select
                    value={formData.recipientType}
                    onChange={(e) => setFormData({ ...formData, recipientType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="ALL_MEMBERS">All Members</option>
                    <option value="OWING_MEMBERS">Owing Members</option>
                    <option value="PAID_MEMBERS">Paid Members</option>
                    <option value="MEMBER_CATEGORY">By Category</option>
                  </select>
                </div>

                {templates.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Use Template (optional)
                    </label>
                    <select
                      value={formData.templateId}
                      onChange={(e) => {
                        const template = templates.find(t => t.id === parseInt(e.target.value));
                        setFormData({
                          ...formData,
                          templateId: e.target.value,
                          message: template?.content || formData.message,
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select a template...</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Message *
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={4}
                    maxLength={918}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="Enter your message..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.message.length}/918 characters ({Math.ceil(formData.message.length / 160)} segments)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Schedule (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
                  >
                    {isCreating ? 'Creating...' : 'Create Campaign'}
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
