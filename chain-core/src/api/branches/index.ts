// Branch Integration API Endpoints
// This file exports all branch-to-chain-core integration endpoint routers

import employeesRouter from './employees';
import inventoryRouter from './inventory';
import productsRouter from './products';
import syncRouter from './sync';
import transactionsRouter from './transactions';

export {
  employeesRouter,
  inventoryRouter,
  productsRouter,
  syncRouter,
  transactionsRouter
};

export default {
  employees: employeesRouter,
  inventory: inventoryRouter,
  products: productsRouter,
  sync: syncRouter,
  transactions: transactionsRouter
};
