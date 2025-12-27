import { Router } from 'express';
import paystackRoutes from './paystack/paystack.routes';
import nombaRoutes from './nomba/nomba.routes';

const router = Router();

// Mount Paystack routes
router.use('/paystack', paystackRoutes);

// Mount Nomba routes
router.use('/nomba', nombaRoutes);

// TODO: Add bank transfer routes
// router.use('/bank-transfer', bankTransferRoutes);

export default router;
