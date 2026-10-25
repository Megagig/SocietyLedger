import { Router } from 'express';
import { exportsController } from './exports.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { requireModule } from '../../middleware/module-feature.middleware';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   POST /api/exports/financial-pdf
 * @desc    Export financial summary as PDF
 * @access  Private (exports.financial)
 */
router.post(
  '/financial-pdf',
  requirePermission(PERMISSIONS.EXPORT_FINANCIAL),
  exportsController.exportFinancialPDF
);

/**
 * @route   POST /api/exports/accounting-statement
 * @desc    Export an accounting statement (income statement, balance sheet or cash flow) as PDF
 * @access  Private (exports.financial and ledger.view; the accounting module must be on)
 */
router.post(
  '/accounting-statement',
  requireModule('accounting'),
  requirePermission(PERMISSIONS.EXPORT_FINANCIAL),
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  exportsController.exportAccountingStatementPDF
);

/**
 * @route   POST /api/exports/financial-excel
 * @desc    Export financial summary as Excel
 * @access  Private (exports.financial)
 */
router.post(
  '/financial-excel',
  requirePermission(PERMISSIONS.EXPORT_FINANCIAL),
  exportsController.exportFinancialExcel
);

/**
 * @route   POST /api/exports/member-statement/:memberId
 * @desc    Export member statement as PDF
 * @access  Private (exports.members)
 */
router.post(
  '/member-statement/:memberId',
  requirePermission(PERMISSIONS.EXPORT_MEMBERS),
  exportsController.exportMemberStatementPDF
);

/**
 * @route   POST /api/exports/members-excel
 * @desc    Export all members with balances as Excel
 * @access  Private (exports.members)
 */
router.post(
  '/members-excel',
  requirePermission(PERMISSIONS.EXPORT_MEMBERS),
  exportsController.exportAllMembersExcel
);

/**
 * @route   POST /api/exports/custom-members-excel
 * @desc    Export members with custom selected fields as Excel
 * @access  Private (exports.members)
 */
router.post(
  '/custom-members-excel',
  requirePermission(PERMISSIONS.EXPORT_MEMBERS),
  exportsController.exportCustomMembersExcel
);

/**
 * @route   POST /api/exports/custom-report-excel
 * @desc    Export custom report data with selected fields as Excel
 * @access  Private (exports.financial)
 */
router.post(
  '/custom-report-excel',
  requirePermission(PERMISSIONS.EXPORT_FINANCIAL),
  exportsController.exportCustomReportExcel
);

/**
 * @route   GET /api/exports/history
 * @desc    Get export history
 * @access  Private (exports.financial or exports.members or exports.view_history)
 */
router.get(
  '/history',
  requireAnyPermission([PERMISSIONS.EXPORT_FINANCIAL, PERMISSIONS.EXPORT_MEMBERS, PERMISSIONS.EXPORT_VIEW_HISTORY]),
  exportsController.getExportHistory
);

/**
 * @route   GET /api/exports/download/:id
 * @desc    Download export file
 * @access  Private (exports.financial or exports.members or exports.view_history)
 */
router.get(
  '/download/:id',
  requireAnyPermission([PERMISSIONS.EXPORT_FINANCIAL, PERMISSIONS.EXPORT_MEMBERS, PERMISSIONS.EXPORT_VIEW_HISTORY]),
  exportsController.downloadExport
);

export default router;
