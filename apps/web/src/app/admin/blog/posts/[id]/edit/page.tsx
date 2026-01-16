'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import QuillEditor from '@/components/editor/QuillEditor';

type Category = {
  id: number;
  name: string;
  slug: string;
  color: string | null;
};

type Tag = {
  id: number;
  name: string;
  slug: string;
};

type BlogPost = {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  status: string;
  publishedAt: string | null;
  readTimeMinutes: number | null;
  categoryId: number | null;
  tagIds: number[];
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string[];
};

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = parseInt(params.id as string);
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    coverImage: '',
    status: 'DRAFT',
    categoryId: '',
    tagIds: [] as number[],
    readTimeMinutes: '',
    metaTitle: '',
    metaDescription: '',
    metaKeywords: '',
  });

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchPost();
    fetchCategories();
    fetchTags();
  }, [token, user, postId]);

  const fetchPost = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const res = await fetch(API_ROUTES.BLOG.ADMIN_POST_BY_ID(postId), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        const postData = data.data.post;
        setPost(postData);
        setFormData({
          title: postData.title,
          slug: postData.slug,
          content: postData.content,
          excerpt: postData.excerpt || '',
          coverImage: postData.coverImage || '',
          status: postData.status,
          categoryId: postData.categoryId?.toString() || '',
          tagIds: postData.tags?.map((t: any) => t.id) || [],
          readTimeMinutes: postData.readTimeMinutes?.toString() || '',
          metaTitle: postData.metaTitle || '',
          metaDescription: postData.metaDescription || '',
          metaKeywords: postData.metaKeywords?.join(', ') || '',
        });
      } else {
        toast.error(data.message || 'Failed to fetch post');
        router.push('/admin/blog/posts');
      }
    } catch (e) {
      console.error('Failed to fetch post:', e);
      toast.error('Failed to fetch post');
      router.push('/admin/blog/posts');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!token) return;
    try {
      const res = await fetch(API_ROUTES.BLOG.CATEGORIES, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setCategories(data.data.categories || []);
      }
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    }
  };

  const fetchTags = async () => {
    if (!token) return;
    try {
      const res = await fetch(API_ROUTES.BLOG.TAGS, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setTags(data.data.tags || []);
      }
    } catch (e) {
      console.error('Failed to fetch tags:', e);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Cloudinary image upload handler for Quill editor
  const handleImageUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'societyledger');
    
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      toast.error('Cloudinary not configured');
      throw new Error('Cloudinary not configured');
    }

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!res.ok) {
      toast.error('Failed to upload image');
      throw new Error('Failed to upload image');
    }

    const data = await res.json();
    return data.secure_url;
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData(prev => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        title: formData.title,
        slug: formData.slug || generateSlug(formData.title),
        content: formData.content,
        excerpt: formData.excerpt || undefined,
        coverImage: formData.coverImage || undefined,
        status: formData.status,
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : undefined,
        tagIds: formData.tagIds,
        readTimeMinutes: formData.readTimeMinutes ? parseInt(formData.readTimeMinutes) : undefined,
        metaTitle: formData.metaTitle || undefined,
        metaDescription: formData.metaDescription || undefined,
        metaKeywords: formData.metaKeywords ? formData.metaKeywords.split(',').map(k => k.trim()) : undefined,
      };

      const res = await fetch(API_ROUTES.BLOG.ADMIN_POST_BY_ID(postId), {
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
        toast.success('Post updated successfully');
        fetchPost();
      } else {
        toast.error(data.message || 'Failed to update post');
      }
    } catch (e) {
      toast.error('Failed to update post');
    } finally {
      setSaving(false);
    }
  };

  const handleTagToggle = (tagId: number) => {
    setFormData(prev => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter(id => id !== tagId)
        : [...prev.tagIds, tagId],
    }));
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <Link href="/admin/blog" className="hover:text-blue-600">Blog</Link>
            <span>/</span>
            <Link href="/admin/blog/posts" className="hover:text-blue-600">Posts</Link>
            <span>/</span>
            <span>Edit Post</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Edit Post
          </h1>
        </div>
        <Link
          href={`/blog/${post?.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View Post
        </Link>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              required
              value={formData.title}
              onChange={handleTitleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter post title..."
            />
          </div>

          {/* Slug */}
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
              placeholder="post-url-slug"
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
              placeholder="Write your post content here..."
              minHeight="400px"
              onImageUpload={handleImageUpload}
            />
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
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Brief summary of post..."
            />
          </div>

          {/* Cover Image */}
          <div>
            <label htmlFor="coverImage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cover Image URL
            </label>
            <input
              type="url"
              id="coverImage"
              value={formData.coverImage}
              onChange={(e) => setFormData(prev => ({ ...prev, coverImage: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              id="category"
              value={formData.categoryId}
              onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagToggle(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    formData.tagIds.includes(tag.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Read Time */}
          <div>
            <label htmlFor="readTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Read Time (minutes)
            </label>
            <input
              type="number"
              id="readTime"
              min="1"
              value={formData.readTimeMinutes}
              onChange={(e) => setFormData(prev => ({ ...prev, readTimeMinutes: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="5"
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        {/* SEO Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SEO Settings</h2>

          {/* Meta Title */}
          <div>
            <label htmlFor="metaTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Meta Title
            </label>
            <input
              type="text"
              id="metaTitle"
              value={formData.metaTitle}
              onChange={(e) => setFormData(prev => ({ ...prev, metaTitle: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="SEO title (defaults to post title)"
            />
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
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="SEO description (defaults to excerpt)"
            />
          </div>

          {/* Meta Keywords */}
          <div>
            <label htmlFor="metaKeywords" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Meta Keywords
            </label>
            <input
              type="text"
              id="metaKeywords"
              value={formData.metaKeywords}
              onChange={(e) => setFormData(prev => ({ ...prev, metaKeywords: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="keyword1, keyword2, keyword3"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Comma-separated keywords
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href="/admin/blog/posts"
            className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium text-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
