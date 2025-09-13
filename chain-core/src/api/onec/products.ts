import axios from 'axios';
import { Request, Response, Router } from 'express';
import FormData from 'form-data';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { authenticateApiKey, requirePermission } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// Validation schemas
const productSchema = z.object({
  oneC_id: z.string(),
  sku: z.string(),
  barcode: z.string().optional(),
  name: z.string(),
  name_ru: z.string().optional(),
  name_uz: z.string().optional(),
  description: z.string().optional(),
  description_ru: z.string().optional(),
  description_uz: z.string().optional(),
  category_key: z.string().optional(),
  brand: z.string().optional(),
  unit_of_measure: z.string().default('pcs'),
  base_price: z.number().positive(),
  cost: z.number().positive(),
  tax_rate: z.number().min(0).max(1).default(0),
  image_url: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  attributes: z.record(z.any()).optional(),
  is_active: z.boolean().default(true)
});

const priceUpdateSchema = z.object({
  updates: z.array(z.object({
    barcode: z.string().min(1).optional(), // Use barcode as primary identifier but make it optional
    oneC_id: z.string().optional(),
    sku: z.string().optional(),
    base_price: z.number().positive(),
    cost: z.number().positive().optional(),
    branch_codes: z.array(z.string()).optional(), // If empty, applies to all branches
    effective_date: z.string().optional()
  })).min(1)
});

// Configure multer for image uploads
const storage = multer.memoryStorage(); // Store in memory first for processing
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Single file upload
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ============================================================================
// PRODUCT MANAGEMENT ENDPOINTS
// ============================================================================

// POST /api/1c/products/:id/image - Upload product image (from 1C system)
router.post('/:id/image', 
  requirePermission('products:write'), 
  upload.single('image'), 
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No image file provided' 
      });
    }

    try {
      console.log(`📤 Uploading image for product ${id}`);
      
      // Create directory structure on chain-core server
      const baseDir = path.join(process.cwd(), 'uploads', 'products', id);
      await fs.mkdir(baseDir, { recursive: true });

      // Define image paths
      const imagePaths = {
        thumbnail: path.join(baseDir, 'thumbnail.jpg'),
        medium: path.join(baseDir, 'medium.jpg'),
        original: path.join(baseDir, 'original.jpg')
      };

      // Process and save multiple image sizes
      console.log('🖼️  Processing image sizes...');
      
      // Create thumbnail (100x100)
      await sharp(req.file.buffer)
        .resize(100, 100, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toFile(imagePaths.thumbnail);

      // Create medium size (300x300) 
      await sharp(req.file.buffer)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toFile(imagePaths.medium);

      // Save original (resized to max 600x600)
      await sharp(req.file.buffer)
        .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 95 })
        .toFile(imagePaths.original);

      // Update database with relative paths
      const relativePaths = {
        thumbnail: `uploads/products/${id}/thumbnail.jpg`,
        medium: `uploads/products/${id}/medium.jpg`,
        original: `uploads/products/${id}/original.jpg`
      };

      console.log('💾 Updating database...');
      await DatabaseManager.query(
        'UPDATE products SET image_paths = $1, has_image = true WHERE oneC_id = $2 OR id::text = $2 OR sku = $2 OR barcode = $2',
        [JSON.stringify(relativePaths), id]
      );

      // 🚀 Automatically sync to all branches
      console.log('🔄 Syncing to branches...');
      await syncImageToAllBranches(id, relativePaths);

      console.log(`✅ Image uploaded and synced for product ${id}`);
      
      res.json({
        success: true,
        data: {
          message: 'Image uploaded successfully',
          product_id: id,
          image_paths: relativePaths
        }
      });

    } catch (error) {
      console.error('❌ Error uploading image:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
));

