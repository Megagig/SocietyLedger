'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type Tag = {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
  _count?: {
    posts: number;
  };
};

export default function TagsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Form state for new tag
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
  });

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchTags();
  }, [token, user]);

  const fetchTags = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const res = await fetch(API_ROUTES.BLOG.TAGS, {
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        setTags(data.data.tags || []);
      } else {
        toast.error(data.message || 'Failed to fetch tags');
      }
    } catch (e) {
      console.error('Failed to fetch tags:', e);
      toast.error('Failed to fetch tags');
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
      };

      const res = await fetch(API_ROUTES.BLOG.ADMIN_TAGS, {
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
        toast.success('Tag created successfully');
        setFormData({ name: '', slug: '' });
        setShowForm(false);
        fetchTags();
      } else {
        toast.error(data.message || 'Failed to create tag');
      }
    } catch (e) {
      toast.error('Failed to create tag');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdate = async (tagId: number, updates: Partial<Tag>) => {
    setActionLoading(tagId);

    try {
      const payload = {
        name: updates.name,
        slug: updates.slug,
      };

      const res = await fetch(API_ROUTES.BLOG.ADMIN_TAG_BY_ID(tagId), {
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
        toast.success('Tag updated successfully');
        fetchTags();
      } else {
        toast.error(data.message || 'Failed to update tag');
      }
    } catch (e) {
      toast.error('Failed to update tag');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (tagId: number) => {
    if (!confirm('Are you sure you want to delete this tag? Posts with this tag will not be affected.')) {
      return;
    }

    setActionLoading(tagId);

    try {
      const res = await fetch(API_ROUTES.BLOG.ADMIN_TAG_BY_ID(tagId), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Tag deleted successfully');
        fetchTags();
      } else {
        toast.error(data.message || 'Failed to delete tag');
      }
    } catch (e) {
      toast.error('Failed to delete tag');
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
            <span>Tags</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Blog Tags
          </h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Tag
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Tag</h2>
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
                  placeholder="Tag name"
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
                  placeholder="tag-slug"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={actionLoading === 0}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 0 ? 'Creating...' : 'Create Tag'}
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

      {/* Tags List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <p className="text-lg">No tags yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-block mt-2 text-blue-600 hover:text-blue-700"
            >
              Create your first tag
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {tags.map((tag) => (
              <TagCard
                key={tag.id}
                tag={tag}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                isLoading={actionLoading === tag.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TagCard({
  tag,
  onUpdate,
  onDelete,
  isLoading,
}: {
  tag: Tag;
  onUpdate: (id: number, updates: Partial<Tag>) => void;
  onDelete: (id: number) => void;
  isLoading: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: tag.name,
    slug: tag.slug,
  });

  const handleSave = () => {
    onUpdate(tag.id, formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      name: tag.name,
      slug: tag.slug,
    });
    setIsEditing(false);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition">
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
              <h3 className="font-semibold text-gray-900 dark:text-white">{tag.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tag.slug}</p>
            </div>
            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              {tag._count?.posts || 0} posts
            </span>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(tag.id)}
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
