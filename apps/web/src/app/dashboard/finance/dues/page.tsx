'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost } from '@/utils/api';
import { toast } from '@/lib/toast';
import { 
  Calendar, Users, DollarSign, Clock, AlertTriangle,
  Plus, Play, CheckCircle, Search, Filter
} from 'lucide-react';

interface DueCategory {
  id: number;
  name: string;
  type: string;
  amount: number | null;
  frequency: string | null;
  description: string | null;
  isActive: boolean;
}

interface Member {
  id: number;
  memberId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
}

export default function DuesPage() {
  const router = useRouter();
  const [dueCategories, setDueCategories] = useState<DueCategory[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  
  // Generation form
  const [selectedCategory, setSelectedCategory] = useState<number | ''>('');
  const [customAmount, setCustomAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  
  // Filters
  const [memberSearch, setMemberSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [memberSearch, statusFilter]);

  const fetchData = async () => {
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories?type=due&isActive=true`
      );
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setDueCategories(data.data.categories);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const params = new URLSearchParams({
        limit: '100',
        ...(memberSearch && { search: memberSearch }),
        ...(statusFilter && { status: statusFilter }),
      });
      
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/members?${params}`
      );
      if (!response.ok) throw new Error('Failed to fetch members');
      const data = await response.json();
      setMembers(data.data.members);
    } catch (err: any) {
      console.error('Error fetching members:', err);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(members.map(m => m.id));
    }
    setSelectAll(!selectAll);
  };

  const handleMemberToggle = (memberId: number) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleGenerateDues = async () => {
    if (!selectedCategory || selectedMembers.length === 0) {
      toast.warning('Please select a due category and at least one member');
      return;
    }

    const category = dueCategories.find(c => c.id === selectedCategory);
    const amount = customAmount ? parseFloat(customAmount) : category?.amount;

    if (!amount || amount <= 0) {
      toast.warning('Please enter a valid amount');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/transactions/bulk`,
        {
          categoryId: selectedCategory,
          memberIds: selectedMembers,
          amount: parseFloat(amount.toString()),
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          notes: notes || null,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to generate dues');

      toast.success(`Successfully generated ${data.data.count} due transactions!`);
      
      // Reset form
      setSelectedMembers([]);
      setSelectAll(false);
      setCustomAmount('');
      setDueDate('');
      setNotes('');
      
      // Navigate to transactions
      router.push('/dashboard/finance/transactions');
    } catch (err: any) {
      toast.apiError(err, 'Failed to generate dues');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedCategoryData = dueCategories.find(c => c.id === selectedCategory);

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
            Due Generation
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Generate and assign dues to members
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/finance/categories')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
        >
          <Plus className="w-4 h-4" />
          Manage Categories
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Due Configuration */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Due Configuration
            </h2>

            <div className="space-y-4">
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Due Category *
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select a due category</option>
                  {dueCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {cat.amount ? `(₦${Number(cat.amount).toLocaleString()})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Info */}
              {selectedCategoryData && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-200">
                    {selectedCategoryData.name}
                  </p>
                  {selectedCategoryData.description && (
                    <p className="text-blue-600 dark:text-blue-300 mt-1">
                      {selectedCategoryData.description}
                    </p>
                  )}
                  <div className="mt-2 flex gap-4 text-blue-700 dark:text-blue-300">
                    {selectedCategoryData.amount && (
                      <span>Default: ₦{Number(selectedCategoryData.amount).toLocaleString()}</span>
                    )}
                    {selectedCategoryData.frequency && (
                      <span className="capitalize">{selectedCategoryData.frequency}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Custom Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount (₦) {selectedCategoryData?.amount ? '(Override)' : '*'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={selectedCategoryData?.amount ? `Default: ${selectedCategoryData.amount}` : 'Enter amount'}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g., January 2025 Monthly Dues"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Summary & Generate */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Summary</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Selected Members:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {selectedMembers.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount per Member:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ₦{(customAmount ? parseFloat(customAmount) : selectedCategoryData?.amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-500">Total Amount:</span>
                <span className="font-bold text-lg text-green-600">
                  ₦{((customAmount ? parseFloat(customAmount) : selectedCategoryData?.amount || 0) * selectedMembers.length).toLocaleString()}
                </span>
              </div>
            </div>

            <Can permission={PERMISSIONS.TRANSACTION_CREATE}>
              <button
                onClick={handleGenerateDues}
                disabled={isGenerating || !selectedCategory || selectedMembers.length === 0}
                className="w-full mt-6 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Generate Dues
                  </>
                )}
              </button>
            </Can>
          </div>
        </div>

        {/* Member Selection */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Select Members
              </h2>
              
              {/* Filters */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="sm:col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Select All */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select All ({members.length} members)
                </span>
              </label>
            </div>

            {/* Member List */}
            <div className="max-h-[500px] overflow-y-auto">
              {members.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No members found
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {members.map(member => (
                    <label
                      key={member.id}
                      className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => handleMemberToggle(member.id)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {member.memberId} • {member.email || 'No email'}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        member.status === 'active' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}>
                        {member.status}
                      </span>
                      {selectedMembers.includes(member.id) && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
