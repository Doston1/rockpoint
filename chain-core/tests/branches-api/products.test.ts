import { Express } from 'express';
import request from 'supertest';
import { cleanupTestBranchData, createBranchAuthHeaders, createBranchTestApp, setupTestBranchData } from '../helpers/branchTestApp';

let app: Express;
let testData: any;

beforeAll(async () => {
  app = await createBranchTestApp();
  testData = await setupTestBranchData();
});

afterAll(async () => {
  await cleanupTestBranchData();
});

describe('Branch Products API', () => {
  describe('GET /api/branch-api/products/search', () => {
    test('should search products by name', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/search?query=Test Product')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].name).toContain('Test Product');
    });

    test('should search products by SKU', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/search?query=TST-001')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].sku).toBe('TST-001');
    });

    test('should search products by barcode', async () => {
      // First update the test product with a barcode
      const { DatabaseManager } = require('../../src/database/manager');
      await DatabaseManager.query(`
        UPDATE products SET barcode = '1234567890123' WHERE sku = 'TST-001'
      `);

      const response = await request(app)
        .get('/api/branch-api/products/search?query=1234567890123')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should filter products by category', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/search?category=TEST_CAT')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should return empty array for no matches', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/search?query=NonExistentProduct')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0);
    });

    test('should limit search results', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/search?query=Test&limit=1')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /api/branch-api/products/:productId', () => {
    test('should get product details by ID', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/TEST_PROD_001')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.onec_id).toBe('TEST_PROD_001');
      expect(response.body.data).toHaveProperty('stock_info');
    });

    test('should return not found for non-existent product', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/NON_EXISTENT')
        .set(createBranchAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('PRODUCT_NOT_FOUND');
    });

    test('should include branch-specific pricing and stock', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/TEST_PROD_001')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stock_info).toHaveProperty('quantity_in_stock');
      expect(response.body.data.pricing).toHaveProperty('branch_price');
    });
  });

  describe('GET /api/branch-api/products/stock/cross-branch', () => {
    test('should search stock across all branches', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/stock/cross-branch?product_id=TEST_PROD_001')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('should require product_id parameter', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/stock/cross-branch')
        .set(createBranchAuthHeaders())
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should filter by minimum stock level', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/stock/cross-branch?product_id=TEST_PROD_001&min_stock=10')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/branch-api/products/pricing/update', () => {
    test('should update product pricing for branch', async () => {
      const pricingUpdate = {
        product_id: 'TEST_PROD_001',
        price: 120000.00,
        cost: 70000.00,
        effective_from: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/branch-api/products/pricing/update')
        .set(createBranchAuthHeaders())
        .send(pricingUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product_id).toBe('TEST_PROD_001');
      expect(response.body.data.price).toBe(120000.00);
    });

    test('should validate pricing update data', async () => {
      const invalidPricing = {
        // Missing required product_id
        price: 100000
      };

      const response = await request(app)
        .post('/api/branch-api/products/pricing/update')
        .set(createBranchAuthHeaders())
        .send(invalidPricing)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should handle negative prices', async () => {
      const invalidPricing = {
        product_id: 'TEST_PROD_001',
        price: -100000 // Negative price
      };

      const response = await request(app)
        .post('/api/branch-api/products/pricing/update')
        .set(createBranchAuthHeaders())
        .send(invalidPricing)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/branch-api/products/pricing/bulk-update', () => {
    test('should bulk update product pricing', async () => {
      const bulkUpdate = {
        updates: [
          {
            product_id: 'TEST_PROD_001',
            price: 130000.00,
            cost: 75000.00
          }
        ]
      };

      const response = await request(app)
        .post('/api/branch-api/products/pricing/bulk-update')
        .set(createBranchAuthHeaders())
        .send(bulkUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated_count).toBe(1);
      expect(response.body.data.failed_count).toBe(0);
    });

    test('should validate bulk update data', async () => {
      const invalidBulkUpdate = {
        updates: [
          {
            // Missing product_id
            price: 100000
          }
        ]
      };

      const response = await request(app)
        .post('/api/branch-api/products/pricing/bulk-update')
        .set(createBranchAuthHeaders())
        .send(invalidBulkUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/branch-api/products/low-stock', () => {
    test('should get low stock products', async () => {
      // First set a minimum stock level for testing
      const { DatabaseManager } = require('../../src/database/manager');
      await DatabaseManager.query(`
        UPDATE branch_inventory 
        SET min_stock_level = 100, quantity_in_stock = 10 
        WHERE product_id = (SELECT id FROM products WHERE onec_id = 'TEST_PROD_001')
      `);

      const response = await request(app)
        .get('/api/branch-api/products/low-stock')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should filter by urgency level', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/low-stock?urgency=critical')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/branch-api/products/categories', () => {
    test('should get product categories', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/categories')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('should include category hierarchy', async () => {
      const response = await request(app)
        .get('/api/branch-api/products/categories')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((category: any) => {
        expect(category).toHaveProperty('key');
        expect(category).toHaveProperty('name');
      });
    });
  });
});
