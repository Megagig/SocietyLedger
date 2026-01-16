// ============================================
// BLOG & DOCUMENTATION SYSTEM - DOCUMENTATION CONTROLLER
// ============================================

import { Request, Response, NextFunction } from 'express';
import { documentationService } from './documentation.service';
import { DocStatus } from '@prisma/client';

// ============================================
// PUBLIC ENDPOINTS
// ============================================

/**
 * GET /api/docs/sections
 * List all documentation sections
 */
export const listSections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const sections = await documentationService.listSections(limit);

    return res.json({
      success: true,
      data: sections,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/docs/sections/:slug
 * Get section by slug
 */
export const getSectionBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const section = await documentationService.getSectionBySlug(slug);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
      });
    }

    return res.json({
      success: true,
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/docs/pages
 * List published documentation pages
 */
export const listPages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string | undefined;
    const sectionId = req.query.sectionId ? parseInt(req.query.sectionId as string) : undefined;
    const status = req.query.status as DocStatus | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await documentationService.listPages({
      query,
      sectionId,
      status,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: result.pages,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/docs/pages/:slug
 * Get documentation page by slug
 */
export const getPageBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const page = await documentationService.getPageBySlug(slug);

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    return res.json({
      success: true,
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/docs/search
 * Search documentation
 */
export const searchDocs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string;
    const sectionId = req.query.sectionId ? parseInt(req.query.sectionId as string) : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter is required',
      });
    }

    const result = await documentationService.listPages({
      query,
      sectionId,
      status: DocStatus.PUBLISHED,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: result.pages,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/docs/pages/:id/related
 * Get related documentation pages
 */
export const getRelatedPages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 5;

    const relatedPages = await documentationService.getRelatedPages(id, limit);

    return res.json({
      success: true,
      data: relatedPages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/docs/pages/:id/view
 * Increment page view count
 */
export const incrementViewCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await documentationService.incrementViewCount(id);

    return res.json({
      success: true,
      message: 'View count incremented',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/docs/pages/:id/feedback
 * Submit feedback for a documentation page
 */
export const createFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { isHelpful, comment, email } = req.body;
    const userId = req.user?.id;

    const feedback = await documentationService.createFeedback(
      id,
      { isHelpful, comment, email },
      userId,
    );

    return res.status(201).json({
      success: true,
      data: feedback,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// SUPER ADMIN ENDPOINTS
// ============================================

/**
 * GET /api/admin/docs/pages
 * List all documentation pages (including drafts)
 */
export const listAllPages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string | undefined;
    const sectionId = req.query.sectionId ? parseInt(req.query.sectionId as string) : undefined;
    const status = req.query.status as DocStatus | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await documentationService.listPages({
      query,
      sectionId,
      status,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: result.pages,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/docs/pages/:id
 * Get documentation page by ID
 */
export const getPageById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const page = await documentationService.getPageById(id);

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    return res.json({
      success: true,
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/docs/pages
 * Create a new documentation page
 */
export const createPage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = req.user!.id;
    const page = await documentationService.createPage(req.body, authorId);

    return res.status(201).json({
      success: true,
      data: page,
      message: 'Documentation page created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/docs/pages/:id
 * Update a documentation page
 */
export const updatePage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const page = await documentationService.updatePage(id, req.body);

    return res.json({
      success: true,
      data: page,
      message: 'Documentation page updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/docs/pages/:id
 * Delete a documentation page
 */
export const deletePage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await documentationService.deletePage(id);

    return res.json({
      success: true,
      message: 'Documentation page deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/docs/sections
 * Create a new documentation section
 */
export const createSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = await documentationService.createSection(req.body);

    return res.status(201).json({
      success: true,
      data: section,
      message: 'Documentation section created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/docs/sections/:id
 * Update a documentation section
 */
export const updateSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const section = await documentationService.updateSection(id, req.body);

    return res.json({
      success: true,
      data: section,
      message: 'Documentation section updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/docs/sections/:id
 * Delete a documentation section
 */
export const deleteSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await documentationService.deleteSection(id);

    return res.json({
      success: true,
      message: 'Documentation section deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/docs/feedback
 * List all feedback
 */
export const listAllFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageId = req.query.pageId ? parseInt(req.query.pageId as string) : undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const feedback = await documentationService.listFeedback(pageId, limit, offset);

    return res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/docs/feedback/:id
 * Get feedback by ID
 */
export const getFeedbackById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const feedback = await documentationService.getFeedbackById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    return res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/docs/feedback/:id
 * Delete feedback
 */
export const deleteFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await documentationService.deleteFeedback(id);

    return res.json({
      success: true,
      message: 'Feedback deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
