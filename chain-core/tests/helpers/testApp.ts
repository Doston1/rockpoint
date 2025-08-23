import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { DatabaseManager } from '../../src/database/manager';

// Import API routes
import onecRouter from '../../src/api/1c';

export async function createTestApp(): Promise<Express> {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize database if not already done
  try {
    await DatabaseManager.initialize();
  } catch (error) {
    // Database might already be initialized, continue
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount 1C API routes
  app.use('/api/1c', onecRouter);

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Test app error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  });

  return app;
}

export function createMockBranch(overrides: any = {}) {
  return {
    code: 'TEST_BRANCH_001',
    name: 'Test Branch One',
    address: '123 Test Street, Test City',
    phone: '+998901234567',
    email: 'test@branch.com',
    manager_name: 'Test Manager',
    timezone: 'Asia/Tashkent',
    currency: 'UZS',
    tax_rate: 12.0,
    is_active: true,
    api_endpoint: 'http://localhost:3000',
    network_status: 'online',
    onec_id: 'TEST_1C_BRANCH_001',
    ...overrides
  };
}

export function createMockProduct(overrides: any = {}) {
  return {
    oneC_id: 'TEST_PROD_001',
    sku: 'TST-001',
    barcode: '1234567890123',
    name: 'Test Product One',
    name_ru: 'Тестовый продукт один',
    name_uz: 'Test mahsulot bir',
    description: 'A test product for testing purposes',
    category_key: 'TEST_CATEGORY',
    brand: 'Test Brand',
    unit_of_measure: 'pcs',
    base_price: 25000.00,
    cost: 15000.00,
    tax_rate: 0.12,
    image_url: 'https://example.com/product.jpg',
    images: ['https://example.com/product1.jpg', 'https://example.com/product2.jpg'],
    attributes: { color: 'red', size: 'large' },
    is_active: true,
    ...overrides
  };
}

export function createMockCategory(overrides: any = {}) {
  return {
    key: 'TEST_CATEGORY',
    name: 'Test Category',
    name_ru: 'Тестовая категория',
    name_uz: 'Test kategoriya',
    description: 'A test category for testing',
    is_active: true,
    onec_id: 'TEST_1C_CAT_001',
    ...overrides
  };
}

export function createMockEmployee(overrides: any = {}) {
  return {
    employee_id: 'EMP_TEST_001',
    name: 'Test Employee',
    role: 'cashier',
    phone: '+998901234567',
    email: 'employee@test.com',
    hire_date: '2024-01-01',
    salary: 3000000.00,
    status: 'active',
    oneC_id: 'TEST_1C_EMP_001',
    ...overrides
  };
}

export function createAuthHeaders() {
  return {
    'Authorization': `Bearer ${global.testApiKey}`,
    'Content-Type': 'application/json'
  };
}
