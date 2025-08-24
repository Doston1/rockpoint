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

describe('Branch Transactions API', () => {
  describe('POST /api/branch-api/transactions/submit', () => {
    test('should submit a single transaction successfully', async () => {
      const transaction = createMockTransaction({
        items: [{
          product_id: testData.productId,
          sku: 'TST-001',
          name: 'Test Product',
          product_name: 'Test Product',
          quantity: 2,
          unit_price: 50000.00,
          total_price: 100000.00,
          tax_rate: 0.12,
          tax_amount: 12000.00,
          discount_amount: 0
        }]
      }, testData);

      const response = await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send(transaction)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('transaction_id');
      expect(response.body.data.status).toBe('submitted');
    });

    test('should submit bulk transactions successfully', async () => {
      const transactions = [
        createMockTransaction({ transaction_id: 'TXN_BULK_001' }, testData),
        createMockTransaction({ transaction_id: 'TXN_BULK_002' }, testData)
      ];

      const response = await request(app)
        .post('/api/branch-api/transactions/bulk-submit')
        .set(createBranchAuthHeaders())
        .send({ transactions })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.submitted_count).toBe(2);
      expect(response.body.data.failed_count).toBe(0);
    });

    test('should validate required transaction fields', async () => {
      const invalidTransaction = {
        // Missing required fields
        total_amount: 100000
      };

      const response = await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send(invalidTransaction)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should validate transaction items', async () => {
      const transaction = createMockTransaction({
        items: [{
          // Missing required fields
          quantity: 2
        }]
      }, testData);

      const response = await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send(transaction)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should handle FastPay transactions', async () => {
      const fastpayTransaction = createMockTransaction({
        payment_method: 'fastpay',
        payment_details: {
          fastpay_transaction_id: 'FP_123456789',
          fastpay_status: 'completed',
          fastpay_amount: 100000.00
        }
      }, testData);

      const response = await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send(fastpayTransaction)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment_method).toBe('fastpay');
    });
  });

  describe('GET /api/branch-api/transactions/status/:transactionId', () => {
    test('should get transaction status', async () => {
      // First submit a transaction
      const transactionId = `TXN_STATUS_${Date.now()}`;
      const transaction = createMockTransaction({ transaction_id: transactionId }, testData);
      
      await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send(transaction)
        .expect(201);

      // Then check its status
      const response = await request(app)
        .get(`/api/branch-api/transactions/status/${transactionId}`)
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction_id).toBe(transactionId);
      expect(response.body.data.status).toBeDefined();
    });

    test('should return not found for non-existent transaction', async () => {
      const response = await request(app)
        .get('/api/branch-api/transactions/status/NON_EXISTENT')
        .set(createBranchAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TRANSACTION_NOT_FOUND');
    });
  });

  describe('GET /api/branch-api/transactions/sync-status', () => {
    test('should get sync status for pending transactions', async () => {
      const response = await request(app)
        .get('/api/branch-api/transactions/sync-status')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pending_count');
      expect(response.body.data).toHaveProperty('failed_count');
      expect(response.body.data).toHaveProperty('last_sync_at');
    });
  });

  describe('POST /api/branch-api/transactions/retry-failed', () => {
    test('should retry failed transactions', async () => {
      const response = await request(app)
        .post('/api/branch-api/transactions/retry-failed')
        .set(createBranchAuthHeaders())
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('retry_count');
    });
  });

  describe('Error Handling', () => {
    test('should handle duplicate transaction ID', async () => {
      const duplicateId = `DUPLICATE_${Date.now()}`;
      const transaction = createMockTransaction({ transaction_id: duplicateId }, testData);
      
      // Submit first time
      await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send(transaction)
        .expect(201);

      // Submit duplicate
      const response = await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send(transaction)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TRANSACTION_ALREADY_EXISTS');
    });

    test('should handle invalid payment method', async () => {
      const transaction = createMockTransaction({
        payment_method: 'invalid_method'
      }, testData);

      const response = await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send(transaction)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should handle negative amounts', async () => {
      const transaction = createMockTransaction({
        total_amount: -100
      }, testData);

      const response = await request(app)
        .post('/api/branch-api/transactions/submit')
        .set(createBranchAuthHeaders())
        .send(transaction)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
