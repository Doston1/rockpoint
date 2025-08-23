import { Express } from 'express';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';

let app: Express;

beforeAll(async () => {
  app = await createTestApp();
});

describe('1C API Authentication', () => {
  describe('API Key Authentication', () => {
    test('should accept valid API key with Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/1c/branches')
        .set('Authorization', `Bearer ${global.testApiKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should accept valid API key with ApiKey prefix', async () => {
      const response = await request(app)
        .get('/api/1c/branches')
        .set('Authorization', `ApiKey ${global.testApiKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should accept valid API key without prefix (backward compatibility)', async () => {
      const response = await request(app)
        .get('/api/1c/branches')
        .set('Authorization', global.testApiKey)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject request without Authorization header', async () => {
      const response = await request(app)
        .get('/api/1c/branches')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_AUTH_HEADER');
    });

    test('should reject invalid API key', async () => {
      const response = await request(app)
        .get('/api/1c/branches')
        .set('Authorization', 'Bearer invalid_api_key')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_API_KEY');
    });

    test('should reject empty Authorization header', async () => {
      const response = await request(app)
        .get('/api/1c/branches')
        .set('Authorization', '')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_AUTH_HEADER');
    });

    test('should reject malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/1c/branches')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_API_KEY');
    });
  });

  describe('Rate Limiting', () => {
    test('should handle multiple requests within rate limit', async () => {
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/1c/branches')
          .set('Authorization', `Bearer ${global.testApiKey}`)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('CORS and Headers', () => {
    test('should include proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/1c/branches')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('should accept JSON content type', async () => {
      const response = await request(app)
        .post('/api/1c/branches')
        .set('Authorization', `Bearer ${global.testApiKey}`)
        .set('Content-Type', 'application/json')
        .send([{
          code: 'TEST_BRANCH',
          name: 'Test Branch',
          oneC_id: 'TEST_1C_ID'
        }])
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
