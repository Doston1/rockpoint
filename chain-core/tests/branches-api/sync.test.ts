import { Express } from 'express';
import request from 'supertest';
import { cleanupTestBranchData, createBranchAuthHeaders, createBranchTestApp, createMockHealthStatus, setupTestBranchData } from '../helpers/branchTestApp';

let app: Express;
let testData: any;

beforeAll(async () => {
  app = await createBranchTestApp();
  testData = await setupTestBranchData();
});

afterAll(async () => {
  await cleanupTestBranchData();
});

describe('Branch Sync API', () => {
  describe('POST /api/branch-api/sync/health', () => {
    test('should update health status successfully', async () => {
      const healthStatus = createMockHealthStatus({
        status: 'online',
        last_activity: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/branch-api/sync/health')
        .set(createBranchAuthHeaders())
        .send(healthStatus)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('online');
      expect(response.body.data).toHaveProperty('branch_code');
    });

    test('should validate health status data', async () => {
      const invalidHealth = {
        // This test expects all fields to be optional per the schema
        last_activity: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/branch-api/sync/health')
        .set(createBranchAuthHeaders())
        .send(invalidHealth)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle different status values', async () => {
      const statuses = ['online', 'offline', 'maintenance', 'error'];
      
      for (const status of statuses) {
        const healthStatus = createMockHealthStatus({ status });

        const response = await request(app)
          .post('/api/branch-api/sync/health')
          .set(createBranchAuthHeaders())
          .send(healthStatus)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe(status);
      }
    });

    test('should store system information', async () => {
      const healthStatus = createMockHealthStatus({
        system_info: {
          cpu_usage: 65.4,
          memory_usage: 78.2,
          disk_space: 45.8,
          uptime: 172800
        }
      });

      const response = await request(app)
        .post('/api/branch-api/sync/health')
        .set(createBranchAuthHeaders())
        .send(healthStatus)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.system_info).toEqual(healthStatus.system_info);
    });
  });

  describe('GET /api/branch-api/sync/health', () => {
    test('should get current health status', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/health')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('last_update');
      expect(response.body.data).toHaveProperty('branch_code');
    });

    test('should include system metrics', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/health')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('system_info');
      expect(response.body.data).toHaveProperty('network_info');
    });
  });

  describe('POST /api/branch-api/sync/ping', () => {
    test('should respond to ping successfully', async () => {
      const pingData = {
        timestamp: new Date().toISOString(),
        sequence: 1
      };

      const response = await request(app)
        .post('/api/branch-api/sync/ping')
        .set(createBranchAuthHeaders())
        .send(pingData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pong');
      expect(response.body.data).toHaveProperty('server_time');
      expect(response.body.data.sequence).toBe(1);
    });

    test('should measure round trip time', async () => {
      const startTime = Date.now();
      const pingData = {
        timestamp: new Date(startTime).toISOString(),
        sequence: 1
      };

      const response = await request(app)
        .post('/api/branch-api/sync/ping')
        .set(createBranchAuthHeaders())
        .send(pingData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('round_trip_ms');
      expect(typeof response.body.data.round_trip_ms).toBe('number');
    });
  });

  describe('POST /api/branch-api/sync/request', () => {
    test('should request data sync successfully', async () => {
      const syncRequest = {
        sync_type: 'products',
        since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 24 hours ago
      };

      const response = await request(app)
        .post('/api/branch-api/sync/request')
        .set(createBranchAuthHeaders())
        .send(syncRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sync_id');
      expect(response.body.data.sync_type).toBe('products');
      expect(response.body.data.status).toBe('initiated');
    });

    test('should validate sync request data', async () => {
      const invalidSync = {
        // Missing required sync_type
        since: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/branch-api/sync/request')
        .set(createBranchAuthHeaders())
        .send(invalidSync)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should handle different sync types', async () => {
      const syncTypes = ['products', 'employees', 'inventory'];

      for (const syncType of syncTypes) {
        const syncRequest = {
          sync_type: syncType,
          since: new Date().toISOString()
        };

        const response = await request(app)
          .post('/api/branch-api/sync/request')
          .set(createBranchAuthHeaders())
          .send(syncRequest)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.sync_type).toBe(syncType);
      }
    });

    test('should support incremental sync', async () => {
      const syncRequest = {
        sync_type: 'products',
        since: new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago
      };

      const response = await request(app)
        .post('/api/branch-api/sync/request')
        .set(createBranchAuthHeaders())
        .send(syncRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sync_type).toBe('products');
    });
  });

  describe('GET /api/branch-api/sync/status/:syncId', () => {
    test('should get sync status', async () => {
      // First initiate a sync
      const syncRequest = {
        sync_type: 'products',
        since: new Date().toISOString()
      };

      const syncResponse = await request(app)
        .post('/api/branch-api/sync/request')
        .set(createBranchAuthHeaders())
        .send(syncRequest)
        .expect(200);

      const syncId = syncResponse.body.data.sync_id;

      // Then check its status
      const statusResponse = await request(app)
        .get(`/api/branch-api/sync/status/${syncId}`)
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.sync_id).toBe(syncId);
      expect(statusResponse.body.data).toHaveProperty('status');
      expect(statusResponse.body.data).toHaveProperty('progress');
    });

    test('should return not found for non-existent sync', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/status/NON_EXISTENT_SYNC')
        .set(createBranchAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SYNC_NOT_FOUND');
    });
  });

  describe('GET /api/branch-api/sync/history', () => {
    test('should get sync history', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/history')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should filter by sync type', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/history?sync_type=products')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should filter by status', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/history?status=completed')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/history?page=1&limit=10')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toHaveProperty('total');
    });
  });

  describe('POST /api/branch-api/sync/complete/:syncId', () => {
    test('should mark sync as completed', async () => {
      // First initiate a sync
      const syncRequest = {
        sync_type: 'products',
        since: new Date().toISOString()
      };

      const syncResponse = await request(app)
        .post('/api/branch-api/sync/request')
        .set(createBranchAuthHeaders())
        .send(syncRequest)
        .expect(200);

      const syncId = syncResponse.body.data.sync_id;

      // Then complete it
      const completionData = {
        status: 'completed',
        records_processed: 150,
        records_total: 150,
        error_message: null
      };

      const response = await request(app)
        .post(`/api/branch-api/sync/complete/${syncId}`)
        .set(createBranchAuthHeaders())
        .send(completionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.records_processed).toBe(150);
    });

    test('should handle sync failure', async () => {
      // First initiate a sync
      const syncRequest = {
        sync_type: 'products',
        since: new Date().toISOString()
      };

      const syncResponse = await request(app)
        .post('/api/branch-api/sync/request')
        .set(createBranchAuthHeaders())
        .send(syncRequest)
        .expect(200);

      const syncId = syncResponse.body.data.sync_id;

      // Then mark as failed
      const failureData = {
        status: 'failed',
        records_processed: 75,
        records_total: 150,
        error_message: 'Network connection timeout'
      };

      const response = await request(app)
        .post(`/api/branch-api/sync/complete/${syncId}`)
        .set(createBranchAuthHeaders())
        .send(failureData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('failed');
      expect(response.body.data.error_message).toBe('Network connection timeout');
    });
  });

  describe('GET /api/branch-api/sync/metrics', () => {
    test('should get sync metrics', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/metrics')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total_syncs');
      expect(response.body.data).toHaveProperty('successful_syncs');
      expect(response.body.data).toHaveProperty('failed_syncs');
      expect(response.body.data).toHaveProperty('average_sync_time');
      expect(response.body.data).toHaveProperty('last_successful_sync');
    });

    test('should include sync type breakdown', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/metrics?include_breakdown=true')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('by_sync_type');
      expect(Array.isArray(response.body.data.by_sync_type)).toBe(true);
    });
  });
});
