import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const syncRequestSchema = z.object({
  entity_type: z.enum(['products', 'transactions', 'inventory', 'all']),
  branch_id: z.string().uuid().optional(),
  force_sync: z.boolean().default(false),
});

const oneCDataSchema = z.object({
  entity_type: z.string(),
  data: z.array(z.any()),
  sync_timestamp: z.string(),
});

// GET /api/1c/status - Get 1C integration status
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  // Check last sync status from database
  const lastSyncQuery = `
    SELECT 
      entity_type,
      last_sync_at,
      sync_status,
      records_synced,
      error_message
    FROM sync_history 
    WHERE integration_type = '1c'
    ORDER BY last_sync_at DESC 
    LIMIT 10
  `;
  
  const result = await DatabaseManager.query(lastSyncQuery);
  
  // Check if 1C service is available (placeholder)
  const isOneCAvailable = await check1CAvailability();
  
  res.json({
    success: true,
    data: {
      integration_status: isOneCAvailable ? 'connected' : 'disconnected',
      last_sync_history: result.rows,
      sync_configuration: {
        auto_sync_enabled: true,
        sync_interval_minutes: 30,
        supported_entities: ['products', 'transactions', 'inventory']
      }
    }
  });
}));

// POST /api/1c/sync - Trigger manual sync with 1C
router.post('/sync', asyncHandler(async (req: Request, res: Response) => {
  const { entity_type, branch_id, force_sync } = syncRequestSchema.parse(req.body);
  
  // Start sync process
  const syncId = await startSyncProcess(entity_type, branch_id, force_sync);
  
  res.json({
    success: true,
    data: {
      sync_id: syncId,
      message: `Sync process started for ${entity_type}`,
      estimated_duration: '5-10 minutes'
    }
  });
}));

// GET /api/1c/sync/:syncId/status - Get sync status
router.get('/sync/:syncId/status', asyncHandler(async (req: Request, res: Response) => {
  const { syncId } = req.params;
  
  const statusQuery = `
    SELECT 
      id, entity_type, sync_status, records_synced, total_records,
      started_at, completed_at, error_message
    FROM sync_history 
    WHERE id = $1
  `;
  
  const result = await DatabaseManager.query(statusQuery, [syncId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Sync process not found'
    });
  }
  
  const syncProcess = result.rows[0];
  const progress = syncProcess.total_records > 0 
    ? Math.round((syncProcess.records_synced / syncProcess.total_records) * 100)
    : 0;
  
  res.json({
    success: true,
    data: {
      sync_id: syncProcess.id,
      entity_type: syncProcess.entity_type,
      status: syncProcess.sync_status,
      progress: progress,
      records_synced: syncProcess.records_synced,
      total_records: syncProcess.total_records,
      started_at: syncProcess.started_at,
      completed_at: syncProcess.completed_at,
      error_message: syncProcess.error_message
    }
  });
}));

// POST /api/1c/webhook - Receive data from 1C system
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const { entity_type, data, sync_timestamp } = oneCDataSchema.parse(req.body);
  
  // Process the data based on entity type
  let processedCount = 0;
  
  switch (entity_type) {
    case 'products':
      processedCount = await processProductsFromOneC(data);
      break;
    case 'inventory':
      processedCount = await processInventoryFromOneC(data);
      break;
    case 'transactions':
      processedCount = await processTransactionsFromOneC(data);
      break;
    default:
      return res.status(400).json({
        success: false,
        error: 'Unsupported entity type'
      });
  }
  
  // Log the sync
  await DatabaseManager.query(`
    INSERT INTO sync_history (
      integration_type, entity_type, sync_status, records_synced,
      started_at, completed_at
    ) VALUES (
      '1c', $1, 'completed', $2, $3, NOW()
    )
  `, [entity_type, processedCount, sync_timestamp]);
  
  res.json({
    success: true,
    data: {
      processed_records: processedCount,
      entity_type: entity_type
    }
  });
}));

// GET /api/1c/export/:entity - Export data to 1C format
router.get('/export/:entity', asyncHandler(async (req: Request, res: Response) => {
  const { entity } = req.params;
  const { branch_id, start_date, end_date } = req.query;
  
  let exportData;
  
  switch (entity) {
    case 'transactions':
      exportData = await exportTransactionsForOneC(branch_id as string, start_date as string, end_date as string);
      break;
    case 'inventory':
      exportData = await exportInventoryForOneC(branch_id as string);
      break;
    case 'products':
      exportData = await exportProductsForOneC();
      break;
    default:
      return res.status(400).json({
        success: false,
        error: 'Unsupported entity type for export'
      });
  }
  
  res.json({
    success: true,
    data: {
      entity_type: entity,
      export_data: exportData,
      exported_at: new Date().toISOString()
    }
  });
}));

// Helper functions (placeholders for actual 1C integration logic)

