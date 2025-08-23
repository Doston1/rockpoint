import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { authenticateApiKey, requirePermission } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// Validation schemas
const categorySchema = z.object({
  key: z.string().min(1, 'Category key is required'),
  name: z.string().min(1, 'Category name is required'),
  name_ru: z.string().optional(),
  name_uz: z.string().optional(),
  description: z.string().optional(),
  description_ru: z.string().optional(),
  description_uz: z.string().optional(),
  parent_key: z.string().optional(),
  onec_id: z.string().optional(),
  sort_order: z.number().default(0),
  is_active: z.boolean().default(true)
});

const updateCategorySchema = categorySchema.partial();

// ============================================================================
// CATEGORY MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/1c/categories - Get all categories
router.get('/', requirePermission('products:read'), asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 100, parent_key, is_active, search, include_hierarchy } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      c.id, c.key, c.name, c.name_ru, c.name_uz,
      c.description, c.description_ru, c.description_uz,
      c.onec_id, c.sort_order, c.is_active,
      c.created_at, c.updated_at,
      pc.key as parent_key, pc.name as parent_name,
      COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN categories pc ON c.parent_id = pc.id
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (parent_key) {
    if (parent_key === 'null') {
      query += ` AND c.parent_id IS NULL`;
    } else {
      params.push(parent_key);
      query += ` AND pc.key = $${params.length}`;
    }
  }
  
  if (is_active !== undefined) {
    params.push(is_active === 'true');
    query += ` AND c.is_active = $${params.length}`;
  }
  
  if (search) {
    params.push(`%${search}%`);
    query += ` AND (c.name ILIKE $${params.length} OR c.key ILIKE $${params.length})`;
  }
  
  query += ` GROUP BY c.id, c.key, c.name, c.name_ru, c.name_uz, c.description, c.description_ru, c.description_uz, c.onec_id, c.sort_order, c.is_active, c.created_at, c.updated_at, pc.key, pc.name`;
  
  // Get total count for pagination
  const countQuery = `
    SELECT COUNT(DISTINCT c.id) 
    FROM categories c
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE 1=1
  ` + (params.length > 0 ? query.substring(query.indexOf('WHERE 1=1') + 9).split('GROUP BY')[0] : '');
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.count || '0');
  
  // Add ordering and pagination
  query += ` ORDER BY c.sort_order ASC, c.name ASC`;
  
  if (include_hierarchy !== 'true') {
    params.push(Number(limit), offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }
  
  const result = await DatabaseManager.query(query, params);
  
  let categories = result.rows;
  
  // Build hierarchy if requested
  if (include_hierarchy === 'true') {
    categories = buildCategoryHierarchy(categories);
  }
  
  res.json({
    success: true,
    data: {
      categories,
      pagination: include_hierarchy === 'true' ? null : {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// GET /api/1c/categories/:key - Get specific category
router.get('/:key', requirePermission('products:read'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { include_children, include_products } = req.query;
  
  const query = `
    SELECT 
      c.id, c.key, c.name, c.name_ru, c.name_uz,
      c.description, c.description_ru, c.description_uz,
      c.onec_id, c.sort_order, c.is_active,
      c.created_at, c.updated_at,
      pc.key as parent_key, pc.name as parent_name,
      COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN categories pc ON c.parent_id = pc.id
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
    WHERE c.key = $1
    GROUP BY c.id, pc.key, pc.name
  `;
  
  const result = await DatabaseManager.query(query, [key]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Category not found'
    });
  }
  
  const category = result.rows[0];
  
  // Include children if requested
  if (include_children === 'true') {
    const childrenResult = await DatabaseManager.query(`
      SELECT 
        c.id, c.key, c.name, c.name_ru, c.name_uz,
        c.description, c.description_ru, c.description_uz,
        c.onec_id, c.sort_order, c.is_active,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
      WHERE c.parent_id = $1
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `, [category.id]);
    
    category.children = childrenResult.rows;
  }
  
  // Include products if requested
  if (include_products === 'true') {
    const productsResult = await DatabaseManager.query(`
      SELECT 
        id, sku, barcode, name, name_ru, name_uz,
        brand, base_price, cost, is_active
      FROM products
      WHERE category_id = $1
      ORDER BY name ASC
    `, [category.id]);
    
    category.products = productsResult.rows;
  }
  
  res.json({
    success: true,
    data: {
      category
    }
  });
}));

// POST /api/1c/categories - Create categories
router.post('/', requirePermission('products:write'), asyncHandler(async (req: Request, res: Response) => {
  const categories = z.array(categorySchema).parse(req.body);
  
  const syncId = await createSyncLog('categories', 'import', categories.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const categoryData of categories) {
      try {
        // Find parent category if specified
        let parentId = null;
        if (categoryData.parent_key) {
          const parentResult = await DatabaseManager.query(
            'SELECT id FROM categories WHERE key = $1',
            [categoryData.parent_key]
          );
          
          if (parentResult.rows.length === 0) {
            throw new Error(`Parent category with key "${categoryData.parent_key}" not found`);
          }
          
          parentId = parentResult.rows[0].id;
        }
        
        // Check if category exists
        const existingResult = await DatabaseManager.query(
          'SELECT id FROM categories WHERE key = $1 OR onec_id = $2',
          [categoryData.key, categoryData.onec_id || null]
        );
        
        let categoryId;
        if (existingResult.rows.length > 0) {
          // Update existing category
          categoryId = existingResult.rows[0].id;
          await DatabaseManager.query(`
            UPDATE categories SET
              key = $1, name = $2, name_ru = $3, name_uz = $4,
              description = $5, description_ru = $6, description_uz = $7,
              parent_id = $8, onec_id = $9, sort_order = $10,
              is_active = $11, updated_at = NOW()
            WHERE id = $12
          `, [
            categoryData.key, categoryData.name, categoryData.name_ru, categoryData.name_uz,
            categoryData.description, categoryData.description_ru, categoryData.description_uz,
            parentId, categoryData.onec_id, categoryData.sort_order, categoryData.is_active,
            categoryId
          ]);
        } else {
          // Create new category
          const insertResult = await DatabaseManager.query(`
            INSERT INTO categories (
              key, name, name_ru, name_uz, description, description_ru, description_uz,
              parent_id, onec_id, sort_order, is_active, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
            ) RETURNING id
          `, [
            categoryData.key, categoryData.name, categoryData.name_ru, categoryData.name_uz,
            categoryData.description, categoryData.description_ru, categoryData.description_uz,
            parentId, categoryData.onec_id, categoryData.sort_order, categoryData.is_active
          ]);
          categoryId = insertResult.rows[0].id;
        }
        
        results.push({
          key: categoryData.key,
          onec_id: categoryData.onec_id,
          success: true,
          action: existingResult.rows.length > 0 ? 'updated' : 'created',
          category_id: categoryId
        });
        
      } catch (error) {
        results.push({
          key: categoryData.key,
          onec_id: categoryData.onec_id,
          success: false,
          error: (error as Error).message
        });
      }
    }
    
    await DatabaseManager.query('COMMIT');
    await completeSyncLog(syncId, 'completed', results.filter(r => r.success).length);
    
    res.json({
      success: true,
      data: {
        sync_id: syncId,
        results,
        imported: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    await completeSyncLog(syncId, 'failed', 0, (error as Error).message);
    throw error;
  }
}));

// PUT /api/1c/categories/:key - Update specific category
router.put('/:key', requirePermission('products:write'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const categoryData = updateCategorySchema.parse(req.body);
  
  // Find category
  const categoryResult = await DatabaseManager.query(
    'SELECT id FROM categories WHERE key = $1',
    [key]
  );
  
  if (categoryResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Category not found'
    });
  }
  
  const categoryId = categoryResult.rows[0].id;
  
  // Handle parent category
  let parentId = null;
  if (categoryData.parent_key) {
    const parentResult = await DatabaseManager.query(
      'SELECT id FROM categories WHERE key = $1',
      [categoryData.parent_key]
    );
    
    if (parentResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: `Parent category with key "${categoryData.parent_key}" not found`
      });
    }
    
    parentId = parentResult.rows[0].id;
    
    // Check for circular reference
    if (await hasCircularReference(categoryId, parentId)) {
      return res.status(400).json({
        success: false,
        error: 'Circular reference detected: category cannot be its own parent'
      });
    }
  }
  
  // Update category
  await DatabaseManager.query(`
    UPDATE categories SET
      key = COALESCE($1, key),
      name = COALESCE($2, name),
      name_ru = COALESCE($3, name_ru),
      name_uz = COALESCE($4, name_uz),
      description = COALESCE($5, description),
      description_ru = COALESCE($6, description_ru),
      description_uz = COALESCE($7, description_uz),
      parent_id = COALESCE($8, parent_id),
      onec_id = COALESCE($9, onec_id),
      sort_order = COALESCE($10, sort_order),
      is_active = COALESCE($11, is_active),
      updated_at = NOW()
    WHERE id = $12
  `, [
    categoryData.key, categoryData.name, categoryData.name_ru, categoryData.name_uz,
    categoryData.description, categoryData.description_ru, categoryData.description_uz,
    parentId, categoryData.onec_id, categoryData.sort_order, categoryData.is_active,
    categoryId
  ]);
  
  res.json({
    success: true,
    data: {
      message: 'Category updated successfully',
      category_id: categoryId
    }
  });
}));

