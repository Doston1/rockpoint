import { DatabaseManager } from '@/database/manager';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { RedisManager } from '@/services/redis';
import { Request, Response, Router } from 'express';

const router = Router();

// GET /api/sync/status
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  // Get last sync information from database
  const lastSyncQuery = `
    SELECT 
      sync_type, last_sync_at, status, records_synced, error_message
    FROM sync_logs 
    ORDER BY last_sync_at DESC 
    LIMIT 10
  `;

  const result = await DatabaseManager.query(lastSyncQuery);

  // Get pending sync items from Redis
  const pendingTransactions = await RedisManager.getPendingTransactions();

  res.json({
    success: true,
    data: {
      lastSyncs: result.rows,
      pendingSync: {
        transactions: pendingTransactions.length,
        nextScheduledSync: getNextSyncTime()
      },
      syncConfiguration: {
        interval: process.env.SYNC_INTERVAL || '24h',
        enabled: process.env.SYNC_ENABLED === 'true',
        cloudApiUrl: process.env.CLOUD_API_URL,
        branchId: process.env.BRANCH_ID
      }
    }
  });
}));

// POST /api/sync/manual
router.post('/manual', asyncHandler(async (req: Request, res: Response) => {
  const { syncType = 'full' } = req.body;

  if (!['full', 'incremental', 'transactions-only'].includes(syncType)) {
    throw createError('Invalid sync type. Must be full, incremental, or transactions-only', 400);
  }

  try {
    // Record sync start
    const syncId = await recordSyncStart(syncType);

    let syncResults;
    switch (syncType) {
      case 'full':
        syncResults = await performFullSync();
        break;
      case 'incremental':
        syncResults = await performIncrementalSync();
        break;
      case 'transactions-only':
        syncResults = await syncTransactionsOnly();
        break;
    }

    // Record sync completion
    await recordSyncCompletion(syncId, syncResults);

    res.json({
      success: true,
      data: {
        syncId,
        syncType,
        results: syncResults,
        completedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Manual sync failed:', error);
    res.status(500).json({
      success: false,
      error: 'Sync failed',
      message: error.message
    });
  }
}));

// GET /api/sync/health
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const healthChecks = {
    database: false,
    redis: false,
    cloudApi: false
  };

  try {
    // Check database connection
    const dbResult = await DatabaseManager.query('SELECT 1');
    healthChecks.database = dbResult.rows.length > 0;
  } catch {
    healthChecks.database = false;
  }

  try {
    // Check Redis connection
    const redisManager = RedisManager.getInstance();
    healthChecks.redis = await redisManager.healthCheck();
  } catch {
    healthChecks.redis = false;
  }

  try {
    // Check cloud API connectivity (simplified)
    if (process.env.CLOUD_API_URL) {
      // This would typically make an actual HTTP request to the cloud API
      healthChecks.cloudApi = true; // Placeholder
    }
  } catch {
    healthChecks.cloudApi = false;
  }

  const overallHealth = Object.values(healthChecks).every(check => check);

  res.json({
    success: true,
    data: {
      overall: overallHealth ? 'healthy' : 'degraded',
      checks: healthChecks,
      timestamp: new Date().toISOString()
    }
  });
}));