// POST /api/1c/products/chain-manager/:id/image - Upload product image (from chain-manager)
router.post('/chain-manager/:id/image', 
  requirePermission('products:write'), 
  upload.single('image'), 
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No image file provided' 
      });
    }

    try {
      console.log(`📤 Chain-manager uploading image for product ${id}`);
      
      // Create directory structure on chain-core server
      const baseDir = path.join(process.cwd(), 'uploads', 'products', id);
      await fs.mkdir(baseDir, { recursive: true });

      // Define image paths
      const imagePaths = {
        thumbnail: path.join(baseDir, 'thumbnail.jpg'),
        medium: path.join(baseDir, 'medium.jpg'),
        original: path.join(baseDir, 'original.jpg')
      };

      // Process and save multiple image sizes
      console.log('🖼️  Processing image sizes...');
      
      // Create thumbnail (100x100)
      await sharp(req.file.buffer)
        .resize(100, 100, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toFile(imagePaths.thumbnail);

      // Create medium size (300x300) 
      await sharp(req.file.buffer)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toFile(imagePaths.medium);

      // Save original (resized to max 600x600)
      await sharp(req.file.buffer)
        .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 95 })
        .toFile(imagePaths.original);

      // Update database with relative paths
      const relativePaths = {
        thumbnail: `uploads/products/${id}/thumbnail.jpg`,
        medium: `uploads/products/${id}/medium.jpg`,
        original: `uploads/products/${id}/original.jpg`
      };

      console.log('💾 Updating database...');
      // Chain-manager uses product UUID, so check by id first
      const updateResult = await DatabaseManager.query(
        'UPDATE products SET image_paths = $1, has_image = true WHERE id::text = $2',
        [JSON.stringify(relativePaths), id]
      );

      if (updateResult.rowCount === 0) {
        // Try by oneC_id, sku, or barcode as fallback
        await DatabaseManager.query(
          'UPDATE products SET image_paths = $1, has_image = true WHERE oneC_id = $2 OR sku = $2 OR barcode = $2',
          [JSON.stringify(relativePaths), id]
        );
      }

      // 🚀 Automatically sync to all branches
      console.log('🔄 Syncing to branches...');
      await syncImageToAllBranches(id, relativePaths);

      console.log(`✅ Image uploaded and synced for product ${id} via chain-manager`);
      
      res.json({
        success: true,
        data: {
          message: 'Image uploaded successfully',
          product_id: id,
          image_paths: relativePaths,
          uploaded_via: 'chain-manager'
        }
      });

    } catch (error) {
      console.error('❌ Error uploading image from chain-manager:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
));

// GET /api/1c/products - Get all products
router.get('/', requirePermission('products:read'), asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 100, category_key, is_active, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      p.id, p.oneC_id as "oneC_id", p.sku, p.barcode, p.name, p.name_ru, p.name_uz,
      p.description, p.description_ru, p.description_uz, p.brand,
      p.unit_of_measure, p.base_price, p.cost, p.tax_rate,
      p.image_url, p.images, p.attributes, p.is_active,
      p.created_at, p.updated_at,
      c.key as category_key, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (category_key) {
    params.push(category_key);
    query += ` AND c.key = $${params.length}`;
  }
  
  if (is_active !== undefined) {
    params.push(is_active === 'true');
    query += ` AND p.is_active = $${params.length}`;
  }
  
  if (search) {
    params.push(`%${search}%`);
    query += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`;
  }
  
  // Get total count for pagination
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM').split('ORDER BY')[0];
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.count || '0');
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY p.name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      products: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// GET /api/1c/products/:id - Get specific product
router.get('/:id', requirePermission('products:read'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    SELECT
      p.id, p.oneC_id as "oneC_id", p.sku, p.barcode, p.name, p.name_ru, p.name_uz,
      p.description, p.description_ru, p.description_uz, p.brand,
      p.unit_of_measure, p.base_price, p.cost, p.tax_rate,
      p.image_url, p.images, p.attributes, p.is_active,
      p.created_at, p.updated_at,
      c.key as category_key, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE (p.id::text = $1 AND $1 ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') 
       OR p.oneC_id = $1 
       OR p.sku = $1 
       OR p.barcode = $1
  `;  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      product: result.rows[0]
    }
  });
}));

