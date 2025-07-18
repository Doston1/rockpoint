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

export default router;
