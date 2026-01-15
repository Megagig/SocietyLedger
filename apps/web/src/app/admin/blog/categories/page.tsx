'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  _count?: {
    posts: number;
  };
};

export default function CategoriesPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Form state for new category
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    color: '#3b82f6',
  });

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchCategories();
  }, [token, user]);

  const fetchCategories = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const res = await fetch(API_ROUTES.BLOG.CATEGORIES, {
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        setCategories(data.data.categories || []);
      } else {
        toast.error(data.message || 'Failed to fetch categories');
      }
    } catch (e) {
      console.error('Failed to fetch categories:', e);
      toast.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(0);

    try {
      const payload = {
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
        description: formData.description || undefined,
        color: formData.color,
      };

      const res = await fetch(API_ROUTES.BLOG.ADMIN_CATEGORIES, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Category created successfully');
        setFormData({ name: '', slug: '', description: '', color: '#3b82f6' });
        setShowForm(false);
        fetchCategories();
      } else {
        toast.error(data.message || 'Failed to create category');
      }
    } catch (e) {
      toast.error('Failed to create category');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdate = async (categoryId: number, updates: Partial<Category>) => {
    setActionLoading(categoryId);

    try {
      const payload = {
        name: updates.name,
        slug: updates.slug,
        description: updates.description || undefined,
        color: updates.color,
      };

      const res = await fetch(API_ROUTES.BLOG.ADMIN_CATEGORY_BY_ID(categoryId), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Category updated successfully');
        fetchCategories();
      } else {
        toast.error(data.message || 'Failed to update category');
      }
    } catch (e) {
      toast.error('Failed to update category');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (categoryId: number) => {
    if (!confirm('Are you sure you want to delete this category? Posts in this category will not be deleted.')) {
      return;
    }

    setActionLoading(categoryId);

    try {
      const res = await fetch(API_ROUTES.BLOG.ADMIN_CATEGORY_BY_ID(categoryId), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Category deleted successfully');
        fetchCategories();
      } else {
        toast.error(data.message || 'Failed to delete category');
      }
    } catch (e) {
      toast.error('Failed to delete category');
    } finally {
      setActionLoading(null);
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <Link href="/admin/blog" className="hover:text-blue-600">Blog</Link>
            <span>/</span>
            <span>Categories</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Blog Categories
          </h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Category
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Category</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Category name"
                />
              </div>
              <div>
                <label htmlFor="slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Slug
                </label>
                <input
                  type="text"
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="category-slug"
                />
              </div>
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Category description..."
              />
            </div>
            <div>
              <label htmlFor="color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-12 rounded cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="#3b82f6"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={actionLoading === 0}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 0 ? 'Creating...' : 'Create Category'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <p className="text-lg">No categories yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-block mt-2 text-blue-600 hover:text-blue-700"
            >
              Create your first category
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                isLoading={actionLoading === category.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  onUpdate,
  onDelete,
  isLoading,
}: {
  category: Category;
  onUpdate: (id: number, updates: Partial<Category>) => void;
  onDelete: (id: number) => void;
  isLoading: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: category.name,
    slug: category.slug,
    description: category.description || '',
    color: category.color || '#3b82f6',
  });

  const handleSave = () => {
    onUpdate(category.id, formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      color: category.color || '#3b82f6',
    });
    setIsEditing(false);
  };

  return (
    <div
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition"
      style={{
        borderTop: `4px solid ${category.color || '#3b82f6'}`,
      }}
    >
      {isEditing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
              className="w-8 h-8 rounded cursor-pointer border-0"
            />
            <input
              type="text"
              value={formData.color}
              onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">{category.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{category.slug}</p>
            </div>
            <span
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: category.color ? `${category.color}20` : '#e5e7eb',
                color: category.color || '#374151',
              }}
            >
              {category._count?.posts || 0} posts
            </span>
          </div>
          {category.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {category.description}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(category.id)}
              disabled={isLoading}
              className="flex-1 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 disabled:opacity-50"
            >
              {isLoading ? '...' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
