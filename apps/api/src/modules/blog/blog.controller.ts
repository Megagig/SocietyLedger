import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { PostStatus, CommentStatus, ContentScope } from '@prisma/client';

// Validation schemas
const createPostSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(10),
  coverImage: z.string().url().optional(),
  status: z.nativeEnum(PostStatus).default(PostStatus.DRAFT),
  publishedAt: z.string().datetime().optional(),
  readTimeMinutes: z.number().int().positive().optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  metaKeywords: z.array(z.string()).optional(),
  categoryId: z.number().int().positive().optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
});

const updatePostSchema = createPostSchema.partial();

const createCategorySchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(200).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const createTagSchema = z.object({
  name: z.string().min(2).max(30),
  slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
});

const createCommentSchema = z.object({
  content: z.string().min(3).max(1000),
  guestName: z.string().min(2).max(50).optional(),
  guestEmail: z.string().email().optional(),
  parentId: z.number().int().positive().optional(),
});

export class BlogController {
  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  async getPublishedPosts(req: Request, res: Response) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const categorySlug = req.query.category as string;
      const tagSlug = req.query.tag as string;
      const search = req.query.search as string;

      const where: any = {
        status: PostStatus.PUBLISHED,
        scope: ContentScope.PLATFORM,
      };

      if (categorySlug) {
        where.category = { slug: categorySlug };
      }

