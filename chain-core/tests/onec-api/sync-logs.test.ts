import { Express } from 'express';
import request from 'supertest';
import { DatabaseManager } from '../../src/database/manager';
import { createAuthHeaders, createTestApp } from '../helpers/testApp';

let app: Express;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  // Clean up sync logs table before each test
  await DatabaseManager.query('DELETE FROM onec_sync_logs');
});

describe('1C API - Sync Logs Management', () => {
  describe('GET /api/1c/sync-logs', () => {
    test('should return empty list when no sync logs exist', async () => {
      const response = await request(app)
        .get('/api/1c/sync-logs')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_logs).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    test('should return sync logs with pagination', async () => {
      // Create sync logs
      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, records_processed, started_at, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['products', 'import', 'completed', 100, 95, new Date(), new Date()]);

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, records_processed, started_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['branches', 'import', 'in_progress', 50, 25, new Date()]);

      const response = await request(app)
        .get('/api/1c/sync-logs')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_logs).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    test('should filter sync logs by sync_type', async () => {
      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['products', 'import', 'completed', 100, new Date()]);

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['branches', 'import', 'completed', 50, new Date()]);

      const response = await request(app)
        .get('/api/1c/sync-logs?sync_type=products')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_logs).toHaveLength(1);
      expect(response.body.data.sync_logs[0].sync_type).toBe('products');
    });

    test('should filter sync logs by status', async () => {
      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['products', 'import', 'completed', 100, new Date(), new Date()]);

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['branches', 'import', 'failed', 50, new Date()]);

      const response = await request(app)
        .get('/api/1c/sync-logs?status=completed')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_logs).toHaveLength(1);
      expect(response.body.data.sync_logs[0].status).toBe('completed');
    });

    test('should filter sync logs by direction', async () => {
      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['products', 'import', 'completed', 100, new Date()]);

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['transactions', 'export', 'completed', 50, new Date()]);

      const response = await request(app)
        .get('/api/1c/sync-logs?direction=export')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_logs).toHaveLength(1);
      expect(response.body.data.sync_logs[0].direction).toBe('export');
    });

    test('should filter sync logs by date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Create old sync log
      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['products', 'import', 'completed', 100, yesterday]);

      // Create recent sync log
      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['branches', 'import', 'completed', 50, new Date()]);

      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/1c/sync-logs?start_date=${today}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_logs).toHaveLength(1);
      expect(response.body.data.sync_logs[0].sync_type).toBe('branches');
    });

    test('should handle pagination correctly', async () => {
      // Create 5 sync logs
      for (let i = 1; i <= 5; i++) {
        await DatabaseManager.query(`
          INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [`type_${i}`, 'import', 'completed', i * 10, new Date()]);
      }

      const response = await request(app)
        .get('/api/1c/sync-logs?page=1&limit=3')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_logs).toHaveLength(3);
      expect(response.body.data.pagination.total).toBe(5);
      expect(response.body.data.pagination.pages).toBe(2);
    });

    test('should sort sync logs by started_at desc by default', async () => {
      const time1 = new Date('2024-01-01T10:00:00Z');
      const time2 = new Date('2024-01-01T11:00:00Z');
      const time3 = new Date('2024-01-01T12:00:00Z');

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['products', 'import', 'completed', 100, time1]);

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['branches', 'import', 'completed', 50, time3]);

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['categories', 'import', 'completed', 25, time2]);

      const response = await request(app)
        .get('/api/1c/sync-logs')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_logs).toHaveLength(3);
      
      // Should be sorted by started_at DESC
      expect(response.body.data.sync_logs[0].sync_type).toBe('branches'); // Latest
      expect(response.body.data.sync_logs[1].sync_type).toBe('categories'); // Middle
      expect(response.body.data.sync_logs[2].sync_type).toBe('products'); // Earliest
    });
  });

  describe('GET /api/1c/sync-logs/:id', () => {
    test('should return specific sync log by id', async () => {
      const result = await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, records_processed, started_at, completed_at, error_message, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
      `, [
        'products', 'import', 'completed', 100, 95, new Date(), new Date(),
        null, JSON.stringify({ batch_size: 50, source: '1C_API' })
      ]);

      const syncId = result.rows[0].id;

      const response = await request(app)
        .get(`/api/1c/sync-logs/${syncId}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_log.id).toBe(syncId);
      expect(response.body.data.sync_log.sync_type).toBe('products');
      expect(response.body.data.sync_log.direction).toBe('import');
      expect(response.body.data.sync_log.status).toBe('completed');
      expect(response.body.data.sync_log.records_total).toBe(100);
      expect(response.body.data.sync_log.records_processed).toBe(95);
      expect(response.body.data.sync_log.metadata).toEqual({ batch_size: 50, source: '1C_API' });
    });

    test('should return 404 for non-existent sync log', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .get(`/api/1c/sync-logs/${fakeId}`)
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Sync log not found');
    });

    test('should include performance metrics when available', async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 30000); // 30 seconds later

      const result = await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, records_processed, started_at, completed_at, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
      `, [
        'products', 'import', 'completed', 1000, 1000, startTime, endTime,
        JSON.stringify({ performance: { records_per_second: 33.33 } })
      ]);

      const syncId = result.rows[0].id;

      const response = await request(app)
        .get(`/api/1c/sync-logs/${syncId}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_log.duration_ms).toBeDefined();
      expect(response.body.data.sync_log.metadata.performance).toBeDefined();
    });
  });

  describe('DELETE /api/1c/sync-logs/:id', () => {
    test('should delete specific sync log', async () => {
      const result = await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, ['products', 'import', 'completed', 100, new Date()]);

      const syncId = result.rows[0].id;

      const response = await request(app)
        .delete(`/api/1c/sync-logs/${syncId}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Sync log deleted successfully');

      // Verify deletion
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM onec_sync_logs WHERE id = $1',
        [syncId]
      );
      expect(dbResult.rows).toHaveLength(0);
    });

    test('should return 404 for non-existent sync log', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app)
        .delete(`/api/1c/sync-logs/${fakeId}`)
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Sync log not found');
    });
  });

  describe('DELETE /api/1c/sync-logs', () => {
    test('should delete old sync logs', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // 10 days ago

      // Create old sync logs
      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['products', 'import', 'completed', 100, oldDate]);

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['branches', 'import', 'completed', 50, oldDate]);

      // Create recent sync log
      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['categories', 'import', 'completed', 25, recentDate]);

      const response = await request(app)
        .delete('/api/1c/sync-logs?older_than_days=30')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted_count).toBe(2);

      // Verify only recent log remains
      const remainingLogs = await DatabaseManager.query('SELECT * FROM onec_sync_logs');
      expect(remainingLogs.rows).toHaveLength(1);
      expect(remainingLogs.rows[0].sync_type).toBe('categories');
    });

    test('should delete sync logs by status', async () => {
      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['products', 'import', 'completed', 100, new Date()]);

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['branches', 'import', 'failed', 50, new Date()]);

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['categories', 'import', 'failed', 25, new Date()]);

      const response = await request(app)
        .delete('/api/1c/sync-logs?status=failed')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted_count).toBe(2);

      // Verify only completed log remains
      const remainingLogs = await DatabaseManager.query('SELECT * FROM onec_sync_logs');
      expect(remainingLogs.rows).toHaveLength(1);
      expect(remainingLogs.rows[0].status).toBe('completed');
    });

    test('should require at least one filter parameter', async () => {
      const response = await request(app)
        .delete('/api/1c/sync-logs')
        .set(createAuthHeaders())
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('filter parameter');
    });
  });

  describe('Sync log statistics', () => {
    test('should return sync statistics', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Create various sync logs
      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, records_processed, started_at, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['products', 'import', 'completed', 100, 100, yesterday, now]);

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, records_processed, started_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['branches', 'import', 'failed', 50, 25, yesterday]);

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['categories', 'import', 'in_progress', 25, now]);

      const response = await request(app)
        .get('/api/1c/sync-logs/summary')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.stats.total_syncs).toBe(3);
      expect(response.body.data.stats.completed_syncs).toBe(1);
      expect(response.body.data.stats.failed_syncs).toBe(1);
      expect(response.body.data.stats.in_progress_syncs).toBe(1);
    });

    test('should return sync statistics for specific time period', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Create sync logs in different time periods
      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['products', 'import', 'completed', 100, now]);

      await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
        VALUES ($1, $2, $3, $4, $5)
      `, ['branches', 'import', 'completed', 50, lastWeek]);

      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/1c/sync-logs/summary?start_date=${today}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats.total_syncs).toBe(1);
      expect(response.body.data.stats.completed_syncs).toBe(1);
    });
  });

  describe('Sync log performance tracking', () => {
    test('should track sync performance metrics', async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 60000); // 1 minute

      const result = await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, records_processed, started_at, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
      `, ['products', 'import', 'completed', 1000, 950, startTime, endTime]);

      const syncId = result.rows[0].id;

      const response = await request(app)
        .get(`/api/1c/sync-logs/${syncId}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_log.duration_ms).toBe(60000);
      expect(response.body.data.sync_log.success_rate).toBeCloseTo(0.95, 2);
      expect(response.body.data.sync_log.records_per_second).toBeCloseTo(15.83, 2);
    });
  });

  describe('Error handling in sync logs', () => {
    test('should store and retrieve error messages', async () => {
      const errorMessage = 'Database connection timeout occurred during import';
      
      const result = await DatabaseManager.query(`
        INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, records_processed, error_message, started_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
      `, ['products', 'import', 'failed', 100, 25, errorMessage, new Date()]);

      const syncId = result.rows[0].id;

      const response = await request(app)
        .get(`/api/1c/sync-logs/${syncId}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_log.error_message).toBe(errorMessage);
      expect(response.body.data.sync_log.status).toBe('failed');
    });
  });
});
