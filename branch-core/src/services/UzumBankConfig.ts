import { DatabaseManager } from '../database/manager';

export interface UzumBankConfigItem {
  key: string;
  value: string;
  description: string;
  is_encrypted: boolean;
  is_active: boolean;
}

export class UzumBankConfig {
  /**
   * Set a configuration value
   */
  static async setConfig(key: string, value: string, description?: string, encrypt = false): Promise<void> {
    try {
      let processedValue = value;
      
      // Encrypt sensitive values if needed
      if (encrypt && value !== 'PLACEHOLDER') {
        // TODO: Implement proper encryption for production
        // processedValue = encrypt(value);
        console.warn('⚠️ Encryption not implemented - storing value as plain text');
      }

      await DatabaseManager.query(`
        INSERT INTO uzum_bank_config (config_key, config_value, description, is_encrypted, is_active)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (config_key) 
        DO UPDATE SET 
          config_value = EXCLUDED.config_value,
          description = COALESCE(EXCLUDED.description, uzum_bank_config.description),
          is_encrypted = EXCLUDED.is_encrypted,
          updated_at = NOW()
      `, [key, processedValue, description || null, encrypt]);

      console.log(`✅ Updated Uzum Bank config: ${key}`);
    } catch (error) {
      console.error(`❌ Failed to set Uzum Bank config ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a configuration value
   */
  static async getConfig(key: string): Promise<string | null> {
    try {
      const result = await DatabaseManager.query(
        'SELECT config_value, is_encrypted FROM uzum_bank_config WHERE config_key = $1 AND is_active = true',
        [key]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const { config_value, is_encrypted } = result.rows[0];
      
      if (is_encrypted && config_value !== 'PLACEHOLDER') {
        // TODO: Implement decryption for production
        // return decrypt(config_value);
        console.warn('⚠️ Decryption not implemented - returning encrypted value');
      }

      return config_value;
    } catch (error) {
      console.error(`❌ Failed to get Uzum Bank config ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get all configuration items
   */
  static async getAllConfig(): Promise<UzumBankConfigItem[]> {
    try {
      const result = await DatabaseManager.query(`
        SELECT config_key as key, config_value as value, description, is_encrypted, is_active
        FROM uzum_bank_config 
        ORDER BY config_key
      `);

      return result.rows.map((row: any) => ({
        ...row,
        // Mask sensitive values for display
        value: row.is_encrypted && row.value !== 'PLACEHOLDER' ? '[ENCRYPTED]' : row.value
      }));
    } catch (error) {
      console.error('❌ Failed to get all Uzum Bank config:', error);
      throw error;
    }
  }

  /**
   * Validate that all required configuration is present
   */
  static async validateConfig(): Promise<{ isValid: boolean; missingKeys: string[]; errors: string[] }> {
    const requiredKeys = [
      'merchant_service_user_id',
      'secret_key', 
      'service_id'
    ];

    const missingKeys: string[] = [];
    const errors: string[] = [];

    try {
      for (const key of requiredKeys) {
        const value = await this.getConfig(key);
        
        if (!value || value === 'PLACEHOLDER') {
          missingKeys.push(key);
        }
      }

      // Additional validation
      const serviceId = await this.getConfig('service_id');
      if (serviceId && isNaN(parseInt(serviceId))) {
        errors.push('service_id must be a valid number');
      }

      const timeoutMs = await this.getConfig('request_timeout_ms');
      if (timeoutMs && (isNaN(parseInt(timeoutMs)) || parseInt(timeoutMs) < 1000)) {
        errors.push('request_timeout_ms must be a number >= 1000');
      }

      return {
        isValid: missingKeys.length === 0 && errors.length === 0,
        missingKeys,
        errors
      };
    } catch (error) {
      console.error('❌ Failed to validate Uzum Bank config:', error);
      return {
        isValid: false,
        missingKeys,
        errors: ['Failed to validate configuration']
      };
    }
  }

  /**
   * Setup initial configuration from environment variables
   */
  static async setupFromEnv(): Promise<void> {
    const envMappings = [
      { key: 'merchant_service_user_id', env: 'UZUM_MERCHANT_SERVICE_USER_ID', encrypt: false },
      { key: 'secret_key', env: 'UZUM_SECRET_KEY', encrypt: true },
      { key: 'service_id', env: 'UZUM_SERVICE_ID', encrypt: false },
      { key: 'api_base_url', env: 'UZUM_API_BASE_URL', encrypt: false },
      { key: 'request_timeout_ms', env: 'UZUM_REQUEST_TIMEOUT_MS', encrypt: false },
      { key: 'cashbox_code_prefix', env: 'UZUM_CASHBOX_CODE_PREFIX', encrypt: false },
      { key: 'max_retry_attempts', env: 'UZUM_MAX_RETRY_ATTEMPTS', encrypt: false },
      { key: 'enable_logging', env: 'UZUM_ENABLE_LOGGING', encrypt: false }
    ];

    console.log('🔧 Setting up Uzum Bank configuration from environment variables...');

    for (const mapping of envMappings) {
      const envValue = process.env[mapping.env];
      
      if (envValue) {
        await this.setConfig(
          mapping.key, 
          envValue, 
          `Configuration from ${mapping.env}`, 
          mapping.encrypt
        );
        console.log(`✅ Set ${mapping.key} from ${mapping.env}`);
      } else {
        console.log(`⚠️ Environment variable ${mapping.env} not found, keeping existing value`);
      }
    }

    const validation = await this.validateConfig();
    if (validation.isValid) {
      console.log('✅ Uzum Bank configuration is valid');
    } else {
      console.warn('⚠️ Uzum Bank configuration issues:', {
        missing: validation.missingKeys,
        errors: validation.errors
      });
    }
  }

  /**
   * Reset configuration to defaults
   */
  static async resetToDefaults(): Promise<void> {
    const defaultConfigs = [
      { key: 'merchant_service_user_id', value: 'PLACEHOLDER', description: 'Cash register ID provided by Uzum Bank', encrypt: false },
      { key: 'secret_key', value: 'PLACEHOLDER', description: 'Secret key provided by Uzum Bank for authentication', encrypt: true },
      { key: 'service_id', value: 'PLACEHOLDER', description: 'Branch/service identifier provided by Uzum Bank', encrypt: false },
      { key: 'api_base_url', value: 'https://mobile.apelsin.uz', description: 'Uzum Bank FastPay API base URL', encrypt: false },
      { key: 'request_timeout_ms', value: '15000', description: 'HTTP request timeout in milliseconds', encrypt: false },
      { key: 'cashbox_code_prefix', value: 'RockPoint', description: 'Prefix for cash register codes', encrypt: false },
      { key: 'max_retry_attempts', value: '3', description: 'Maximum number of retry attempts for failed payments', encrypt: false },
      { key: 'enable_logging', value: 'true', description: 'Enable detailed logging for debugging', encrypt: false }
    ];

    console.log('🔄 Resetting Uzum Bank configuration to defaults...');

    for (const config of defaultConfigs) {
      await this.setConfig(config.key, config.value, config.description, config.encrypt);
    }

    console.log('✅ Uzum Bank configuration reset to defaults');
  }

  /**
   * Test configuration by attempting to load it
   */
  static async testConfig(): Promise<{ success: boolean; error?: string }> {
    try {
      const validation = await this.validateConfig();
      
      if (!validation.isValid) {
        return {
          success: false,
          error: `Configuration invalid: ${validation.missingKeys.join(', ')} missing. Errors: ${validation.errors.join(', ')}`
        };
      }

      // Try to load configuration as FastPayService would
      const config = {
        merchant_service_user_id: await this.getConfig('merchant_service_user_id'),
        secret_key: await this.getConfig('secret_key'),
        service_id: parseInt(await this.getConfig('service_id') || '0'),
        api_base_url: await this.getConfig('api_base_url') || 'https://mobile.apelsin.uz',
        request_timeout_ms: parseInt(await this.getConfig('request_timeout_ms') || '15000'),
        cashbox_code_prefix: await this.getConfig('cashbox_code_prefix') || 'RockPoint',
        max_retry_attempts: parseInt(await this.getConfig('max_retry_attempts') || '3'),
        enable_logging: (await this.getConfig('enable_logging') || 'true') === 'true'
      };

      // Validate loaded config
      if (!config.merchant_service_user_id || config.merchant_service_user_id === 'PLACEHOLDER') {
        return { success: false, error: 'merchant_service_user_id not configured' };
      }

      if (!config.secret_key || config.secret_key === 'PLACEHOLDER') {
        return { success: false, error: 'secret_key not configured' };
      }

      if (!config.service_id || config.service_id === 0) {
        return { success: false, error: 'service_id not configured' };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get configuration status for health checks
   */
  static async getStatus(): Promise<{
    configured: boolean;
    missingRequiredKeys: string[];
    totalKeys: number;
    lastUpdated?: Date;
  }> {
    try {
      const validation = await this.validateConfig();
      const allConfig = await this.getAllConfig();
      
      // Get last updated timestamp
      const lastUpdatedResult = await DatabaseManager.query(
        'SELECT MAX(updated_at) as last_updated FROM uzum_bank_config WHERE is_active = true'
      );

      return {
        configured: validation.isValid,
        missingRequiredKeys: validation.missingKeys,
        totalKeys: allConfig.length,
        lastUpdated: lastUpdatedResult.rows[0]?.last_updated || undefined
      };
    } catch (error) {
      console.error('❌ Failed to get Uzum Bank config status:', error);
      return {
        configured: false,
        missingRequiredKeys: ['Error checking configuration'],
        totalKeys: 0
      };
    }
  }
}
