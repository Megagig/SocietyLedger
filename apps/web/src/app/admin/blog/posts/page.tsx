'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type BlogPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  status: string;
  publishedAt: string | null;
  viewCount: number;
  readTimeMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  author?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  category?: {
    id: number;
    name: string;
    slug: string;
    color: string | null;
  };
  tags?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  _count?: {
    comments: number;
  };
};

export default function PostsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchPosts();
  }, [token, user, page, search, statusFilter, categoryFilter]);

  const fetchPosts = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('categoryId', categoryFilter);

      const res = await fetch(`${API_ROUTES.BLOG.ADMIN_POSTS}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        setPosts(data.data.posts || []);
        setTotalPages(data.data.totalPages || 1);
      } else {
        toast.error(data.message || 'Failed to fetch posts');
      }
    } catch (e) {
      console.error('Failed to fetch posts:', e);
      toast.error('Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId: number) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    setActionLoading(postId);

    try {
      const res = await fetch(API_ROUTES.BLOG.ADMIN_POST_BY_ID(postId), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Post deleted successfully');
        fetchPosts();
      } else {
        toast.error(data.message || 'Failed to delete post');
      }
    } catch (e) {
      toast.error('Failed to delete post');
    } finally {
      setActionLoading(null);
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <Link href="/admin/blog" className="hover:text-blue-600">Blog</Link>
            <span>/</span>
            <span>Posts</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Blog Posts
          </h1>
        </div>
        <Link
          href="/admin/blog/posts/new"
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Post
        </Link>
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
      </div>

      {/* Posts List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <p className="text-lg">No posts found</p>
            <Link
              href="/admin/blog/posts/new"
              className="inline-block mt-2 text-blue-600 hover:text-blue-700"
            >
              Create your first post
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {posts.map((post) => (
                <div key={post.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {post.coverImage && (
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          post.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : post.status === 'DRAFT'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {post.status}
                        </span>
                        {post.category && (
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: post.category.color ? `${post.category.color}20` : '#e5e7eb',
                              color: post.category.color || '#374151',
                            }}
                          >
                            {post.category.name}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {post.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {post.excerpt || 'No excerpt'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
                        <span>{post.viewCount} views</span>
                        {post._count?.comments && (
                          <span>{post._count.comments} comments</span>
                        )}
                        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/admin/blog/posts/${post.id}/edit`}
                      className="flex-1 px-3 py-2 text-xs text-center text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={actionLoading === post.id}
                      className="flex-1 px-3 py-2 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 disabled:opacity-50"
                    >
                      {actionLoading === post.id ? '...' : 'Delete'}
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
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Post</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Category</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Views</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Comments</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Created</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {post.coverImage && (
                            <img
                              src={post.coverImage}
                              alt={post.title}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
                              {post.title}
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-xs">
                              {post.excerpt || 'No excerpt'}
                            </div>
                            {post.readTimeMinutes && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                {post.readTimeMinutes} min read
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {post.category ? (
                          <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                              backgroundColor: post.category.color ? `${post.category.color}20` : '#e5e7eb',
                              color: post.category.color || '#374151',
                            }}
                          >
                            {post.category.name}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          post.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : post.status === 'DRAFT'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {post.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">
                        {post.viewCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">
                        {post._count?.comments || 0}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <Link
                            href={`/admin/blog/posts/${post.id}/edit`}
                            className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(post.id)}
                            disabled={actionLoading === post.id}
                            className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 disabled:opacity-50"
                          >
                            {actionLoading === post.id ? '...' : 'Delete'}
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
        {totalPages > 1 && (
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
