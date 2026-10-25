import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireModule } from '../../middleware/module-feature.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { MAX_RECEIPT_BYTES } from './expense-rules';
import { expensesController } from './expenses.controller';

const router: Router = Router();

// The receipt goes to memory and straight on to storage — no file lands on the server's disk. Its real type is read from its bytes.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_RECEIPT_BYTES } });
const oneReceipt = (req: Request, res: Response, next: NextFunction) =>
  upload.single('receipt')(req, res, (error: unknown) => {
    if (error) return res.status(400).json({ success: false, code: 'RECEIPT_TOO_LARGE', message: 'That file is larger than 5MB. Choose a smaller one.' });
    return next();
  });

router.use(authMiddleware);
router.use(requireModule('accounting'));

// Reading needs `ledger.view`; recording, changing and sending need `ledger.create`; approving, rejecting and voiding need `payments.approve`.
router.get('/options', requirePermission(PERMISSIONS.FINANCE_VIEW), expensesController.options);
router.get('/budget-check', requirePermission(PERMISSIONS.FINANCE_VIEW), expensesController.budgetCheck);
router.get('/', requirePermission(PERMISSIONS.FINANCE_VIEW), expensesController.list);
router.post('/', requirePermission(PERMISSIONS.FINANCE_CREATE), expensesController.create);
router.get('/:id', requirePermission(PERMISSIONS.FINANCE_VIEW), expensesController.get);
router.put('/:id', requirePermission(PERMISSIONS.FINANCE_CREATE), expensesController.update);
router.delete('/:id', requirePermission(PERMISSIONS.FINANCE_CREATE), expensesController.remove);

router.post('/:id/receipt', requirePermission(PERMISSIONS.FINANCE_CREATE), oneReceipt, expensesController.attachReceipt);
router.delete('/:id/receipt', requirePermission(PERMISSIONS.FINANCE_CREATE), expensesController.removeReceipt);
router.get('/:id/receipt-url', requirePermission(PERMISSIONS.FINANCE_VIEW), expensesController.receiptUrl);

router.post('/:id/submit', requirePermission(PERMISSIONS.FINANCE_CREATE), expensesController.submit);
router.post('/:id/withdraw', requirePermission(PERMISSIONS.FINANCE_CREATE), expensesController.withdraw);
router.post('/:id/approve', requirePermission(PERMISSIONS.FINANCE_APPROVE), expensesController.approve);
router.post('/:id/reject', requirePermission(PERMISSIONS.FINANCE_APPROVE), expensesController.reject);
router.post('/:id/void', requirePermission(PERMISSIONS.FINANCE_APPROVE), expensesController.voidVoucher);

export default router;
