import { Router } from 'express';
import { memberLedgerController, memberLedgerExportController } from './member-ledger.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();

// Apply auth middleware to all routes
// Note: Tenant context comes from req.user.associationId (set by auth middleware)
// No tenant middleware needed - these are user-specific routes
router.use(authMiddleware);

// Permission set that allows both members viewing own data and admins viewing any data
const selfViewPermissions = [
  PERMISSIONS.MEMBER_FINANCE_VIEW,  // ledger.view_own - members viewing their own
  PERMISSIONS.LEDGER_VIEW,           // ledger.view - admins viewing ledger
  PERMISSIONS.LEDGER_VIEW_ALL,       // ledger.view_all - admins viewing all ledgers
];

// ============================================
// MEMBER SELF-SERVICE ENDPOINTS
// These allow members to view their own ledger
// ============================================

// Get my ledger summary
router.get('/my-ledger/summary',
  requireAnyPermission(selfViewPermissions),
  memberLedgerController.getMyLedgerSummary
);

// Get my ledger entries
router.get('/my-ledger/entries',
  requireAnyPermission(selfViewPermissions),
  memberLedgerController.getMyLedgerEntries
);

// Get my statement
router.get('/my-ledger/statement',
  requireAnyPermission(selfViewPermissions),
  memberLedgerController.getMyStatement
);

// Get my current balance
router.get('/my-ledger/balance',
  requireAnyPermission(selfViewPermissions),
  memberLedgerController.getMyBalance
);

// Export my ledger statement as PDF
router.post('/my-ledger/export',
  requireAnyPermission(selfViewPermissions),
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

// Bulk sync all members' ledgers (only for members without ledger entries)
router.post('/ledger/bulk-sync',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  memberLedgerController.bulkSyncLedgers
);

// Force re-sync all ledgers (clears and rebuilds ALL ledger entries)
router.post('/ledger/force-resync',
  requirePermission(PERMISSIONS.FINANCE_APPROVE),
  memberLedgerController.forceResyncAllLedgers
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
