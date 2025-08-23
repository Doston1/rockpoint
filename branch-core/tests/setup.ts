import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from '../src/database/manager';

// Mock console to reduce noise during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(async () => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn();
  console.error = jest.fn();
  
  // Initialize test database connection
  try {
    await DatabaseManager.initialize();
    console.log = originalConsoleLog;
    console.log('✅ Test database connected');
    console.log = jest.fn();
  } catch (error) {
    console.error = originalConsoleError;
    console.error('❌ Failed to connect to test database:', error);
    process.exit(1);
  }
});

afterAll(async () => {
  // Restore console
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  
  // Close database connection
  try {
    await DatabaseManager.close();
    console.log('✅ Test database connection closed');
  } catch (error) {
    console.error('❌ Failed to close test database connection:', error);
  }
});

// Cleanup function for tests
export const cleanupDatabase = async () => {
  await DatabaseManager.query('DELETE FROM uzum_fastpay_transactions WHERE created_at < NOW()');
  await DatabaseManager.query('DELETE FROM uzum_bank_config WHERE config_key LIKE $1', ['test_%']);
};

// Helper to create test configuration
export const createTestConfig = async () => {
  const testConfig = [
    { key: 'merchant_service_user_id', value: 'test_merchant_123', encrypted: false },
    { key: 'secret_key', value: 'test_secret_key_456', encrypted: true },
    { key: 'service_id', value: '12345', encrypted: false },
    { key: 'api_base_url', value: 'https://test.api.uzum.com', encrypted: false },
    { key: 'request_timeout_ms', value: '10000', encrypted: false },
    { key: 'cashbox_code_prefix', value: 'TEST', encrypted: false },
    { key: 'max_retry_attempts', value: '2', encrypted: false },
    { key: 'enable_logging', value: 'true', encrypted: false }
  ];

  for (const config of testConfig) {
    await DatabaseManager.query(
      `INSERT INTO uzum_bank_config (config_key, config_value, is_encrypted, is_active, updated_at) 
       VALUES ($1, $2, $3, true, NOW()) 
       ON CONFLICT (config_key) DO UPDATE SET 
       config_value = $2, is_encrypted = $3, updated_at = NOW()`,
      [config.key, config.value, config.encrypted]
    );
  }
};

// Mock data generators
export const generateMockQRCode = (): string => {
  // Generate a QR code that's at least 40 characters (API requirement)
  const baseData = 'qr_fastpay_test_' + Math.random().toString(36).substring(2, 15);
  return baseData.padEnd(40, '0123456789abcdef');
};

export const generateMockOrderId = (): string => {
  return 'fp_order_' + uuidv4().replace(/-/g, '').substring(0, 16);
};

export const generateMockTransactionId = (): string => {
  return uuidv4();
};

export const generateMockEmployeeId = (): string => {
  return 'emp_' + Math.random().toString(36).substring(2, 8);
};

export const generateMockTerminalId = (): string => {
  return 'term_' + Math.random().toString(36).substring(2, 8);
};

// Complete test payment data generator
export const generateTestPaymentData = (overrides: any = {}) => {
  return {
    amount_uzs: 50000,
    otp_data: generateMockQRCode(),
    employee_id: generateMockEmployeeId(),
    terminal_id: generateMockTerminalId(),
    pos_transaction_id: generateMockTransactionId(),
    ...overrides
  };
};
