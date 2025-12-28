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
 * @access  Private (requires report:view permission)
 */
router.post(
  '/financial-pdf',
  requirePermission('report:view'),
  exportsController.exportFinancialPDF
);

/**
 * @route   POST /api/exports/financial-excel
 * @desc    Export financial summary as Excel
 * @access  Private (requires report:view permission)
 */
router.post(
  '/financial-excel',
  requirePermission('report:view'),
  exportsController.exportFinancialExcel
);

/**
 * @route   POST /api/exports/member-statement/:memberId
 * @desc    Export member statement as PDF
 * @access  Private (requires member:view permission)
 */
router.post(
  '/member-statement/:memberId',
  requirePermission('member:view'),
  exportsController.exportMemberStatementPDF
);

/**
 * @route   POST /api/exports/members-excel
 * @desc    Export all members with balances as Excel
 * @access  Private (requires member:view permission)
 */
router.post(
  '/members-excel',
  requirePermission('member:view'),
  exportsController.exportAllMembersExcel
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
