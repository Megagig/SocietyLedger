// ============================================
// BLOG & DOCUMENTATION SYSTEM - DOCUMENTATION SERVICE
// ============================================

import { prisma } from '../../lib/prisma';
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

    const where: any = {
      status,
      scope: 'PLATFORM',
    };

    // Filter by section
    if (sectionId) {
      where.sectionId = sectionId;
    }

    // Search by query
    if (query) {
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

    return {
      pages: pages as DocPageWithRelations[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get page by slug (public)
   */
  async getPageBySlug(slug: string, incrementView = true): Promise<DocPageWithRelations | null> {
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
   * Delete page (admin only)
   */
  async deletePage(pageId: number): Promise<void> {
    await prisma.docPage.delete({
      where: { id: pageId },
    });
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
