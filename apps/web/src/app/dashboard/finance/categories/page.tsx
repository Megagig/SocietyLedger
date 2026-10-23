'use client';

import { useState, useEffect } from 'react';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { FinancialCategory } from '@/types';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/utils/api';
import { toast } from '@/lib/toast';
import { 
  Search, Plus, Edit, Trash2, DollarSign, 
  Calendar, AlertCircle, Gift, Gavel 
} from 'lucide-react';

interface CategoryFormData {
  name: string;
  type: 'due' | 'levy' | 'donation' | 'penalty';
  amount: string;
  frequency: string;
  description: string;
  isActive: boolean;
}

const initialFormData: CategoryFormData = {
  name: '',
  type: 'due',
  amount: '',
  frequency: 'monthly',
  description: '',
  isActive: true,
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  useEffect(() => {
    fetchCategories();
  }, [search, typeFilter, activeFilter]);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(typeFilter && { type: typeFilter }),
        ...(activeFilter && { isActive: activeFilter }),
      });

      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories?${params}`
      );

      if (!response.ok) throw new Error('Failed to fetch categories');

      const data = await response.json();
      setCategories(data.data.categories);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/finance/categories${editingCategory ? `/${editingCategory.id}` : ''}`;

      const response = editingCategory 
        ? await apiPatch(url, {
            ...formData,
            amount: formData.amount ? parseFloat(formData.amount) : null,
            frequency: formData.frequency || null,
          })
        : await apiPost(url, {
            ...formData,
            amount: formData.amount ? parseFloat(formData.amount) : null,
            frequency: formData.frequency || null,
          });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Failed to save category');

      toast.success(editingCategory ? 'Category updated successfully' : 'Category created successfully');
      setShowModal(false);
      setEditingCategory(null);
      setFormData(initialFormData);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (category: FinancialCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      amount: category.amount?.toString() || '',
      frequency: category.frequency || 'one-time',
      description: category.description || '',
      isActive: category.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    modals.openConfirmModal({
      title: 'Delete Category',
      children: (
        <Text size="sm">
          Are you sure you want to delete this category? This action cannot be undone.
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
          fetchCategories();
        } catch (err: any) {
          toast.error(err.message || 'Failed to delete category');
        }
      },
    });
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, JSX.Element> = {
      due: <Calendar className="w-4 h-4" />,
      levy: <DollarSign className="w-4 h-4" />,
      donation: <Gift className="w-4 h-4" />,
      penalty: <Gavel className="w-4 h-4" />,
    };
    return icons[type] || <DollarSign className="w-4 h-4" />;
  };

  const getTypeBadge = (type: string) => {
    const badges: Record<string, string> = {
      due: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      levy: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      donation: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      penalty: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return badges[type] || badges.due;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Financial Categories
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage dues, levies, donations, and penalties
          </p>
        </div>
        
        <Can permission={PERMISSIONS.FINANCE_CREATE}>
          <button
            onClick={() => {
              setEditingCategory(null);
              setFormData(initialFormData);
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </Can>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            <option value="due">Dues</option>
            <option value="levy">Levies</option>
            <option value="donation">Donations</option>
            <option value="penalty">Penalties</option>
          </select>

          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Categories Grid */}
      {isLoading ? (
        <div className="text-center py-12">Loading categories...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-600">{error}</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No categories found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${
                !category.isActive ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getTypeBadge(category.type)}`}>
                    {getTypeIcon(category.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {category.name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeBadge(category.type)}`}>
                      {category.type}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Can permission={PERMISSIONS.FINANCE_EDIT}>
                    <button
                      onClick={() => handleEdit(category)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </Can>
                  <Can permission={PERMISSIONS.FINANCE_DELETE}>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Can>
                </div>
              </div>

              {category.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {category.description}
                </p>
              )}

              <div className="space-y-2 text-sm">
                {category.amount && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ₦{Number(category.amount).toLocaleString()}
                    </span>
                  </div>
                )}
                {category.frequency && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Frequency:</span>
                    <span className="capitalize text-gray-900 dark:text-white">
                      {category.frequency}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className={category.isActive ? 'text-green-600' : 'text-red-600'}>
                    {category.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type *
                </label>
                <select
                  required
                  value={formData.type}
                  disabled={!!editingCategory && (editingCategory.usageCount ?? 0) > 0}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="due">Due</option>
                  <option value="levy">Levy</option>
                  <option value="donation">Donation</option>
                  <option value="penalty">Penalty</option>
                </select>
                {editingCategory && (editingCategory.usageCount ?? 0) > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    The type can&apos;t change because {editingCategory.usageCount} charge(s) or levy campaign(s) already use this category.
                  </p>
                )}
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Frequency
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="one-time">One-time</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
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
                  Active
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
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
