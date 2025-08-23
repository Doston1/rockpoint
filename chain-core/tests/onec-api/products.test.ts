import { Express } from 'express';
import request from 'supertest';
import { DatabaseManager } from '../../src/database/manager';
import { createAuthHeaders, createMockCategory, createMockProduct, createTestApp } from '../helpers/testApp';

let app: Express;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  // Clean up tables before each test
  await DatabaseManager.query('DELETE FROM products');
  await DatabaseManager.query('DELETE FROM categories');
});

describe('1C API - Products Management', () => {
  describe('GET /api/1c/products', () => {
    test('should return empty list when no products exist', async () => {
      const response = await request(app)
        .get('/api/1c/products')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    test('should return products with pagination', async () => {
      // Create category first
      const category = createMockCategory();
      const categoryResult = await DatabaseManager.query(`
        INSERT INTO categories (key, name, is_active) VALUES ($1, $2, $3) RETURNING id
      `, [category.key, category.name, category.is_active]);
      const categoryId = categoryResult.rows[0].id;

      // Create products
      const product1 = createMockProduct({ oneC_id: 'PROD1', sku: 'SKU1', name: 'Product 1' });
      const product2 = createMockProduct({ oneC_id: 'PROD2', sku: 'SKU2', name: 'Product 2' });

      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, barcode, name, category_id, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [product1.oneC_id, product1.sku, product1.barcode, product1.name, categoryId, product1.base_price, product1.cost]);

      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, barcode, name, category_id, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [product2.oneC_id, product2.sku, product2.barcode, product2.name, categoryId, product2.base_price, product2.cost]);

      const response = await request(app)
        .get('/api/1c/products')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    test('should filter products by category', async () => {
      // Create categories
      const category1 = createMockCategory({ key: 'CAT1', name: 'Category 1' });
      const category2 = createMockCategory({ key: 'CAT2', name: 'Category 2' });

      const cat1Result = await DatabaseManager.query(`
        INSERT INTO categories (key, name, is_active) VALUES ($1, $2, $3) RETURNING id
      `, [category1.key, category1.name, category1.is_active]);

      const cat2Result = await DatabaseManager.query(`
        INSERT INTO categories (key, name, is_active) VALUES ($1, $2, $3) RETURNING id
      `, [category2.key, category2.name, category2.is_active]);

      // Create products in different categories
      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, name, category_id, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['PROD1', 'SKU1', 'Product 1', cat1Result.rows[0].id, 100, 60]);

      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, name, category_id, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['PROD2', 'SKU2', 'Product 2', cat2Result.rows[0].id, 200, 120]);

      const response = await request(app)
        .get('/api/1c/products?category_key=CAT1')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.products[0].name).toBe('Product 1');
    });

    test('should search products by name, SKU, and barcode', async () => {
      const product = createMockProduct({ 
        name: 'Coca Cola',
        sku: 'COKE001',
        barcode: '1234567890123'
      });

      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, barcode, name, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [product.oneC_id, product.sku, product.barcode, product.name, product.base_price, product.cost]);

      // Search by name
      let response = await request(app)
        .get('/api/1c/products?search=Coca')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(1);

      // Search by SKU
      response = await request(app)
        .get('/api/1c/products?search=COKE')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(1);

      // Search by barcode
      response = await request(app)
        .get('/api/1c/products?search=1234567890123')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(1);
    });

    test('should handle pagination parameters', async () => {
      // Create 5 products
      for (let i = 1; i <= 5; i++) {
        await DatabaseManager.query(`
          INSERT INTO products (oneC_id, sku, name, base_price, cost)
          VALUES ($1, $2, $3, $4, $5)
        `, [`PROD${i}`, `SKU${i}`, `Product ${i}`, 100 * i, 60 * i]);
      }

      const response = await request(app)
        .get('/api/1c/products?page=1&limit=3')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(3);
      expect(response.body.data.pagination.total).toBe(5);
      expect(response.body.data.pagination.pages).toBe(2);
    });
  });

  describe('GET /api/1c/products/:id', () => {
    test('should return product by oneC_id', async () => {
      const product = createMockProduct();

      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, barcode, name, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [product.oneC_id, product.sku, product.barcode, product.name, product.base_price, product.cost]);

      const response = await request(app)
        .get(`/api/1c/products/${product.oneC_id}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product.oneC_id).toBe(product.oneC_id);
      expect(response.body.data.product.name).toBe(product.name);
    });

    test('should return product by SKU', async () => {
      const product = createMockProduct();

      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, barcode, name, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [product.oneC_id, product.sku, product.barcode, product.name, product.base_price, product.cost]);

      const response = await request(app)
        .get(`/api/1c/products/${product.sku}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product.sku).toBe(product.sku);
    });

    test('should return product by barcode', async () => {
      const product = createMockProduct();

      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, barcode, name, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [product.oneC_id, product.sku, product.barcode, product.name, product.base_price, product.cost]);

      const response = await request(app)
        .get(`/api/1c/products/${product.barcode}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product.barcode).toBe(product.barcode);
    });

    test('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/1c/products/NON_EXISTENT')
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Product not found');
    });
  });

  describe('POST /api/1c/products', () => {
    test('should create new product successfully', async () => {
      const newProduct = createMockProduct();

      const response = await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([newProduct])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(1);
      expect(response.body.data.failed).toBe(0);
      expect(response.body.data.results[0].success).toBe(true);
      expect(response.body.data.results[0].action).toBe('created');

      // Verify product was created in database
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM products WHERE oneC_id = $1',
        [newProduct.oneC_id]
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].name).toBe(newProduct.name);
      expect(parseFloat(dbResult.rows[0].base_price)).toBe(newProduct.base_price);
    });

    test('should update existing product', async () => {
      const product = createMockProduct({ name: 'Original Name' });

      // Create product first
      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, barcode, name, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [product.oneC_id, product.sku, product.barcode, product.name, product.base_price, product.cost]);

      // Update with new data
      const updatedProduct = { ...product, name: 'Updated Name', base_price: 30000 };

      const response = await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([updatedProduct])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results[0].action).toBe('updated');

      // Verify update in database
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM products WHERE oneC_id = $1',
        [product.oneC_id]
      );
      expect(dbResult.rows[0].name).toBe('Updated Name');
      expect(dbResult.rows[0].base_price).toBe('30000.00');
    });

    test('should auto-create category if not exists', async () => {
      const product = createMockProduct({ category_key: 'NEW_CATEGORY' });

      const response = await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([product])
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify category was created
      const categoryResult = await DatabaseManager.query(
        'SELECT * FROM categories WHERE key = $1',
        ['NEW_CATEGORY']
      );
      expect(categoryResult.rows).toHaveLength(1);
      expect(categoryResult.rows[0].name).toBe('NEW_CATEGORY');

      // Verify product has correct category
      const productResult = await DatabaseManager.query(`
        SELECT p.*, c.key as category_key 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.oneC_id = $1
      `, [product.oneC_id]);
      
      expect(productResult.rows[0].category_key).toBe('NEW_CATEGORY');
    });

    test('should handle multiple products in single request', async () => {
      const product1 = createMockProduct({ oneC_id: 'MULTI1', sku: 'MSKU1', barcode: '1111111111111' });
      const product2 = createMockProduct({ oneC_id: 'MULTI2', sku: 'MSKU2', barcode: '2222222222222' });

      const response = await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([product1, product2])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(2);
      expect(response.body.data.failed).toBe(0);

      // Verify both products were created
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM products WHERE oneC_id IN ($1, $2)',
        [product1.oneC_id, product2.oneC_id]
      );
      expect(dbResult.rows).toHaveLength(2);
    });

    test('should handle validation errors gracefully', async () => {
      const invalidProduct = {
        // Missing required fields
        name: 'Invalid Product'
      };

      const response = await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([invalidProduct])
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle partial success scenarios', async () => {
      const validProduct = createMockProduct({ oneC_id: 'VALID' });
      const invalidProduct = { name: 'Invalid' }; // Missing required fields

      const response = await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([validProduct, invalidProduct])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(1);
      expect(response.body.data.failed).toBe(1);
      expect(response.body.data.results[0].success).toBe(true);
      expect(response.body.data.results[1].success).toBe(false);
    });

    test('should handle complex product attributes', async () => {
      const product = createMockProduct({
        images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
        attributes: { 
          color: 'red',
          size: 'large',
          weight: '500g',
          manufacturer: 'Test Corp'
        }
      });

      const response = await request(app)
        .post('/api/1c/products')
        .set(createAuthHeaders())
        .send([product])
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify complex attributes were stored correctly
      const dbResult = await DatabaseManager.query(
        'SELECT images, attributes FROM products WHERE oneC_id = $1',
        [product.oneC_id]
      );
      
      expect(dbResult.rows[0].images).toEqual(product.images);
      expect(dbResult.rows[0].attributes).toEqual(product.attributes);
    });
  });

  describe('PUT /api/1c/products/prices', () => {
    test('should update product prices by barcode', async () => {
      const product = createMockProduct();

      // Create product
      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, barcode, name, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [product.oneC_id, product.sku, product.barcode, product.name, product.base_price, product.cost]);

      const priceUpdate = {
        updates: [{
          barcode: product.barcode,
          base_price: 35000,
          cost: 20000
        }]
      };

      const response = await request(app)
        .put('/api/1c/products/prices')
        .set(createAuthHeaders())
        .send(priceUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated).toBe(1);
      expect(response.body.data.failed).toBe(0);

      // Verify price update in database
      const dbResult = await DatabaseManager.query(
        'SELECT base_price, cost FROM products WHERE barcode = $1',
        [product.barcode]
      );
      expect(dbResult.rows[0].base_price).toBe('35000.00');
      expect(dbResult.rows[0].cost).toBe('20000.00');
    });

    test('should update product prices by oneC_id', async () => {
      const product = createMockProduct();

      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, name, base_price, cost)
        VALUES ($1, $2, $3, $4, $5)
      `, [product.oneC_id, product.sku, product.name, product.base_price, product.cost]);

      const priceUpdate = {
        updates: [{
          oneC_id: product.oneC_id,
          base_price: 40000
        }]
      };

      const response = await request(app)
        .put('/api/1c/products/prices')
        .set(createAuthHeaders())
        .send(priceUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated).toBe(1);

      // Verify price update
      const dbResult = await DatabaseManager.query(
        'SELECT base_price FROM products WHERE oneC_id = $1',
        [product.oneC_id]
      );
      expect(dbResult.rows[0].base_price).toBe('40000.00');
    });

    test('should update product prices by SKU', async () => {
      const product = createMockProduct();

      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, name, base_price, cost)
        VALUES ($1, $2, $3, $4, $5)
      `, [product.oneC_id, product.sku, product.name, product.base_price, product.cost]);

      const priceUpdate = {
        updates: [{
          sku: product.sku,
          base_price: 45000
        }]
      };

      const response = await request(app)
        .put('/api/1c/products/prices')
        .set(createAuthHeaders())
        .send(priceUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated).toBe(1);
    });

    test('should handle multiple price updates', async () => {
      const product1 = createMockProduct({ oneC_id: 'PRICE1', sku: 'PSKU1', barcode: '1111' });
      const product2 = createMockProduct({ oneC_id: 'PRICE2', sku: 'PSKU2', barcode: '2222' });

      // Create products
      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, barcode, name, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [product1.oneC_id, product1.sku, product1.barcode, product1.name, 100, 60]);

      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, barcode, name, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [product2.oneC_id, product2.sku, product2.barcode, product2.name, 200, 120]);

      const priceUpdate = {
        updates: [
          { barcode: product1.barcode, base_price: 150 },
          { barcode: product2.barcode, base_price: 250 }
        ]
      };

      const response = await request(app)
        .put('/api/1c/products/prices')
        .set(createAuthHeaders())
        .send(priceUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated).toBe(2);
      expect(response.body.data.failed).toBe(0);
    });

    test('should handle price update for non-existent product', async () => {
      const priceUpdate = {
        updates: [{
          barcode: 'NON_EXISTENT_BARCODE',
          base_price: 100
        }]
      };

      const response = await request(app)
        .put('/api/1c/products/prices')
        .set(createAuthHeaders())
        .send(priceUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated).toBe(0);
      expect(response.body.data.failed).toBe(1);
      expect(response.body.data.results[0].success).toBe(false);
      expect(response.body.data.results[0].error).toContain('Product not found');
    });

    test('should validate price update data', async () => {
      const priceUpdate = {
        updates: [{
          // Missing product identifier
          base_price: -100 // Invalid negative price
        }]
      };

      const response = await request(app)
        .put('/api/1c/products/prices')
        .set(createAuthHeaders())
        .send(priceUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/1c/products/:id', () => {
    test('should update specific product by oneC_id', async () => {
      const product = createMockProduct();

      // Create product
      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, barcode, name, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [product.oneC_id, product.sku, product.barcode, product.name, product.base_price, product.cost]);

      const updateData = {
        name: 'Updated Product Name',
        base_price: 35000,
        brand: 'Updated Brand'
      };

      const response = await request(app)
        .put(`/api/1c/products/${product.oneC_id}`)
        .set(createAuthHeaders())
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Product updated successfully');

      // Verify update in database
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM products WHERE oneC_id = $1',
        [product.oneC_id]
      );
      expect(dbResult.rows[0].name).toBe('Updated Product Name');
      expect(dbResult.rows[0].base_price).toBe('35000.00');
      expect(dbResult.rows[0].brand).toBe('Updated Brand');
    });

    test('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .put('/api/1c/products/NON_EXISTENT')
        .set(createAuthHeaders())
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Product not found');
    });
  });

  describe('DELETE /api/1c/products/:id', () => {
    test('should deactivate product successfully', async () => {
      const product = createMockProduct();

      // Create product
      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, barcode, name, base_price, cost, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [product.oneC_id, product.sku, product.barcode, product.name, product.base_price, product.cost, true]);

      const response = await request(app)
        .delete(`/api/1c/products/${product.oneC_id}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('has been deactivated');

      // Verify product is deactivated in database
      const dbResult = await DatabaseManager.query(
        'SELECT is_active FROM products WHERE oneC_id = $1',
        [product.oneC_id]
      );
      expect(dbResult.rows[0].is_active).toBe(false);
    });

    test('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .delete('/api/1c/products/NON_EXISTENT')
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Product not found');
    });
  });
});
