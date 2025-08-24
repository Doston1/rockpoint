# Branch API Tests

This directory contains comprehensive tests for the Branch-to-Chain-Core API system.

## Test Structure

### Test Files

- **`auth.test.ts`** - Authentication middleware tests

  - Branch server API key validation
  - Authorization header formats
  - Authentication error handling
  - Middleware coverage across all endpoints

- **`transactions.test.ts`** - Transaction API tests

  - Single transaction submission
  - Bulk transaction processing
  - Transaction status checking
  - FastPay integration
  - Error handling and validation

- **`employees.test.ts`** - Employee management tests

  - Employee CRUD operations
  - Time logging and tracking
  - Bulk employee updates
  - Employee status management

- **`products.test.ts`** - Product API tests

  - Product search and filtering
  - Cross-branch stock lookup
  - Pricing updates and management
  - Low stock alerts
  - Category management

- **`inventory.test.ts`** - Inventory management tests

  - Stock movement logging
  - Inventory adjustments
  - Transfer requests
  - Bulk operations
  - Inventory summaries

- **`sync.test.ts`** - Synchronization API tests

  - Health status reporting
  - Data sync requests
  - Sync status monitoring
  - Ping/pong functionality
  - Sync metrics and history

- **`integration.test.ts`** - End-to-end workflow tests
  - Complete POS transaction flows
  - Employee shift workflows
  - Inventory management flows
  - Sync and monitoring workflows
  - Error handling and recovery

### Helper Files

- **`branchTestApp.ts`** - Test application setup
  - Creates test Express app with branch API
  - Mock data factories
  - Authentication helpers
  - Database setup and cleanup utilities

## Running Tests

### Run All Branch API Tests

```bash
npm run test:branch-api
```

### Run Individual Test Suites

```bash
# Authentication tests
npm run test:branch-auth

# Transaction tests
npm run test:branch-transactions

# Employee tests
npm run test:branch-employees

# Product tests
npm run test:branch-products

# Inventory tests
npm run test:branch-inventory

# Sync tests
npm run test:branch-sync

# Integration tests
npm run test:branch-integration
```

### Run with Coverage

```bash
npm run test:coverage -- tests/branches-api/
```

### Watch Mode

```bash
npm run test:watch -- tests/branches-api/
```

## Test Database Setup

The tests use the same database setup as the main test suite:

1. **Automatic Setup**: Test database tables are created automatically in `tests/setup.ts`
2. **Data Isolation**: Each test file sets up and cleans up its own test data
3. **Branch Server**: A test branch server with API key `test_branch_server_api_key_123` is created
4. **Test Products**: Sample products and inventory are created for testing

## Authentication

All branch API tests use the branch server authentication system:

```typescript
// Default test API key
const apiKey = "test_branch_server_api_key_123";

// Create auth headers
const headers = createBranchAuthHeaders(apiKey);
```

## Mock Data Factories

The test helpers provide factories for creating test data:

- `createMockTransaction()` - POS transactions
- `createMockEmployee()` - Employee records
- `createMockTimeLog()` - Time tracking entries
- `createMockStockMovement()` - Inventory movements
- `createMockHealthStatus()` - System health data

## Test Patterns

### API Response Validation

```typescript
expect(response.body.success).toBe(true);
expect(response.body.data).toHaveProperty("expected_field");
```

### Error Handling Tests

```typescript
const response = await request(app)
  .post("/api/branch-api/endpoint")
  .set(createBranchAuthHeaders())
  .send(invalidData)
  .expect(400);

expect(response.body.success).toBe(false);
expect(response.body.code).toBe("VALIDATION_ERROR");
```

### Authentication Tests

```typescript
// Test without auth
const response = await request(app).get("/api/branch-api/endpoint").expect(401);

expect(response.body.code).toBe("MISSING_AUTHORIZATION");
```

## Database Interactions

Tests verify database state changes:

```typescript
// Check inventory was updated after transaction
const inventoryResponse = await request(app)
  .get(`/api/branch-api/inventory/stock/${productId}`)
  .set(createBranchAuthHeaders())
  .expect(200);

expect(inventoryResponse.body.data.quantity_in_stock).toBe(expectedQuantity);
```

## Integration Test Scenarios

The integration tests cover complete workflows:

1. **Complete POS Transaction**

   - Product search → Inventory check → Transaction submit → Inventory update

2. **Employee Shift Management**

   - Employee creation → Clock in/out → Break tracking → Time log retrieval

3. **Inventory Replenishment**

   - Low stock detection → Transfer request → Stock receipt → Verification

4. **Sync Workflow**
   - Health reporting → Sync request → Status monitoring → Completion

## Performance Testing

Integration tests include basic performance validation:

- Bulk operation efficiency
- Response time monitoring
- Rate limiting compliance

## Troubleshooting

### Common Issues

1. **Database Connection Errors**

   - Ensure PostgreSQL is running
   - Check test database configuration
   - Verify database permissions

2. **Authentication Failures**

   - Confirm test branch server exists
   - Check API key format
   - Verify branch server is active

3. **Test Data Conflicts**
   - Tests run sequentially (maxWorkers: 1)
   - Each test cleans up its data
   - Use unique IDs for test records

### Debug Mode

Run tests with verbose output:

```bash
npm run test:branch-api -- --verbose
```

Run specific test with debug info:

```bash
npm run test:branch-auth -- --detectOpenHandles --forceExit
```

## Coverage Goals

- **API Endpoints**: 100% endpoint coverage
- **Authentication**: All auth scenarios tested
- **Validation**: All validation rules tested
- **Error Handling**: All error codes tested
- **Integration**: Complete workflow coverage

## Contributing

When adding new branch API features:

1. Add unit tests for new endpoints
2. Update integration tests if workflows change
3. Add mock data factories for new data types
4. Update this README with new test commands
5. Ensure 100% test coverage for new code