// DELETE /api/1c/categories/:key - Deactivate category
router.delete('/:key', requirePermission('products:write'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { force } = req.query;
  
  // Check if category has products
  const productCountResult = await DatabaseManager.query(
    'SELECT COUNT(*) as count FROM products WHERE category_id = (SELECT id FROM categories WHERE key = $1) AND is_active = true',
    [key]
  );
  
  const productCount = parseInt(productCountResult.rows[0].count);
  
  if (productCount > 0 && force !== 'true') {
    return res.status(400).json({
      success: false,
      error: `Category has ${productCount} active products. Use force=true to deactivate anyway.`,
      product_count: productCount
    });
  }
  
  // Check if category has child categories
  const childCountResult = await DatabaseManager.query(
    'SELECT COUNT(*) as count FROM categories WHERE parent_id = (SELECT id FROM categories WHERE key = $1) AND is_active = true',
    [key]
  );
  
  const childCount = parseInt(childCountResult.rows[0].count);
  
  if (childCount > 0 && force !== 'true') {
    return res.status(400).json({
      success: false,
      error: `Category has ${childCount} active child categories. Use force=true to deactivate anyway.`,
      child_count: childCount
    });
  }
  
  const result = await DatabaseManager.query(`
    UPDATE categories 
    SET is_active = false, updated_at = NOW()
    WHERE key = $1
    RETURNING id, name
  `, [key]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Category not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      message: `Category "${result.rows[0].name}" has been deactivated`,
      category_id: result.rows[0].id,
      products_affected: productCount,
      children_affected: childCount
    }
  });
}));

