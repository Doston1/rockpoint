import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from '../../src/database/manager';

/**
 * Test utilities for FastPay tests
 */
export class FastPayTestUtils {
  
  /**
   * Create a test FastPay transaction in the database
   */
  static async createTestTransaction(data: {
    id?: string;
    transaction_id?: string;
    order_id?: string;
    amount?: number;
    amount_uzs?: number;
    employee_id?: string;
    terminal_id?: string;
    status?: string;
    otp_data?: string;
    cashbox_code?: string;
    service_id?: number;
  }) {
    const defaults = {
      id: uuidv4(),
      transaction_id: uuidv4(),
      order_id: 'order_test_' + Math.random().toString(36).substring(7),
      amount: 50000 * 100, // Convert UZS to tiyin
      amount_uzs: 50000,
      employee_id: 'emp_test',
      terminal_id: 'term_test',
      status: 'success',
      otp_data: 'test_qr_code_' + Math.random().toString(36).substring(7).padEnd(40, '0'),
      cashbox_code: 'TEST_CASHBOX',
      service_id: 12345
    };

    const transaction = { ...defaults, ...data };

    await DatabaseManager.query(`
      INSERT INTO uzum_fastpay_transactions 
      (id, transaction_id, order_id, amount, amount_uzs, otp_data, employee_id, terminal_id, 
       status, cashbox_code, service_id, request_payload, authorization_header, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
    `, [
      transaction.id,
      transaction.transaction_id,
      transaction.order_id,
      transaction.amount,
      transaction.amount_uzs,
      transaction.otp_data,
      transaction.employee_id,
      transaction.terminal_id,
      transaction.status,
      transaction.cashbox_code,
      transaction.service_id,
      JSON.stringify({ test: true }), // request_payload
      'test_auth_header' // authorization_header
    ]);

    return transaction;
  }

  /**
   * Clean up test data from the database
   */
  static async cleanupTestData() {
    await DatabaseManager.query(`DELETE FROM uzum_fastpay_transactions WHERE order_id LIKE 'order_test_%'`);
    await DatabaseManager.query(`DELETE FROM uzum_bank_config WHERE config_key LIKE 'test_%'`);
  }

  /**
   * Generate a valid QR code for testing
   */
  static generateTestQRCode(length: number = 50): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'qr_';
    for (let i = 0; i < length - 3; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate a test order ID
   */
  static generateTestOrderId(): string {
    return 'order_test_' + Date.now() + '_' + Math.random().toString(36).substring(7);
  }

  /**
   * Create test configuration in database
   */
  static async createTestConfiguration(overrides: Record<string, string> = {}) {
    const defaultConfig = {
      merchant_service_user_id: 'test_merchant_123',
      secret_key: 'test_secret_key_456',
      service_id: '12345',
      api_base_url: 'https://test-api.uzum.com',
      request_timeout_ms: '10000',
      cashbox_code_prefix: 'TEST',
      max_retry_attempts: '2',
      enable_logging: 'true',
      ...overrides
    };

    for (const [key, value] of Object.entries(defaultConfig)) {
      await DatabaseManager.query(`
        INSERT INTO uzum_bank_config (config_key, config_value, is_encrypted, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, true, NOW(), NOW())
        ON CONFLICT (config_key) DO UPDATE SET
        config_value = $2, updated_at = NOW()
      `, [key, value, key === 'secret_key']);
    }
  }

  /**
   * Verify transaction exists in database
   */
  static async verifyTransactionExists(transactionId: string): Promise<any> {
    const result = await DatabaseManager.query(
      'SELECT * FROM uzum_fastpay_transactions WHERE id = $1',
      [transactionId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get transaction count for testing pagination
   */
  static async getTransactionCount(filters: any = {}): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM uzum_fastpay_transactions WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.employee_id) {
      query += ` AND employee_id = $${paramIndex}`;
      params.push(filters.employee_id);
      paramIndex++;
    }

    if (filters.terminal_id) {
      query += ` AND terminal_id = $${paramIndex}`;
      params.push(filters.terminal_id);
      paramIndex++;
    }

    if (filters.order_id) {
      query += ` AND order_id = $${paramIndex}`;
      params.push(filters.order_id);
      paramIndex++;
    }

    const result = await DatabaseManager.query(query, params);
    return parseInt(result.rows[0].count);
  }

  /**
   * Mock successful Uzum Bank API response
   */
  static createMockSuccessResponse(orderId: string) {
    return {
      status: 200,
      data: {
        success: true,
        order_id: orderId,
        status: 'success',
        message: 'Payment processed successfully',
        transaction_id: 'uzum_' + orderId
      }
    };
  }

  /**
   * Mock failed Uzum Bank API response
   */
  static createMockFailureResponse(errorCode: string, errorMessage: string) {
    return {
      status: 200,
      data: {
        success: false,
        error_code: errorCode,
        error_message: errorMessage
      }
    };
  }

  /**
   * Mock network error response
   */
  static createMockNetworkError() {
    return new Error('ECONNREFUSED: Connection refused');
  }

  /**
   * Mock timeout error response
   */
  static createMockTimeoutError() {
    const error = new Error('timeout of 10000ms exceeded');
    (error as any).code = 'ECONNABORTED';
    return error;
  }

  /**
   * Validate FastPay response structure
   */
  static validateFastPayResponse(response: any, expectedSuccess: boolean): boolean {
    if (!response) return false;
    if (typeof response.success !== 'boolean') return false;
    if (response.success !== expectedSuccess) return false;

    if (expectedSuccess) {
      if (!response.data) return false;
      if (typeof response.data !== 'object') return false;
    } else {
      if (!response.error) return false;
      if (typeof response.error !== 'string') return false;
    }
    
    return true;
  }

  /**
   * Wait for a specified amount of time (for testing async operations)
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate test date range
   */
  static generateDateRange(daysBack: number = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    return {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    };
  }
}
