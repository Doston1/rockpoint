import { Express } from 'express';
import request from 'supertest';
import { DatabaseManager } from '../../src/database/manager';
import { createAuthHeaders, createMockCategory, createTestApp } from '../helpers/testApp';

let app: Express;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  // Clean up tables with foreign key dependencies in proper order
  await DatabaseManager.query('DELETE FROM products');
  await DatabaseManager.query('DELETE FROM categories');
});

describe('1C API - Categories Management', () => {
  describe('GET /api/1c/categories', () => {
    test('should return empty list when no categories exist', async () => {
      const response = await request(app)
        .get('/api/1c/categories')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    test('should return categories with pagination', async () => {
      // Create categories
      const category1 = createMockCategory({ key: 'CAT001', name: 'Category One' });
      const category2 = createMockCategory({ key: 'CAT002', name: 'Category Two' });

      await DatabaseManager.query(`
        INSERT INTO categories (key, name, name_ru, name_uz, description, is_active, onec_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [category1.key, category1.name, category1.name_ru, category1.name_uz, category1.description, category1.is_active, category1.onec_id]);

      await DatabaseManager.query(`
        INSERT INTO categories (key, name, name_ru, name_uz, description, is_active, onec_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [category2.key, category2.name, category2.name_ru, category2.name_uz, category2.description, category2.is_active, category2.onec_id]);

      const response = await request(app)
        .get('/api/1c/categories')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    test('should filter categories by active status', async () => {
      await DatabaseManager.query(`
        INSERT INTO categories (key, name, is_active) VALUES ($1, $2, $3)
      `, ['ACTIVE', 'Active Category', true]);

      await DatabaseManager.query(`
        INSERT INTO categories (key, name, is_active) VALUES ($1, $2, $3)
      `, ['INACTIVE', 'Inactive Category', false]);

      const response = await request(app)
        .get('/api/1c/categories?is_active=true')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toHaveLength(1);
      expect(response.body.data.categories[0].key).toBe('ACTIVE');
    });

    test('should search categories by name', async () => {
      await DatabaseManager.query(`
        INSERT INTO categories (key, name) VALUES ($1, $2)
      `, ['SEARCH1', 'Electronics']);

      await DatabaseManager.query(`
        INSERT INTO categories (key, name) VALUES ($1, $2)
      `, ['SEARCH2', 'Clothing']);

      const response = await request(app)
        .get('/api/1c/categories?search=Electronics')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toHaveLength(1);
      expect(response.body.data.categories[0].name).toBe('Electronics');
    });

    test('should handle pagination correctly', async () => {
      // Create 3 categories
      for (let i = 1; i <= 3; i++) {
        await DatabaseManager.query(`
          INSERT INTO categories (key, name) VALUES ($1, $2)
        `, [`CAT${i.toString().padStart(3, '0')}`, `Category ${i}`]);
      }

      const response = await request(app)
        .get('/api/1c/categories?page=1&limit=2')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(3);
      expect(response.body.data.pagination.pages).toBe(2);
    });
  });

  describe('GET /api/1c/categories/:key', () => {
    test('should return specific category by key', async () => {
      const category = createMockCategory();

      await DatabaseManager.query(`
        INSERT INTO categories (key, name, name_ru, name_uz, description, is_active, onec_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [category.key, category.name, category.name_ru, category.name_uz, category.description, category.is_active, category.onec_id]);

      const response = await request(app)
        .get(`/api/1c/categories/${category.key}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.category.key).toBe(category.key);
      expect(response.body.data.category.name).toBe(category.name);
      expect(response.body.data.category.name_ru).toBe(category.name_ru);
      expect(response.body.data.category.name_uz).toBe(category.name_uz);
    });

    test('should return 404 for non-existent category', async () => {
      const response = await request(app)
        .get('/api/1c/categories/NON_EXISTENT')
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Category not found');
    });

    test('should include subcategories when requested', async () => {
      // Create parent category
      const parentCategory = createMockCategory({ key: 'PARENT', name: 'Parent Category' });
      const parentResult = await DatabaseManager.query(`
        INSERT INTO categories (key, name, is_active) VALUES ($1, $2, $3) RETURNING id
      `, [parentCategory.key, parentCategory.name, parentCategory.is_active]);
      const parentId = parentResult.rows[0].id;

      // Create subcategory
      await DatabaseManager.query(`
        INSERT INTO categories (key, name, parent_id, is_active)
        VALUES ($1, $2, $3, $4)
      `, ['CHILD', 'Child Category', parentId, true]);

      const response = await request(app)
        .get(`/api/1c/categories/${parentCategory.key}?include_subcategories=true`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.category.subcategories).toBeDefined();
      expect(response.body.data.category.subcategories).toHaveLength(1);
      expect(response.body.data.category.subcategories[0].key).toBe('CHILD');
    });

    test('should include products when requested', async () => {
      const category = createMockCategory();
      
      // Create category
      const categoryResult = await DatabaseManager.query(`
        INSERT INTO categories (key, name, is_active) VALUES ($1, $2, $3) RETURNING id
      `, [category.key, category.name, category.is_active]);
      const categoryId = categoryResult.rows[0].id;

      // Create product in category
      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, name, category_id, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['PROD1', 'SKU1', 'Test Product', categoryId, 100, 60]);

      const response = await request(app)
        .get(`/api/1c/categories/${category.key}?include_products=true`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.category.products).toBeDefined();
      expect(response.body.data.category.products).toHaveLength(1);
      expect(response.body.data.category.products[0].name).toBe('Test Product');
    });
  });

  describe('POST /api/1c/categories', () => {
    test('should create new category successfully', async () => {
      const newCategory = createMockCategory();

      const response = await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([newCategory])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(1);
      expect(response.body.data.failed).toBe(0);
      expect(response.body.data.results[0].success).toBe(true);
      expect(response.body.data.results[0].action).toBe('created');

      // Verify category was created in database
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM categories WHERE key = $1',
        [newCategory.key]
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].name).toBe(newCategory.name);
    });

    test('should update existing category', async () => {
      const category = createMockCategory({ name: 'Original Name' });

      // Create category first
      await DatabaseManager.query(`
        INSERT INTO categories (key, name, onec_id, is_active) VALUES ($1, $2, $3, $4)
      `, [category.key, category.name, category.onec_id, category.is_active]);

      // Update with new data
      const updatedCategory = { ...category, name: 'Updated Name' };

      const response = await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([updatedCategory])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results[0].action).toBe('updated');

      // Verify update in database
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM categories WHERE key = $1',
        [category.key]
      );
      expect(dbResult.rows[0].name).toBe('Updated Name');
    });

    test('should handle hierarchical categories (parent-child)', async () => {
      // First create parent category
      const parentCategory = createMockCategory({ key: 'PARENT', name: 'Parent Category' });

      const parentResponse = await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([parentCategory])
        .expect(200);

      expect(parentResponse.body.success).toBe(true);

      // Then create child category with parent reference
      const childCategory = createMockCategory({ 
        key: 'CHILD', 
        name: 'Child Category',
        parent_key: 'PARENT'
      });

      const childResponse = await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([childCategory])
        .expect(200);

      expect(childResponse.body.success).toBe(true);

      // Verify parent-child relationship
      const dbResult = await DatabaseManager.query(`
        SELECT c.*, p.key as parent_key 
        FROM categories c 
        LEFT JOIN categories p ON c.parent_id = p.id 
        WHERE c.key = $1
      `, ['CHILD']);

      expect(dbResult.rows[0].parent_key).toBe('PARENT');
    });

    test('should handle multiple categories in single request', async () => {
      const category1 = createMockCategory({ key: 'MULTI1', onec_id: 'M1' });
      const category2 = createMockCategory({ key: 'MULTI2', onec_id: 'M2' });

      const response = await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([category1, category2])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(2);
      expect(response.body.data.failed).toBe(0);

      // Verify both categories were created
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM categories WHERE key IN ($1, $2)',
        [category1.key, category2.key]
      );
      expect(dbResult.rows).toHaveLength(2);
    });

    test('should handle validation errors gracefully', async () => {
      const invalidCategory = {
        // Missing required 'key' field
        name: 'Invalid Category'
      };

      const response = await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([invalidCategory])
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle partial success scenarios', async () => {
      const validCategory = createMockCategory({ key: 'VALID' });
      const invalidCategory = { name: 'Invalid' }; // Missing required key

      const response = await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([validCategory, invalidCategory])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(1);
      expect(response.body.data.failed).toBe(1);
      expect(response.body.data.results[0].success).toBe(true);
      expect(response.body.data.results[1].success).toBe(false);
    });
  });

  describe('PUT /api/1c/categories/:key', () => {
    test('should update specific category successfully', async () => {
      const category = createMockCategory();

      // Create category first
      await DatabaseManager.query(`
        INSERT INTO categories (key, name, description) VALUES ($1, $2, $3)
      `, [category.key, category.name, category.description]);

      const updateData = {
        name: 'Updated Category Name',
        description: 'Updated description',
        name_ru: 'Обновленная категория'
      };

      const response = await request(app)
        .put(`/api/1c/categories/${category.key}`)
        .set(createAuthHeaders())
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Category updated successfully');

      // Verify update in database
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM categories WHERE key = $1',
        [category.key]
      );
      expect(dbResult.rows[0].name).toBe('Updated Category Name');
      expect(dbResult.rows[0].description).toBe('Updated description');
      expect(dbResult.rows[0].name_ru).toBe('Обновленная категория');
    });

    test('should return 404 for non-existent category', async () => {
      const response = await request(app)
        .put('/api/1c/categories/NON_EXISTENT')
        .set(createAuthHeaders())
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Category not found');
    });
  });

  describe('DELETE /api/1c/categories/:key', () => {
    test('should deactivate category successfully', async () => {
      const category = createMockCategory();

      // Create category first
      await DatabaseManager.query(`
        INSERT INTO categories (key, name, is_active) VALUES ($1, $2, $3)
      `, [category.key, category.name, true]);

      const response = await request(app)
        .delete(`/api/1c/categories/${category.key}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('has been deactivated');

      // Verify category is deactivated in database
      const dbResult = await DatabaseManager.query(
        'SELECT is_active FROM categories WHERE key = $1',
        [category.key]
      );
      expect(dbResult.rows[0].is_active).toBe(false);
    });

    test('should return 404 for non-existent category', async () => {
      const response = await request(app)
        .delete('/api/1c/categories/NON_EXISTENT')
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Category not found');
    });
  });

  describe('Category hierarchy management', () => {
    test('should handle moving category to different parent', async () => {
      // Create categories
      const parent1 = createMockCategory({ key: 'PARENT1', name: 'Parent 1' });
      const parent2 = createMockCategory({ key: 'PARENT2', name: 'Parent 2' });
      const child = createMockCategory({ key: 'CHILD', name: 'Child Category' });

      // Create parent categories
      const parent1Result = await DatabaseManager.query(`
        INSERT INTO categories (key, name, is_active) VALUES ($1, $2, $3) RETURNING id
      `, [parent1.key, parent1.name, parent1.is_active]);

      const parent2Result = await DatabaseManager.query(`
        INSERT INTO categories (key, name, is_active) VALUES ($1, $2, $3) RETURNING id
      `, [parent2.key, parent2.name, parent2.is_active]);

      // Create child under parent1
      await DatabaseManager.query(`
        INSERT INTO categories (key, name, parent_id, is_active)
        VALUES ($1, $2, $3, $4)
      `, [child.key, child.name, parent1Result.rows[0].id, child.is_active]);

      // Move child to parent2
      const updateData = { parent_key: 'PARENT2' };

      const response = await request(app)
        .put(`/api/1c/categories/${child.key}`)
        .set(createAuthHeaders())
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify new parent relationship
      const dbResult = await DatabaseManager.query(`
        SELECT c.*, p.key as parent_key 
        FROM categories c 
        LEFT JOIN categories p ON c.parent_id = p.id 
        WHERE c.key = $1
      `, [child.key]);

      expect(dbResult.rows[0].parent_key).toBe('PARENT2');
    });

    test('should prevent circular references in hierarchy', async () => {
      // Create parent and child
      const parent = createMockCategory({ key: 'PARENT', name: 'Parent Category' });
      const child = createMockCategory({ key: 'CHILD', name: 'Child Category', parent_key: 'PARENT' });

      await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([parent])
        .expect(200);

      await request(app)
        .post('/api/1c/categories')
        .set(createAuthHeaders())
        .send([child])
        .expect(200);

      // Try to make parent a child of child (circular reference)
      const response = await request(app)
        .put('/api/1c/categories/PARENT')
        .set(createAuthHeaders())
        .send({ parent_key: 'CHILD' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('circular reference');
    });
  });

  describe('Category statistics', () => {
    test('should return category with product count', async () => {
      const category = createMockCategory();
      
      // Create category
      const categoryResult = await DatabaseManager.query(`
        INSERT INTO categories (key, name, is_active) VALUES ($1, $2, $3) RETURNING id
      `, [category.key, category.name, category.is_active]);
      const categoryId = categoryResult.rows[0].id;

      // Create products in category
      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, name, category_id, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['PROD1', 'SKU1', 'Product 1', categoryId, 100, 60]);

      await DatabaseManager.query(`
        INSERT INTO products (oneC_id, sku, name, category_id, base_price, cost)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['PROD2', 'SKU2', 'Product 2', categoryId, 200, 120]);

      const response = await request(app)
        .get(`/api/1c/categories/${category.key}?include_stats=true`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.category.stats).toBeDefined();
      expect(response.body.data.category.stats.product_count).toBe(2);
    });
  });
});