// POST /api/1c/categories/reorder - Reorder categories
router.post('/reorder', requirePermission('products:write'), asyncHandler(async (req: Request, res: Response) => {
  const { categories } = z.object({
    categories: z.array(z.object({
      key: z.string(),
      sort_order: z.number()
    }))
  }).parse(req.body);
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const category of categories) {
      await DatabaseManager.query(
        'UPDATE categories SET sort_order = $1, updated_at = NOW() WHERE key = $2',
        [category.sort_order, category.key]
      );
    }
    
    await DatabaseManager.query('COMMIT');
    
    res.json({
      success: true,
      data: {
        message: 'Categories reordered successfully',
        updated_count: categories.length
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    throw error;
  }
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildCategoryHierarchy(categories: any[]): any[] {
  const categoryMap = new Map<string, any>();
  const rootCategories: string[] = [];
  
  // First pass: create map and identify root categories
  categories.forEach(cat => {
    categoryMap.set(cat.id, { ...cat, children: [] });
    if (!cat.parent_key) {
      rootCategories.push(cat.id);
    }
  });
  
  // Second pass: build hierarchy
  categories.forEach(cat => {
    if (cat.parent_key) {
      const parent = categories.find(p => p.key === cat.parent_key);
      if (parent && categoryMap.has(parent.id)) {
        categoryMap.get(parent.id).children.push(categoryMap.get(cat.id));
      }
    }
  });
  
  return rootCategories.map(id => categoryMap.get(id));
}

async function hasCircularReference(categoryId: string, parentId: string): Promise<boolean> {
  let currentParentId = parentId;
  const visited = new Set();
  
  while (currentParentId) {
    if (currentParentId === categoryId) {
      return true; // Circular reference found
    }
    
    if (visited.has(currentParentId)) {
      break; // Avoid infinite loop
    }
    
    visited.add(currentParentId);
    
    const result = await DatabaseManager.query(
      'SELECT parent_id FROM categories WHERE id = $1',
      [currentParentId]
    );
    
    currentParentId = result.rows[0]?.parent_id;
  }
  
  return false;
}

async function createSyncLog(syncType: string, direction: string, totalRecords: number): Promise<string> {
  const result = await DatabaseManager.query(`
    INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
    VALUES ($1, $2, 'in_progress', $3, NOW())
    RETURNING id
  `, [syncType, direction, totalRecords]);
  
  return result.rows[0].id;
}

async function completeSyncLog(
  syncId: string, 
  status: string, 
  recordsProcessed: number, 
  errorMessage?: string
): Promise<void> {
  await DatabaseManager.query(`
    UPDATE onec_sync_logs 
    SET status = $1, records_processed = $2, error_message = $3, completed_at = NOW()
    WHERE id = $4
  `, [status, recordsProcessed, errorMessage, syncId]);
}

export default router;
