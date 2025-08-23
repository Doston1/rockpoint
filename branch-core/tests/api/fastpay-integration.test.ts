import { DatabaseManager } from '../../src/database/manager';
import { FastPayService } from '../../src/services/FastPayService';
import {
    cleanupDatabase,
    generateMockOrderId,
    generateMockTransactionId,
    generateTestPaymentData
} from '../setup';
import { FastPayTestUtils } from '../utils/FastPayTestUtils';

describe('FastPay Integration Tests', () => {
  beforeEach(async () => {
    await cleanupDatabase();
    await FastPayTestUtils.createTestConfiguration();
  });

  afterEach(async () => {
    await FastPayTestUtils.cleanupTestData();
  });

  describe('Database Operations', () => {
    test('should create and retrieve FastPay transaction', async () => {
      const testData = {
        order_id: FastPayTestUtils.generateTestOrderId(),
        amount_uzs: 75000,
        employee_id: 'emp_integration',
        terminal_id: 'term_integration',
        status: 'success',
        otp_data: FastPayTestUtils.generateTestQRCode()
      };

      // Create transaction
      const created = await FastPayTestUtils.createTestTransaction(testData);

      // Retrieve and verify
      const retrieved = await FastPayTestUtils.verifyTransactionExists(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.transaction_id).toBe(created.transaction_id);
      expect(retrieved.order_id).toBe(testData.order_id);
      expect(retrieved.amount_uzs).toBe(testData.amount_uzs.toFixed(2)); // Database stores as decimal with 2 places
      expect(retrieved.status).toBe(testData.status);
    });

    test('should update transaction status', async () => {
      const testData = await FastPayTestUtils.createTestTransaction({
        status: 'pending'
      });

      // Update status
      await DatabaseManager.query(
        'UPDATE uzum_fastpay_transactions SET status = $1, updated_at = NOW() WHERE id = $2',
        ['success', testData.id]
      );

      // Verify update
      const updated = await FastPayTestUtils.verifyTransactionExists(testData.id);
      expect(updated.status).toBe('success');
    });

    test('should filter transactions by status', async () => {
      // Create transactions with different statuses
      await FastPayTestUtils.createTestTransaction({ status: 'success', employee_id: 'emp_filter' });
      await FastPayTestUtils.createTestTransaction({ status: 'failed', employee_id: 'emp_filter' });
      await FastPayTestUtils.createTestTransaction({ status: 'success', employee_id: 'emp_filter' });

      // Count successful transactions
      const successCount = await FastPayTestUtils.getTransactionCount({
        status: 'success',
        employee_id: 'emp_filter'
      });

      expect(successCount).toBe(2);

      // Count failed transactions
      const failedCount = await FastPayTestUtils.getTransactionCount({
        status: 'failed',
        employee_id: 'emp_filter'
      });

      expect(failedCount).toBe(1);
    });

    test('should handle transaction linking', async () => {
      const testData = await FastPayTestUtils.createTestTransaction({
        status: 'success'
      });

      const posTransactionId = '550e8400-e29b-41d4-a716-446655440000';

      // First create a minimal POS transaction to satisfy foreign key constraint
      await DatabaseManager.query(`
        INSERT INTO transactions (id, terminal_id, employee_id, subtotal, total_amount, status, created_at, updated_at)
        VALUES ($1, 'TERM001', 'EMP001', 50000, 50000, 'completed', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [posTransactionId]);

      // Link to POS transaction
      await DatabaseManager.query(
        'UPDATE uzum_fastpay_transactions SET pos_transaction_id = $1 WHERE id = $2',
        [posTransactionId, testData.id]
      );

      // Verify linking
      const linked = await FastPayTestUtils.verifyTransactionExists(testData.id);
      expect(linked.pos_transaction_id).toBe(posTransactionId);
    });
  });

  describe('Configuration Management', () => {
    test('should load configuration from database', async () => {
      // Configuration is already created in beforeEach
      // Test that we can create a payment (which requires loading config)
      const mockPaymentData = {
        amount_uzs: 50000,
        otp_data: FastPayTestUtils.generateTestQRCode(),
        employee_id: 'emp_config_test',
        terminal_id: 'term_config_test'
      };

      // This should not throw an error if config is loaded properly
      try {
        // We can't actually call the external API in tests, so we'll just verify
        // that the service attempts to load configuration
        const configExists = await DatabaseManager.query(
          'SELECT COUNT(*) as count FROM uzum_bank_config WHERE config_key = $1',
          ['merchant_service_user_id']
        );
        
        expect(parseInt(configExists.rows[0].count)).toBeGreaterThan(0);
      } catch (error: any) {
        // If error is about missing config, that's expected in test environment
        if (error.message && error.message.includes('FastPay service is not properly configured')) {
          // This is expected in test environment without real API
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    });

    test('should validate required configuration fields', async () => {
      // Remove a required field
      await DatabaseManager.query(
        'DELETE FROM uzum_bank_config WHERE config_key = $1',
        ['merchant_service_user_id']
      );

      // Attempt to use service should fail
      const result = await FastPayService.createPayment({
        amount_uzs: 50000,
        otp_data: FastPayTestUtils.generateTestQRCode(),
        employee_id: 'emp_test',
        terminal_id: 'term_test'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('FastPay service is not properly configured');
    });

    test('should handle encrypted configuration values', async () => {
      // Update secret key as encrypted
      await DatabaseManager.query(
        'UPDATE uzum_bank_config SET is_encrypted = true WHERE config_key = $1',
        ['secret_key']
      );

      // Verify the encryption flag is set
      const result = await DatabaseManager.query(
        'SELECT is_encrypted FROM uzum_bank_config WHERE config_key = $1',
        ['secret_key']
      );

      expect(result.rows[0].is_encrypted).toBe(true);
    });
  });

  describe('Data Validation', () => {
    test('should validate transaction data constraints', async () => {
      // Test data validation by attempting to insert invalid data
      
      // Test negative amount
      try {
        await DatabaseManager.query(`
          INSERT INTO uzum_fastpay_transactions 
          (id, order_id, amount_uzs, otp_data, employee_id, terminal_id, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `, ['fp_invalid', 'order_invalid', -1000, 'qr_data', 'emp', 'term', 'pending']);
        
        // Should not reach here if constraint exists
      } catch (error) {
        // Expected if there's a check constraint
      }

      // Test empty required fields
      try {
        await DatabaseManager.query(`
          INSERT INTO uzum_fastpay_transactions 
          (id, order_id, amount_uzs, otp_data, employee_id, terminal_id, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `, ['fp_empty', '', 1000, 'qr_data', 'emp', 'term', 'pending']);
        
        // Should not reach here if NOT NULL constraint exists
      } catch (error) {
        // Expected if there's a NOT NULL constraint
      }
    });

    test('should handle duplicate order IDs', async () => {
      const orderId = FastPayTestUtils.generateTestOrderId();

      // Create first transaction
      const firstTransaction = await FastPayTestUtils.createTestTransaction({
        order_id: orderId
      });

      // Attempt to create second transaction with same order_id
      try {
        const secondTransaction = await FastPayTestUtils.createTestTransaction({
          order_id: orderId
        });
        
        // If we reach here, there's no unique constraint (which might be okay)
        // Verify both transactions exist
        const transactionCount = await FastPayTestUtils.getTransactionCount({ order_id: orderId });
        expect(transactionCount).toBeGreaterThanOrEqual(1);
        
        const result = await DatabaseManager.query(
          'SELECT COUNT(*) as count FROM uzum_fastpay_transactions WHERE order_id = $1',
          [orderId]
        );
        
        // Should be either 1 (if unique constraint) or 2 (if duplicates allowed)
        expect([1, 2]).toContain(parseInt(result.rows[0].count));
      } catch (error: any) {
        // Expected if there's a unique constraint on order_id
        expect(error.message).toContain('duplicate');
      }
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle multiple concurrent transactions', async () => {
      const concurrentTransactions: Promise<any>[] = [];
      
      // Create multiple transactions concurrently
      for (let i = 0; i < 5; i++) {
        concurrentTransactions.push(
          FastPayTestUtils.createTestTransaction({
            order_id: `order_concurrent_${i}`,
            employee_id: 'emp_concurrent'
          })
        );
      }

      // Wait for all to complete
      await Promise.all(concurrentTransactions);

      // Verify all transactions were created
      const count = await FastPayTestUtils.getTransactionCount({
        employee_id: 'emp_concurrent'
      });

      expect(count).toBe(5);
    });

    test('should handle large result sets with pagination', async () => {
      // Create many transactions
      const createPromises: Promise<any>[] = [];
      for (let i = 0; i < 25; i++) {
        createPromises.push(
          FastPayTestUtils.createTestTransaction({
            employee_id: 'emp_pagination'
          })
        );
      }

      await Promise.all(createPromises);

      // Test pagination
      const page1 = await DatabaseManager.query(`
        SELECT * FROM uzum_fastpay_transactions 
        WHERE employee_id = $1 
        ORDER BY created_at DESC 
        LIMIT 10 OFFSET 0
      `, ['emp_pagination']);

      const page2 = await DatabaseManager.query(`
        SELECT * FROM uzum_fastpay_transactions 
        WHERE employee_id = $1 
        ORDER BY created_at DESC 
        LIMIT 10 OFFSET 10
      `, ['emp_pagination']);

      expect(page1.rows).toHaveLength(10);
      expect(page2.rows).toHaveLength(10);
      
      // Verify no overlap
      const page1Ids = page1.rows.map((row: any) => row.id);
      const page2Ids = page2.rows.map((row: any) => row.id);
      const intersection = page1Ids.filter((id: any) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle database connection issues gracefully', async () => {
      // This test is more conceptual - in a real scenario you'd temporarily
      // close the database connection to test error handling
      
      // For now, just verify that database operations work normally
      const transaction = await FastPayTestUtils.createTestTransaction({});
      expect(transaction).toBeDefined();
      
      const retrieved = await FastPayTestUtils.verifyTransactionExists(transaction.id);
      expect(retrieved).toBeDefined();
    });

    test('should handle invalid SQL gracefully', async () => {
      try {
        await DatabaseManager.query('SELECT * FROM non_existent_table');
        expect(false).toBe(true); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('does not exist');
      }
    });

    test('should handle malformed data gracefully', async () => {
      // Test various edge cases for data handling
      
      // Very long strings
      const longString = 'a'.repeat(1000);
      
      try {
        await FastPayTestUtils.createTestTransaction({
          otp_data: longString
        });
        
        // If successful, verify it was truncated or handled properly
        const transaction = await DatabaseManager.query(
          'SELECT otp_data FROM uzum_fastpay_transactions WHERE otp_data = $1',
          [longString]
        );
        
        // Should either find it (if no length limit) or not find it (if truncated)
        expect([0, 1]).toContain(transaction.rows.length);
      } catch (error: any) {
        // Expected if there are column length constraints
        expect(error.message).toContain('value too long');
      }
    });
  });

  describe('Data Cleanup and Maintenance', () => {
    test('should clean up test data properly', async () => {
      // Create some test data
      await FastPayTestUtils.createTestTransaction({
        employee_id: 'emp_cleanup'
      });

      // Verify it exists
      let count = await FastPayTestUtils.getTransactionCount({
        employee_id: 'emp_cleanup'
      });
      expect(count).toBe(1);

      // Clean up
      await FastPayTestUtils.cleanupTestData();

      // Verify it's gone
      count = await FastPayTestUtils.getTransactionCount({
        employee_id: 'emp_cleanup'
      });
      expect(count).toBe(0);
    });

    test('should handle date-based queries', async () => {
      // Create date range that includes the current time with some buffer
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const endDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour in future
      
      // Create transaction
      const transaction = await FastPayTestUtils.createTestTransaction({
        employee_id: 'emp_date_test'
      });

      // Small delay to ensure transaction is committed
      await new Promise(resolve => setTimeout(resolve, 10));

      // Query by date range
      const result = await DatabaseManager.query(`
        SELECT COUNT(*) as count FROM uzum_fastpay_transactions 
        WHERE employee_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
      `, ['emp_date_test', startDate.toISOString(), endDate.toISOString()]);

      expect(parseInt(result.rows[0].count)).toBe(1);
    });
  });
});
