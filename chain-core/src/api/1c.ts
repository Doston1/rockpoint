import { Router } from 'express';
import { authenticateApiKey } from '../middleware/auth';

// Import comprehensive OneC endpoint routers
import {
  analyticsRouter,
  branchesRouter,
  categoriesRouter,
  customersRouter,
  employeesRouter,
  inventoryRouter,
  paymentsRouter,
  productsRouter,
  syncLogsRouter,
  transactionsRouter
} from './onec';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// Mount comprehensive OneC endpoint routers with appropriate prefixes
router.use('/products', productsRouter);
router.use('/categories', categoriesRouter);
router.use('/branches', branchesRouter);
router.use('/customers', customersRouter);
router.use('/transactions', transactionsRouter);
router.use('/employees', employeesRouter);
router.use('/inventory', inventoryRouter);
router.use('/payments', paymentsRouter);
router.use('/sync-logs', syncLogsRouter);
router.use('/analytics', analyticsRouter);


export default router;
