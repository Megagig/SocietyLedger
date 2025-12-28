'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text, Tabs } from '@mantine/core';
import { modals } from '@mantine/modals';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/utils/api';
import { toast } from '@/lib/toast';
import { 
  Gift, Plus, Edit, Trash2, Heart,
  CheckCircle, Clock, FileText, Download, TrendingUp, Target
} from 'lucide-react';

interface DonationCategory {
  id: number;
  name: string;
  type: string;
  amount: number | null;
  description: string | null;
  isActive: boolean;
}

interface DonationAllocation {
  id: number;
  name: string;
  description: string | null;
  type: string;
  targetAmount: number | null;
  isActive: boolean;
  _count?: { donations: number };
}

interface DonationRecord {
  id: number;
  receiptNumber: string;
  donorMessage: string | null;
  isAnonymous: boolean;
  createdAt: string;
  amount?: number;
  donor?: { id?: number; memberId?: string; name: string };
  category?: string;
  transaction?: {
    id: number;
    amount: number;
    member: { firstName: string; lastName: string; memberId: string };
    category: { name: string };
  };
  allocation?: { name: string };
}

interface Member {
  id: number;
  memberId: string;
  firstName: string;
  lastName: string;
  status: string;
}

export default function DonationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string | null>('categories');
  const [donations, setDonations] = useState<DonationCategory[]>([]);
  const [allocations, setAllocations] = useState<DonationAllocation[]>([]);
  const [recentDonations, setRecentDonations] = useState<DonationRecord[]>([]);
  const [donationStats, setDonationStats] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPrintReceiptModal, setShowPrintReceiptModal] = useState(false);
  const [printReceiptData, setPrintReceiptData] = useState<any>(null);
  const [editingDonation, setEditingDonation] = useState<DonationCategory | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DonationCategory | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<DonationRecord | null>(null);
  
  // Category form
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    amount: '',
    description: '',
    isActive: true,
  });
  
  // Allocation form
  const [allocationForm, setAllocationForm] = useState({
    name: '',
    description: '',
    type: 'general',
    targetAmount: '',
  });
  
  // Record donation form
  const [recordForm, setRecordForm] = useState({
    memberId: '',
    amount: '',
    allocationId: '',
    donorMessage: '',
    isAnonymous: false,
    notes: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDonations();
    fetchAllocations();
    fetchRecentDonations();
    fetchDonationStats();
    fetchMembers();
  }, []);

  const fetchDonations = async () => {
    setIsLoading(true);
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories?type=donation`
      );
      if (!response.ok) throw new Error('Failed to fetch donations');
      const data = await response.json();
      setDonations(data.data.categories);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllocations = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/donations/allocations`
      );
      if (response.ok) {
        const data = await response.json();
        setAllocations(data.data.allocations || []);
      }
    } catch (err: any) {
      console.error('Error fetching allocations:', err);
    }
  };

  const fetchRecentDonations = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/donations?limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setRecentDonations(data.data.donations || []);
      }
    } catch (err: any) {
      console.error('Error fetching recent donations:', err);
    }
  };

  const fetchDonationStats = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/donations/stats`
      );
      if (response.ok) {
        const data = await response.json();
        setDonationStats(data.data);
      }
    } catch (err: any) {
      console.error('Error fetching donation stats:', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/members?status=active&limit=100`
      );
      if (!response.ok) throw new Error('Failed to fetch members');
      const data = await response.json();
      setMembers(data.data.members);
    } catch (err: any) {
      console.error('Error fetching members:', err);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingDonation
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories/${editingDonation.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories`;

      const payload = {
        name: categoryForm.name,
        type: 'donation',
        amount: categoryForm.amount ? parseFloat(categoryForm.amount) : null,
        frequency: 'one-time',
        description: categoryForm.description || null,
        isActive: categoryForm.isActive,
      };

      const response = editingDonation
        ? await apiPatch(url, payload)
        : await apiPost(url, payload);

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to save donation category');

      toast.success(editingDonation ? 'Category updated successfully' : 'Category created successfully');
      setShowCategoryModal(false);
      setEditingDonation(null);
      setCategoryForm({ name: '', amount: '', description: '', isActive: true });
      fetchDonations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save donation category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !recordForm.memberId || !recordForm.amount) return;

    setIsSubmitting(true);
    try {
      // Use the advanced donation recording API
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/donations/record`,
        {
          memberId: parseInt(recordForm.memberId),
          categoryId: selectedCategory.id,
          amount: parseFloat(recordForm.amount),
          allocationId: recordForm.allocationId ? parseInt(recordForm.allocationId) : undefined,
          donorMessage: recordForm.donorMessage || undefined,
          isAnonymous: recordForm.isAnonymous,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to record donation');

      toast.success('Donation recorded successfully!');
      setShowRecordModal(false);
      setSelectedCategory(null);
      setRecordForm({ memberId: '', amount: '', allocationId: '', donorMessage: '', isAnonymous: false, notes: '' });
      fetchRecentDonations();
      fetchDonationStats();
      
      // Show receipt
      if (data.data?.donationRecord) {
        setSelectedReceipt(data.data.donationRecord);
        setShowReceiptModal(true);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to record donation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/donations/allocations`,
        {
          name: allocationForm.name,
          description: allocationForm.description || undefined,
          type: allocationForm.type,
          targetAmount: allocationForm.targetAmount ? parseFloat(allocationForm.targetAmount) : undefined,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create allocation');

      toast.success('Allocation created successfully');
      setShowAllocationModal(false);
      setAllocationForm({ name: '', description: '', type: 'general', targetAmount: '' });
      fetchAllocations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create allocation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadReceipt = async (donationId: number) => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/advanced/donations/${donationId}/receipt`
      );
      if (!response.ok) throw new Error('Failed to get receipt');
      
      const data = await response.json();
      setPrintReceiptData(data.data);
      setShowPrintReceiptModal(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate receipt');
    }
  };

  const handlePrintReceipt = () => {
    const printContent = document.getElementById('printable-receipt');
    if (!printContent) return;
    
    const printWindow = window.open('', '', 'width=600,height=800');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Donation Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 500px; margin: 20px auto; padding: 20px; }
            .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 15px; }
            .header h1 { color: #10b981; margin: 0 0 5px 0; font-size: 20px; }
            .receipt-number { font-size: 12px; color: #888; }
            .amount { font-size: 28px; color: #10b981; text-align: center; margin: 20px 0; font-weight: bold; }
            .details { margin: 15px 0; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .label { color: #666; }
            .value { font-weight: 600; }
            .message { background: #f0fdf4; padding: 12px; border-radius: 6px; margin: 15px 0; font-style: italic; color: #166534; }
            .footer { text-align: center; margin-top: 25px; color: #888; font-size: 11px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const handleEdit = (donation: DonationCategory) => {
    setEditingDonation(donation);
    setCategoryForm({
      name: donation.name,
      amount: donation.amount?.toString() || '',
      description: donation.description || '',
      isActive: donation.isActive,
    });
    setShowCategoryModal(true);
  };

  const handleDelete = async (id: number) => {
    modals.openConfirmModal({
      title: 'Delete Donation Category',
      children: (
        <Text size="sm">
          Are you sure you want to delete this donation category? This action cannot be undone.
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

          toast.success('Category deleted successfully');
          fetchDonations();
        } catch (err: any) {
          toast.error(err.message || 'Failed to delete category');
        }
      },
    });
  };

  const openRecordModal = (donation: DonationCategory) => {
    setSelectedCategory(donation);
    setRecordForm({
      memberId: '',
      amount: donation.amount?.toString() || '',
      allocationId: '',
      donorMessage: '',
      isAnonymous: false,
      notes: '',
    });
    setShowRecordModal(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Gift className="w-8 h-8 text-green-600" />
            Donations
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage donation categories, allocations, and record contributions
          </p>
        </div>
        
        <div className="flex gap-2">
          <Can permission={PERMISSIONS.FINANCE_CREATE}>
            <button
              onClick={() => setShowAllocationModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Target className="w-4 h-4" />
              New Allocation
            </button>
          </Can>
          <Can permission={PERMISSIONS.FINANCE_CREATE}>
            <button
              onClick={() => {
                setEditingDonation(null);
                setCategoryForm({ name: '', amount: '', description: '', isActive: true });
                setShowCategoryModal(true);
              }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Category
            </button>
          </Can>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Donations</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                ₦{Number(donationStats?.totalAmount || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Donation Count</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {donationStats?.totalCount || recentDonations.length}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <Gift className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Categories</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {donations.length}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Allocations</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {allocations.length}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
              <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="categories">Categories ({donations.length})</Tabs.Tab>
          <Tabs.Tab value="allocations">Allocations ({allocations.length})</Tabs.Tab>
          <Tabs.Tab value="recent">Recent Donations ({recentDonations.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="categories" pt="md">
      {donations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <Heart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Donation Categories
          </h3>
          <p className="text-gray-500 mb-4">
            Create donation categories to start tracking contributions
          </p>
          <Can permission={PERMISSIONS.FINANCE_CREATE}>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Create Category
            </button>
          </Can>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {donations.map(donation => (
            <div
              key={donation.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${
                !donation.isActive ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Gift className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {donation.name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      donation.isActive 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {donation.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Can permission={PERMISSIONS.FINANCE_EDIT}>
                    <button
                      onClick={() => handleEdit(donation)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </Can>
                  <Can permission={PERMISSIONS.FINANCE_DELETE}>
                    <button
                      onClick={() => handleDelete(donation.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Can>
                </div>
              </div>

              {donation.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {donation.description}
                </p>
              )}

              <div className="space-y-2 text-sm mb-4">
                {donation.amount && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Suggested Amount:</span>
                    <span className="font-semibold text-green-600">
                      ₦{Number(donation.amount).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <Can permission={PERMISSIONS.TRANSACTION_CREATE}>
                <button
                  onClick={() => openRecordModal(donation)}
                  disabled={!donation.isActive}
                  className="w-full flex items-center justify-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-4 py-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Heart className="w-4 h-4" />
                  Record Donation
                </button>
              </Can>
            </div>
          ))}
        </div>
      )}
        </Tabs.Panel>

        <Tabs.Panel value="allocations" pt="md">
          {/* Allocations */}
          {allocations.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <Target className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Allocations Created
              </h3>
              <p className="text-gray-500 mb-4">
                Create allocations to track donations for specific purposes or projects
              </p>
              <Can permission={PERMISSIONS.FINANCE_CREATE}>
                <button
                  onClick={() => setShowAllocationModal(true)}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  <Target className="w-4 h-4" />
                  Create Allocation
                </button>
              </Can>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allocations.map(allocation => (
                <div key={allocation.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{allocation.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        {allocation.type}
                      </span>
                    </div>
                  </div>
                  {allocation.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{allocation.description}</p>
                  )}
                  <div className="space-y-2 text-sm">
                    {allocation.targetAmount && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Target:</span>
                        <span className="font-semibold">₦{Number(allocation.targetAmount).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Donations:</span>
                      <span>{allocation._count?.donations || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="recent" pt="md">
          {/* Recent Donations */}
          {recentDonations.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <Heart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Donations Yet
              </h3>
              <p className="text-gray-500">
                Donations will appear here once recorded
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Donor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {recentDonations.map(donation => (
                    <tr key={donation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 font-mono text-sm">{donation.receiptNumber}</td>
                      <td className="px-4 py-3">
                        {donation.isAnonymous ? (
                          <span className="text-gray-500 italic">Anonymous</span>
                        ) : donation.donor?.name ? (
                          <span>{donation.donor.name}</span>
                        ) : donation.transaction?.member ? (
                          <span>{donation.transaction.member.firstName} {donation.transaction.member.lastName}</span>
                        ) : (
                          <span className="text-gray-400">Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-600">
                        ₦{Number(donation.amount || donation.transaction?.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">{donation.category || donation.transaction?.category?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(donation.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedReceipt(donation);
                            setShowReceiptModal(true);
                          }}
                          className="text-green-600 hover:text-green-800"
                          title="View Receipt"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingDonation ? 'Edit Donation Category' : 'Create Donation Category'}
            </h2>

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g., Building Fund, Charity Drive"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Suggested Amount (₦)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={categoryForm.amount}
                  onChange={(e) => setCategoryForm({ ...categoryForm, amount: e.target.value })}
                  placeholder="Optional suggested donation amount"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={3}
                  placeholder="Describe the purpose of this donation category"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="categoryActive"
                  checked={categoryForm.isActive}
                  onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="categoryActive" className="text-sm text-gray-700 dark:text-gray-300">
                  Active
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Donation Modal */}
      {showRecordModal && selectedCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Record Donation: {selectedCategory.name}
            </h2>

            <form onSubmit={handleRecordDonation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Donor (Member) *
                </label>
                <select
                  required
                  value={recordForm.memberId}
                  onChange={(e) => setRecordForm({ ...recordForm, memberId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select a member</option>
                  {members.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName} ({member.memberId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount (₦) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={recordForm.amount}
                  onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })}
                  placeholder={selectedCategory.amount ? `Suggested: ${selectedCategory.amount}` : 'Enter amount'}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Allocation (Optional)
                </label>
                <select
                  value={recordForm.allocationId}
                  onChange={(e) => setRecordForm({ ...recordForm, allocationId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">General Fund</option>
                  {allocations.filter(a => a.isActive).map(allocation => (
                    <option key={allocation.id} value={allocation.id}>
                      {allocation.name} ({allocation.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Donor Message
                </label>
                <textarea
                  value={recordForm.donorMessage}
                  onChange={(e) => setRecordForm({ ...recordForm, donorMessage: e.target.value })}
                  rows={2}
                  placeholder="Optional message from donor"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAnonymous"
                  checked={recordForm.isAnonymous}
                  onChange={(e) => setRecordForm({ ...recordForm, isAnonymous: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="isAnonymous" className="text-sm text-gray-700 dark:text-gray-300">
                  Anonymous donation (hide donor name on receipts)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Record Donation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocation Modal */}
      {showAllocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Create Donation Allocation
            </h2>

            <form onSubmit={handleCreateAllocation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Allocation Name *
                </label>
                <input
                  type="text"
                  required
                  value={allocationForm.name}
                  onChange={(e) => setAllocationForm({ ...allocationForm, name: e.target.value })}
                  placeholder="e.g., Building Project, Emergency Fund"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type *
                </label>
                <select
                  required
                  value={allocationForm.type}
                  onChange={(e) => setAllocationForm({ ...allocationForm, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="general">General Fund</option>
                  <option value="project">Specific Project</option>
                  <option value="emergency">Emergency Fund</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Amount (₦)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={allocationForm.targetAmount}
                  onChange={(e) => setAllocationForm({ ...allocationForm, targetAmount: e.target.value })}
                  placeholder="Optional fundraising target"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={allocationForm.description}
                  onChange={(e) => setAllocationForm({ ...allocationForm, description: e.target.value })}
                  rows={2}
                  placeholder="Describe the purpose of this allocation"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAllocationModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {showReceiptModal && selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="text-center mb-6">
              <Gift className="w-12 h-12 mx-auto text-green-600 mb-2" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Donation Receipt
              </h2>
              <p className="text-sm text-gray-500">{selectedReceipt.receiptNumber}</p>
            </div>

            <div className="space-y-4 border-t border-b border-gray-200 dark:border-gray-700 py-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Donor:</span>
                <span className="font-medium">
                  {selectedReceipt.isAnonymous 
                    ? 'Anonymous' 
                    : selectedReceipt.donor?.name 
                      ? selectedReceipt.donor.name
                      : selectedReceipt.transaction?.member 
                        ? `${selectedReceipt.transaction.member.firstName} ${selectedReceipt.transaction.member.lastName}`
                        : 'Unknown'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <span className="font-bold text-green-600">
                  ₦{Number(selectedReceipt.amount || selectedReceipt.transaction?.amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Category:</span>
                <span>{selectedReceipt.category || selectedReceipt.transaction?.category?.name || 'N/A'}</span>
              </div>
              {selectedReceipt.allocation && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Allocation:</span>
                  <span>{selectedReceipt.allocation.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Date:</span>
                <span>{new Date(selectedReceipt.createdAt).toLocaleDateString()}</span>
              </div>
              {selectedReceipt.donorMessage && (
                <div className="pt-2">
                  <span className="text-gray-500 text-sm">Message:</span>
                  <p className="text-sm italic mt-1">"{selectedReceipt.donorMessage}"</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowReceiptModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Close
              </button>
              <button
                onClick={() => handleDownloadReceipt(selectedReceipt.id)}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      {showPrintReceiptModal && printReceiptData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            {/* Printable content */}
            <div id="printable-receipt">
              <div className="text-center border-b-2 border-green-500 pb-4 mb-4">
                <h1 className="text-xl font-bold text-green-600">
                  {printReceiptData.association?.name || 'SocietyLedger'}
                </h1>
                <p className="text-gray-600">Donation Receipt</p>
                <p className="text-sm text-gray-400">{printReceiptData.receiptNumber}</p>
              </div>
              
              <div className="text-center my-6">
                <span className="text-3xl font-bold text-green-600">
                  ₦{Number(printReceiptData.amount).toLocaleString()}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Donor:</span>
                  <span className="font-semibold">{printReceiptData.donor?.name || 'Anonymous'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Category:</span>
                  <span className="font-semibold">{printReceiptData.category}</span>
                </div>
                {printReceiptData.allocation && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Allocation:</span>
                    <span className="font-semibold">{printReceiptData.allocation.name}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Payment Method:</span>
                  <span className="font-semibold">{printReceiptData.paymentMethod}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Date:</span>
                  <span className="font-semibold">{new Date(printReceiptData.donationDate).toLocaleDateString()}</span>
                </div>
              </div>
              
              {printReceiptData.donorMessage && (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg mt-4 text-green-800 dark:text-green-200 italic">
                  "{printReceiptData.donorMessage}"
                </div>
              )}
              
              <div className="text-center mt-6 text-gray-400 text-sm">
                <p>Thank you for your generous donation!</p>
                <p>Generated on {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowPrintReceiptModal(false);
                  setPrintReceiptData(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Close
              </button>
              <button
                onClick={handlePrintReceipt}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
