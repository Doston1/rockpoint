import { Express } from 'express';
import request from 'supertest';
import { DatabaseManager } from '../../src/database/manager';
import { createAuthHeaders, createMockBranch, createMockEmployee, createMockProduct, createTestApp } from '../helpers/testApp';

let app: Express;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  // Clean up all tables before each test
  await DatabaseManager.query('DELETE FROM employees');
  await DatabaseManager.query('DELETE FROM products');
  await DatabaseManager.query('DELETE FROM categories');
  await DatabaseManager.query('DELETE FROM branches');
  await DatabaseManager.query('DELETE FROM onec_sync_logs');
});

describe('1C API - End-to-End Integration Tests', () => {
  describe('Complete Workflow: Branches → Categories → Products → Employees', () => {
    test('should handle complete business setup workflow', async () => {
      // Step 1: Create branch
      const branch = createMockBranch({
        code: 'STORE_001',
        name: 'Main Store',
        onec_id: '1C_BRANCH_001'
      });

      let response = await request(app)
        .post('/api/1c/branches')
        .set(createAuthHeaders())
        .send([branch])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(1);

      // Step 2: Create categories
      const categories = [
        {
          key: 'ELECTRONICS',
          name: 'Electronics',
          name_ru: 'Электроника',
          name_uz: 'Elektronika',
          is_active: true,
          onec_id: '1C_CAT_ELECTRONICS'
        },
        {
          key: 'MOBILE_PHONES',
          name: 'Mobile Phones',
          parent_key: 'ELECTRONICS',
          is_active: true,
          onec_id: '1C_CAT_MOBILE'
        }
      ];

      response = await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send(categories)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(2);

      // Step 3: Create products
      const products = [
        createMockProduct({
          oneC_id: '1C_PROD_IPHONE',
          sku: 'IPHONE_15_PRO',
          barcode: '1234567890123',
          name: 'iPhone 15 Pro',
          category_key: 'MOBILE_PHONES',
          base_price: 15000000, // 15M UZS
          cost: 12000000
        }),
        createMockProduct({
          oneC_id: '1C_PROD_SAMSUNG',
          sku: 'SAMSUNG_S24',
          barcode: '2345678901234',
          name: 'Samsung Galaxy S24',
          category_key: 'MOBILE_PHONES',
          base_price: 12000000,
          cost: 9000000
        })
      ];

      response = await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send(products)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(2);

      // Step 4: Create employees
      const employees = [
        {
          ...createMockEmployee({
            employee_id: 'MGR_001',
            name: 'John Manager',
            role: 'manager'
          }),
          branch_code: branch.code
        },
        {
          ...createMockEmployee({
            employee_id: 'CASH_001',
            name: 'Jane Cashier',
            role: 'cashier'
          }),
          branch_code: branch.code
        }
      ];

      response = await request(app)
        .post('/api/1c/employees')
        .set(createAuthHeaders())
        .send(employees)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(2);

      // Step 5: Verify complete setup by querying all data
      
      // Check branch with employees
      response = await request(app)
        .get(`/api/1c/branches/${branch.code}?include_employees=true`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.branch.employees).toHaveLength(2);

      // Check category hierarchy
      response = await request(app)
        .get('/api/1c/categories/ELECTRONICS?include_subcategories=true')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.category.subcategories).toHaveLength(1);
      expect(response.body.data.category.subcategories[0].key).toBe('MOBILE_PHONES');

      // Check products in category
      response = await request(app)
        .get('/api/1c/products?category_key=MOBILE_PHONES')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(2);
    });
  });

  describe('Bulk Operations and Performance', () => {
    test('should handle large batch of products efficiently', async () => {
      // Create category first
      const category = {
        key: 'BULK_CATEGORY',
        name: 'Bulk Test Category',
        is_active: true
      };

      await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([category])
        .expect(200);

      // Create 100 products
      const products: any[] = [];
      for (let i = 1; i <= 100; i++) {
        products.push(createMockProduct({
          oneC_id: `BULK_PROD_${i.toString().padStart(3, '0')}`,
          sku: `BULK_SKU_${i.toString().padStart(3, '0')}`,
          barcode: `12345678${i.toString().padStart(5, '0')}`,
          name: `Bulk Product ${i}`,
          category_key: 'BULK_CATEGORY',
          base_price: 1000 * i,
          cost: 600 * i
        }));
      }

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send(products)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(100);
      expect(response.body.data.failed).toBe(0);
      
      // Should complete in reasonable time (less than 30 seconds)
      expect(duration).toBeLessThan(30000);

      // Verify all products were created
      const verifyResponse = await request(app)
        .get('/api/1c/products?category_key=BULK_CATEGORY&limit=100')
        .set(createAuthHeaders())
        .expect(200);

      expect(verifyResponse.body.data.products).toHaveLength(100);
    });

    test('should handle mixed success/failure scenarios', async () => {
      const mixedData = [
        // Valid product
        createMockProduct({
          oneC_id: 'VALID_PROD_001',
          sku: 'VALID_SKU_001',
          name: 'Valid Product'
        }),
        // Invalid product (missing required fields)
        {
          name: 'Invalid Product'
          // Missing oneC_id, sku, base_price, cost
        },
        // Another valid product
        createMockProduct({
          oneC_id: 'VALID_PROD_002',
          sku: 'VALID_SKU_002',
          name: 'Another Valid Product'
        })
      ];

      const response = await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send(mixedData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(2);
      expect(response.body.data.failed).toBe(1);
      expect(response.body.data.results).toHaveLength(3);
      expect(response.body.data.results[0].success).toBe(true);
      expect(response.body.data.results[1].success).toBe(false);
      expect(response.body.data.results[2].success).toBe(true);
    });
  });

  describe('Data Consistency and Relationships', () => {
    test('should maintain referential integrity across entities', async () => {
      // Create branch
      const branch = createMockBranch();
      await request(app)
        .post('/api/1c/branches')
        .set(createAuthHeaders())
        .send([branch])
        .expect(200);

      // Create category
      const category = {
        key: 'TEST_CATEGORY',
        name: 'Test Category',
        is_active: true
      };
      await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([category])
        .expect(200);

      // Create product with category reference
      const product = createMockProduct({
        category_key: 'TEST_CATEGORY'
      });
      await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([product])
        .expect(200);

      // Create employee with branch reference
      const employee = {
        ...createMockEmployee(),
        branch_code: branch.code
      };
      await request(app)
        .post('/api/1c/employees')
        .set(createAuthHeaders())
        .send([employee])
        .expect(200);

      // Verify relationships are maintained
      const productResponse = await request(app)
        .get(`/api/1c/products/${product.oneC_id}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(productResponse.body.data.product.category_key).toBe('TEST_CATEGORY');

      const employeeResponse = await request(app)
        .get(`/api/1c/employees/${employee.employee_id}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(employeeResponse.body.data.employee.branch_code).toBe(branch.code);
    });

    test('should handle cascade updates correctly', async () => {
      // Create category and product
      const category = {
        key: 'UPDATE_CATEGORY',
        name: 'Original Category Name',
        is_active: true
      };
      await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([category])
        .expect(200);

      const product = createMockProduct({
        category_key: 'UPDATE_CATEGORY'
      });
      await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([product])
        .expect(200);

      // Update category
      await request(app)
        .put('/api/1c/categories/UPDATE_CATEGORY')
        .set(createAuthHeaders())
        .send({ name: 'Updated Category Name' })
        .expect(200);

      // Verify product still references correct category
      const productResponse = await request(app)
        .get(`/api/1c/products/${product.oneC_id}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(productResponse.body.data.product.category_key).toBe('UPDATE_CATEGORY');
      expect(productResponse.body.data.product.category_name).toBe('Updated Category Name');
    });
  });

  describe('Price Management Integration', () => {
    test('should handle price updates across multiple products', async () => {
      // Create products
      const products = [
        createMockProduct({
          oneC_id: 'PRICE_PROD_001',
          sku: 'PRICE_SKU_001',
          barcode: '1111111111111',
          base_price: 100000,
          cost: 60000
        }),
        createMockProduct({
          oneC_id: 'PRICE_PROD_002',
          sku: 'PRICE_SKU_002',
          barcode: '2222222222222',
          base_price: 200000,
          cost: 120000
        })
      ];

      await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send(products)
        .expect(200);

      // Update prices
      const priceUpdates = {
        updates: [
          {
            barcode: '1111111111111',
            base_price: 150000,
            cost: 90000
          },
          {
            barcode: '2222222222222',
            base_price: 250000,
            cost: 150000
          }
        ]
      };

      const response = await request(app)
        .put('/api/1c/products/prices')
        .set(createAuthHeaders())
        .send(priceUpdates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated).toBe(2);
      expect(response.body.data.failed).toBe(0);

      // Verify price updates
      const product1Response = await request(app)
        .get('/api/1c/products/1111111111111')
        .set(createAuthHeaders())
        .expect(200);

      expect(parseFloat(product1Response.body.data.product.base_price)).toBe(150000);
      expect(parseFloat(product1Response.body.data.product.cost)).toBe(90000);
    });
  });

  describe('Error Recovery and Rollback', () => {
    test('should rollback transaction on critical errors', async () => {
      // This test simulates a scenario where a batch operation partially fails
      // and needs to rollback to maintain data consistency

      const validProduct = createMockProduct({
        oneC_id: 'ROLLBACK_VALID',
        sku: 'ROLLBACK_VALID_SKU'
      });

      const duplicateProduct = createMockProduct({
        oneC_id: 'ROLLBACK_VALID', // Same oneC_id as valid product - should cause conflict
        sku: 'ROLLBACK_DUPLICATE_SKU'
      });

      // First, create the valid product
      await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([validProduct])
        .expect(200);

      // Now try to create a batch that includes a duplicate
      const response = await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([duplicateProduct])
        .expect(200);

      // Should handle the conflict gracefully
      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(0);
      expect(response.body.data.failed).toBe(1);

      // Verify original product is still intact
      const verifyResponse = await request(app)
        .get('/api/1c/products/ROLLBACK_VALID')
        .set(createAuthHeaders())
        .expect(200);

      expect(verifyResponse.body.data.product.sku).toBe('ROLLBACK_VALID_SKU');
    });
  });

  describe('Sync Logging Integration', () => {
    test('should create sync logs for all operations', async () => {
      // Create some data that should generate sync logs
      const branch = createMockBranch();
      const category = { key: 'SYNC_CAT', name: 'Sync Category', is_active: true };
      const product = createMockProduct({ category_key: 'SYNC_CAT' });

      // Each operation should create a sync log
      await request(app)
        .post('/api/1c/branches')
        .set(createAuthHeaders())
        .send([branch])
        .expect(200);

      await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([category])
        .expect(200);

      await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([product])
        .expect(200);

      // Check sync logs were created
      const syncLogsResponse = await request(app)
        .get('/api/1c/sync-logs')
        .set(createAuthHeaders())
        .expect(200);

      expect(syncLogsResponse.body.success).toBe(true);
      expect(syncLogsResponse.body.data.sync_logs.length).toBeGreaterThanOrEqual(3);

      // Verify sync log types
      const syncTypes = syncLogsResponse.body.data.sync_logs.map((log: any) => log.sync_type);
      expect(syncTypes).toContain('branches');
      expect(syncTypes).toContain('categories');
      expect(syncTypes).toContain('products');
    });
  });

  describe('Multi-language Support', () => {
    test('should handle multi-language content correctly', async () => {
      const multiLangCategory = {
        key: 'MULTILANG_CAT',
        name: 'Electronics',
        name_ru: 'Электроника',
        name_uz: 'Elektronika',
        description: 'Electronic devices and accessories',
        is_active: true
      };

      const multiLangProduct = createMockProduct({
        oneC_id: 'MULTILANG_PROD',
        name: 'Smartphone',
        name_ru: 'Смартфон',
        name_uz: 'Aqlli telefon',
        description: 'Modern smartphone with advanced features',
        description_ru: 'Современный смартфон с передовыми функциями',
        description_uz: 'Zamonaviy imkoniyatlarga ega aqlli telefon',
        category_key: 'MULTILANG_CAT'
      });

      // Create category
      await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([multiLangCategory])
        .expect(200);

      // Create product
      await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([multiLangProduct])
        .expect(200);

      // Verify multi-language data was stored correctly
      const categoryResponse = await request(app)
        .get('/api/1c/categories/MULTILANG_CAT')
        .set(createAuthHeaders())
        .expect(200);

      expect(categoryResponse.body.data.category.name).toBe('Electronics');
      expect(categoryResponse.body.data.category.name_ru).toBe('Электроника');
      expect(categoryResponse.body.data.category.name_uz).toBe('Elektronika');

      const productResponse = await request(app)
        .get('/api/1c/products/MULTILANG_PROD')
        .set(createAuthHeaders())
        .expect(200);

      expect(productResponse.body.data.product.name_ru).toBe('Смартфон');
      expect(productResponse.body.data.product.name_uz).toBe('Aqlli telefon');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle concurrent requests efficiently', async () => {
      const concurrentRequests: Promise<any>[] = [];

      // Create 10 concurrent branch creation requests
      for (let i = 1; i <= 10; i++) {
        const branch = createMockBranch({
          code: `CONCURRENT_BR_${i.toString().padStart(2, '0')}`,
          name: `Concurrent Branch ${i}`,
          onec_id: `CONC_1C_${i}`
        });

        concurrentRequests.push(
          request(app)
            .post('/api/1c/branches')
            .set(createAuthHeaders())
            .send([branch])
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach((response: any) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // Less than 10 seconds

      // Verify all branches were created
      const verifyResponse = await request(app)
        .get('/api/1c/branches?search=Concurrent')
        .set(createAuthHeaders())
        .expect(200);

      expect(verifyResponse.body.data.branches).toHaveLength(10);
    });
  });

  describe('Data Validation and Sanitization', () => {
    test('should properly validate and sanitize input data', async () => {
      const productWithSpecialChars = createMockProduct({
        oneC_id: 'SPECIAL_CHARS_PROD',
        name: 'Product with "quotes" & <tags> and émojis 🎉',
        description: 'Description with <script>alert("xss")</script> attempts',
        attributes: {
          'special key!': 'special value @#$%',
          'unicode': 'Тест юникод ўзбек'
        }
      });

      const response = await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([productWithSpecialChars])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(1);

      // Verify data was stored safely
      const productResponse = await request(app)
        .get('/api/1c/products/SPECIAL_CHARS_PROD')
        .set(createAuthHeaders())
        .expect(200);

      expect(productResponse.body.data.product.name).toContain('quotes');
      expect(productResponse.body.data.product.name).toContain('🎉');
      expect(productResponse.body.data.product.attributes['unicode']).toBe('Тест юникод ўзбек');
    });
  });
});
