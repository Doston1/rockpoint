// OneC Integration API Endpoints
// This file exports all OneC integration endpoint routers

import analyticsRouter from './analytics';
import branchesRouter from './branches';
import categoriesRouter from './categories';
import customersRouter from './customers';
import employeesRouter from './employees';
import inventoryRouter from './inventory';
import paymentsRouter from './payments';
import productsRouter from './products';
import syncLogsRouter from './sync-logs';
import transactionsRouter from './transactions';

export {
  analyticsRouter, branchesRouter, categoriesRouter, customersRouter, employeesRouter,
  inventoryRouter,
  paymentsRouter, productsRouter, syncLogsRouter, transactionsRouter
};

export default {
  products: productsRouter,
  categories: categoriesRouter,
  branches: branchesRouter,
  customers: customersRouter,
  transactions: transactionsRouter,
  employees: employeesRouter,
  inventory: inventoryRouter,
  payments: paymentsRouter,
  syncLogs: syncLogsRouter,
  analytics: analyticsRouter
};