// POST /api/sync/products-complete - Receive comprehensive product sync from chain-core
router.post('/products-complete', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { sync_type, timestamp, last_sync_at, data } = req.body;
    
    if (sync_type !== 'complete_products') {
      return res.status(400).json({
        success: false,
        error: 'Invalid sync type. Expected complete_products'
      });
    }
    
    console.log(`🔄 [COMPLETE SYNC] Receiving comprehensive sync from chain-core`);
    console.log(`📅 [COMPLETE SYNC] Last sync: ${last_sync_at}, Current: ${timestamp}`);
    
    const syncResults = {
      products: { processed: 0, success: 0, failed: 0 },
      price_updates: { processed: 0, success: 0, failed: 0 },
      promotions: { processed: 0, success: 0, failed: 0 },
      status_updates: { processed: 0, success: 0, failed: 0 }
    };
    
    const errors: any[] = [];
    
    await DatabaseManager.query('BEGIN');
    
    try {
      // 1. Process new/updated products
      if (data.products && Array.isArray(data.products)) {
        console.log(`📦 [COMPLETE SYNC] Processing ${data.products.length} product updates`);
        
        for (const product of data.products) {
          syncResults.products.processed++;
          try {
            // First, ensure category exists and get category_id
            let categoryId = null;
            if (product.category_key) {
              const categoryQuery = `
                INSERT INTO categories (key, name_en)
                VALUES ($1, $1)
                ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
                RETURNING id
              `;
              const categoryResult = await DatabaseManager.query(categoryQuery, [product.category_key]);
              categoryId = categoryResult.rows[0]?.id || null;
            }

            // Upsert product - branch-core uses category_id reference
            const upsertQuery = `
              INSERT INTO products (
                sku, barcode, name, description, category_id, 
                brand, price, cost, unit_of_measure, tax_rate, is_active, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
              ON CONFLICT (barcode) 
              DO UPDATE SET 
                sku = EXCLUDED.sku,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                category_id = EXCLUDED.category_id,
                brand = EXCLUDED.brand,
                price = EXCLUDED.price,
                cost = EXCLUDED.cost,
                unit_of_measure = EXCLUDED.unit_of_measure,
                tax_rate = EXCLUDED.tax_rate,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
              RETURNING id
            `;

            await DatabaseManager.query(upsertQuery, [
              product.sku || null,
              product.barcode,
              product.name,
              product.description || null,
              categoryId,
              product.brand || null,
              product.price,
              product.cost || null,
              product.unit_of_measure || 'pcs',
              product.tax_rate || 0,
              product.is_active !== false
            ]);
            
            syncResults.products.success++;
          } catch (error) {
            syncResults.products.failed++;
            errors.push({
              type: 'product',
              barcode: product.barcode,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
      
      // 2. Process price updates
      if (data.price_updates && Array.isArray(data.price_updates)) {
        console.log(`💰 [COMPLETE SYNC] Processing ${data.price_updates.length} price updates`);
        
        for (const update of data.price_updates) {
          syncResults.price_updates.processed++;
          try {
            const updateQuery = `
              UPDATE products 
              SET price = $1, cost = $2, updated_at = NOW()
              WHERE barcode = $3
            `;

            const result = await DatabaseManager.query(updateQuery, [
              update.price,
              update.cost || null,
              update.barcode
            ]);

            if (result.rowCount > 0) {
              syncResults.price_updates.success++;
            } else {
              syncResults.price_updates.failed++;
              errors.push({
                type: 'price_update',
                barcode: update.barcode,
                error: 'Product not found'
              });
            }
          } catch (error) {
            syncResults.price_updates.failed++;
            errors.push({
              type: 'price_update',
              barcode: update.barcode,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
      
      // 3. Process promotions
      if (data.promotions && Array.isArray(data.promotions)) {
        console.log(`🎁 [COMPLETE SYNC] Processing ${data.promotions.length} promotions`);
        
        for (const promotion of data.promotions) {
          syncResults.promotions.processed++;
          try {
            // Check if promotions table exists, if not create a simple one
            await DatabaseManager.query(`
              CREATE TABLE IF NOT EXISTS promotions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                chain_promotion_id VARCHAR(255) UNIQUE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                promotion_type VARCHAR(50),
                discount_value DECIMAL(10,2),
                min_quantity INTEGER,
                product_barcode VARCHAR(100),
                category_key VARCHAR(100),
                start_date TIMESTAMP WITH TIME ZONE,
                end_date TIMESTAMP WITH TIME ZONE,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              )
            `);
            
            const upsertQuery = `
              INSERT INTO promotions (
                chain_promotion_id, name, description, promotion_type, 
                discount_value, min_quantity, product_barcode, category_key,
                start_date, end_date, is_active
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (chain_promotion_id) 
              DO UPDATE SET 
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                promotion_type = EXCLUDED.promotion_type,
                discount_value = EXCLUDED.discount_value,
                min_quantity = EXCLUDED.min_quantity,
                product_barcode = EXCLUDED.product_barcode,
                category_key = EXCLUDED.category_key,
                start_date = EXCLUDED.start_date,
                end_date = EXCLUDED.end_date,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            `;

            const discountValue = promotion.discount_percentage || promotion.discount_amount || 0;

            await DatabaseManager.query(upsertQuery, [
              promotion.id,
              promotion.name,
              promotion.description || null,
              promotion.type,
              discountValue,
              promotion.min_quantity || null,
              promotion.product_barcode || null,
              promotion.category_key || null,
              promotion.start_date,
              promotion.end_date,
              promotion.is_active !== false
            ]);
            
            syncResults.promotions.success++;
          } catch (error) {
            syncResults.promotions.failed++;
            errors.push({
              type: 'promotion',
              id: promotion.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
      
      // 4. Process status updates
      if (data.status_updates && Array.isArray(data.status_updates)) {
        console.log(`🔄 [COMPLETE SYNC] Processing ${data.status_updates.length} status updates`);
        
        for (const update of data.status_updates) {
          syncResults.status_updates.processed++;
          try {
            const updateQuery = `
              UPDATE products 
              SET is_active = $1, updated_at = NOW()
              WHERE barcode = $2
            `;

            const result = await DatabaseManager.query(updateQuery, [
              update.is_active,
              update.barcode
            ]);

            if (result.rowCount > 0) {
              syncResults.status_updates.success++;
            } else {
              syncResults.status_updates.failed++;
              errors.push({
                type: 'status_update',
                barcode: update.barcode,
                error: 'Product not found'
              });
            }
          } catch (error) {
            syncResults.status_updates.failed++;
            errors.push({
              type: 'status_update',
              barcode: update.barcode,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
      
      await DatabaseManager.query('COMMIT');
      
      // Log successful sync
      await DatabaseManager.query(`
        INSERT INTO sync_logs (id, sync_type, status, started_at, records_synced, completed_at)
        VALUES ($1, 'complete_products_received', 'completed', NOW(), $2, NOW())
      `, [
        `complete-sync-${Date.now()}`,
        syncResults.products.success + syncResults.price_updates.success + 
        syncResults.promotions.success + syncResults.status_updates.success
      ]);
      
      const totalSuccess = syncResults.products.success + syncResults.price_updates.success + 
                          syncResults.promotions.success + syncResults.status_updates.success;
      const totalFailed = syncResults.products.failed + syncResults.price_updates.failed + 
                         syncResults.promotions.failed + syncResults.status_updates.failed;
      
      console.log(`✅ [COMPLETE SYNC] Sync completed - Success: ${totalSuccess}, Failed: ${totalFailed}`);
      
      res.status(200).json({
        success: true,
        message: 'Complete sync processed successfully',
        results: syncResults,
        total_processed: totalSuccess + totalFailed,
        total_success: totalSuccess,
        total_failed: totalFailed,
        errors: errors.length > 0 ? errors.slice(0, 10) : [] // Return first 10 errors
      });
      
    } catch (error) {
      await DatabaseManager.query('ROLLBACK');
      throw error;
    }
    
  } catch (error: any) {
    console.error('❌ [COMPLETE SYNC] Error processing sync:', error);
    
    // Log failed sync
    try {
      await DatabaseManager.query(`
        INSERT INTO sync_logs (id, sync_type, status, started_at, error_message, completed_at)
        VALUES ($1, 'complete_products_received', 'failed', NOW(), $2, NOW())
      `, [`complete-sync-failed-${Date.now()}`, error.message]);
    } catch (logError) {
      console.error('Failed to log sync error:', logError);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process complete sync',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

// Helper functions for sync operations
async function recordSyncStart(syncType: string): Promise<string> {
  const syncId = `sync_${Date.now()}`;
  
  await DatabaseManager.query(
    `INSERT INTO sync_logs (id, sync_type, status, started_at) 
     VALUES ($1, $2, 'in_progress', NOW())`,
    [syncId, syncType]
  );

  return syncId;
}

async function recordSyncCompletion(syncId: string, results: any): Promise<void> {
  await DatabaseManager.query(
    `UPDATE sync_logs 
     SET status = $1, completed_at = NOW(), records_synced = $2, last_sync_at = NOW()
     WHERE id = $3`,
    ['completed', results.recordsSynced || 0, syncId]
  );
}

async function performFullSync(): Promise<any> {
  // This would implement the full synchronization logic
  // For now, return a mock result
  console.log('🔄 Performing full sync...');
  
  // Simulate sync operations
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    recordsSynced: 150,
    tables: ['products', 'transactions', 'employees', 'customers'],
    duration: '2.1s'
  };
}

async function performIncrementalSync(): Promise<any> {
  // This would implement incremental synchronization
  console.log('🔄 Performing incremental sync...');
  
  const lastSyncQuery = `
    SELECT last_sync_at 
    FROM sync_logs 
    WHERE status = 'completed' 
    ORDER BY completed_at DESC 
    LIMIT 1
  `;
  
  const lastSyncResult = await DatabaseManager.query(lastSyncQuery);
  const lastSyncTime = lastSyncResult.rows[0]?.last_sync_at || new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get changes since last sync
  const changesQuery = `
    SELECT 'transactions' as table_name, COUNT(*) as count
    FROM transactions 
    WHERE updated_at > $1
    UNION ALL
    SELECT 'products' as table_name, COUNT(*) as count
    FROM products 
    WHERE updated_at > $1
  `;

  const changesResult = await DatabaseManager.query(changesQuery, [lastSyncTime]);
  
  return {
    recordsSynced: changesResult.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0),
    lastSyncTime,
    changes: changesResult.rows
  };
}

async function syncTransactionsOnly(): Promise<any> {
  console.log('🔄 Syncing transactions only...');
  
  // Get pending transactions from Redis
  const pendingTransactions = await RedisManager.getPendingTransactions();
  
  // In a real implementation, this would upload transactions to cloud
  for (const transaction of pendingTransactions) {
    // Simulate cloud upload
    console.log(`Uploading transaction: ${transaction.id}`);
  }
  
  return {
    recordsSynced: pendingTransactions.length,
    type: 'transactions',
    pendingBefore: pendingTransactions.length,
    pendingAfter: 0
  };
}

function getNextSyncTime(): string {
  const interval = process.env.SYNC_INTERVAL || '24h';
  const hours = interval.includes('h') ? parseInt(interval) : 24;
  const nextSync = new Date(Date.now() + (hours * 60 * 60 * 1000));
  return nextSync.toISOString();
}

// POST /api/sync/payment-methods-config
router.post('/payment-methods-config', asyncHandler(async (req: Request, res: Response) => {
  const { sync_type, timestamp, data } = req.body;

  if (sync_type !== 'payment_methods_config') {
    throw createError('Invalid sync type. Expected payment_methods_config', 400);
  }

  if (!data || !data.payment_methods) {
    throw createError('Missing payment methods data', 400);
  }

  try {
    const paymentMethods = data.payment_methods;
    console.log(`🔄 Syncing ${paymentMethods.length} payment methods configuration...`);

    // Store payment methods configuration in database
    for (const method of paymentMethods) {
      // Upsert payment method status
      const upsertStatusQuery = `
        INSERT INTO branch_payment_methods_status (
          payment_method_code, payment_method_name, is_enabled, priority,
          credentials_configured, last_sync_at, sync_status, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), 'synced', NOW())
        ON CONFLICT (payment_method_code) 
        DO UPDATE SET
          payment_method_name = EXCLUDED.payment_method_name,
          is_enabled = EXCLUDED.is_enabled,
          priority = EXCLUDED.priority,
          credentials_configured = EXCLUDED.credentials_configured,
          last_sync_at = NOW(),
          sync_status = 'synced',
          updated_at = NOW()
      `;

      await DatabaseManager.query(upsertStatusQuery, [
        method.method_code,
        method.method_name,
        method.is_enabled,
        method.priority_order || 0,
        method.credentials && method.credentials.length > 0
      ]);

      // Clear existing credentials for this payment method
      await DatabaseManager.query(
        'DELETE FROM payment_method_credentials WHERE payment_method_code = $1',
        [method.method_code]
      );

      // Insert new credentials
      for (const credential of method.credentials || []) {
        const insertCredentialQuery = `
          INSERT INTO payment_method_credentials (
            payment_method_code, credential_key, credential_value, 
            is_encrypted, is_test_environment, last_sync_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
        `;

        await DatabaseManager.query(insertCredentialQuery, [
          method.method_code,
          credential.key,
          credential.value,
          credential.isEncrypted !== false, // Default to true if not specified
          credential.isTestEnvironment || false
        ]);
      }
    }

    // Disable payment methods that were not included in the sync
    const enabledMethodCodes = paymentMethods.map((m: any) => m.method_code);
    if (enabledMethodCodes.length > 0) {
      const disableQuery = `
        UPDATE branch_payment_methods_status 
        SET is_enabled = false, last_sync_at = NOW(), updated_at = NOW()
        WHERE payment_method_code NOT IN (${enabledMethodCodes.map((_: any, i: number) => `$${i + 1}`).join(', ')})
        AND is_enabled = true
      `;
      await DatabaseManager.query(disableQuery, enabledMethodCodes);
    }

    // Log successful sync
    const syncLogQuery = `
      INSERT INTO sync_logs (id, sync_type, status, records_synced, last_sync_at, started_at, completed_at)
      VALUES ($1, $2, 'completed', $3, NOW(), NOW(), NOW())
    `;
    await DatabaseManager.query(syncLogQuery, [
      `payment_methods_sync_${Date.now()}`,
      'payment_methods_config', 
      paymentMethods.length
    ]);

    console.log(`✅ Successfully synced ${paymentMethods.length} payment methods`);

    res.json({
      success: true,
      data: {
        message: 'Payment methods configuration synced successfully',
        syncedMethods: paymentMethods.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Payment methods sync failed:', error);

    // Log failed sync
    try {
      const syncLogQuery = `
        INSERT INTO sync_logs (id, sync_type, status, error_message, last_sync_at, started_at)
        VALUES ($1, $2, 'failed', $3, NOW(), NOW())
      `;
      await DatabaseManager.query(syncLogQuery, [
        `payment_methods_sync_failed_${Date.now()}`,
        'payment_methods_config',
        error.message
      ]);
    } catch (logError) {
      console.error('Failed to log sync error:', logError);
    }

    throw createError('Failed to sync payment methods configuration: ' + error.message, 500);
  }
}));

export default router;
