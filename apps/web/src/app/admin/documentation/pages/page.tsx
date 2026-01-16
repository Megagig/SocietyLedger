'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type DocPage = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  status: string;
  publishedAt: string | null;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  order: number;
  version: string;
  createdAt: string;
  updatedAt: string;
  parentId: number | null;
  section?: {
    id: number;
    name: string;
    slug: string;
    icon: string | null;
  };
  author?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  children?: DocPage[];
};

type DocSection = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  order: number;
};

export default function DocumentationPagesPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [pages, setPages] = useState<DocPage[]>([]);
  const [sections, setSections] = useState<DocSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [token, user, page, search, statusFilter, sectionFilter]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const [pagesRes, sectionsRes] = await Promise.all([
        fetch(`${API_ROUTES.DOCUMENTATION.ADMIN_PAGES}?${new URLSearchParams({
          page: page.toString(),
          limit: '50',
          ...(search && { search }),
          ...(statusFilter && { status: statusFilter }),
          ...(sectionFilter && { sectionId: sectionFilter }),
        })}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(API_ROUTES.DOCUMENTATION.ADMIN_SECTIONS, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
      ]);

      const pagesData = await pagesRes.json();
      const sectionsData = await sectionsRes.json();

      if (pagesData.success) {
        setPages(pagesData.data.pages || []);
        setTotalPages(pagesData.data.totalPages || 1);
      } else {
        toast.error(pagesData.message || 'Failed to fetch pages');
      }

      if (sectionsData.success) {
        setSections(sectionsData.data.sections || []);
      }
    } catch (e) {
      console.error('Failed to fetch documentation data:', e);
      toast.error('Failed to fetch pages');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (pageId: number) => {
    if (!confirm('Are you sure you want to delete this page? This action cannot be undone.')) {
      return;
    }

    setActionLoading(pageId);

    try {
      const res = await fetch(API_ROUTES.DOCUMENTATION.ADMIN_PAGE_BY_ID(pageId), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Page deleted successfully');
        fetchData();
      } else {
        toast.error(data.message || 'Failed to delete page');
      }
    } catch (e) {
      toast.error('Failed to delete page');
    } finally {
      setActionLoading(null);
    }
  };

  // Build tree structure from flat pages
  const buildTree = (flatPages: DocPage[]): DocPage[] => {
    const pageMap = new Map<number, DocPage>();
    const rootPages: DocPage[] = [];

    // First pass: create map and initialize children arrays
    flatPages.forEach(page => {
      pageMap.set(page.id, { ...page, children: [] });
    });

    // Second pass: build hierarchy
    flatPages.forEach(page => {
      const pageNode = pageMap.get(page.id);
      if (!pageNode) return;

      if (page.parentId && pageMap.has(page.parentId)) {
        const parent = pageMap.get(page.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(pageNode);
        }
      } else {
        rootPages.push(pageNode);
      }
    });

    // Sort by order
    const sortPages = (pages: DocPage[]) => {
      pages.sort((a, b) => a.order - b.order);
      pages.forEach(page => {
        if (page.children && page.children.length > 0) {
          sortPages(page.children);
        }
      });
    };

    sortPages(rootPages);
    return rootPages;
  };

  // Render tree node
  const renderTreeNode = (page: DocPage, level: number = 0) => {
    const hasChildren = page.children && page.children.length > 0;

    return (
      <div key={page.id}>
        <div
          className={`flex items-center gap-3 py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition border-b border-gray-100 dark:border-gray-700/50`}
          style={{ paddingLeft: `${16 + level * 24}px` }}
        >
          {hasChildren && (
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                page.status === 'PUBLISHED'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
              }`}>
                {page.status}
              </span>
              {page.section && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {page.section.name}
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {page.viewCount} views
              </span>
            </div>
            <Link
              href={`/admin/documentation/pages/${page.id}/edit`}
              className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate block"
            >
              {page.title}
            </Link>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {page.excerpt || 'No excerpt'}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link
              href={`/admin/documentation/pages/${page.id}/edit`}
              className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
            >
              Edit
            </Link>
            <button
              onClick={() => handleDelete(page.id)}
              disabled={actionLoading === page.id}
              className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 disabled:opacity-50"
            >
              {actionLoading === page.id ? '...' : 'Delete'}
            </button>
          </div>
        </div>
        {hasChildren && (
          <div>
            {page.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  const treePages = buildTree(pages);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <Link href="/admin/documentation" className="hover:text-blue-600">Documentation</Link>
            <span>/</span>
            <span>Pages</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Documentation Pages
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-2 text-sm rounded-lg border transition ${
              viewMode === 'tree'
                ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Tree View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-sm rounded-lg border transition ${
              viewMode === 'list'
                ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            List View
          </button>
          <Link
            href="/admin/documentation/pages/new"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Page
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <input
          type="text"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 min-w-0 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          value={sectionFilter}
          onChange={(e) => {
            setSectionFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">All Sections</option>
          {sections.map(section => (
            <option key={section.id} value={section.id.toString()}>
              {section.name}
            </option>
          ))}
        </select>
      </div>

      {/* Pages List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <p className="text-lg">No pages found</p>
            <Link
              href="/admin/documentation/pages/new"
              className="inline-block mt-2 text-blue-600 hover:text-blue-700"
            >
              Create your first page
            </Link>
          </div>
        ) : viewMode === 'tree' ? (
          <div>
            {treePages.map(page => renderTreeNode(page))}
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {pages.map((page) => (
                <div key={page.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {page.status}
                        </span>
                        {page.section && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {page.section.name}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {page.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {page.excerpt || 'No excerpt'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
                        <span>{page.viewCount} views</span>
                        <span>{page.helpfulCount} helpful</span>
                        <span>{new Date(page.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/admin/documentation/pages/${page.id}/edit`}
                      className="flex-1 px-3 py-2 text-xs text-center text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(page.id)}
                      disabled={actionLoading === page.id}
                      className="flex-1 px-3 py-2 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 disabled:opacity-50"
                    >
                      {actionLoading === page.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Page</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Section</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Views</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Helpful</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Created</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-3 px-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
                            {page.title}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            {page.excerpt || 'No excerpt'}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            v{page.version}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {page.section ? (
                          <span className="text-gray-600 dark:text-gray-300">
                            {page.section.name}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          page.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {page.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">
                        {page.viewCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">
                        {page.helpfulCount}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(page.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <Link
                            href={`/admin/documentation/pages/${page.id}/edit`}
                            className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(page.id)}
                            disabled={actionLoading === page.id}
                            className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 disabled:opacity-50"
                          >
                            {actionLoading === page.id ? '...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && viewMode === 'list' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
