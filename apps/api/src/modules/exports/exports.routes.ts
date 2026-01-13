import { Router } from 'express';
import { exportsController } from './exports.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   POST /api/exports/financial-pdf
 * @desc    Export financial summary as PDF
 * @access  Private (authenticated users)
 */
router.post(
  '/financial-pdf',
  exportsController.exportFinancialPDF
);

/**
 * @route   POST /api/exports/financial-excel
 * @desc    Export financial summary as Excel
 * @access  Private (authenticated users)
 */
router.post(
  '/financial-excel',
  exportsController.exportFinancialExcel
);

/**
 * @route   POST /api/exports/member-statement/:memberId
 * @desc    Export member statement as PDF
 * @access  Private (authenticated users)
 */
router.post(
  '/member-statement/:memberId',
  exportsController.exportMemberStatementPDF
);

/**
 * @route   POST /api/exports/members-excel
 * @desc    Export all members with balances as Excel
 * @access  Private (authenticated users)
 */
router.post(
  '/members-excel',
  exportsController.exportAllMembersExcel
);

/**
 * @route   POST /api/exports/custom-members-excel
 * @desc    Export members with custom selected fields as Excel
 * @access  Private (authenticated users)
 */
router.post(
  '/custom-members-excel',
  exportsController.exportCustomMembersExcel
);

/**
 * @route   GET /api/exports/history
 * @desc    Get export history
 * @access  Private
 */
router.get('/history', exportsController.getExportHistory);

/**
 * @route   GET /api/exports/download/:id
 * @desc    Download export file
 * @access  Private
 */
router.get('/download/:id', exportsController.downloadExport);

export default router;
