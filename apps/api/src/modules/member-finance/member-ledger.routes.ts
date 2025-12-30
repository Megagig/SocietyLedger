import { Router } from 'express';
import { memberLedgerController, memberLedgerExportController } from './member-ledger.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// Apply auth middleware to all routes
// Note: Tenant context comes from req.user.associationId (set by auth middleware)
// No tenant middleware needed - these are user-specific routes
router.use(authMiddleware);

// ============================================
// MEMBER SELF-SERVICE ENDPOINTS
// These allow members to view their own ledger
// ============================================

// Get my ledger summary
router.get('/my-ledger/summary',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberLedgerController.getMyLedgerSummary
);

// Get my ledger entries
router.get('/my-ledger/entries',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberLedgerController.getMyLedgerEntries
);

// Get my statement
router.get('/my-ledger/statement',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberLedgerController.getMyStatement
);

// Get my current balance
router.get('/my-ledger/balance',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberLedgerController.getMyBalance
);

// Export my ledger statement as PDF
router.post('/my-ledger/export',
  requirePermission(PERMISSIONS.MEMBER_FINANCE_VIEW),
  memberLedgerExportController.exportMyStatement
);

// ============================================
// ADMIN ENDPOINTS
// These allow admins to view any member's ledger
// ============================================

// Get all members with balances (report)
router.get('/ledger/members',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  memberLedgerController.getAllMemberBalances
);

// Bulk sync all members' ledgers
router.post('/ledger/bulk-sync',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  memberLedgerController.bulkSyncLedgers
);

// Get specific member's ledger summary
router.get('/ledger/:memberId/summary',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  memberLedgerController.getMemberLedgerSummary
);

// Get specific member's ledger entries
router.get('/ledger/:memberId/entries',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  memberLedgerController.getMemberLedgerEntries
);

// Get specific member's statement
router.get('/ledger/:memberId/statement',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  memberLedgerController.getMemberStatement
);

// Get specific member's balance
router.get('/ledger/:memberId/balance',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  memberLedgerController.getMemberBalance
);

// Sync specific member's ledger from existing transactions
router.post('/ledger/:memberId/sync',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  memberLedgerController.syncMemberLedger
);

// Export specific member's ledger statement as PDF
router.post('/ledger/:memberId/export',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  memberLedgerExportController.exportMemberStatement
);

export default router;
