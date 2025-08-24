import { Express } from 'express';
import request from 'supertest';
import { cleanupTestBranchData, createBranchAuthHeaders, createBranchTestApp, createMockTransaction, setupTestBranchData } from '../helpers/branchTestApp';

let app: Express;
let testData: any;

beforeAll(async () => {
  app = await createBranchTestApp();
  testData = await setupTestBranchData();
});

afterAll(async () => {
  await cleanupTestBranchData();
});

describe('Branch API Integration Tests', () => {
  describe('Complete Transaction Flow', () => {
    test('should handle complete POS transaction workflow', async () => {
      // 1. First search for products
      const searchResponse = await request(app)
        .get('/api/branch-api/products/search?query=Test Product')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.data.length).toBeGreaterThan(0);
      
      const product = searchResponse.body.data[0];

      // 2. Check inventory before transaction
      const inventoryResponse = await request(app)
        .get(`/api/branch-api/inventory/stock/${product.onec_id}`)
        .set(createBranchAuthHeaders())
        .expect(200);

      const initialStock = inventoryResponse.body.data.quantity_in_stock;

      // 3. Submit transaction
      const transaction = createMockTransaction({
        transaction_id: `INTEGRATION_TXN_${Date.now()}`,
        items: [{
          product_id: product.onec_id,
          sku: product.sku,
          name: product.name,
          quantity: 2,
          unit_price: Number(product.base_price),
          total_price: Number(product.base_price) * 2,
          tax_rate: 0.12
        }]
      });

      const transactionResponse = await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send(transaction)
        .expect(201);

      expect(transactionResponse.body.success).toBe(true);
      
      // 4. Verify inventory was updated
      const updatedInventoryResponse = await request(app)
        .get(`/api/branch-api/inventory/stock/${product.onec_id}`)
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(updatedInventoryResponse.body.data.quantity_in_stock).toBe(initialStock - 2);

      // 5. Check transaction status
      const statusResponse = await request(app)
        .get(`/api/branch-api/transactions/status/${transaction.transaction_id}`)
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.status).toBe('completed');
    });

    test('should handle insufficient stock scenario', async () => {
      // First reduce stock to 1
      await request(app)
        .put('/api/branch-api/inventory/stock/TEST_PROD_001')
        .set(createBranchAuthHeaders())
        .send({ new_quantity: 1, reason: 'test_setup' })
        .expect(200);

      // Try to sell more than available
      const transaction = createMockTransaction({
        transaction_id: 'INSUFFICIENT_STOCK_TXN',
        items: [{
          product_id: 'TEST_PROD_001',
          sku: 'TST-001',
          name: 'Test Product',
          quantity: 5, // More than available
          unit_price: 50000,
          total_price: 250000
        }]
      });

      const response = await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send(transaction)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INSUFFICIENT_STOCK');
    });
  });

  describe('Employee Management Flow', () => {
    test('should handle employee shift workflow', async () => {
      // 1. Create new employee
      const employee = {
        employee_id: 'EMP_SHIFT_TEST',
        name: 'Shift Test Employee',
        role: 'cashier',
        phone: '+998901234567',
        status: 'active'
      };

      const createResponse = await request(app)
        .post('/api/branch-api/employees')
        .set(createBranchAuthHeaders())
        .send(employee)
        .expect(201);

      expect(createResponse.body.success).toBe(true);

      // 2. Clock in
      const clockInResponse = await request(app)
        .post('/api/branch-api/employees/EMP_SHIFT_TEST/time-log')
        .set(createBranchAuthHeaders())
        .send({
          action: 'clock_in',
          timestamp: new Date().toISOString(),
          location: 'main_terminal'
        })
        .expect(201);

      expect(clockInResponse.body.success).toBe(true);

      // 3. Take break
      await request(app)
        .post('/api/branch-api/employees/EMP_SHIFT_TEST/time-log')
        .set(createBranchAuthHeaders())
        .send({
          action: 'break_start',
          timestamp: new Date().toISOString()
        })
        .expect(201);

      // 4. Return from break
      await request(app)
        .post('/api/branch-api/employees/EMP_SHIFT_TEST/time-log')
        .set(createBranchAuthHeaders())
        .send({
          action: 'break_end',
          timestamp: new Date().toISOString()
        })
        .expect(201);

      // 5. Clock out
      const clockOutResponse = await request(app)
        .post('/api/branch-api/employees/EMP_SHIFT_TEST/time-log')
        .set(createBranchAuthHeaders())
        .send({
          action: 'clock_out',
          timestamp: new Date().toISOString()
        })
        .expect(201);

      expect(clockOutResponse.body.success).toBe(true);

      // 6. Get time logs for the day
      const today = new Date().toISOString().split('T')[0];
      const logsResponse = await request(app)
        .get(`/api/branch-api/employees/EMP_SHIFT_TEST/time-logs?from=${today}&to=${today}`)
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(logsResponse.body.success).toBe(true);
      
      // The API returns 1 record per day with multiple timestamp fields
      expect(logsResponse.body.data.length).toBe(1);
      
      const timeLog = logsResponse.body.data[0];
      expect(timeLog.clock_in).toBeDefined();
      expect(timeLog.clock_out).toBeDefined();
      expect(timeLog.break_start).toBeDefined();
      expect(timeLog.break_end).toBeDefined();
    });
  });

  describe('Inventory Management Flow', () => {
    test('should handle stock replenishment workflow', async () => {
      // 1. Check current low stock items
      const lowStockResponse = await request(app)
        .get('/api/branch-api/products/low-stock')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(lowStockResponse.body.success).toBe(true);

      // 2. Create transfer request for low stock item
      if (lowStockResponse.body.data.length > 0) {
        const lowStockItem = lowStockResponse.body.data[0];
        
        const transferResponse = await request(app)
          .post('/api/branch-api/inventory/transfer-request')
          .set(createBranchAuthHeaders())
          .send({
            to_branch_id: testData.branchId,
            items: [{
              product_id: lowStockItem.product_id,
              quantity_requested: 50,
              urgency: 'high',
              notes: 'Replenishment for low stock'
            }],
            notes: 'Auto-generated transfer request for low stock items'
          })
          .expect(201);

        expect(transferResponse.body.success).toBe(true);
        expect(transferResponse.body.data.status).toBe('pending');
      }

      // 3. Receive stock (simulate)
      const receiveResponse = await request(app)
        .post('/api/branch-api/inventory/movements')
        .set(createBranchAuthHeaders())
        .send({
          product_id: testData.productId,
          movement_type: 'purchase',
          quantity_change: 100,
          reason: 'purchase_order',
          reference_id: 'PO_12345',
          notes: 'Stock replenishment'
        })
        .expect(201);

      expect(receiveResponse.body.success).toBe(true);

      // 4. Verify stock levels updated
      const stockResponse = await request(app)
        .get('/api/branch-api/inventory/stock/TEST_PROD_001')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(stockResponse.body.success).toBe(true);
      expect(stockResponse.body.data.quantity_in_stock).toBeGreaterThan(0);
    });
  });

  describe('Sync and Health Monitoring Flow', () => {
    test('should handle complete sync workflow', async () => {
      // 1. Send health status
      const healthResponse = await request(app)
        .post('/api/branch-api/sync/health')
        .set(createBranchAuthHeaders())
        .send({
          status: 'online',
          last_activity: new Date().toISOString(),
          system_info: {
            cpu_usage: 45.2,
            memory_usage: 67.8,
            disk_space: 85.5,
            uptime: 86400
          },
          network_info: {
            ping_ms: 25,
            bandwidth_mbps: 100
          }
        })
        .expect(200);

      expect(healthResponse.body.success).toBe(true);

      // 2. Request data sync
      const syncResponse = await request(app)
        .post('/api/branch-api/sync/request')
        .set(createBranchAuthHeaders())
        .send({
          sync_type: 'products',
          last_sync_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          incremental: true
        })
        .expect(200);

      expect(syncResponse.body.success).toBe(true);
      const syncId = syncResponse.body.data.sync_id;

      // 3. Check sync status
      const statusResponse = await request(app)
        .get(`/api/branch-api/sync/status/${syncId}`)
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.sync_id).toBe(syncId);

      // 4. Complete sync
      const completeResponse = await request(app)
        .post(`/api/branch-api/sync/complete/${syncId}`)
        .set(createBranchAuthHeaders())
        .send({
          status: 'completed',
          records_processed: 125,
          records_total: 125
        })
        .expect(200);

      expect(completeResponse.body.success).toBe(true);

      // 5. Check sync metrics
      const metricsResponse = await request(app)
        .get('/api/branch-api/sync/metrics')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(metricsResponse.body.success).toBe(true);
      expect(metricsResponse.body.data.total_syncs).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle API failures gracefully', async () => {
      // Test with malformed JSON
      const response = await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle database connection issues', async () => {
      // This would require mocking the database connection
      // For now, just test that the API handles validation errors properly
      const invalidData = {
        // Completely invalid data structure
        invalid: 'data'
      };

      const response = await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Performance and Limits', () => {
    test('should handle bulk operations efficiently', async () => {
      const bulkTransactions = Array.from({ length: 10 }, (_, i) => 
        createMockTransaction({ 
          transaction_id: `BULK_TXN_${i + 1}`,
          total_amount: 10000 + (i * 1000)
        })
      );

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/branch-api/transactions/bulk-submit')
        .set(createBranchAuthHeaders())
        .send({ transactions: bulkTransactions })
        .expect(201);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.submitted_count).toBe(10);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should respect rate limits', async () => {
      // Test making multiple rapid requests
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/branch-api/sync/health')
          .set(createBranchAuthHeaders())
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed (no rate limiting implemented yet)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});
