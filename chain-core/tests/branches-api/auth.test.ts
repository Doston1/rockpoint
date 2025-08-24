import { Express } from 'express';
import request from 'supertest';
import { cleanupTestBranchData, createBranchAuthHeaders, createBranchTestApp, setupTestBranchData } from '../helpers/branchTestApp';

let app: Express;

beforeAll(async () => {
  app = await createBranchTestApp();
  await setupTestBranchData();
});

afterAll(async () => {
  await cleanupTestBranchData();
});

describe('Branch API Authentication', () => {
  describe('Branch Server Authentication', () => {
    test('should accept valid branch server API key', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/health')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should accept valid API key with Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/health')
        .set('Authorization', 'Bearer test_branch_server_api_key_123')
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject request without Authorization header', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/health')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_AUTHORIZATION');
    });

    test('should reject invalid API key', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/health')
        .set('Authorization', 'Bearer invalid_api_key')
        .set('Content-Type', 'application/json')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_API_KEY');
    });

    test('should reject inactive branch server', async () => {
      // First set the branch server as inactive
      const { DatabaseManager } = require('../../src/database/manager');
      await DatabaseManager.query(`
        UPDATE branch_servers 
        SET is_active = false 
        WHERE api_key = 'test_branch_server_api_key_123'
      `);

      const response = await request(app)
        .get('/api/branch-api/sync/health')
        .set(createBranchAuthHeaders())
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('BRANCH_SERVER_INACTIVE');

      // Restore active status for other tests
      await DatabaseManager.query(`
        UPDATE branch_servers 
        SET is_active = true 
        WHERE api_key = 'test_branch_server_api_key_123'
      `);
    });

    test('should include branch information in request after authentication', async () => {
      const response = await request(app)
        .get('/api/branch-api/sync/health')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('branch_code');
      expect(response.body.data.branch_code).toBe('TEST_BRANCH');
    });
  });

  describe('Authentication Middleware Coverage', () => {
    const endpoints = [
      '/api/branch-api/transactions/submit',
      '/api/branch-api/employees',
      '/api/branch-api/products/search',
      '/api/branch-api/inventory/movements',
      '/api/branch-api/sync/health'
    ];

    endpoints.forEach(endpoint => {
      test(`should require authentication for ${endpoint}`, async () => {
        const response = await request(app)
          .get(endpoint)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('MISSING_AUTHORIZATION');
      });
    });
  });

  describe('Authorization Header Formats', () => {
    const validFormats = [
      'Bearer test_branch_server_api_key_123',
      'ApiKey test_branch_server_api_key_123',
      'test_branch_server_api_key_123' // Backward compatibility
    ];

    validFormats.forEach(authHeader => {
      test(`should accept authorization format: ${authHeader.split(' ')[0] || 'plain'}`, async () => {
        const response = await request(app)
          .get('/api/branch-api/sync/health')
          .set('Authorization', authHeader)
          .set('Content-Type', 'application/json')
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });
});
