// ============================================
// PHASE 21: HELP SERVICE
// Knowledge base articles and FAQs
// ============================================

import { prisma } from '../../lib/prisma';
import {
  HelpArticle,
  CreateArticleRequest,
  UpdateArticleRequest,
  ArticleSearchParams,
  ArticleSearchResult,
  FAQItem,
  CreateFAQRequest,
  UpdateFAQRequest,
  FAQByCategory,
  HelpCenterData,
  ARTICLE_CATEGORIES,
  FAQ_CATEGORIES,
} from './help.types';

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
    const existing = await prisma.helpArticle.findUnique({
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
// HELP SERVICE
// ============================================

export const helpService = {
  // ==========================================
  // ARTICLE METHODS
  // ==========================================

  /**
   * List articles with filtering
   */
  async listArticles(
    params: ArticleSearchParams & { associationId?: number; userRole?: string }
  ): Promise<ArticleSearchResult> {
    const { query, category, tags, role, limit = 20, offset = 0, associationId, userRole } = params;

    const where: any = {
      isPublished: true,
      OR: [
        { associationId: null }, // Global articles
        { associationId: associationId }, // Association-specific
      ],
    };

    // Filter by category
    if (category) {
      where.category = category;
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    // Filter by role visibility
    if (userRole) {
      where.roleVisibility = { has: userRole };
    }

    // Search by query
    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { excerpt: { contains: query, mode: 'insensitive' } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.helpArticle.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { viewCount: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.helpArticle.count({ where }),
    ]);

    return {
      articles: articles as HelpArticle[],
      total,
      hasMore: offset + articles.length < total,
    };
  },

  /**
   * Search articles with text search
   */
  async searchArticles(
    query: string,
    options: { associationId?: number; userRole?: string; limit?: number }
  ): Promise<HelpArticle[]> {
    const { associationId, userRole, limit = 10 } = options;

    const where: any = {
      isPublished: true,
      OR: [
        { associationId: null },
        { associationId: associationId },
      ],
      AND: [
        {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
            { tags: { hasSome: query.toLowerCase().split(' ') } },
          ],
        },
      ],
    };

    if (userRole) {
      where.roleVisibility = { has: userRole };
    }

    const articles = await prisma.helpArticle.findMany({
      where,
      orderBy: [{ viewCount: 'desc' }, { helpfulCount: 'desc' }],
      take: limit,
    });

    return articles as HelpArticle[];
  },

  /**
   * Get article by slug
   */
  async getArticleBySlug(
    slug: string,
    options: { associationId?: number; userRole?: string; incrementView?: boolean }
  ): Promise<HelpArticle | null> {
    const { associationId, userRole, incrementView = true } = options;

    const article = await prisma.helpArticle.findUnique({
      where: { slug },
    });

    if (!article) return null;

    // Check visibility
    if (!article.isPublished) return null;
    if (article.associationId && article.associationId !== associationId) return null;
    if (userRole && !article.roleVisibility.includes(userRole)) return null;

    // Increment view count
    if (incrementView) {
      await prisma.helpArticle.update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    return article as HelpArticle;
  },

  /**
   * Get featured articles
   */
  async getFeaturedArticles(
    options: { associationId?: number; userRole?: string; limit?: number }
  ): Promise<HelpArticle[]> {
    const { associationId, userRole, limit = 5 } = options;

    const where: any = {
      isPublished: true,
      isFeatured: true,
      OR: [
        { associationId: null },
        { associationId: associationId },
      ],
    };

    if (userRole) {
      where.roleVisibility = { has: userRole };
    }

    const articles = await prisma.helpArticle.findMany({
      where,
      orderBy: { viewCount: 'desc' },
      take: limit,
    });

    return articles as HelpArticle[];
  },

  /**
   * Mark article as helpful/not helpful
   */
  async markArticleHelpful(
    articleId: number,
    helpful: boolean
  ): Promise<{ helpfulCount: number; notHelpfulCount: number }> {
    const article = await prisma.helpArticle.update({
      where: { id: articleId },
      data: helpful
        ? { helpfulCount: { increment: 1 } }
        : { notHelpfulCount: { increment: 1 } },
      select: { helpfulCount: true, notHelpfulCount: true },
    });

    return article;
  },

  /**
   * Create article (admin only)
   */
  async createArticle(
    data: CreateArticleRequest,
    associationId?: number
  ): Promise<HelpArticle> {
    const baseSlug = generateSlug(data.title);
    const slug = await ensureUniqueSlug(baseSlug);

    const article = await prisma.helpArticle.create({
      data: {
        associationId,
        slug,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || data.content.substring(0, 200),
        category: data.category,
        tags: data.tags || [],
        roleVisibility: data.roleVisibility || ['admin', 'treasurer', 'member'],
        isPublished: data.isPublished ?? true,
        isFeatured: data.isFeatured ?? false,
      },
    });

    return article as HelpArticle;
  },

  /**
   * Update article (admin only)
   */
  async updateArticle(
    articleId: number,
    data: UpdateArticleRequest
  ): Promise<HelpArticle> {
    const updateData: any = { ...data };

    // Update slug if title changed
    if (data.title) {
      const baseSlug = generateSlug(data.title);
      updateData.slug = await ensureUniqueSlug(baseSlug, articleId);
    }

    const article = await prisma.helpArticle.update({
      where: { id: articleId },
      data: updateData,
    });

    return article as HelpArticle;
  },

  /**
   * Delete article (admin only)
   */
  async deleteArticle(articleId: number): Promise<void> {
    await prisma.helpArticle.delete({
      where: { id: articleId },
    });
  },

  // ==========================================
  // FAQ METHODS
  // ==========================================

  /**
   * List FAQs
   */
  async listFAQs(
    options: { associationId?: number; userRole?: string; category?: string }
  ): Promise<FAQItem[]> {
    const { associationId, userRole, category } = options;

    const where: any = {
      isActive: true,
      OR: [
        { associationId: null },
        { associationId: associationId },
      ],
    };

    if (category) {
      where.category = category;
    }

    if (userRole) {
      where.roleVisibility = { has: userRole };
    }

    const faqs = await prisma.fAQItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    return faqs as FAQItem[];
  },

  /**
   * Get FAQs grouped by category
   */
  async getFAQsByCategory(
    options: { associationId?: number; userRole?: string }
  ): Promise<FAQByCategory[]> {
    const faqs = await this.listFAQs(options);

    const grouped: Record<string, FAQItem[]> = {};
    faqs.forEach(faq => {
      if (!grouped[faq.category]) {
        grouped[faq.category] = [];
      }
      grouped[faq.category].push(faq);
    });

    return Object.entries(grouped).map(([category, items]) => ({
      category,
      items,
    }));
  },

  /**
   * Get top FAQs
   */
  async getTopFAQs(
    options: { associationId?: number; userRole?: string; limit?: number }
  ): Promise<FAQItem[]> {
    const { associationId, userRole, limit = 5 } = options;

    const where: any = {
      isActive: true,
      OR: [
        { associationId: null },
        { associationId: associationId },
      ],
    };

    if (userRole) {
      where.roleVisibility = { has: userRole };
    }

    const faqs = await prisma.fAQItem.findMany({
      where,
      orderBy: [{ viewCount: 'desc' }, { sortOrder: 'asc' }],
      take: limit,
    });

    return faqs as FAQItem[];
  },

  /**
   * Increment FAQ view count
   */
  async incrementFAQView(faqId: number): Promise<void> {
    await prisma.fAQItem.update({
      where: { id: faqId },
      data: { viewCount: { increment: 1 } },
    });
  },

  /**
   * Create FAQ (admin only)
   */
  async createFAQ(
    data: CreateFAQRequest,
    associationId?: number
  ): Promise<FAQItem> {
    const faq = await prisma.fAQItem.create({
      data: {
        associationId,
        question: data.question,
        answer: data.answer,
        category: data.category,
        roleVisibility: data.roleVisibility || ['admin', 'treasurer', 'member'],
        sortOrder: data.sortOrder || 0,
      },
    });

    return faq as FAQItem;
  },

  /**
   * Update FAQ (admin only)
   */
  async updateFAQ(faqId: number, data: UpdateFAQRequest): Promise<FAQItem> {
    const faq = await prisma.fAQItem.update({
      where: { id: faqId },
      data,
    });

    return faq as FAQItem;
  },

  /**
   * Delete FAQ (admin only)
   */
  async deleteFAQ(faqId: number): Promise<void> {
    await prisma.fAQItem.delete({
      where: { id: faqId },
    });
  },

  // ==========================================
  // HELP CENTER DATA
  // ==========================================

  /**
   * Get help center homepage data
   */
  async getHelpCenterData(
    options: { associationId?: number; userRole?: string }
  ): Promise<HelpCenterData> {
    const { associationId, userRole } = options;

    const [featuredArticles, topFAQs, categoryCountsRaw] = await Promise.all([
      this.getFeaturedArticles({ associationId, userRole, limit: 4 }),
      this.getTopFAQs({ associationId, userRole, limit: 5 }),
      prisma.helpArticle.groupBy({
        by: ['category'],
        where: {
          isPublished: true,
          OR: [
            { associationId: null },
            { associationId: associationId },
          ],
          ...(userRole && { roleVisibility: { has: userRole } }),
        },
        _count: { id: true },
      }),
    ]);

    const categories = categoryCountsRaw.map(c => ({
      name: c.category,
      count: c._count.id,
    }));

    // Quick actions are role-based (handled by quick-actions.service.ts)
    const quickActions: any[] = [];

    return {
      featuredArticles,
      topFAQs,
      quickActions,
      categories,
    };
  },

  /**
   * Get article categories with counts
   */
  async getArticleCategories(): Promise<{ name: string; label: string }[]> {
    return ARTICLE_CATEGORIES.map(cat => ({
      name: cat,
      label: cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    }));
  },

  /**
   * Get FAQ categories
   */
  async getFAQCategories(): Promise<{ name: string; label: string }[]> {
    return FAQ_CATEGORIES.map(cat => ({
      name: cat,
      label: cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    }));
  },
};

export default helpService;
