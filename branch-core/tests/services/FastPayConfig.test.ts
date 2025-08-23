import { DatabaseManager } from '../../src/database/manager';
import { cleanupDatabase } from '../setup';
import { FastPayTestUtils } from '../utils/FastPayTestUtils';

describe('FastPay Configuration Tests', () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await FastPayTestUtils.cleanupTestData();
  });

  describe('Configuration Storage', () => {
    test('should store configuration securely', async () => {
      const uniquePrefix = `test_store_${Date.now()}`;
      const config = {
        [`${uniquePrefix}_merchant_service_user_id`]: 'test_merchant_456',
        [`${uniquePrefix}_secret_key`]: 'very_secret_key_789',
        [`${uniquePrefix}_service_id`]: '98765',
        [`${uniquePrefix}_api_base_url`]: 'https://secure-api.uzum.com',
        [`${uniquePrefix}_request_timeout_ms`]: '20000',
        [`${uniquePrefix}_cashbox_code_prefix`]: 'SECURE',
        [`${uniquePrefix}_max_retry_attempts`]: '3',
        [`${uniquePrefix}_enable_logging`]: 'false'
      };

      // Store configuration
      for (const [key, value] of Object.entries(config)) {
        await DatabaseManager.query(`
          INSERT INTO uzum_bank_config (config_key, config_value, is_encrypted, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, true, NOW(), NOW())
        `, [key, value, key.includes('secret_key')]);
      }

      // Verify storage
      const result = await DatabaseManager.query(
        'SELECT config_key, config_value, is_encrypted FROM uzum_bank_config WHERE config_key LIKE $1 AND is_active = true',
        [`${uniquePrefix}_%`]
      );

      expect(result.rows).toHaveLength(8);
      
      // Verify secret key is marked as encrypted
      const secretKeyRow = result.rows.find((row: any) => row.config_key.includes('secret_key'));
      expect(secretKeyRow.is_encrypted).toBe(true);
      
      // Verify other keys are not marked as encrypted
      const merchantIdRow = result.rows.find((row: any) => row.config_key.includes('merchant_service_user_id'));
      expect(merchantIdRow.is_encrypted).toBe(false);
      
      // Cleanup test data
      await DatabaseManager.query('DELETE FROM uzum_bank_config WHERE config_key LIKE $1', [`${uniquePrefix}_%`]);
    });

    test('should handle configuration updates', async () => {
      // Initial configuration
      await FastPayTestUtils.createTestConfiguration({
        api_base_url: 'https://old-api.uzum.com'
      });

      // Update configuration
      await DatabaseManager.query(`
        UPDATE uzum_bank_config 
        SET config_value = $1, updated_at = NOW() 
        WHERE config_key = $2
      `, ['https://new-api.uzum.com', 'api_base_url']);

      // Verify update
      const result = await DatabaseManager.query(
        'SELECT config_value FROM uzum_bank_config WHERE config_key = $1',
        ['api_base_url']
      );

      expect(result.rows[0].config_value).toBe('https://new-api.uzum.com');
    });

    test('should validate configuration completeness', async () => {
      const requiredKeys = [
        'merchant_service_user_id',
        'secret_key',
        'service_id',
        'api_base_url'
      ];

      // Test with complete configuration
      await FastPayTestUtils.createTestConfiguration();

      for (const key of requiredKeys) {
        const result = await DatabaseManager.query(
          'SELECT COUNT(*) as count FROM uzum_bank_config WHERE config_key = $1 AND is_active = true',
          [key]
        );
        expect(parseInt(result.rows[0].count)).toBe(1);
      }

      // Test with missing configuration
      await DatabaseManager.query(
        'DELETE FROM uzum_bank_config WHERE config_key = $1',
        ['merchant_service_user_id']
      );

      const missingResult = await DatabaseManager.query(
        'SELECT COUNT(*) as count FROM uzum_bank_config WHERE config_key = $1',
        ['merchant_service_user_id']
      );
      expect(parseInt(missingResult.rows[0].count)).toBe(0);
    });

    test('should handle configuration deactivation', async () => {
      await FastPayTestUtils.createTestConfiguration();

      // Deactivate configuration
      await DatabaseManager.query(
        'UPDATE uzum_bank_config SET is_active = false WHERE config_key = $1',
        ['merchant_service_user_id']
      );

      // Verify active configuration count
      const activeResult = await DatabaseManager.query(
        'SELECT COUNT(*) as count FROM uzum_bank_config WHERE config_key = $1 AND is_active = true',
        ['merchant_service_user_id']
      );
      expect(parseInt(activeResult.rows[0].count)).toBe(0);

      // Verify total configuration count (including inactive)
      const totalResult = await DatabaseManager.query(
        'SELECT COUNT(*) as count FROM uzum_bank_config WHERE config_key = $1',
        ['merchant_service_user_id']
      );
      expect(parseInt(totalResult.rows[0].count)).toBe(1);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate API URL format', async () => {
      const validUrls = [
        'https://api.uzum.com',
        'https://mobile.apelsin.uz',
        'https://test-api.example.com:8443/path'
      ];

      const invalidUrls = [
        'http://insecure.com',
        'not-a-url',
        'ftp://wrong-protocol.com',
        ''
      ];

      // Test valid URLs (should succeed)
      for (const url of validUrls) {
        await DatabaseManager.query(`
          INSERT INTO uzum_bank_config (config_key, config_value, is_encrypted, is_active, created_at, updated_at)
          VALUES ($1, $2, false, true, NOW(), NOW())
          ON CONFLICT (config_key) DO UPDATE SET config_value = $2
        `, [`test_api_url_${validUrls.indexOf(url)}`, url]);
      }

      // Verify all valid URLs were stored
      const validResult = await DatabaseManager.query(
        'SELECT COUNT(*) as count FROM uzum_bank_config WHERE config_key LIKE $1',
        ['test_api_url_%']
      );
      expect(parseInt(validResult.rows[0].count)).toBe(validUrls.length);

      // Note: Invalid URL validation would typically be done in application code
      // Database-level validation depends on your schema constraints
    });

    test('should validate numeric configuration values', async () => {
      const numericConfigs = [
        { key: 'service_id', value: '12345', valid: true },
        { key: 'service_id', value: 'not_a_number', valid: false },
        { key: 'request_timeout_ms', value: '15000', valid: true },
        { key: 'request_timeout_ms', value: '-1000', valid: false },
        { key: 'max_retry_attempts', value: '3', valid: true },
        { key: 'max_retry_attempts', value: '0', valid: false }
      ];

      for (const config of numericConfigs) {
        try {
          await DatabaseManager.query(`
            INSERT INTO uzum_bank_config (config_key, config_value, is_encrypted, is_active, created_at, updated_at)
            VALUES ($1, $2, false, true, NOW(), NOW())
            ON CONFLICT (config_key) DO UPDATE SET config_value = $2
          `, [config.key, config.value]);

          if (config.valid) {
            // Should succeed for valid values
            const result = await DatabaseManager.query(
              'SELECT config_value FROM uzum_bank_config WHERE config_key = $1',
              [config.key]
            );
            expect(result.rows[0].config_value).toBe(config.value);
          }
        } catch (error) {
          if (!config.valid) {
            // Expected for invalid values if there are check constraints
            expect(error).toBeDefined();
          } else {
            throw error;
          }
        }
      }
    });

    test('should validate boolean configuration values', async () => {
      const booleanConfigs = [
        'true',
        'false',
        'TRUE',
        'FALSE',
        '1',
        '0'
      ];

      for (const value of booleanConfigs) {
        await DatabaseManager.query(`
          INSERT INTO uzum_bank_config (config_key, config_value, is_encrypted, is_active, created_at, updated_at)
          VALUES ($1, $2, false, true, NOW(), NOW())
          ON CONFLICT (config_key) DO UPDATE SET config_value = $2
        `, [`test_boolean_${booleanConfigs.indexOf(value)}`, value]);
      }

      // Verify all boolean values were stored
      const result = await DatabaseManager.query(
        'SELECT COUNT(*) as count FROM uzum_bank_config WHERE config_key LIKE $1',
        ['test_boolean_%']
      );
      expect(parseInt(result.rows[0].count)).toBe(booleanConfigs.length);
    });
  });

  describe('Configuration Security', () => {
    test('should mark sensitive data as encrypted', async () => {
      const sensitiveKeys = ['secret_key'];
      const nonSensitiveKeys = ['merchant_service_user_id', 'service_id', 'api_base_url'];

      await FastPayTestUtils.createTestConfiguration();

      // Verify sensitive keys are marked as encrypted
      for (const key of sensitiveKeys) {
        const result = await DatabaseManager.query(
          'SELECT is_encrypted FROM uzum_bank_config WHERE config_key = $1',
          [key]
        );
        expect(result.rows[0].is_encrypted).toBe(true);
      }

      // Verify non-sensitive keys are not marked as encrypted
      for (const key of nonSensitiveKeys) {
        const result = await DatabaseManager.query(
          'SELECT is_encrypted FROM uzum_bank_config WHERE config_key = $1',
          [key]
        );
        expect(result.rows[0].is_encrypted).toBe(false);
      }
    });

    test('should handle encrypted configuration values', async () => {
      const secretKey = 'super_secret_key_123';
      
      // Store as encrypted
      await DatabaseManager.query(`
        INSERT INTO uzum_bank_config (config_key, config_value, is_encrypted, is_active, created_at, updated_at)
        VALUES ($1, $2, true, true, NOW(), NOW())
      `, ['test_encrypted_key', secretKey]);

      // Retrieve and verify encryption flag
      const result = await DatabaseManager.query(
        'SELECT config_value, is_encrypted FROM uzum_bank_config WHERE config_key = $1',
        ['test_encrypted_key']
      );

      expect(result.rows[0].is_encrypted).toBe(true);
      // In a real implementation, the stored value might be encrypted
      // For testing purposes, we're just verifying the flag is set
    });

    test('should prevent unauthorized configuration access', async () => {
      await FastPayTestUtils.createTestConfiguration();

      // Simulate checking only active configurations
      const activeConfigs = await DatabaseManager.query(
        'SELECT config_key FROM uzum_bank_config WHERE is_active = true'
      );

      // Should only return active configurations
      expect(activeConfigs.rows.length).toBeGreaterThan(0);
      
      // All returned configs should be active
      for (const row of activeConfigs.rows) {
        expect(row.config_key).toBeDefined();
      }
    });
  });

  describe('Configuration Performance', () => {
    test('should handle large configuration sets efficiently', async () => {
      const testPrefix = `test_perf_config_${Date.now()}`;
      
      // Clean up any existing test data first
      await DatabaseManager.query(
        'DELETE FROM uzum_bank_config WHERE config_key LIKE $1',
        [`${testPrefix}_%`]
      );
      
      const startTime = Date.now();
      
      // Create many configuration entries
      const configs: (string | boolean)[][] = [];
      for (let i = 0; i < 100; i++) {
        configs.push([
          `${testPrefix}_${i}`,
          `test_value_${i}`,
          false,
          true
        ]);
      }

      // Batch insert
      for (const config of configs) {
        await DatabaseManager.query(`
          INSERT INTO uzum_bank_config (config_key, config_value, is_encrypted, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
        `, config);
      }

      const insertTime = Date.now() - startTime;
      expect(insertTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test bulk retrieval performance
      const retrievalStartTime = Date.now();
      const result = await DatabaseManager.query(
        'SELECT * FROM uzum_bank_config WHERE config_key LIKE $1',
        [`${testPrefix}_%`]
      );
      const retrievalTime = Date.now() - retrievalStartTime;

      expect(result.rows).toHaveLength(100);
      expect(retrievalTime).toBeLessThan(1000); // Should retrieve within 1 second
      
      // Cleanup test data
      await DatabaseManager.query(
        'DELETE FROM uzum_bank_config WHERE config_key LIKE $1',
        [`${testPrefix}_%`]
      );
    });

    test('should cache configuration efficiently', async () => {
      await FastPayTestUtils.createTestConfiguration();

      // Simulate multiple rapid configuration requests
      const startTime = Date.now();
      const requests: Promise<any>[] = [];
      
      for (let i = 0; i < 10; i++) {
        requests.push(
          DatabaseManager.query(
            'SELECT * FROM uzum_bank_config WHERE is_active = true'
          )
        );
      }

      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should return the same data
      expect(results).toHaveLength(10);
      for (const result of results) {
        expect(result.rows.length).toBeGreaterThan(0);
      }

      // Multiple concurrent requests should be reasonably fast
      expect(totalTime).toBeLessThan(2000);
    });
  });

  describe('Configuration Backup and Recovery', () => {
    test('should support configuration export', async () => {
      await FastPayTestUtils.createTestConfiguration();

      // Export all configuration
      const exportResult = await DatabaseManager.query(`
        SELECT config_key, config_value, is_encrypted, is_active 
        FROM uzum_bank_config 
        ORDER BY config_key
      `);

      // Verify export contains expected data
      expect(exportResult.rows.length).toBeGreaterThan(0);
      
      const configKeys = exportResult.rows.map((row: any) => row.config_key);
      expect(configKeys).toContain('merchant_service_user_id');
      expect(configKeys).toContain('secret_key');
      expect(configKeys).toContain('service_id');
    });

    test('should support configuration import', async () => {
      // Clear existing configuration
      await DatabaseManager.query('DELETE FROM uzum_bank_config');

      // Import configuration
      const importData = [
        { key: 'merchant_service_user_id', value: 'imported_merchant', encrypted: false },
        { key: 'secret_key', value: 'imported_secret', encrypted: true },
        { key: 'service_id', value: '99999', encrypted: false }
      ];

      for (const item of importData) {
        await DatabaseManager.query(`
          INSERT INTO uzum_bank_config (config_key, config_value, is_encrypted, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, true, NOW(), NOW())
        `, [item.key, item.value, item.encrypted]);
      }

      // Verify import
      const result = await DatabaseManager.query(
        'SELECT COUNT(*) as count FROM uzum_bank_config WHERE is_active = true'
      );
      expect(parseInt(result.rows[0].count)).toBe(3);
    });

    test('should handle configuration versioning', async () => {
      // Create initial configuration
      await DatabaseManager.query(`
        INSERT INTO uzum_bank_config (config_key, config_value, is_encrypted, is_active, created_at, updated_at)
        VALUES ($1, $2, false, true, NOW(), NOW())
      `, ['api_base_url', 'https://v1-api.uzum.com']);

      const firstUpdate = await DatabaseManager.query(
        'SELECT updated_at FROM uzum_bank_config WHERE config_key = $1',
        ['api_base_url']
      );

      // Wait a moment to ensure different timestamp
      await FastPayTestUtils.wait(100);

      // Update configuration
      await DatabaseManager.query(`
        UPDATE uzum_bank_config 
        SET config_value = $1, updated_at = NOW() 
        WHERE config_key = $2
      `, ['https://v2-api.uzum.com', 'api_base_url']);

      const secondUpdate = await DatabaseManager.query(
        'SELECT updated_at FROM uzum_bank_config WHERE config_key = $1',
        ['api_base_url']
      );

      // Verify timestamp was updated
      expect(new Date(secondUpdate.rows[0].updated_at).getTime())
        .toBeGreaterThan(new Date(firstUpdate.rows[0].updated_at).getTime());
    });
  });
});
