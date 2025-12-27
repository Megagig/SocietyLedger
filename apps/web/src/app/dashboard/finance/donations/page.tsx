'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/utils/api';
import { toast } from '@/lib/toast';
import { 
  Gift, Plus, Edit, Trash2, Heart,
  CheckCircle, Clock
} from 'lucide-react';

interface DonationCategory {
  id: number;
  name: string;
  type: string;
  amount: number | null;
  description: string | null;
  isActive: boolean;
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
  const [donations, setDonations] = useState<DonationCategory[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingDonation, setEditingDonation] = useState<DonationCategory | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DonationCategory | null>(null);
  
  // Category form
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    amount: '',
    description: '',
    isActive: true,
  });
  
  // Record donation form
  const [recordForm, setRecordForm] = useState({
    memberId: '',
    amount: '',
    notes: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDonations();
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
      // Create transaction and immediately mark as paid
      const txnResponse = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions`,
        {
          memberId: parseInt(recordForm.memberId),
          categoryId: selectedCategory.id,
          amount: parseFloat(recordForm.amount),
          notes: recordForm.notes || `Donation: ${selectedCategory.name}`,
        }
      );

      const txnData = await txnResponse.json();
      if (!txnResponse.ok) throw new Error(txnData.message || 'Failed to record donation');

      // Record payment
      const paymentResponse = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/payments`,
        {
          transactionId: txnData.data.id,
          amountPaid: parseFloat(recordForm.amount),
          paymentMethod: 'cash',
        }
      );

      const paymentData = await paymentResponse.json();
      if (!paymentResponse.ok) throw new Error(paymentData.message || 'Failed to record payment');

      toast.success('Donation recorded successfully!');
      setShowRecordModal(false);
      setSelectedCategory(null);
      setRecordForm({ memberId: '', amount: '', notes: '' });
      router.push('/dashboard/finance/transactions');
    } catch (err: any) {
      toast.error(err.message || 'Failed to record donation');
    } finally {
      setIsSubmitting(false);
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
            Manage donation categories and record contributions
          </p>
        </div>
        
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

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Donation Categories</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {donations.length}
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {donations.filter(d => d.isActive).length}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Inactive</p>
              <p className="text-2xl font-bold text-gray-600 mt-1">
                {donations.filter(d => !d.isActive).length}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
              <Clock className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Donations List */}
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
                  Notes
                </label>
                <textarea
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Additional notes about this donation"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
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
    </div>
  );
}
