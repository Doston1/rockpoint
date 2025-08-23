import axios from 'axios';
import { DatabaseManager } from '../../src/database/manager';
import { FastPayService } from '../../src/services/FastPayService';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock DatabaseManager.query static method
jest.mock('../../src/database/manager', () => ({
  DatabaseManager: {
    query: jest.fn()
  }
}));

describe('FastPayService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockClear();
    mockedAxios.get.mockClear();
    
    // Reset config cache
    (FastPayService as any).config = null;
    (FastPayService as any).configLastFetched = 0;
  });

  describe('Configuration Management', () => {
    test('should load configuration successfully', async () => {
      // Mock database response with complete configuration
      const mockConfigRows = [
        { config_key: 'api_base_url', config_value: 'https://api.fastpay.uz/v1', is_encrypted: false },
        { config_key: 'merchant_service_user_id', config_value: 'test_merchant', is_encrypted: false },
        { config_key: 'secret_key', config_value: 'test_secret', is_encrypted: true },
        { config_key: 'service_id', config_value: '12345', is_encrypted: false },
        { config_key: 'cashbox_code_prefix', config_value: 'TEST', is_encrypted: false },
        { config_key: 'request_timeout_ms', config_value: '30000', is_encrypted: false },
        { config_key: 'max_retry_attempts', config_value: '3', is_encrypted: false },
        { config_key: 'enable_logging', config_value: 'true', is_encrypted: false }
      ];

      (DatabaseManager.query as jest.Mock).mockResolvedValue({
        rows: mockConfigRows
      });

      // Access private loadConfig method to test configuration loading
      const config = await (FastPayService as any).loadConfig();
      
      expect(config).toBeDefined();
      expect(config.api_base_url).toBe('https://api.fastpay.uz/v1');
      expect(config.merchant_service_user_id).toBe('test_merchant');
      expect(DatabaseManager.query).toHaveBeenCalled();
    });

    test('should handle missing configuration', async () => {
      // Mock empty database response
      (DatabaseManager.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect((FastPayService as any).loadConfig()).rejects.toThrow('FastPay service is not properly configured');
    });

    test('should cache configuration properly', async () => {
      const mockConfigRows = [
        { config_key: 'api_base_url', config_value: 'https://api.fastpay.uz/v1', is_encrypted: false },
        { config_key: 'merchant_service_user_id', config_value: 'test_merchant', is_encrypted: false },
        { config_key: 'secret_key', config_value: 'test_secret', is_encrypted: true },
        { config_key: 'service_id', config_value: '12345', is_encrypted: false },
        { config_key: 'cashbox_code_prefix', config_value: 'TEST', is_encrypted: false },
        { config_key: 'request_timeout_ms', config_value: '30000', is_encrypted: false },
        { config_key: 'max_retry_attempts', config_value: '3', is_encrypted: false },
        { config_key: 'enable_logging', config_value: 'true', is_encrypted: false }
      ];

      (DatabaseManager.query as jest.Mock).mockResolvedValue({
        rows: mockConfigRows
      });

      // First call should fetch from database
      await (FastPayService as any).loadConfig();
      expect(DatabaseManager.query).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await (FastPayService as any).loadConfig();
      expect(DatabaseManager.query).toHaveBeenCalledTimes(1); // Should not increase
    });
  });

  describe('Payment Processing', () => {
    test('should validate amount constraints', async () => {
      const invalidPaymentData = {
        amount_uzs: 100, // Too small (minimum is 1000)
        otp_data: '1234567890123456789012345678901234567890', // 40 chars
        employee_id: 'emp_123',
        terminal_id: 'term_123'
      };

      // Mock empty configuration to trigger validation error
      (DatabaseManager.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await FastPayService.createPayment(invalidPaymentData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('FastPay service is not properly configured');
    });

    test('should validate QR code data length', async () => {
      const invalidPaymentData = {
        amount_uzs: 50000,
        otp_data: 'short', // Too short (minimum is 40 chars)
        employee_id: 'emp_123',
        terminal_id: 'term_123'
      };

      // Mock empty configuration to trigger validation error
      (DatabaseManager.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await FastPayService.createPayment(invalidPaymentData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('FastPay service is not properly configured');
    });

    test('should create payment successfully with valid data', async () => {
      // Mock configuration
      const mockConfigRows = [
        { config_key: 'api_base_url', config_value: 'https://api.fastpay.uz/v1', is_encrypted: false },
        { config_key: 'merchant_service_user_id', config_value: 'test_merchant', is_encrypted: false },
        { config_key: 'secret_key', config_value: 'test_secret', is_encrypted: true },
        { config_key: 'service_id', config_value: '12345', is_encrypted: false },
        { config_key: 'cashbox_code_prefix', config_value: 'TEST', is_encrypted: false },
        { config_key: 'request_timeout_ms', config_value: '30000', is_encrypted: false },
        { config_key: 'max_retry_attempts', config_value: '3', is_encrypted: false },
        { config_key: 'enable_logging', config_value: 'true', is_encrypted: false }
      ];

      (DatabaseManager.query as jest.Mock)
        .mockResolvedValueOnce({ rows: mockConfigRows }) // For loadConfig
        .mockResolvedValueOnce({ rows: [] }) // For unique order ID check
        .mockResolvedValueOnce({ rows: [{ id: 'db-transaction-id' }] }) // For database insert
        .mockResolvedValueOnce({}) // For audit log
        .mockResolvedValueOnce({}) // For status update
        .mockResolvedValueOnce({}); // For final audit log

      // Mock axios response
      (mockedAxios as any).mockResolvedValue({
        data: {
          error_code: 0,
          payment_id: 'payment_123'
        },
        status: 200
      });

      const paymentData = {
        amount_uzs: 50000,
        otp_data: '1234567890123456789012345678901234567890', // 40 chars minimum
        employee_id: 'emp_123',
        terminal_id: 'term_123'
      };

      const result = await FastPayService.createPayment(paymentData);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockedAxios).toHaveBeenCalledTimes(1);
    });
  });

  describe('Payment Status Checking', () => {
    test('should check payment status successfully', async () => {
      // Mock configuration
      const mockConfigRows = [
        { config_key: 'api_base_url', config_value: 'https://api.fastpay.uz/v1', is_encrypted: false },
        { config_key: 'merchant_service_user_id', config_value: 'test_merchant', is_encrypted: false },
        { config_key: 'secret_key', config_value: 'test_secret', is_encrypted: true },
        { config_key: 'service_id', config_value: '12345', is_encrypted: false },
        { config_key: 'cashbox_code_prefix', config_value: 'TEST', is_encrypted: false },
        { config_key: 'request_timeout_ms', config_value: '30000', is_encrypted: false },
        { config_key: 'max_retry_attempts', config_value: '3', is_encrypted: false },
        { config_key: 'enable_logging', config_value: 'true', is_encrypted: false }
      ];

      (DatabaseManager.query as jest.Mock)
        .mockResolvedValueOnce({ rows: mockConfigRows }) // For loadConfig
        .mockResolvedValueOnce({ rows: [{ payment_id: 'payment_123', service_id: '12345', employee_id: 'emp_123', terminal_id: 'term_123' }] }) // For transaction lookup
        .mockResolvedValueOnce({}); // For audit log

      // Mock axios response
      (mockedAxios as any).mockResolvedValue({
        data: {
          error_code: 0,
          payment_status: 'completed'
        },
        status: 200
      });

      const result = await FastPayService.checkPaymentStatus('transaction_123');
      
      expect(result.success).toBe(true);
      expect(mockedAxios).toHaveBeenCalledTimes(1);
    });

    test('should handle API errors gracefully', async () => {
      const mockConfigRows = [
        { config_key: 'api_base_url', config_value: 'https://api.fastpay.uz/v1', is_encrypted: false },
        { config_key: 'merchant_service_user_id', config_value: 'test_merchant', is_encrypted: false },
        { config_key: 'secret_key', config_value: 'test_secret', is_encrypted: true },
        { config_key: 'service_id', config_value: '12345', is_encrypted: false },
        { config_key: 'cashbox_code_prefix', config_value: 'TEST', is_encrypted: false },
        { config_key: 'request_timeout_ms', config_value: '30000', is_encrypted: false },
        { config_key: 'max_retry_attempts', config_value: '3', is_encrypted: false },
        { config_key: 'enable_logging', config_value: 'true', is_encrypted: false }
      ];

      (DatabaseManager.query as jest.Mock)
        .mockResolvedValueOnce({ rows: mockConfigRows }) // For loadConfig
        .mockResolvedValueOnce({ rows: [{ payment_id: 'payment_123', service_id: '12345', employee_id: 'emp_123', terminal_id: 'term_123' }] }); // For transaction lookup

      (mockedAxios as any).mockRejectedValue(new Error('API Error'));

      const result = await FastPayService.checkPaymentStatus('transaction_123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('API Error');
    });
  });

  describe('Payment Reversal', () => {
    test('should reverse payment successfully', async () => {
      const mockConfigRows = [
        { config_key: 'api_base_url', config_value: 'https://api.fastpay.uz/v1', is_encrypted: false },
        { config_key: 'merchant_service_user_id', config_value: 'test_merchant', is_encrypted: false },
        { config_key: 'secret_key', config_value: 'test_secret', is_encrypted: true },
        { config_key: 'service_id', config_value: '12345', is_encrypted: false },
        { config_key: 'cashbox_code_prefix', config_value: 'TEST', is_encrypted: false },
        { config_key: 'request_timeout_ms', config_value: '30000', is_encrypted: false },
        { config_key: 'max_retry_attempts', config_value: '3', is_encrypted: false },
        { config_key: 'enable_logging', config_value: 'true', is_encrypted: false }
      ];

      (DatabaseManager.query as jest.Mock)
        .mockResolvedValueOnce({ rows: mockConfigRows }) // For loadConfig
        .mockResolvedValueOnce({ rows: [{ id: 'txn_123', payment_id: 'pay_123', service_id: '12345', employee_id: 'emp_123', terminal_id: 'term_123' }] }) // For transaction lookup
        .mockResolvedValueOnce({}) // For reversal record insert
        .mockResolvedValueOnce({}) // For reversal record update
        .mockResolvedValueOnce({}) // For transaction status update
        .mockResolvedValueOnce({}); // For audit log

      (mockedAxios as any).mockResolvedValue({
        data: {
          error_code: 0,
          reversal_id: 'reversal_123'
        },
        status: 200
      });

      const result = await FastPayService.reversePayment('order_123', 'Test reversal', 'admin_user');
      
      expect(result.success).toBe(true);
      expect(mockedAxios).toHaveBeenCalledTimes(1);
    });
  });

  describe('Utility Methods', () => {
    test('should generate authorization header correctly', () => {
      const secretKey = 'test_secret';
      const merchantId = 'test_merchant';
      
      // Access private method for testing
      const authHeader = (FastPayService as any).generateAuthHeader(secretKey, merchantId);
      
      expect(authHeader).toBeDefined();
      expect(authHeader).toContain(merchantId);
      expect(authHeader.split(':')).toHaveLength(3); // merchant:hash:timestamp format
    });

    test('should validate OTP data correctly', () => {
      const validOtpData = '1234567890123456789012345678901234567890'; // 40 chars
      const invalidOtpData = 'short';
      
      // Access private method for testing
      const validResult = (FastPayService as any).validateOtpData(validOtpData);
      const invalidResult = (FastPayService as any).validateOtpData(invalidOtpData);
      
      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.error).toContain('40 characters');
    });

    test('should generate cashbox code correctly', () => {
      const terminalId = 'TERM123';
      const prefix = 'TEST';
      
      // Access private method for testing
      const cashboxCode = (FastPayService as any).generateCashboxCode(terminalId, prefix);
      
      expect(cashboxCode).toBe('TEST_TERM123');
    });
  });
});
