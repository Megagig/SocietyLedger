'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type Comment = {
  id: number;
  content: string;
  status: string;
  postId: number;
  authorId: number | null;
  guestName: string | null;
  guestEmail: string | null;
  parentId: number | null;
  createdAt: string;
  author?: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  post?: {
    id: number;
    title: string;
    slug: string;
  };
  parent?: Comment;
  replies?: Comment[];
};

export default function CommentsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchComments();
  }, [token, user, page, statusFilter]);

  const fetchComments = async () => {
    if (!token) return;
    setLoading(true);

    try {
      // Fetch all posts first, then get comments for each
      const postsRes = await fetch(`${API_ROUTES.BLOG.ADMIN_POSTS}?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      const postsData = await postsRes.json();

      if (postsData.success) {
        const posts = postsData.data.posts || [];
        const allComments: Comment[] = [];

        for (const post of posts) {
          const commentsRes = await fetch(API_ROUTES.BLOG.POST_COMMENTS(post.id), {
            credentials: 'include',
          });

          const commentsData = await commentsRes.json();

          if (commentsData.success) {
            const postComments = commentsData.data.comments || [];
            allComments.push(...postComments.map((c: any) => ({
              ...c,
              post: {
                id: post.id,
                title: post.title,
                slug: post.slug,
              },
            })));
          }
        }

        // Filter by status
        const filteredComments = statusFilter
          ? allComments.filter((c) => c.status === statusFilter)
          : allComments;

        setComments(filteredComments);
        setTotalPages(Math.ceil(filteredComments.length / 20) || 1);
      }
    } catch (e) {
      console.error('Failed to fetch comments:', e);
      toast.error('Failed to fetch comments');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (commentId: number) => {
    setActionLoading(commentId);

    try {
      const res = await fetch(API_ROUTES.BLOG.ADMIN_COMMENT_APPROVE(commentId), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Comment approved successfully');
        fetchComments();
      } else {
        toast.error(data.message || 'Failed to approve comment');
      }
    } catch (e) {
      toast.error('Failed to approve comment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      return;
    }

    setActionLoading(commentId);

    try {
      const res = await fetch(API_ROUTES.BLOG.ADMIN_COMMENT_DELETE(commentId), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Comment deleted successfully');
        fetchComments();
      } else {
        toast.error(data.message || 'Failed to delete comment');
      }
    } catch (e) {
      toast.error('Failed to delete comment');
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
            <span>Comments</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Comment Moderation
          </h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="SPAM">Spam</option>
        </select>
      </div>

      {/* Comments List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <p className="text-lg">No comments found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                onApprove={handleApprove}
                onDelete={handleDelete}
                isLoading={actionLoading === comment.id}
              />
            ))}
          </div>
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

function CommentCard({
  comment,
  onApprove,
  onDelete,
  isLoading,
}: {
  comment: Comment;
  onApprove: (id: number) => void;
  onDelete: (id: number) => void;
  isLoading: boolean;
}) {
  return (
    <div className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Comment Content */}
        <div className="flex-1 min-w-0">
          {/* Author Info */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              {comment.author ? (
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {(comment.author.firstName || comment.author.email)[0].toUpperCase()}
                </span>
              ) : (
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {(comment.guestName || 'G')[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {comment.author
                  ? `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || comment.author.email
                  : comment.guestName || 'Guest'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {comment.author?.email || comment.guestEmail || ''}
              </p>
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              comment.status === 'APPROVED'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : comment.status === 'PENDING'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}>
              {comment.status}
            </span>
          </div>

          {/* Comment Text */}
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">
            {comment.content}
          </p>

          {/* Post Link */}
          {comment.post && (
            <Link
              href={`/blog/${comment.post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              View on post: {comment.post.title}
            </Link>
          )}

          {/* Date */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {new Date(comment.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex sm:flex-col gap-2 sm:min-w-[100px]">
          {comment.status === 'PENDING' && (
            <button
              onClick={() => onApprove(comment.id)}
              disabled={isLoading}
              className="px-3 py-2 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition disabled:opacity-50"
            >
              {isLoading ? '...' : 'Approve'}
            </button>
          )}
          <button
            onClick={() => onDelete(comment.id)}
            disabled={isLoading}
            className="px-3 py-2 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition disabled:opacity-50"
          >
            {isLoading ? '...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