async function check1CAvailability(): Promise<boolean> {
  // Placeholder: In real implementation, ping 1C server
  return true;
}

async function startSyncProcess(entityType: string, branchId?: string, forceSync?: boolean): Promise<string> {
  // Create sync record
  const result = await DatabaseManager.query(`
    INSERT INTO sync_history (
      integration_type, entity_type, sync_status, started_at
    ) VALUES (
      '1c', $1, 'in_progress', NOW()
    ) RETURNING id
  `, [entityType]);
  
  // Placeholder: Start actual sync process in background
  setTimeout(async () => {
    await completeSyncProcess(result.rows[0].id, entityType);
  }, 5000);
  
  return result.rows[0].id;
}

async function completeSyncProcess(syncId: string, entityType: string): Promise<void> {
  // Placeholder: Complete the sync process
  const recordsCount = Math.floor(Math.random() * 100) + 1;
  
  await DatabaseManager.query(`
    UPDATE sync_history 
    SET sync_status = 'completed', records_synced = $1, completed_at = NOW()
    WHERE id = $2
  `, [recordsCount, syncId]);
}

async function processProductsFromOneC(data: any[]): Promise<number> {
  // Placeholder: Process products data from 1C
  let processedCount = 0;
  
  for (const item of data) {
    try {
      // Check if product exists
      const existingProduct = await DatabaseManager.query(
        'SELECT id FROM products WHERE sku = $1',
        [item.sku]
      );
      
      if (existingProduct.rows.length > 0) {
        // Update existing product
        await DatabaseManager.query(`
          UPDATE products 
          SET name = $1, price = $2, cost = $3, updated_at = NOW()
          WHERE sku = $4
        `, [item.name, item.price, item.cost, item.sku]);
      } else {
        // Create new product
        await DatabaseManager.query(`
          INSERT INTO products (
            name, sku, price, cost, category_id, is_active, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, 
            (SELECT id FROM categories WHERE name = 'General' LIMIT 1),
            true, NOW(), NOW()
          )
        `, [item.name, item.sku, item.price, item.cost]);
      }
      
      processedCount++;
    } catch (error) {
      console.error('Error processing product:', error);
    }
  }
  
  return processedCount;
}

async function processInventoryFromOneC(data: any[]): Promise<number> {
  // Placeholder: Process inventory data from 1C
  let processedCount = 0;
  
  for (const item of data) {
    try {
      await DatabaseManager.query(`
        UPDATE inventory 
        SET quantity = $1, last_updated = NOW()
        WHERE product_id = (SELECT id FROM products WHERE sku = $2)
        AND branch_id = $3
      `, [item.quantity, item.sku, item.branch_id]);
      
      processedCount++;
    } catch (error) {
      console.error('Error processing inventory:', error);
    }
  }
  
  return processedCount;
}

async function processTransactionsFromOneC(data: any[]): Promise<number> {
  // Placeholder: Process transactions data from 1C
  return data.length; // Just return count for now
}

async function exportTransactionsForOneC(branchId?: string, startDate?: string, endDate?: string): Promise<any[]> {
  let query = `
    SELECT 
      t.id, t.total_amount, t.tax_amount, t.payment_method, t.created_at,
      json_agg(
        json_build_object(
          'product_sku', p.sku,
          'quantity', ti.quantity,
          'price', ti.price,
          'total', ti.total_amount
        )
      ) as items
    FROM transactions t
    JOIN transaction_items ti ON t.id = ti.transaction_id
    JOIN products p ON ti.product_id = p.id
    WHERE t.status = 'completed'
  `;
  
  const params: any[] = [];
  let paramIndex = 1;
  
  if (startDate) {
    query += ` AND DATE(t.created_at) >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }
  
  if (endDate) {
    query += ` AND DATE(t.created_at) <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }
  
  if (branchId) {
    query += ` AND t.branch_id = $${paramIndex}`;
    params.push(branchId);
    paramIndex++;
  }
  
  query += ` GROUP BY t.id, t.total_amount, t.tax_amount, t.payment_method, t.created_at`;
  
  const result = await DatabaseManager.query(query, params);
  return result.rows;
}

async function exportInventoryForOneC(branchId?: string): Promise<any[]> {
  let query = `
    SELECT 
      p.sku, p.name, i.quantity, i.min_stock, i.max_stock,
      b.code as branch_code
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    JOIN branches b ON i.branch_id = b.id
    WHERE p.is_active = true
  `;
  
  const params: any[] = [];
  
  if (branchId) {
    query += ` AND i.branch_id = $1`;
    params.push(branchId);
  }
  
  const result = await DatabaseManager.query(query, params);
  return result.rows;
}

async function exportProductsForOneC(): Promise<any[]> {
  const query = `
    SELECT 
      p.sku, p.name, p.price, p.cost, p.barcode,
      c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = true
    ORDER BY p.name
  `;
  
  const result = await DatabaseManager.query(query);
  return result.rows;
}

export default router;
