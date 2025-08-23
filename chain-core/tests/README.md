# 1C API Integration Tests

This directory contains comprehensive tests for the 1C integration API endpoints in the chain-core system.

## Overview

The 1C API enables 1C:Enterprise systems to manage retail chain operations including branches, products, employees, categories, and synchronization monitoring. Since we cannot test directly with 1C systems until customer deployment, these tests provide comprehensive validation.

## Test Structure

```
tests/
├── setup.ts                      # Global test setup & database initialization
├── helpers/
│   └── testApp.ts                 # Test utilities & mock data factories
└── onec-api/
    ├── auth.test.ts              # Authentication & security tests
    ├── branches.test.ts          # Branch management tests
    ├── products.test.ts          # Product management tests
    ├── employees.test.ts         # Employee management tests
    ├── categories.test.ts        # Category management tests
    ├── sync-logs.test.ts         # Sync monitoring tests
    └── integration.test.ts       # End-to-end integration tests
```

## Quick Start

### Run All Tests

```bash
npm run test:1c
```

### Run Specific Test Categories

```bash
npm run test:auth          # Authentication tests
npm run test:branches      # Branch management tests
npm run test:products      # Product management tests
npm run test:employees     # Employee management tests
npm run test:categories    # Category management tests
npm run test:sync         # Sync logs tests
npm run test:integration  # Integration tests
```

### Coverage & Monitoring

```bash
npm run test:coverage     # Run with coverage report
npm run test:watch        # Watch mode for development
npm run test:1c:info      # Show test information
```

## Test Features

### 🔐 Authentication & Security

- API key validation (Bearer & ApiKey formats)
- Permission-based access control
- Rate limiting protection
- CORS header validation
- Invalid key rejection

### 🏢 Branch Management

- Branch CRUD operations
- Server management for branches
- Status monitoring & health checks
- Pagination & filtering
- Hierarchical server relationships

### 📦 Product Management

- Product catalog CRUD operations
- Price management & updates
- Category associations
- Bulk operations
- Multi-language support
- Stock level tracking

### 👥 Employee Management

- Employee CRUD operations
- Branch assignments
- Role validation
- Status management
- Filtering by branch

### 📂 Category Management

- Hierarchical category structure
- Parent-child relationships
- Multi-language content
- Circular reference prevention
- Category tree operations

### 📊 Sync Logs

- Synchronization monitoring
- Performance tracking
- Log filtering & search
- Statistics generation
- Cleanup operations

### 🔄 Integration Testing

- End-to-end workflows
- Multi-entity operations
- Concurrent request handling
- Data consistency validation
- Error recovery testing
- Performance benchmarking

## Database Setup

Tests use an isolated test database with automatic:

- Schema creation before tests
- Data seeding with realistic test data
- Cleanup after test completion
- Transaction rollback for data isolation

## Mock Data

The test suite includes factories for generating realistic test data:

```typescript
// Branch mock data
const mockBranch = createMockBranch({
  name: "Test Branch",
  address: "123 Test Street",
  status: "active",
});

// Product mock data
const mockProduct = createMockProduct({
  name: "Test Product",
  price: 99.99,
  category_id: "category-123",
});
```

## API Endpoints Tested

### Authentication

- `GET /api/onec/auth/validate` - Validate API key
- Rate limiting on all endpoints

### Branches

- `GET /api/onec/branches` - List branches
- `POST /api/onec/branches` - Create branch
- `GET /api/onec/branches/:id` - Get branch details
- `PUT /api/onec/branches/:id` - Update branch
- `DELETE /api/onec/branches/:id` - Delete branch
- `GET /api/onec/branches/:id/servers` - Get branch servers
- `POST /api/onec/branches/:id/servers` - Create server
- `GET /api/onec/branches/:id/status` - Get branch status

### Products

- `GET /api/onec/products` - List products
- `POST /api/onec/products` - Create product
- `GET /api/onec/products/:id` - Get product details
- `PUT /api/onec/products/:id` - Update product
- `DELETE /api/onec/products/:id` - Delete product
- `PUT /api/onec/products/:id/price` - Update price
- `POST /api/onec/products/bulk` - Bulk operations

### Employees

- `GET /api/onec/employees` - List employees
- `POST /api/onec/employees` - Create employee
- `GET /api/onec/employees/:id` - Get employee details
- `PUT /api/onec/employees/:id` - Update employee
- `DELETE /api/onec/employees/:id` - Delete employee

### Categories

- `GET /api/onec/categories` - List categories
- `POST /api/onec/categories` - Create category
- `GET /api/onec/categories/:id` - Get category details
- `PUT /api/onec/categories/:id` - Update category
- `DELETE /api/onec/categories/:id` - Delete category
- `GET /api/onec/categories/tree` - Get category tree

### Sync Logs

- `GET /api/onec/sync/logs` - List sync logs
- `POST /api/onec/sync/logs` - Create sync log
- `GET /api/onec/sync/logs/stats` - Get sync statistics
- `DELETE /api/onec/sync/logs/cleanup` - Cleanup old logs

## Environment Configuration

Tests use the following environment:

- `NODE_ENV=test`
- Separate test database (configured in .env.test)
- Redis test instance
- Mock external services

## Error Scenarios Tested

- Invalid authentication
- Missing required fields
- Invalid data formats
- Foreign key violations
- Concurrent access conflicts
- Network timeout simulations
- Database connection failures
- Rate limit exceeded

## Performance Testing

- Concurrent request handling
- Bulk operation performance
- Database query optimization
- Memory usage monitoring
- Response time validation

## Contributing

When adding new API endpoints:

1. Add corresponding test file in `tests/onec-api/`
2. Include authentication tests
3. Test all CRUD operations
4. Add error scenario tests
5. Include integration test scenarios
6. Update this README

## Test Data Cleanup

All test data is automatically cleaned up:

- Database tables are recreated for each test run
- Temporary files are removed
- Redis cache is cleared
- No persistent test data remains

## Debugging Tests

Use these commands for debugging:

```bash
# Run specific test with verbose output
npx jest tests/onec-api/auth.test.ts --verbose

# Run with debugging information
DEBUG=* npm run test:1c

# Run single test case
npx jest -t "should authenticate with valid API key"
```

## Coverage Goals

We aim for:

- 100% endpoint coverage
- 90%+ code path coverage
- All error scenarios covered
- All business logic validated

Current coverage can be viewed with:

```bash
npm run test:coverage
```

---

**Note**: These tests simulate 1C system behavior without requiring an actual 1C installation. They validate that the API correctly handles all expected 1C integration scenarios and data formats.
