import { Router } from 'express';
import multer from 'multer';
import { cashController } from './cash.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();

// The deposit slip goes to memory and straight on to storage — no file lands on the server's disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/gif', 'application/pdf'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF are allowed.'));
  },
});

router.use(authMiddleware);
router.use(tenantMiddleware);

const anyCashAccess = requireAnyPermission([PERMISSIONS.CASH_COLLECT, PERMISSIONS.CASH_LODGE, PERMISSIONS.CASH_VERIFY, PERMISSIONS.CASH_VIEW]);

router.get('/overview', anyCashAccess, cashController.overview);

// Collections and the receipts inside them
router.get('/collections', anyCashAccess, cashController.listCollections);
router.post('/collections', requirePermission(PERMISSIONS.CASH_COLLECT), cashController.createCollection);
router.get('/collections/:id', anyCashAccess, cashController.getCollection);
router.post('/collections/:id/close', requirePermission(PERMISSIONS.CASH_COLLECT), cashController.closeCollection);
router.post('/collections/:id/receipts', requirePermission(PERMISSIONS.CASH_COLLECT), cashController.recordReceipt);
router.post('/receipts/:id/void', requirePermission(PERMISSIONS.CASH_VERIFY), cashController.voidReceipt);
router.get('/payables', requirePermission(PERMISSIONS.CASH_COLLECT), cashController.payables);

// Lodgments: paying collected cash into the bank
router.get('/lodgable', requirePermission(PERMISSIONS.CASH_LODGE), cashController.lodgable);
router.post('/lodgments', requirePermission(PERMISSIONS.CASH_LODGE), upload.single('slip'), cashController.recordLodgment);
router.get('/lodgments', anyCashAccess, cashController.listLodgments);
router.get('/lodgments/:id', anyCashAccess, cashController.getLodgment);
router.get('/lodgments/:id/slip-url', anyCashAccess, cashController.slipUrl);
router.post('/lodgments/:id/decision', requirePermission(PERMISSIONS.CASH_VERIFY), cashController.decideLodgment);

export default router;
