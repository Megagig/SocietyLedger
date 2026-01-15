// ============================================
// BLOG & DOCUMENTATION SYSTEM - BLOG SERVICE
// ============================================

import { prisma } from '../../lib/prisma';
import {
  BlogPost,
  BlogPostWithRelations,
  CreatePostRequest,
  UpdatePostRequest,
  PostSearchParams,
  PostSearchResult,
  BlogCategory,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  BlogTag,
  CreateTagRequest,
  UpdateTagRequest,
  BlogComment,
  CreateCommentRequest,
  UpdateCommentRequest,
  CommentSearchParams,
  RelatedPost,
  ViewIncrementRequest,
} from './blog.types';
import { PostStatus, CommentStatus } from '@prisma/client';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

/**
 * Ensure slug is unique
 */
async function ensureUniqueSlug(baseSlug: string, excludeId?: number): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug },
    });
    
    if (!existing || existing.id === excludeId) {
      return slug;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// ============================================
// BLOG SERVICE
// ============================================

export const blogService = {
  // ==========================================
  // BLOG POST METHODS
  // ==========================================

  /**
   * List published posts (public)
   */
  async listPosts(params: PostSearchParams): Promise<PostSearchResult> {
    const {
      status = PostStatus.PUBLISHED,
      categoryId,
      tagId,
      authorId,
      search,
      limit = 20,
      offset = 0,
      sortBy = 'publishedAt',
      sortOrder = 'desc',
    } = params;

    const where: any = {
      status,
      scope: 'PLATFORM',
    };

    // Filter by category
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Filter by tag
    if (tagId) {
      where.tags = {
        some: { tagId },
      };
    }

    // Filter by author
    if (authorId) {
      where.authorId = authorId;
    }

    // Search by query
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
          category: true,
          tags: {
            include: {
              tag: true,
            },
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
      }),
      prisma.blogPost.count({ where }),
    ]);

    // Transform tags to match expected type
    const transformedPosts = posts.map(post => ({
      ...post,
      tags: post.tags.map(pt => pt.tag),
    })) as unknown as BlogPostWithRelations[];

    return {
      posts: transformedPosts,
      total,
      hasMore: offset + posts.length < total,
    };
  },

  /**
   * Get post by slug (public)
   */
  async getPostBySlug(slug: string, incrementView = true): Promise<BlogPostWithRelations | null> {
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    if (!post) return null;

    // Only published posts are publicly accessible
    if (post.status !== PostStatus.PUBLISHED) return null;

    // Increment view count
    if (incrementView) {
      await prisma.blogPost.update({
        where: { id: post.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    // Transform tags
    const transformedPost = {
      ...post,
      tags: post.tags.map(pt => pt.tag),
    } as unknown as BlogPostWithRelations;

    return transformedPost;
  },

  /**
   * Get post by ID (admin)
   */
  async getPostById(id: number): Promise<BlogPostWithRelations | null> {
    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    if (!post) return null;

    // Transform tags
    const transformedPost = {
      ...post,
      tags: post.tags.map(pt => pt.tag),
    } as unknown as BlogPostWithRelations;

    return transformedPost;
  },

  /**
   * Get related posts
   */
  async getRelatedPosts(postId: number, limit = 5): Promise<RelatedPost[]> {
    const post = await prisma.blogPost.findUnique({
      where: { id: postId },
      select: { categoryId: true, tags: true },
    });

    if (!post) return [];

    const tagIds = post.tags.map(pt => pt.tagId);

    const relatedPosts = await prisma.blogPost.findMany({
      where: {
        id: { not: postId },
        status: PostStatus.PUBLISHED,
        scope: 'PLATFORM',
        OR: [
          { categoryId: post.categoryId },
          {
            tags: {
              some: {
                tagId: {
                  in: tagIds,
                },
              },
            },
          },
        ],
      },
      include: {
        category: true,
      },
      orderBy: { viewCount: 'desc' },
      take: limit,
    });

    return relatedPosts as RelatedPost[];
  },

  /**
   * Increment post view count
   */
  async incrementViewCount({ postId }: ViewIncrementRequest): Promise<void> {
    await prisma.blogPost.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });
  },

  /**
   * Create post (admin only)
   */
  async createPost(data: CreatePostRequest, authorId: number): Promise<BlogPostWithRelations> {
    const baseSlug = generateSlug(data.title);
    const slug = await ensureUniqueSlug(baseSlug);

    const post = await prisma.blogPost.create({
      data: {
        slug,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || data.content.substring(0, 200),
        coverImage: data.coverImage || null,
        status: data.status || PostStatus.DRAFT,
        scope: data.scope || 'PLATFORM',
        publishedAt: data.publishedAt || (data.status === PostStatus.PUBLISHED ? new Date() : null),
        readTimeMinutes: data.readTimeMinutes || null,
        categoryId: data.categoryId || null,
        authorId,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        metaKeywords: data.metaKeywords || [],
        tags: data.tagIds
          ? {
              create: data.tagIds.map(tagId => ({
                tagId,
              })),
            }
          : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    // Transform tags
    const transformedPost = {
      ...post,
      tags: post.tags.map(pt => pt.tag),
    } as unknown as BlogPostWithRelations;

    return transformedPost;
  },

  /**
   * Update post (admin only)
   */
  async updatePost(postId: number, data: UpdatePostRequest): Promise<BlogPostWithRelations> {
    const updateData: any = { ...data };

    // Update slug if title changed
    if (data.title) {
      const baseSlug = generateSlug(data.title);
      updateData.slug = await ensureUniqueSlug(baseSlug, postId);
    }

    // Handle tags
    if (data.tagIds !== undefined) {
      // Delete existing tag connections
      await prisma.blogPostTag.deleteMany({
        where: { postId },
      });

      // Create new tag connections
      if (data.tagIds.length > 0) {
        await prisma.blogPostTag.createMany({
          data: data.tagIds.map(tagId => ({
            postId,
            tagId,
          })),
        });
      }

      delete updateData.tagIds;
    }

    const post = await prisma.blogPost.update({
      where: { id: postId },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    // Transform tags
    const transformedPost = {
      ...post,
      tags: post.tags.map(pt => pt.tag),
    } as unknown as BlogPostWithRelations;

    return transformedPost;
  },

  /**
   * Delete post (admin only)
   */
  async deletePost(postId: number): Promise<void> {
    await prisma.blogPost.delete({
      where: { id: postId },
    });
  },

  // ==========================================
  // BLOG CATEGORY METHODS
  // ==========================================

  /**
   * List categories
   */
  async listCategories(limit = 100): Promise<BlogCategory[]> {
    const categories = await prisma.blogCategory.findMany({
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return categories as BlogCategory[];
  },

  /**
   * Get category by slug
   */
  async getCategoryBySlug(slug: string): Promise<BlogCategory | null> {
    const category = await prisma.blogCategory.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    return category as BlogCategory | null;
  },

  /**
   * Create category (admin only)
   */
  async createCategory(data: CreateCategoryRequest): Promise<BlogCategory> {
    const category = await prisma.blogCategory.create({
      data,
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    return category as BlogCategory;
  },

  /**
   * Update category (admin only)
   */
  async updateCategory(categoryId: number, data: UpdateCategoryRequest): Promise<BlogCategory> {
    const category = await prisma.blogCategory.update({
      where: { id: categoryId },
      data,
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    return category as BlogCategory;
  },

  /**
   * Delete category (admin only)
   */
  async deleteCategory(categoryId: number): Promise<void> {
    await prisma.blogCategory.delete({
      where: { id: categoryId },
    });
  },

  // ==========================================
  // BLOG TAG METHODS
  // ==========================================

  /**
   * List tags
   */
  async listTags(limit = 100): Promise<BlogTag[]> {
    const tags = await prisma.blogTag.findMany({
      orderBy: { name: 'asc' },
      take: limit,
    });

    return tags as BlogTag[];
  },

  /**
   * Get tag by slug
   */
  async getTagBySlug(slug: string): Promise<BlogTag | null> {
    const tag = await prisma.blogTag.findUnique({
      where: { slug },
    });

    return tag as BlogTag | null;
  },

  /**
   * Create tag (admin only)
   */
  async createTag(data: CreateTagRequest): Promise<BlogTag> {
    const tag = await prisma.blogTag.create({
      data,
    });

    return tag as BlogTag;
  },

  /**
   * Update tag (admin only)
   */
  async updateTag(tagId: number, data: UpdateTagRequest): Promise<BlogTag> {
    const tag = await prisma.blogTag.update({
      where: { id: tagId },
      data,
    });

    return tag as BlogTag;
  },

  /**
   * Delete tag (admin only)
   */
  async deleteTag(tagId: number): Promise<void> {
    await prisma.blogTag.delete({
      where: { id: tagId },
    });
  },

  // ==========================================
  // BLOG COMMENT METHODS
  // ==========================================

  /**
   * List comments for a post
   */
  async listComments(params: CommentSearchParams): Promise<BlogComment[]> {
    const { postId, status, limit = 50, offset = 0 } = params;

    const where: any = { postId };

    // Filter by status (only approved comments for public)
    if (status) {
      where.status = status;
    } else {
      where.status = CommentStatus.APPROVED;
    }

    const comments = await prisma.blogComment.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        parent: true,
        replies: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    });

    return comments as BlogComment[];
  },

  /**
   * Get comment by ID
   */
  async getCommentById(id: number): Promise<BlogComment | null> {
    const comment = await prisma.blogComment.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        parent: true,
        replies: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return comment as BlogComment | null;
  },

  /**
   * Create comment (public)
   */
  async createComment(data: CreateCommentRequest, authorId?: number): Promise<BlogComment> {
    const comment = await prisma.blogComment.create({
      data: {
        content: data.content,
        postId: data.postId,
        parentId: data.parentId || null,
        authorId: authorId || null,
        guestName: data.guestName || null,
        guestEmail: data.guestEmail || null,
        status: CommentStatus.PENDING,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        parent: true,
      },
    });

    return comment as BlogComment;
  },

  /**
   * Update comment (admin only)
   */
  async updateComment(commentId: number, data: UpdateCommentRequest): Promise<BlogComment> {
    const comment = await prisma.blogComment.update({
      where: { id: commentId },
      data,
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        parent: true,
      },
    });

    return comment as BlogComment;
  },

  /**
   * Approve comment (admin only)
   */
  async approveComment(commentId: number): Promise<BlogComment> {
    const comment = await prisma.blogComment.update({
      where: { id: commentId },
      data: { status: CommentStatus.APPROVED },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        parent: true,
      },
    });

    return comment as BlogComment;
  },

  /**
   * Delete comment (admin only)
   */
  async deleteComment(commentId: number): Promise<void> {
    await prisma.blogComment.delete({
      where: { id: commentId },
    });
  },
};

export default blogService;