// POST /api/1c/products - Create or update products from 1C
router.post('/', requirePermission('products:write'), asyncHandler(async (req: Request, res: Response) => {
  // Validate that we received an array
  if (!Array.isArray(req.body)) {
    return res.status(400).json({
      success: false,
      error: 'Request body must be an array of products'
    });
  }
  
  const rawProducts = req.body;
  const syncId = await createSyncLog('products', 'import', rawProducts.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const rawProductData of rawProducts) {
      let productData;
      try {
        // Validate this individual product
        productData = productSchema.parse(rawProductData);
      } catch (validationError) {
        // Handle validation error for this product
        results.push({
          oneC_id: rawProductData.oneC_id || 'unknown',
          sku: rawProductData.sku || 'unknown',
          success: false,
          error: 'Validation failed: ' + (validationError as Error).message
        });
        continue; // Skip to next product
      }

      try {
        // Find or create category
        let categoryId = null;
        if (productData.category_key) {
          const categoryResult = await DatabaseManager.query(
            'SELECT id FROM categories WHERE key = $1',
            [productData.category_key]
          );
          
          if (categoryResult.rows.length > 0) {
            categoryId = categoryResult.rows[0].id;
          } else {
            // Auto-create category
            const newCategoryResult = await DatabaseManager.query(`
              INSERT INTO categories (key, name, is_active, created_at, updated_at)
              VALUES ($1, $2, true, NOW(), NOW())
              RETURNING id
            `, [productData.category_key, productData.category_key]);
            categoryId = newCategoryResult.rows[0].id;
          }
        }
        
        // Check if product exists by oneC_id, barcode, or SKU
        const existingProductQuery = `
          SELECT id FROM products 
          WHERE oneC_id = $1 OR (barcode IS NOT NULL AND barcode = $2) OR sku = $3
        `;
        const existingResult = await DatabaseManager.query(existingProductQuery, [
          productData.oneC_id,
          productData.barcode || null,
          productData.sku
        ]);
        
        let productId;
        if (existingResult.rows.length > 0) {
          // Update existing product
          productId = existingResult.rows[0].id;
          await DatabaseManager.query(`
            UPDATE products SET
              oneC_id = $1, sku = $2, barcode = $3, name = $4,
              name_ru = $5, name_uz = $6, description = $7,
              description_ru = $8, description_uz = $9, category_id = $10,
              brand = $11, unit_of_measure = $12, base_price = $13,
              cost = $14, tax_rate = $15, image_url = $16,
              images = $17, attributes = $18, is_active = $19,
              updated_at = NOW()
            WHERE id = $20
          `, [
            productData.oneC_id, productData.sku, productData.barcode,
            productData.name, productData.name_ru, productData.name_uz,
            productData.description, productData.description_ru, productData.description_uz,
            categoryId, productData.brand, productData.unit_of_measure,
            productData.base_price, productData.cost, productData.tax_rate,
            productData.image_url, JSON.stringify(productData.images || []),
            JSON.stringify(productData.attributes || {}), productData.is_active,
            productId
          ]);
        } else {
          // Create new product
          const insertResult = await DatabaseManager.query(`
            INSERT INTO products (
              oneC_id, sku, barcode, name, name_ru, name_uz,
              description, description_ru, description_uz, category_id,
              brand, unit_of_measure, base_price, cost, tax_rate,
              image_url, images, attributes, is_active, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW()
            ) RETURNING id
          `, [
            productData.oneC_id, productData.sku, productData.barcode,
            productData.name, productData.name_ru, productData.name_uz,
            productData.description, productData.description_ru, productData.description_uz,
            categoryId, productData.brand, productData.unit_of_measure,
            productData.base_price, productData.cost, productData.tax_rate,
            productData.image_url, JSON.stringify(productData.images || []),
            JSON.stringify(productData.attributes || {}), productData.is_active
          ]);
          productId = insertResult.rows[0].id;
        }
        
        // Sync to all active branches
        await syncProductToBranches(productId);
        
        results.push({
          oneC_id: productData.oneC_id,
          sku: productData.sku,
          success: true,
          action: existingResult.rows.length > 0 ? 'updated' : 'created'
        });
        
      } catch (error) {
        results.push({
          oneC_id: productData.oneC_id,
          sku: productData.sku,
          success: false,
          error: (error as Error).message
        });
      }
    }
    
    await DatabaseManager.query('COMMIT');
    await completeSyncLog(syncId, 'completed', results.filter(r => r.success).length);
    
    // If all products failed validation, return 400
    const successCount = results.filter(r => r.success).length;
    if (successCount === 0 && results.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'All products failed validation',
        data: {
          sync_id: syncId,
          results,
          imported: 0,
          failed: results.length
        }
      });
    }

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

// PUT /api/1c/products/prices - Update product prices across branches
router.put('/prices', requirePermission('products:write'), asyncHandler(async (req: Request, res: Response) => {
  // Validate input data
  let updates;
  try {
    const validated = priceUpdateSchema.parse(req.body);
    updates = validated.updates;
  } catch (validationError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: validationError
    });
  }
  
  const syncId = await createSyncLog('products', 'price_update', updates.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const update of updates) {
      try {
        // Find product by barcode (primary), then oneC_id, then SKU
        let productQuery = 'SELECT id FROM products WHERE ';
        let productParam;
        
        if (update.barcode) {
          productQuery += 'barcode = $1';
          productParam = update.barcode;
        } else if (update.oneC_id) {
          productQuery += 'oneC_id = $1';
          productParam = update.oneC_id;
        } else if (update.sku) {
          productQuery += 'sku = $1';
          productParam = update.sku;
        } else {
          throw new Error('Must provide barcode, oneC_id, or sku');
        }
        
        const productResult = await DatabaseManager.query(productQuery, [productParam]);
        
        if (productResult.rows.length === 0) {
          throw new Error('Product not found');
        }
        
        const productId = productResult.rows[0].id;
        
        // Update base price in products table
        await DatabaseManager.query(`
          UPDATE products 
          SET base_price = $1, cost = COALESCE($2, cost), updated_at = NOW()
          WHERE id = $3
        `, [update.base_price, update.cost, productId]);
        
        // Update branch-specific pricing
        if (update.branch_codes && update.branch_codes.length > 0) {
          // Update specific branches
          for (const branchCode of update.branch_codes) {
            const branchResult = await DatabaseManager.query(
              'SELECT id FROM branches WHERE code = $1',
              [branchCode]
            );
            
            if (branchResult.rows.length > 0) {
              const branchId = branchResult.rows[0].id;
              await DatabaseManager.query(`
                INSERT INTO branch_product_pricing (branch_id, product_id, price, cost, effective_from, is_available)
                VALUES ($1, $2, $3, $4, $5, true)
                ON CONFLICT (branch_id, product_id) 
                DO UPDATE SET price = $3, cost = $4, effective_from = $5, updated_at = NOW()
              `, [
                branchId, productId, update.base_price, update.cost || null,
                update.effective_date || new Date().toISOString()
              ]);
              
              // Send update to branch
              await sendPriceUpdateToBranch(branchCode, {
                product_id: productId,
                barcode: update.barcode,
                sku: update.sku,
                price: update.base_price,
                cost: update.cost,
                effective_date: update.effective_date
              });
            }
          }
        } else {
          // Update all active branches
          const branchesResult = await DatabaseManager.query(
            'SELECT id, code FROM branches WHERE is_active = true'
          );
          
          for (const branch of branchesResult.rows) {
            await DatabaseManager.query(`
              INSERT INTO branch_product_pricing (branch_id, product_id, price, cost, effective_from, is_available)
              VALUES ($1, $2, $3, $4, $5, true)
              ON CONFLICT (branch_id, product_id) 
              DO UPDATE SET price = $3, cost = $4, effective_from = $5, updated_at = NOW()
            `, [
              branch.id, productId, update.base_price, update.cost || null,
              update.effective_date || new Date().toISOString()
            ]);
            
            // Send update to branch
            await sendPriceUpdateToBranch(branch.code, {
              product_id: productId,
              barcode: update.barcode,
              sku: update.sku,
              price: update.base_price,
              cost: update.cost,
              effective_date: update.effective_date
            });
          }
        }
        
        results.push({
          barcode: update.barcode,
          sku: update.sku,
          oneC_id: update.oneC_id,
          success: true,
          branches_updated: update.branch_codes?.length || 'all'
        });
        
      } catch (error) {
        results.push({
          barcode: update.barcode,
          sku: update.sku,
          oneC_id: update.oneC_id,
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
        updated: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    await completeSyncLog(syncId, 'failed', 0, (error as Error).message);
    throw error;
  }
}));

// PUT /api/1c/products/:id - Update specific product
router.put('/:id', requirePermission('products:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const productData = productSchema.partial().parse(req.body);
  
  // Find product
  const productResult = await DatabaseManager.query(
    `SELECT id FROM products WHERE 
     (id::text = $1 AND $1 ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') 
     OR oneC_id = $1 
     OR sku = $1 
     OR barcode = $1`,
    [id]
  );
  
  if (productResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  const productId = productResult.rows[0].id;
  
  // Handle category
  let categoryId = null;
  if (productData.category_key) {
    const categoryResult = await DatabaseManager.query(
      'SELECT id FROM categories WHERE key = $1',
      [productData.category_key]
    );
    
    if (categoryResult.rows.length > 0) {
      categoryId = categoryResult.rows[0].id;
    } else {
      // Auto-create category
      const newCategoryResult = await DatabaseManager.query(`
        INSERT INTO categories (key, name, is_active, created_at, updated_at)
        VALUES ($1, $2, true, NOW(), NOW())
        RETURNING id
      `, [productData.category_key, productData.category_key]);
      categoryId = newCategoryResult.rows[0].id;
    }
  }
  
  // Update product
  await DatabaseManager.query(`
    UPDATE products SET
      oneC_id = COALESCE($1, oneC_id),
      sku = COALESCE($2, sku),
      barcode = COALESCE($3, barcode),
      name = COALESCE($4, name),
      name_ru = COALESCE($5, name_ru),
      name_uz = COALESCE($6, name_uz),
      description = COALESCE($7, description),
      description_ru = COALESCE($8, description_ru),
      description_uz = COALESCE($9, description_uz),
      category_id = COALESCE($10, category_id),
      brand = COALESCE($11, brand),
      unit_of_measure = COALESCE($12, unit_of_measure),
      base_price = COALESCE($13, base_price),
      cost = COALESCE($14, cost),
      tax_rate = COALESCE($15, tax_rate),
      image_url = COALESCE($16, image_url),
      images = COALESCE($17, images),
      attributes = COALESCE($18, attributes),
      is_active = COALESCE($19, is_active),
      updated_at = NOW()
    WHERE id = $20
    RETURNING *
  `, [
    productData.oneC_id, productData.sku, productData.barcode,
    productData.name, productData.name_ru, productData.name_uz,
    productData.description, productData.description_ru, productData.description_uz,
    categoryId, productData.brand, productData.unit_of_measure,
    productData.base_price, productData.cost, productData.tax_rate,
    productData.image_url, JSON.stringify(productData.images || []),
    JSON.stringify(productData.attributes || {}), productData.is_active,
    productId
  ]);
  
  // Sync to branches
  await syncProductToBranches(productId);
  
  res.json({
    success: true,
    data: {
      message: 'Product updated successfully',
      product_id: productId
    }
  });
}));

// DELETE /api/1c/products/:id - Deactivate product
router.delete('/:id', requirePermission('products:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const result = await DatabaseManager.query(`
    UPDATE products 
    SET is_active = false, updated_at = NOW()
    WHERE (id::text = $1 AND $1 ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') 
       OR oneC_id = $1 
       OR sku = $1 
       OR barcode = $1
    RETURNING id, name
  `, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  const productId = result.rows[0].id;
  
  // Sync deactivation to branches
  await syncProductToBranches(productId);
  
  res.json({
    success: true,
    data: {
      message: `Product "${result.rows[0].name}" has been deactivated`,
      product_id: productId
    }
  });
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

async function syncProductToBranches(productId: string): Promise<void> {
  // Get all active branches
  const branchesResult = await DatabaseManager.query(
    'SELECT code FROM branches WHERE is_active = true'
  );
  
  // Get product data
  const productResult = await DatabaseManager.query(`
    SELECT 
      p.*, c.key as category_key
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = $1
  `, [productId]);
  
  if (productResult.rows.length === 0) return;
  
  const productData = productResult.rows[0];
  
  // Send to each branch
  for (const branch of branchesResult.rows) {
    try {
      await sendProductDataToBranch(branch.code, productData);
    } catch (error) {
      console.error(`Failed to sync product ${productId} to branch ${branch.code}:`, error);
    }
  }
}

async function getBranchApiEndpoint(branchCode: string): Promise<{ endpoint: string; apiKey: string } | null> {
  const result = await DatabaseManager.query(`
    SELECT api_endpoint, api_key 
    FROM branches 
    WHERE code = $1 AND is_active = true
  `, [branchCode]);
  
  if (result.rows.length === 0) return null;
  
  return {
    endpoint: result.rows[0].api_endpoint,
    apiKey: result.rows[0].api_key
  };
}

async function sendProductDataToBranch(branchCode: string, productData: any): Promise<void> {
  const branchApi = await getBranchApiEndpoint(branchCode);
  if (!branchApi) return;
  
  try {
    await axios.post(`${branchApi.endpoint}/api/chain-core/products`, {
      products: [productData]
    }, {
      headers: {
        'Authorization': `Bearer ${branchApi.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  } catch (error) {
    console.error(`Failed to send product to branch ${branchCode}:`, error);
    throw error;
  }
}

async function sendPriceUpdateToBranch(branchCode: string, priceUpdate: any): Promise<void> {
  const branchApi = await getBranchApiEndpoint(branchCode);
  if (!branchApi) return;
  
  try {
    await axios.put(`${branchApi.endpoint}/api/chain-core/prices`, {
      updates: [priceUpdate]
    }, {
      headers: {
        'Authorization': `Bearer ${branchApi.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  } catch (error) {
    console.error(`Failed to send price update to branch ${branchCode}:`, error);
    throw error;
  }
}

// ============================================================================
// IMAGE SYNC FUNCTIONS
// ============================================================================

async function syncImageToAllBranches(productId: string, imagePaths: any): Promise<void> {
  console.log(`🌐 Starting image sync for product ${productId} to all branches...`);
  
  // Get all active branches
  const branchesResult = await DatabaseManager.query(
    'SELECT code, api_endpoint, api_key FROM branches WHERE is_active = true'
  );

  if (branchesResult.rows.length === 0) {
    console.log('ℹ️  No active branches found for image sync');
    return;
  }

  console.log(`📡 Found ${branchesResult.rows.length} active branches`);

  // Send image to each branch
  const syncPromises = branchesResult.rows.map(async (branch: any) => {
    try {
      console.log(`📤 Syncing image to branch: ${branch.code}`);
      await sendImageToBranch(branch, productId, imagePaths);
      console.log(`✅ Image synced successfully to branch: ${branch.code}`);
    } catch (error) {
      console.error(`❌ Failed to sync image to branch ${branch.code}:`, error);
      // Don't throw - continue with other branches
    }
  });

  // Wait for all syncs to complete
  await Promise.all(syncPromises);
  console.log(`🏁 Image sync completed for product ${productId}`);
}

async function sendImageToBranch(branch: any, productId: string, imagePaths: any): Promise<void> {
  const { code: branchCode, api_endpoint: endpoint, api_key: apiKey } = branch;
  
  if (!endpoint || !apiKey) {
    throw new Error(`Branch ${branchCode} missing API endpoint or key`);
  }

  try {
    // Read image files from chain-core server disk
    const thumbnailBuffer = await fs.readFile(path.join(process.cwd(), imagePaths.thumbnail));
    const mediumBuffer = await fs.readFile(path.join(process.cwd(), imagePaths.medium));
    const originalBuffer = await fs.readFile(path.join(process.cwd(), imagePaths.original));

    // Create form data with multiple files
    const form = new FormData();
    form.append('product_id', productId);
    form.append('thumbnail', thumbnailBuffer, 'thumbnail.jpg');
    form.append('medium', mediumBuffer, 'medium.jpg');
    form.append('original', originalBuffer, 'original.jpg');

    // Send to branch-core server
    console.log(`🔄 Sending ${Math.round((thumbnailBuffer.length + mediumBuffer.length + originalBuffer.length) / 1024)}KB of images to ${branchCode}`);
    
    await axios.post(`${endpoint}/api/chain-core/products/images/sync`, form, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders()
      },
      timeout: 60000, // 60 second timeout for image upload
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      maxBodyLength: 50 * 1024 * 1024
    });

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message;
      throw new Error(`HTTP ${status}: ${message}`);
    }
    throw error;
  }
}

export default router;
