'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import QuillEditor from '@/components/editor/QuillEditor';

type DocSection = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  order: number;
};

type DocPage = {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: string;
  sectionId: number | null;
  parentId: number | null;
  order: number;
  metaTitle: string | null;
  metaDescription: string | null;
  version: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export default function EditDocumentationPage() {
  const router = useRouter();
  const params = useParams();
  const { token, user } = useAuthStore();
  const pageId = parseInt(params.id as string);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sections, setSections] = useState<DocSection[]>([]);
  const [parentPages, setParentPages] = useState<DocPage[]>([]);
  const [page, setPage] = useState<DocPage | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    status: 'DRAFT',
    sectionId: '',
    parentId: '',
    order: '0',
    metaTitle: '',
    metaDescription: '',
  });

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    if (pageId) {
      fetchInitialData();
    }
  }, [token, user, pageId]);

  const fetchInitialData = async () => {
    if (!token) return;
    setInitialLoading(true);

    try {
      const [pageRes, sectionsRes, pagesRes] = await Promise.all([
        fetch(API_ROUTES.DOCUMENTATION.ADMIN_PAGE_BY_ID(pageId), {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(API_ROUTES.DOCUMENTATION.ADMIN_SECTIONS, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(`${API_ROUTES.DOCUMENTATION.ADMIN_PAGES}?limit=1000`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
      ]);

      const pageData = await pageRes.json();
      const sectionsData = await sectionsRes.json();
      const pagesData = await pagesRes.json();

      if (pageData.success) {
        const page = pageData.data.page;
        setPage(page);
        setFormData({
          title: page.title,
          slug: page.slug,
          content: page.content,
          excerpt: page.excerpt || '',
          status: page.status,
          sectionId: page.sectionId ? page.sectionId.toString() : '',
          parentId: page.parentId ? page.parentId.toString() : '',
          order: page.order.toString(),
          metaTitle: page.metaTitle || '',
          metaDescription: page.metaDescription || '',
        });
      } else {
        toast.error(pageData.message || 'Failed to fetch page');
        router.push('/admin/documentation/pages');
      }

      if (sectionsData.success) {
        setSections(sectionsData.data.sections || []);
      }

      if (pagesData.success) {
        // Filter out current page from parent options
        setParentPages(
          (pagesData.data.pages || []).filter((p: DocPage) => p.id !== pageId)
        );
      }
    } catch (e) {
      console.error('Failed to fetch initial data:', e);
      toast.error('Failed to fetch page data');
      router.push('/admin/documentation/pages');
    } finally {
      setInitialLoading(false);
    }
  };

  // Auto-generate slug from title
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData(prev => ({
      ...prev,
      title,
      slug: title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    }));
  };

  // Cloudinary image upload handler for Quill editor
  const handleImageUpload = async (file: File): Promise<string> => {
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    formDataUpload.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'societyledger');
    
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      toast.error('Cloudinary not configured');
      throw new Error('Cloudinary not configured');
    }

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formDataUpload,
      }
    );

    if (!res.ok) {
      toast.error('Failed to upload image');
      throw new Error('Failed to upload image');
    }

    const data = await res.json();
    return data.secure_url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!formData.content.trim()) {
      toast.error('Content is required');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        content: formData.content,
        excerpt: formData.excerpt.trim() || null,
        status: formData.status,
        sectionId: formData.sectionId ? parseInt(formData.sectionId) : null,
        parentId: formData.parentId ? parseInt(formData.parentId) : null,
        order: parseInt(formData.order),
        metaTitle: formData.metaTitle.trim() || null,
        metaDescription: formData.metaDescription.trim() || null,
      };

      const res = await fetch(API_ROUTES.DOCUMENTATION.ADMIN_PAGE_BY_ID(pageId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Documentation page updated successfully');
        setPage(data.data.page);
      } else {
        toast.error(data.message || 'Failed to update page');
      }
    } catch (e) {
      console.error('Failed to update page:', e);
      toast.error('Failed to update page');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this page? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(API_ROUTES.DOCUMENTATION.ADMIN_PAGE_BY_ID(pageId), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Page deleted successfully');
        router.push('/admin/documentation/pages');
      } else {
        toast.error(data.message || 'Failed to delete page');
      }
    } catch (e) {
      toast.error('Failed to delete page');
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!page) {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <Link href="/admin/documentation" className="hover:text-blue-600">Documentation</Link>
            <span>/</span>
            <Link href="/admin/documentation/pages" className="hover:text-blue-600">Pages</Link>
            <span>/</span>
            <span>Edit</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Edit Documentation Page
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/documentation/pages"
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm font-medium"
          >
            Cancel
          </Link>
          <Link
            href={`/documentation/${page.slug}`}
            target="_blank"
            className="inline-flex items-center justify-center px-4 py-2 border border-green-600 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 transition text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View Live
          </Link>
        </div>
      </div>

      {/* Page Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Version:</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-white">{page.version}</span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Created:</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-white">
              {new Date(page.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Last Updated:</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-white">
              {new Date(page.updatedAt).toLocaleDateString()}
            </span>
          </div>
          {page.publishedAt && (
            <div>
              <span className="text-gray-600 dark:text-gray-400">Published:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {new Date(page.publishedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 sm:p-6 space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={handleTitleChange}
              placeholder="Enter page title..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              URL Slug <span className="text-red-500">*</span>
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-sm">
                /documentation/
              </span>
              <input
                type="text"
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="page-url-slug"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-r-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              This will be the URL for your documentation page
            </p>
          </div>

          {/* Section */}
          <div>
            <label htmlFor="section" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Section
            </label>
            <select
              id="section"
              value={formData.sectionId}
              onChange={(e) => setFormData(prev => ({ ...prev, sectionId: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No section</option>
              {sections.map(section => (
                <option key={section.id} value={section.id.toString()}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>

          {/* Parent Page */}
          <div>
            <label htmlFor="parent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Parent Page
            </label>
            <select
              id="parent"
              value={formData.parentId}
              onChange={(e) => setFormData(prev => ({ ...prev, parentId: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No parent (top-level page)</option>
              {parentPages.map(p => (
                <option key={p.id} value={p.id.toString()}>
                  {p.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Select a parent page to create a hierarchical structure
            </p>
          </div>

          {/* Order */}
          <div>
            <label htmlFor="order" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Order
            </label>
            <input
              type="number"
              id="order"
              value={formData.order}
              onChange={(e) => setFormData(prev => ({ ...prev, order: e.target.value }))}
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Lower numbers appear first
            </p>
          </div>

          {/* Excerpt */}
          <div>
            <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Excerpt
            </label>
            <textarea
              id="excerpt"
              value={formData.excerpt}
              onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
              placeholder="Brief description of the page..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Content <span className="text-red-500">*</span>
            </label>
            <QuillEditor
              value={formData.content}
              onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
              placeholder="Write your documentation content here..."
              minHeight="400px"
              onImageUpload={handleImageUpload}
            />
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {/* SEO Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">SEO Settings</h3>

            {/* Meta Title */}
            <div className="mb-4">
              <label htmlFor="metaTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Meta Title
              </label>
              <input
                type="text"
                id="metaTitle"
                value={formData.metaTitle}
                onChange={(e) => setFormData(prev => ({ ...prev, metaTitle: e.target.value }))}
                placeholder="Custom meta title (optional)"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Leave empty to use the page title
              </p>
            </div>

            {/* Meta Description */}
            <div>
              <label htmlFor="metaDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Meta Description
              </label>
              <textarea
                id="metaDescription"
                value={formData.metaDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, metaDescription: e.target.value }))}
                placeholder="Custom meta description for search engines..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Leave empty to use the excerpt
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
          <button
            type="button"
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            Delete this page
          </button>
          <div className="flex gap-3">
            <Link
              href="/admin/documentation/pages"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
