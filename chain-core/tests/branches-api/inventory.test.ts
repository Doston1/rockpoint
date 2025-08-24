import { Express } from 'express';
import request from 'supertest';
import { cleanupTestBranchData, createBranchAuthHeaders, createBranchTestApp, createMockStockMovement, setupTestBranchData } from '../helpers/branchTestApp';

let app: Express;
let testData: any;

beforeAll(async () => {
  app = await createBranchTestApp();
  testData = await setupTestBranchData();
});

afterAll(async () => {
  await cleanupTestBranchData();
});

describe('Branch Inventory API', () => {
  describe('POST /api/branch-api/inventory/movements', () => {
    test('should log stock movement successfully', async () => {
      const movement = createMockStockMovement({
        product_id: 'TEST_PROD_001',
        movement_type: 'adjustment',
        quantity_change: 10,
        reason: 'inventory_count'
      });

      const response = await request(app)
        .post('/api/branch-api/inventory/movements')
        .set(createBranchAuthHeaders())
        .send(movement)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.movement_type).toBe('adjustment');
      expect(response.body.data.quantity_change).toBe(10);
    });

    test('should validate movement data', async () => {
      const invalidMovement = {
        // Missing required fields
        quantity_change: 10
      };

      const response = await request(app)
        .post('/api/branch-api/inventory/movements')
        .set(createBranchAuthHeaders())
        .send(invalidMovement)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should handle different movement types', async () => {
      const movements = [
        { movement_type: 'sale', quantity_change: -5 },
        { movement_type: 'purchase', quantity_change: 20 },
        { movement_type: 'transfer_in', quantity_change: 15 },
        { movement_type: 'transfer_out', quantity_change: -10 }
      ];

      for (const movementData of movements) {
        const movement = createMockStockMovement({
          product_id: 'TEST_PROD_001',
          ...movementData
        });

        const response = await request(app)
          .post('/api/branch-api/inventory/movements')
          .set(createBranchAuthHeaders())
          .send(movement)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.movement_type).toBe(movementData.movement_type);
      }
    });

    test('should update inventory quantity after movement', async () => {
      // Get current stock
      const stockResponse = await request(app)
        .get('/api/branch-api/inventory/stock/TEST_PROD_001')
        .set(createBranchAuthHeaders())
        .expect(200);

      const currentStock = stockResponse.body.data.quantity_in_stock;

      // Add stock movement
      const movement = createMockStockMovement({
        product_id: 'TEST_PROD_001',
        movement_type: 'adjustment',
        quantity_change: 25
      });

      await request(app)
        .post('/api/branch-api/inventory/movements')
        .set(createBranchAuthHeaders())
        .send(movement)
        .expect(201);

      // Check updated stock
      const updatedStockResponse = await request(app)
        .get('/api/branch-api/inventory/stock/TEST_PROD_001')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(updatedStockResponse.body.data.quantity_in_stock).toBe(currentStock + 25);
    });
  });

  describe('GET /api/branch-api/inventory/movements', () => {
    test('should get movement history', async () => {
      const response = await request(app)
        .get('/api/branch-api/inventory/movements')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should filter movements by product', async () => {
      const response = await request(app)
        .get('/api/branch-api/inventory/movements?product_id=TEST_PROD_001')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should filter movements by type', async () => {
      const response = await request(app)
        .get('/api/branch-api/inventory/movements?movement_type=adjustment')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should filter movements by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/branch-api/inventory/movements?from=${today}&to=${today}`)
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/branch-api/inventory/movements?page=1&limit=10')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('pages');
    });
  });

  describe('GET /api/branch-api/inventory/stock/:productId', () => {
    test('should get stock level for product', async () => {
      const response = await request(app)
        .get('/api/branch-api/inventory/stock/TEST_PROD_001')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('product_id');
      expect(response.body.data).toHaveProperty('quantity_in_stock');
      expect(response.body.data).toHaveProperty('min_stock_level');
    });

    test('should return not found for non-existent product', async () => {
      const response = await request(app)
        .get('/api/branch-api/inventory/stock/NON_EXISTENT')
        .set(createBranchAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('PUT /api/branch-api/inventory/stock/:productId', () => {
    test('should adjust stock level', async () => {
      const adjustmentData = {
        new_quantity: 75,
        reason: 'manual_adjustment',
        notes: 'Stock count correction'
      };

      const response = await request(app)
        .put('/api/branch-api/inventory/stock/TEST_PROD_001')
        .set(createBranchAuthHeaders())
        .send(adjustmentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity_in_stock).toBe(75);
    });

    test('should validate adjustment data', async () => {
      const invalidAdjustment = {
        new_quantity: -10 // Negative stock
      };

      const response = await request(app)
        .put('/api/branch-api/inventory/stock/TEST_PROD_001')
        .set(createBranchAuthHeaders())
        .send(invalidAdjustment)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should create movement record for adjustment', async () => {
      const adjustmentData = {
        new_quantity: 80,
        reason: 'test_adjustment'
      };

      await request(app)
        .put('/api/branch-api/inventory/stock/TEST_PROD_001')
        .set(createBranchAuthHeaders())
        .send(adjustmentData)
        .expect(200);

      // Check if movement was recorded
      const movementsResponse = await request(app)
        .get('/api/branch-api/inventory/movements?product_id=TEST_PROD_001&movement_type=adjustment')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(movementsResponse.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/branch-api/inventory/bulk-movements', () => {
    test('should process bulk movements', async () => {
      const bulkMovements = {
        movements: [
          createMockStockMovement({
            product_id: 'TEST_PROD_001',
            movement_type: 'adjustment',
            quantity_change: 5
          })
        ]
      };

      const response = await request(app)
        .post('/api/branch-api/inventory/bulk-movements')
        .set(createBranchAuthHeaders())
        .send(bulkMovements)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.processed_count).toBe(1);
      expect(response.body.data.failed_count).toBe(0);
    });

    test('should validate bulk movements data', async () => {
      const invalidBulkMovements = {
        movements: [
          {
            // Missing required fields
            quantity_change: 10
          }
        ]
      };

      const response = await request(app)
        .post('/api/branch-api/inventory/bulk-movements')
        .set(createBranchAuthHeaders())
        .send(invalidBulkMovements)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should handle partial failures in bulk operations', async () => {
      const bulkMovements = {
        movements: [
          createMockStockMovement({
            product_id: 'TEST_PROD_001',
            movement_type: 'adjustment',
            quantity_change: 5
          }),
          createMockStockMovement({
            product_id: 'NON_EXISTENT_PRODUCT',
            movement_type: 'adjustment',
            quantity_change: 5
          })
        ]
      };

      const response = await request(app)
        .post('/api/branch-api/inventory/bulk-movements')
        .set(createBranchAuthHeaders())
        .send(bulkMovements)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.processed_count).toBe(1);
      expect(response.body.data.failed_count).toBe(1);
      expect(response.body.data.errors.length).toBe(1);
    });
  });

  describe('GET /api/branch-api/inventory/summary', () => {
    test('should get inventory summary', async () => {
      const response = await request(app)
        .get('/api/branch-api/inventory/summary')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total_products');
      expect(response.body.data).toHaveProperty('total_value');
      expect(response.body.data).toHaveProperty('low_stock_count');
      expect(response.body.data).toHaveProperty('out_of_stock_count');
    });

    test('should include category breakdown', async () => {
      const response = await request(app)
        .get('/api/branch-api/inventory/summary?include_categories=true')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('by_category');
      expect(Array.isArray(response.body.data.by_category)).toBe(true);
    });
  });

  describe('POST /api/branch-api/inventory/transfer-request', () => {
    test('should create transfer request', async () => {
      const transferRequest = {
        to_branch_id: 'other-branch-id',
        items: [
          {
            product_id: 'TEST_PROD_001',
            quantity_requested: 10,
            urgency: 'medium',
            notes: 'Need for promotion'
          }
        ],
        notes: 'Inter-branch transfer for stock balancing'
      };

      const response = await request(app)
        .post('/api/branch-api/inventory/transfer-request')
        .set(createBranchAuthHeaders())
        .send(transferRequest)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('transfer_id');
      expect(response.body.data.status).toBe('pending');
    });

    test('should validate transfer request data', async () => {
      const invalidTransfer = {
        // Missing required to_branch_id
        items: [
          {
            product_id: 'TEST_PROD_001',
            quantity_requested: 10
          }
        ]
      };

      const response = await request(app)
        .post('/api/branch-api/inventory/transfer-request')
        .set(createBranchAuthHeaders())
        .send(invalidTransfer)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
