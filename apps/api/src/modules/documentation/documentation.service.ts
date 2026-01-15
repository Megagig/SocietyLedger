// ============================================
// BLOG & DOCUMENTATION SYSTEM - DOCUMENTATION SERVICE
// Phase 9: Enhanced with Full-Text Search & Redis Caching
// ============================================

import { prisma } from '../../lib/prisma';
import { cacheService, CACHE_TTL } from '../../services/cache.service';
import {
  DocPageWithRelations,
  DocSectionWithPages,
  DocFeedbackWithUser,
  CreatePageDto,
  UpdatePageDto,
  CreateSectionDto,
  UpdateSectionDto,
  CreateFeedbackDto,
  DocSearchParams,
  DocPageListResponse,
} from './types/documentation.types';
import { DocStatus, ContentScope } from '@prisma/client';

// Cache key prefixes
const DOC_CACHE_PREFIX = 'docs';
const CACHE_TAGS = {
  DOC_PAGE: 'doc_page',
  DOC_LIST: 'doc_list',
  DOC_SECTION: 'doc_section',
};

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
    const existing = await prisma.docPage.findUnique({
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
// DOCUMENTATION SERVICE
// ============================================

export const documentationService = {
  // ==========================================
  // DOC PAGE METHODS
  // ==========================================

  /**
   * List published pages (public)
   * Phase 9: Enhanced with full-text search and Redis caching
   */
  async listPages(params: DocSearchParams): Promise<DocPageListResponse> {
    const {
      query,
      sectionId,
      status = DocStatus.PUBLISHED,
      page = 1,
      limit = 20,
    } = params;

    const offset = (page - 1) * limit;

    // Generate cache key
    const cacheKey = `${DOC_CACHE_PREFIX}:list:${status}:${sectionId || 'all'}:${query || 'none'}:${page}:${limit}`;

    // Try to get from cache
    const cached = await cacheService.get<DocPageListResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const where: any = {
      status,
      scope: 'PLATFORM',
    };

    // Filter by section
    if (sectionId) {
      where.sectionId = sectionId;
    }

    // Phase 9: Enhanced full-text search using PostgreSQL tsvector
    if (query) {
      const searchQuery = query.trim();
      
      // Try full-text search first
      try {
        const searchResults = await prisma.$queryRaw<Array<any>>`
          SELECT 
            dp.*,
            ts_rank(dp.search_vector, plainto_tsquery('english', ${searchQuery})) as rank
          FROM doc_pages dp
          WHERE 
            dp.status = ${status}::text
            AND dp.scope = 'PLATFORM'
            AND dp.search_vector @@ plainto_tsquery('english', ${searchQuery})
            ${sectionId ? prisma.$queryRaw`AND dp."sectionId" = ${sectionId}` : prisma.$queryRaw``}
          ORDER BY rank DESC, dp.order ASC, dp."publishedAt" DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

        if (searchResults.length > 0) {
          // Get total count for this search
          const totalResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count
            FROM doc_pages dp
            WHERE 
              dp.status = ${status}::text
              AND dp.scope = 'PLATFORM'
              AND dp.search_vector @@ plainto_tsquery('english', ${searchQuery})
              ${sectionId ? prisma.$queryRaw`AND dp."sectionId" = ${sectionId}` : prisma.$queryRaw``}
          `;

          const total = Number(totalResult[0]?.count || 0);

          // Fetch relations for each page
          const pageIds = searchResults.map(p => p.id);
          const pagesWithRelations = await prisma.docPage.findMany({
            where: { id: { in: pageIds } },
            include: {
              author: {
                select: {
                  id: true,
                  email: true,
                },
              },
              section: true,
              parent: true,
              _count: {
                select: {
                  feedback: true,
                },
              },
            },
          });

          // Sort by rank
          const sortedPages = pageIds.map(id => 
            pagesWithRelations.find(p => p.id === id)
          ).filter((page): page is typeof pagesWithRelations[0] => page !== undefined);

          const result = {
            pages: sortedPages as DocPageWithRelations[],
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          };

          // Cache the result
          await cacheService.set(cacheKey, result, {
            ttl: CACHE_TTL.MEDIUM,
            tags: [CACHE_TAGS.DOC_LIST],
          });

          return result;
        }
      } catch (error) {
        console.error('Full-text search error, falling back to basic search:', error);
      }

      // Fallback to basic search if full-text search fails
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { excerpt: { contains: query, mode: 'insensitive' } },
      ];
    }

    const [pages, total] = await Promise.all([
      prisma.docPage.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
          section: true,
          parent: true,
          _count: {
            select: {
              feedback: true,
            },
          },
        },
        orderBy: [
          { order: 'asc' },
          { publishedAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.docPage.count({ where }),
    ]);

    const result = {
      pages: pages as DocPageWithRelations[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    // Cache the result
    await cacheService.set(cacheKey, result, {
      ttl: CACHE_TTL.MEDIUM,
      tags: [CACHE_TAGS.DOC_LIST],
    });

    return result;
  },

  /**
   * Get page by slug (public)
   * Phase 9: Enhanced with Redis caching
   */
  async getPageBySlug(slug: string, incrementView = true): Promise<DocPageWithRelations | null> {
    const cacheKey = `${DOC_CACHE_PREFIX}:page:${slug}`;

    // Try to get from cache
    const cached = await cacheService.get<DocPageWithRelations>(cacheKey);
    if (cached) {
      // Increment view count asynchronously
      if (incrementView) {
        prisma.docPage.update({
          where: { id: cached.id },
          data: { viewCount: { increment: 1 } },
        }).catch(err => console.error('Error incrementing view count:', err));
      }
      return cached;
    }

    const page = await prisma.docPage.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        section: true,
        parent: true,
        children: {
          where: {
            status: DocStatus.PUBLISHED,
          },
          orderBy: { order: 'asc' },
        },
        feedback: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            feedback: true,
          },
        },
      },
    });

    if (!page) return null;

    // Only published pages are publicly accessible
    if (page.status !== DocStatus.PUBLISHED) return null;

    // Increment view count
    if (incrementView) {
      await prisma.docPage.update({
        where: { id: page.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    // Cache the result
    await cacheService.set(cacheKey, page as DocPageWithRelations, {
      ttl: CACHE_TTL.LONG,
      tags: [CACHE_TAGS.DOC_PAGE],
    });

    return page as DocPageWithRelations;
  },

  /**
   * Get page by ID (admin)
   */
  async getPageById(id: number): Promise<DocPageWithRelations | null> {
    const page = await prisma.docPage.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        section: true,
        parent: true,
        children: true,
        feedback: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            feedback: true,
          },
        },
      },
    });

    if (!page) return null;

    return page as DocPageWithRelations;
  },

  /**
   * Get related pages
   */
  async getRelatedPages(pageId: number, limit = 5): Promise<DocPageWithRelations[]> {
    const page = await prisma.docPage.findUnique({
      where: { id: pageId },
      select: { sectionId: true },
    });

    if (!page) return [];

    const relatedPages = await prisma.docPage.findMany({
      where: {
        id: { not: pageId },
        status: DocStatus.PUBLISHED,
        scope: 'PLATFORM',
        sectionId: page.sectionId,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        section: true,
      },
      orderBy: { viewCount: 'desc' },
      take: limit,
    });

    return relatedPages as DocPageWithRelations[];
  },

  /**
   * Increment page view count
   */
  async incrementViewCount(pageId: number): Promise<void> {
    await prisma.docPage.update({
      where: { id: pageId },
      data: { viewCount: { increment: 1 } },
    });
  },

  /**
   * Create page (admin only)
   */
  async createPage(data: CreatePageDto, authorId: number): Promise<DocPageWithRelations> {
    const baseSlug = generateSlug(data.title);
    const slug = await ensureUniqueSlug(baseSlug);

    const page = await prisma.docPage.create({
      data: {
        slug,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || null,
        order: data.order || 0,
        scope: data.scope || ContentScope.PLATFORM,
        parentId: data.parentId || null,
        sectionId: data.sectionId || null,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        version: data.version || '1.0',
        status: DocStatus.DRAFT,
        authorId,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        section: true,
        parent: true,
        _count: {
          select: {
            feedback: true,
          },
        },
      },
    });

    return page as DocPageWithRelations;
  },

  /**
   * Create page (admin only)
   * Phase 9: Enhanced with cache invalidation
   */
  async createPage(data: CreatePageDto, authorId: number): Promise<DocPageWithRelations> {
    const baseSlug = generateSlug(data.title);
    const slug = await ensureUniqueSlug(baseSlug);
    
    const page = await prisma.docPage.create({
      data: {
        slug,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || null,
        order: data.order || 0,
        scope: data.scope || ContentScope.PLATFORM,
        parentId: data.parentId || null,
        sectionId: data.sectionId || null,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        version: data.version || '1.0',
        status: DocStatus.DRAFT,
        authorId,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        section: true,
        parent: true,
        _count: {
          select: {
            feedback: true,
          },
        },
      },
    });
    
    // Phase 9: Invalidate cache
    await cacheService.invalidateByTag(CACHE_TAGS.DOC_LIST);
    await cacheService.delete(`${DOC_CACHE_PREFIX}:page:${slug}`);
    
    return page as DocPageWithRelations;
  },

  /**
   * Update page (admin only)
   */
  async updatePage(pageId: number, data: UpdatePageDto): Promise<DocPageWithRelations> {
    const updateData: any = { ...data };

    // Update slug if title changed
    if (data.title) {
      const baseSlug = generateSlug(data.title);
      updateData.slug = await ensureUniqueSlug(baseSlug, pageId);
    }

    // Handle status change to published
    if (data.status === DocStatus.PUBLISHED && !data.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const page = await prisma.docPage.update({
      where: { id: pageId },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        section: true,
        parent: true,
        children: true,
        _count: {
          select: {
            feedback: true,
          },
        },
      },
    });

    return page as DocPageWithRelations;
  },

  /**
   * Update page (admin only)
   * Phase 9: Enhanced with cache invalidation
   */
  async updatePage(pageId: number, data: UpdatePageDto): Promise<DocPageWithRelations> {
    const updateData: any = { ...data };

    // Update slug if title changed
    if (data.title) {
      const baseSlug = generateSlug(data.title);
      updateData.slug = await ensureUniqueSlug(baseSlug, pageId);
    }

    // Handle status change to published
    if (data.status === DocStatus.PUBLISHED && !data.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const page = await prisma.docPage.update({
      where: { id: pageId },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        section: true,
        parent: true,
        children: true,
        _count: {
          select: {
            feedback: true,
          },
        },
      },
    });

    // Phase 9: Invalidate cache
    await cacheService.invalidateByTag(CACHE_TAGS.DOC_LIST);
    await cacheService.delete(`${DOC_CACHE_PREFIX}:page:${page.slug}`);

    return page as DocPageWithRelations;
  },

  /**
   * Delete page (admin only)
   * Phase 9: Enhanced with cache invalidation
   */
  async deletePage(pageId: number): Promise<void> {
    // Get page slug before deletion for cache invalidation
    const page = await prisma.docPage.findUnique({
      where: { id: pageId },
      select: { slug: true },
    });
    
    await prisma.docPage.delete({
      where: { id: pageId },
    });
    
    // Phase 9: Invalidate cache
    if (page) {
      await cacheService.invalidateByTag(CACHE_TAGS.DOC_LIST);
      await cacheService.delete(`${DOC_CACHE_PREFIX}:page:${page.slug}`);
    }
  },

  // ==========================================
  // DOC SECTION METHODS
  // ==========================================

  /**
   * List sections
   */
  async listSections(limit = 100): Promise<DocSectionWithPages[]> {
    const sections = await prisma.docSection.findMany({
      include: {
        pages: {
          where: {
            status: DocStatus.PUBLISHED,
          },
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            pages: true,
          },
        },
      },
      orderBy: { order: 'asc' },
      take: limit,
    });

    return sections as DocSectionWithPages[];
  },

  /**
   * Get section by slug
   */
  async getSectionBySlug(slug: string): Promise<DocSectionWithPages | null> {
    const section = await prisma.docSection.findUnique({
      where: { slug },
      include: {
        pages: {
          where: {
            status: DocStatus.PUBLISHED,
          },
          include: {
            author: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            pages: true,
          },
        },
      },
    });

    return section as DocSectionWithPages | null;
  },

  /**
   * Create section (admin only)
   */
  async createSection(data: CreateSectionDto): Promise<DocSectionWithPages> {
    const section = await prisma.docSection.create({
      data,
      include: {
        pages: true,
        _count: {
          select: {
            pages: true,
          },
        },
      },
    });

    return section as DocSectionWithPages;
  },

  /**
   * Update section (admin only)
   */
  async updateSection(sectionId: number, data: UpdateSectionDto): Promise<DocSectionWithPages> {
    const section = await prisma.docSection.update({
      where: { id: sectionId },
      data,
      include: {
        pages: true,
        _count: {
          select: {
            pages: true,
          },
        },
      },
    });

    return section as DocSectionWithPages;
  },

  /**
   * Delete section (admin only)
   */
  async deleteSection(sectionId: number): Promise<void> {
    await prisma.docSection.delete({
      where: { id: sectionId },
    });
  },

  // ==========================================
  // DOC FEEDBACK METHODS
  // ==========================================

  /**
   * List feedback for a page (admin only)
   */
  async listFeedback(pageId?: number, limit = 50, offset = 0): Promise<DocFeedbackWithUser[]> {
    const where: any = {};

    if (pageId) {
      where.pageId = pageId;
    }

    const feedback = await prisma.docFeedback.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return feedback as DocFeedbackWithUser[];
  },

  /**
   * Get feedback by ID (admin only)
   */
  async getFeedbackById(id: number): Promise<DocFeedbackWithUser | null> {
    const feedback = await prisma.docFeedback.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    return feedback as DocFeedbackWithUser | null;
  },

  /**
   * Create feedback (public)
   */
  async createFeedback(pageId: number, data: CreateFeedbackDto, userId?: number): Promise<DocFeedbackWithUser> {
    const feedback = await prisma.docFeedback.create({
      data: {
        pageId,
        isHelpful: data.isHelpful,
        comment: data.comment || null,
        email: data.email || null,
        userId: userId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    // Update page feedback counts
    if (data.isHelpful) {
      await prisma.docPage.update({
        where: { id: pageId },
        data: { helpfulCount: { increment: 1 } },
      });
    } else {
      await prisma.docPage.update({
        where: { id: pageId },
        data: { notHelpfulCount: { increment: 1 } },
      });
    }

    return feedback as DocFeedbackWithUser;
  },

  /**
   * Delete feedback (admin only)
   */
  async deleteFeedback(feedbackId: number): Promise<void> {
    const feedback = await prisma.docFeedback.findUnique({
      where: { id: feedbackId },
      select: { pageId: true, isHelpful: true },
    });

    if (!feedback) return;

    await prisma.docFeedback.delete({
      where: { id: feedbackId },
    });

    // Update page feedback counts
    if (feedback.isHelpful) {
      await prisma.docPage.update({
        where: { id: feedback.pageId },
        data: { helpfulCount: { decrement: 1 } },
      });
    } else {
      await prisma.docPage.update({
        where: { id: feedback.pageId },
        data: { notHelpfulCount: { decrement: 1 } },
      });
    }
  },
};

export default documentationService;