      if (tagSlug) {
        where.tags = {
          some: {
            tag: { slug: tagSlug },
          },
        };
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { excerpt: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [posts, total] = await Promise.all([
        prisma.blogPost.findMany({
          where,
          skip,
          take: limit,
          orderBy: { publishedAt: 'desc' },
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
                comments: {
                  where: { status: CommentStatus.APPROVED },
                },
              },
            },
          },
        }),
        prisma.blogPost.count({ where }),
      ]);

      return res.json({
        success: true,
        data: {
          posts,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error('Get published posts error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getPostBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      const post = await prisma.blogPost.findUnique({
        where: { slug, status: PostStatus.PUBLISHED },
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
              comments: {
                where: { status: CommentStatus.APPROVED },
              },
            },
          },
        },
      });

      if (!post) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }

      return res.json({ success: true, data: post });
    } catch (error) {
      console.error('Get post by slug error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async incrementView(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      await prisma.blogPost.update({
        where: { id },
        data: {
          viewCount: {
            increment: 1,
          },
        },
      });

      return res.json({ success: true });
    } catch (error) {
      console.error('Increment view error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getCategories(req: Request, res: Response) {
    try {
      const categories = await prisma.blogCategory.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              posts: {
                where: { status: PostStatus.PUBLISHED },
              },
            },
          },
        },
      });

      return res.json({ success: true, data: categories });
    } catch (error) {
      console.error('Get categories error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getTags(req: Request, res: Response) {
    try {
      const tags = await prisma.blogTag.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              posts: true,
            },
          },
        },
      });

      return res.json({ success: true, data: tags });
    } catch (error) {
      console.error('Get tags error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getComments(req: Request, res: Response) {
    try {
      const postId = Number(req.params.id);

      const comments = await prisma.blogComment.findMany({
        where: {
          postId,
          status: CommentStatus.APPROVED,
          parentId: null, // Only top-level comments
        },
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
          replies: {
            where: { status: CommentStatus.APPROVED },
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

      return res.json({ success: true, data: comments });
    } catch (error) {
      console.error('Get comments error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async createComment(req: Request, res: Response) {
    try {
      const postId = Number(req.params.id);
      const input = createCommentSchema.parse(req.body);
      const userId = req.user?.id;

      const comment = await prisma.blogComment.create({
        data: {
          postId,
          content: input.content,
          authorId: userId,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          parentId: input.parentId,
          status: CommentStatus.PENDING, // Requires moderation
        },
      });

      return res.status(201).json({ success: true, data: comment });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
      }
      console.error('Create comment error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getRelatedPosts(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const limit = Number(req.query.limit) || 3;

      const post = await prisma.blogPost.findUnique({
        where: { id },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });

      if (!post) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }

      const tagIds = post.tags.map((t) => t.tagId);

      const relatedPosts = await prisma.blogPost.findMany({
        where: {
          id: { not: id },
          status: PostStatus.PUBLISHED,
          OR: [
            { categoryId: post.categoryId },
            {
              tags: {
                some: {
                  tagId: { in: tagIds },
                },
              },
            },
          ],
        },
        take: limit,
        orderBy: { publishedAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
          category: true,
        },
      });

      return res.json({ success: true, data: relatedPosts });
    } catch (error) {
      console.error('Get related posts error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ============================================
  // SUPER ADMIN ENDPOINTS
  // ============================================

  async getAllPosts(req: Request, res: Response) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const status = req.query.status as PostStatus;
      const search = req.query.search as string;

      const where: any = {
        scope: ContentScope.PLATFORM,
      };

      if (status) {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { excerpt: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [posts, total] = await Promise.all([
        prisma.blogPost.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
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
        }),
        prisma.blogPost.count({ where }),
      ]);

      return res.json({
        success: true,
        data: {
          posts,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error('Get all posts error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getPostById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

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
        },
      });

      if (!post) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }

      return res.json({ success: true, data: post });
    } catch (error) {
      console.error('Get post by ID error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async createPost(req: Request, res: Response) {
    try {
      const input = createPostSchema.parse(req.body);
      const authorId = req.user!.id;

      // Check if slug exists
      const existing = await prisma.blogPost.findUnique({
        where: { slug: input.slug },
      });

      if (existing) {
        return res.status(409).json({ success: false, message: 'Slug already exists' });
      }

      const { tagIds, ...postData } = input;

      const post = await prisma.blogPost.create({
        data: {
          ...postData,
          authorId,
          scope: ContentScope.PLATFORM,
          publishedAt: input.status === PostStatus.PUBLISHED ? input.publishedAt || new Date().toISOString() : null,
          tags: tagIds
            ? {
                create: tagIds.map((tagId) => ({
                  tag: { connect: { id: tagId } },
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
        },
      });

      return res.status(201).json({ success: true, data: post });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
      }
      console.error('Create post error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async updatePost(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const input = updatePostSchema.parse(req.body);

      // Check if slug exists (excluding current post)
      if (input.slug) {
        const existing = await prisma.blogPost.findFirst({
          where: {
            slug: input.slug,
            id: { not: id },
          },
        });

        if (existing) {
          return res.status(409).json({ success: false, message: 'Slug already exists' });
        }
      }

      const { tagIds, ...postData } = input;

      // Update tags if provided
      if (tagIds !== undefined) {
        await prisma.blogPostTag.deleteMany({
          where: { postId: id },
        });
      }

      const post = await prisma.blogPost.update({
        where: { id },
        data: {
          ...postData,
          publishedAt:
            input.status === PostStatus.PUBLISHED && !postData.publishedAt
              ? new Date().toISOString()
              : postData.publishedAt,
          tags: tagIds
            ? {
                create: tagIds.map((tagId) => ({
                  tag: { connect: { id: tagId } },
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
        },
      });

      return res.json({ success: true, data: post });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
      }
      console.error('Update post error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async deletePost(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      await prisma.blogPost.delete({
        where: { id },
      });

      return res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
      console.error('Delete post error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async createCategory(req: Request, res: Response) {
    try {
      const input = createCategorySchema.parse(req.body);

      const existing = await prisma.blogCategory.findUnique({
        where: { slug: input.slug },
      });

      if (existing) {
        return res.status(409).json({ success: false, message: 'Category slug already exists' });
      }

      const category = await prisma.blogCategory.create({
        data: input,
      });

      return res.status(201).json({ success: true, data: category });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
      }
      console.error('Create category error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async updateCategory(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const input = createCategorySchema.partial().parse(req.body);

      const category = await prisma.blogCategory.update({
        where: { id },
        data: input,
      });

      return res.json({ success: true, data: category });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
      }
      console.error('Update category error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async deleteCategory(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      await prisma.blogCategory.delete({
        where: { id },
      });

      return res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
      console.error('Delete category error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async createTag(req: Request, res: Response) {
    try {
      const input = createTagSchema.parse(req.body);

      const existing = await prisma.blogTag.findUnique({
        where: { slug: input.slug },
      });

      if (existing) {
        return res.status(409).json({ success: false, message: 'Tag slug already exists' });
      }

      const tag = await prisma.blogTag.create({
        data: input,
      });

      return res.status(201).json({ success: true, data: tag });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
      }
      console.error('Create tag error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async updateTag(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const input = createTagSchema.partial().parse(req.body);

      const tag = await prisma.blogTag.update({
        where: { id },
        data: input,
      });

      return res.json({ success: true, data: tag });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
      }
      console.error('Update tag error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async deleteTag(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      await prisma.blogTag.delete({
        where: { id },
      });

      return res.json({ success: true, message: 'Tag deleted successfully' });
    } catch (error) {
      console.error('Delete tag error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async approveComment(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      const comment = await prisma.blogComment.update({
        where: { id },
        data: {
          status: CommentStatus.APPROVED,
        },
      });

      return res.json({ success: true, data: comment });
    } catch (error) {
      console.error('Approve comment error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async deleteComment(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      await prisma.blogComment.delete({
        where: { id },
      });

      return res.json({ success: true, message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Delete comment error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
