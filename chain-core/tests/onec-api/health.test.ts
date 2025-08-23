import request from 'supertest';
import { createTestApp } from '../helpers/testApp';

describe('Basic API Health Check', () => {
  let app: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  test('should respond to health check', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
  });

  test('should reject unauthorized request', async () => {
    const response = await request(app)
      .get('/api/1c/branches')
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  test('should accept valid API key', async () => {
    const response = await request(app)
      .get('/api/1c/branches')
      .set('Authorization', `Bearer ${global.testApiKey}`)
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
