import { Router } from 'express';
import { authenticateBranchServer } from './branches/auth';
import employeesRouter from './branches/employees';
import inventoryRouter from './branches/inventory';
import productsRouter from './branches/products';
import syncRouter from './branches/sync';
import transactionsRouter from './branches/transactions';

const router = Router();

// Apply branch server authentication middleware to all routes
router.use(authenticateBranchServer);

// Mount comprehensive Branch API endpoint routers with appropriate prefixes
router.use('/transactions', transactionsRouter);
router.use('/employees', employeesRouter);
router.use('/products', productsRouter);
router.use('/inventory', inventoryRouter);
router.use('/sync', syncRouter);

export default router;
