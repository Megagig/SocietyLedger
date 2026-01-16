'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type BlogStats = {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalCategories: number;
  totalTags: number;
  pendingComments: number;
  totalViews: number;
};

type RecentPost = {
  id: number;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  viewCount: number;
  createdAt: string;
  author?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
};

export default function BlogDashboardPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [stats, setStats] = useState<BlogStats | null>(null);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [token, user]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const [statsRes, postsRes] = await Promise.all([
        fetch(`${API_ROUTES.BLOG.ADMIN_POSTS}?limit=0`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(`${API_ROUTES.BLOG.ADMIN_POSTS}?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
      ]);

      const statsData = await statsRes.json();
      const postsData = await postsRes.json();

      if (statsData.success) {
        const posts = statsData.data.posts || [];
        setStats({
          totalPosts: posts.length,
          publishedPosts: posts.filter((p: any) => p.status === 'PUBLISHED').length,
          draftPosts: posts.filter((p: any) => p.status === 'DRAFT').length,
          totalCategories: 0, // Will be fetched separately
          totalTags: 0, // Will be fetched separately
          pendingComments: 0, // Will be fetched separately
          totalViews: posts.reduce((sum: number, p: any) => sum + (p.viewCount || 0), 0),
        });
      }
      if (postsData.success) {
        setRecentPosts(postsData.data.posts || []);
      }
    } catch (e) {
      console.error('Failed to fetch blog data:', e);
    } finally {
      setLoading(false);
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
            <span>Blog</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Blog Management
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Posts</p>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      {stats.totalPosts}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Published</p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                      {stats.publishedPosts}
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Drafts</p>
                    <p className="text-2xl sm:text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                      {stats.draftPosts}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Views</p>
                    <p className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                      {stats.totalViews.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/admin/blog/posts"
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition group"
            >
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">All Posts</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage posts</p>
              </div>
            </Link>

            <Link
              href="/admin/blog/categories"
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition group"
            >
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Categories</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Organize posts</p>
              </div>
            </Link>

            <Link
              href="/admin/blog/tags"
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition group"
            >
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Tags</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Add tags</p>
              </div>
            </Link>

            <Link
              href="/admin/blog/comments"
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-orange-500 dark:hover:border-orange-500 transition group"
            >
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Comments</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Moderate</p>
              </div>
            </Link>
          </div>

          {/* Recent Posts */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Posts</h2>
                <Link
                  href="/admin/blog/posts"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  View All
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentPosts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <p>No posts yet</p>
                  <Link
                    href="/admin/blog/posts/new"
                    className="inline-block mt-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Create your first post
                  </Link>
                </div>
              ) : (
                recentPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            post.status === 'PUBLISHED'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          }`}>
                            {post.status}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {post.viewCount} views
                          </span>
                        </div>
                        <Link
                          href={`/admin/blog/posts/${post.id}/edit`}
                          className="text-base font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate block"
                        >
                          {post.title}
                        </Link>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          By {post.author?.firstName || post.author?.email} • {new Date(post.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Link
                        href={`/admin/blog/posts/${post.id}/edit`}
                        className="flex-shrink-0 px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
