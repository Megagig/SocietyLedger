'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text, Progress, Tabs } from '@mantine/core';
import { modals } from '@mantine/modals';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/utils/api';
import { toast } from '@/lib/toast';
import { HelpLink } from '@/components/docs/HelpLink';
import { 
  DollarSign, Users, Calendar, Target, Plus, Edit, Trash2,
  TrendingUp, Clock, CheckCircle, AlertCircle, Eye, Rocket
} from 'lucide-react';

interface LevyCategory {
  id: number;
  name: string;
  type: string;
  amount: number | null;
  frequency: string | null;
  description: string | null;
  isActive: boolean;
  _count?: { transactions: number };
}

interface LevyCampaign {
  id: number;
  name: string;
  description: string | null;
  targetAmount: number;
  amountPerMember: number | null;
  deadline: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  category: { id: number; name: string };
  _count?: { assignments: number };
  collectedAmount?: number;
}

interface LevyStats {
  totalLevies: number;
  totalAmount: number;
  totalCollected: number;
  totalPending: number;
}

export default function LeviesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string | null>('categories');
  const [levies, setLevies] = useState<LevyCategory[]>([]);
  const [campaigns, setCampaigns] = useState<LevyCampaign[]>([]);
  const [stats, setStats] = useState<LevyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingLevy, setEditingLevy] = useState<LevyCategory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    description: '',
    isActive: true,
  });
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    targetAmount: '',
    amountPerMember: '',
    deadline: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLevies();
    fetchCampaigns();
  }, []);

  const fetchLevies = async () => {
    setIsLoading(true);
    try {
      const [leviesRes, statsRes] = await Promise.all([
        apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories?type=levy`),
        apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions/stats`),
      ]);

      if (!leviesRes.ok) throw new Error('Failed to fetch levies');
      
      const leviesData = await leviesRes.json();
      setLevies(leviesData.data.categories);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const levyStats = statsData.data.byType?.levy;
        setStats({
          totalLevies: leviesData.data.categories.length,
          totalAmount: levyStats?.amount || 0,
          totalCollected: 0,
          totalPending: 0,
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/levies/campaigns`
      );
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.data.campaigns || []);
      }
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/levies/campaigns`,
        {
          name: campaignForm.name,
          description: campaignForm.description || undefined,
          categoryId: parseInt(campaignForm.categoryId),
          targetAmount: parseFloat(campaignForm.targetAmount),
          amountPerMember: campaignForm.amountPerMember ? parseFloat(campaignForm.amountPerMember) : undefined,
          deadline: campaignForm.deadline,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create campaign');

      toast.success('Campaign created successfully');
      setShowCampaignModal(false);
      setCampaignForm({ name: '', description: '', categoryId: '', targetAmount: '', amountPerMember: '', deadline: '' });
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories${editingLevy ? `/${editingLevy.id}` : ''}`;
      const payload = {
        name: formData.name,
        type: 'levy',
        amount: formData.amount ? parseFloat(formData.amount) : null,
        frequency: 'one-time',
        description: formData.description || null,
        isActive: formData.isActive,
      };

      const response = editingLevy 
        ? await apiPatch(url, payload)
        : await apiPost(url, payload);

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to save levy');

      toast.success(editingLevy ? 'Levy updated successfully' : 'Levy created successfully');
      setShowModal(false);
      setEditingLevy(null);
      setFormData({ name: '', amount: '', description: '', isActive: true });
      fetchLevies();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save levy');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (levy: LevyCategory) => {
    setEditingLevy(levy);
    setFormData({
      name: levy.name,
      amount: levy.amount?.toString() || '',
      description: levy.description || '',
      isActive: levy.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    modals.openConfirmModal({
      title: 'Delete Levy',
      children: (
        <Text size="sm">
          Are you sure you want to delete this levy? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await apiDelete(
            `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories/${id}`
          );

          const data = await response.json();
          if (!response.ok) throw new Error(data.message);

          toast.success('Levy deleted successfully');
          fetchLevies();
        } catch (err: any) {
          toast.error(err.message || 'Failed to delete levy');
        }
      },
    });
  };

  const handleAssignLevy = (levyId: number) => {
    router.push(`/dashboard/finance/dues?categoryId=${levyId}`);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Levies & Special Contributions
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Manage one-time levies, campaigns, and special project contributions
          </p>
        </div>
        
        <div className="flex gap-2">
          <HelpLink />
          <Can permission={PERMISSIONS.FINANCE_CREATE}>
            <button
              onClick={() => setShowCampaignModal(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Rocket className="w-4 h-4" />
              <span className="hidden sm:inline">New Campaign</span>
              <span className="sm:hidden">Campaign</span>
            </button>
          </Can>
          <Can permission={PERMISSIONS.FINANCE_CREATE}>
            <button
              onClick={() => {
                setEditingLevy(null);
                setFormData({ name: '', amount: '', description: '', isActive: true });
                setShowModal(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Levy</span>
              <span className="sm:hidden">Levy</span>
            </button>
          </Can>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Levies</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {levies.length}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Active Campaigns</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">
                {campaigns.filter(c => c.status === 'ACTIVE').length}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <Rocket className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Billed</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">
                ₦{Number(stats?.totalAmount || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-600 mt-1">
                {campaigns.filter(c => c.status === 'COMPLETED').length}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="categories">Levy Categories ({levies.length})</Tabs.Tab>
          <Tabs.Tab value="campaigns">Campaigns ({campaigns.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="categories" pt="md">
          {/* Levy Categories */}
          {levies.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <DollarSign className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Levies Created
              </h3>
              <p className="text-gray-500 mb-4">
                Create your first levy to start collecting special contributions
              </p>
              <Can permission={PERMISSIONS.FINANCE_CREATE}>
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Create Levy
                </button>
              </Can>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {levies.map(levy => (
                <div
                  key={levy.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${
                    !levy.isActive ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                        <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {levy.name}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          levy.isActive 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                          {levy.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Can permission={PERMISSIONS.FINANCE_EDIT}>
                        <button
                          onClick={() => handleEdit(levy)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </Can>
                      <Can permission={PERMISSIONS.FINANCE_DELETE}>
                        <button
                          onClick={() => handleDelete(levy.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Can>
                    </div>
                  </div>

                  {levy.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {levy.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm mb-4">
                    {levy.amount && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Amount:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          ₦{Number(levy.amount).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <Can permission={PERMISSIONS.TRANSACTION_CREATE}>
                    <button
                      onClick={() => handleAssignLevy(levy.id)}
                      disabled={!levy.isActive}
                      className="w-full flex items-center justify-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-4 py-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Users className="w-4 h-4" />
                      Assign to Members
                    </button>
                  </Can>
                </div>
              ))}
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="campaigns" pt="md">
          {/* Campaigns */}
          {campaigns.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <Rocket className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Campaigns Created
              </h3>
              <p className="text-gray-500 mb-4">
                Create a campaign to track levy collection progress with targets and deadlines
              </p>
              <Can permission={PERMISSIONS.FINANCE_CREATE}>
                <button
                  onClick={() => setShowCampaignModal(true)}
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                >
                  <Rocket className="w-4 h-4" />
                  Create Campaign
                </button>
              </Can>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map(campaign => {
                const progressPercent = campaign.collectedAmount 
                  ? Math.min((Number(campaign.collectedAmount) / Number(campaign.targetAmount)) * 100, 100)
                  : 0;
                const daysRemaining = Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div
                    key={campaign.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {campaign.name}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                          campaign.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                          campaign.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {campaign.status}
                        </span>
                      </div>
                      <button
                        onClick={() => router.push(`/dashboard/finance/levies/${campaign.id}`)}
                        className="text-purple-600 hover:text-purple-800"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium">{progressPercent.toFixed(1)}%</span>
                      </div>
                      <Progress value={progressPercent} color="grape" size="sm" />
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Target:</span>
                        <span className="font-semibold">₦{Number(campaign.targetAmount).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Members:</span>
                        <span>{campaign._count?.assignments || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Deadline:</span>
                        <span className={daysRemaining < 0 ? 'text-red-600' : daysRemaining < 7 ? 'text-orange-600' : ''}>
                          {new Date(campaign.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => router.push(`/dashboard/finance/levies/${campaign.id}`)}
                      className="w-full mt-4 flex items-center justify-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-4 py-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingLevy ? 'Edit Levy' : 'Create Levy'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Levy Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Building Fund Levy"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount (₦)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Enter default amount"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe the purpose of this levy"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                  Active (can be assigned to members)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Create Levy Campaign
            </h2>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  required
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  placeholder="e.g., 2025 Building Fund Drive"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Levy Category *
                </label>
                <select
                  required
                  value={campaignForm.categoryId}
                  onChange={(e) => setCampaignForm({ ...campaignForm, categoryId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select a levy category</option>
                  {levies.filter(l => l.isActive).map(levy => (
                    <option key={levy.id} value={levy.id}>{levy.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Amount (₦) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={campaignForm.targetAmount}
                  onChange={(e) => setCampaignForm({ ...campaignForm, targetAmount: e.target.value })}
                  placeholder="Total amount to raise"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount Per Member (₦)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={campaignForm.amountPerMember}
                  onChange={(e) => setCampaignForm({ ...campaignForm, amountPerMember: e.target.value })}
                  placeholder="Default amount per member (optional)"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Deadline *
                </label>
                <input
                  type="date"
                  required
                  value={campaignForm.deadline}
                  onChange={(e) => setCampaignForm({ ...campaignForm, deadline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={campaignForm.description}
                  onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                  rows={2}
                  placeholder="Campaign description"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
