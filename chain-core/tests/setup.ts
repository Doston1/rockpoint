import dotenv from 'dotenv';
import { DatabaseManager } from '../src/database/manager';

// Global type declarations for testing
declare global {
  var testApiKey: string;
}

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

beforeAll(async () => {
  // Initialize database connection for tests
  await DatabaseManager.initialize();
  
  // Run migrations if needed
  try {
    await DatabaseManager.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(255) UNIQUE NOT NULL,
        permissions TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP WITH TIME ZONE,
        usage_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await DatabaseManager.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        manager_name VARCHAR(255),
        timezone VARCHAR(50) DEFAULT 'Asia/Tashkent',
        currency VARCHAR(10) DEFAULT 'UZS',
        tax_rate DECIMAL(5,2) DEFAULT 12.00,
        is_active BOOLEAN DEFAULT true,
        api_endpoint VARCHAR(500),
        api_key VARCHAR(255),
        network_status VARCHAR(20) DEFAULT 'offline',
        onec_id VARCHAR(255),
        last_sync_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await DatabaseManager.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        name_ru VARCHAR(255),
        name_uz VARCHAR(255),
        description TEXT,
        description_ru TEXT,
        description_uz TEXT,
        parent_id UUID REFERENCES categories(id),
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        onec_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await DatabaseManager.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        oneC_id VARCHAR(255) UNIQUE NOT NULL,
        sku VARCHAR(100) UNIQUE NOT NULL,
        barcode VARCHAR(100),
        name VARCHAR(500) NOT NULL,
        name_ru VARCHAR(500),
        name_uz VARCHAR(500),
        description TEXT,
        description_ru TEXT,
        description_uz TEXT,
        category_id UUID REFERENCES categories(id),
        brand VARCHAR(255),
        unit_of_measure VARCHAR(50) DEFAULT 'pcs',
        base_price DECIMAL(12,2) NOT NULL,
        cost DECIMAL(12,2) NOT NULL,
        tax_rate DECIMAL(5,4) DEFAULT 0,
        image_url VARCHAR(500),
        images JSONB DEFAULT '[]',
        attributes JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await DatabaseManager.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID REFERENCES branches(id),
        employee_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        hire_date DATE,
        salary DECIMAL(12,2),
        status VARCHAR(20) DEFAULT 'active',
        onec_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(branch_id, employee_id)
      )
    `);

    await DatabaseManager.query(`
      CREATE TABLE IF NOT EXISTS onec_sync_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sync_type VARCHAR(100) NOT NULL,
        direction VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        records_total INTEGER DEFAULT 0,
        records_processed INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB DEFAULT '{}'
      )
    `);

    await DatabaseManager.query(`
      CREATE TABLE IF NOT EXISTS branch_servers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID REFERENCES branches(id),
        server_name VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        port INTEGER NOT NULL,
        api_port INTEGER,
        websocket_port INTEGER,
        vpn_ip_address VARCHAR(45),
        public_ip_address VARCHAR(45),
        network_type VARCHAR(20) DEFAULT 'local',
        server_info JSONB DEFAULT '{}',
        api_key VARCHAR(255),
        outbound_api_key VARCHAR(255),
        status VARCHAR(20) DEFAULT 'offline',
        is_active BOOLEAN DEFAULT true,
        last_ping_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(branch_id, server_name)
      )
    `);

    await DatabaseManager.query(`
      CREATE TABLE IF NOT EXISTS connection_health_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID REFERENCES branches(id),
        endpoint VARCHAR(500) NOT NULL,
        status VARCHAR(20) NOT NULL,
        response_time_ms INTEGER,
        error_message TEXT,
        checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await DatabaseManager.query(`
      CREATE TABLE IF NOT EXISTS branch_product_pricing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID REFERENCES branches(id),
        product_id UUID REFERENCES products(id),
        price DECIMAL(12,2) NOT NULL,
        cost DECIMAL(12,2),
        effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_available BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(branch_id, product_id)
      )
    `);

    await DatabaseManager.query(`
      CREATE TABLE IF NOT EXISTS branch_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID REFERENCES branches(id),
        product_id UUID REFERENCES products(id),
        quantity_in_stock DECIMAL(10,3) DEFAULT 0,
        min_stock_level DECIMAL(10,3) DEFAULT 0,
        max_stock_level DECIMAL(10,3),
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(branch_id, product_id)
      )
    `);

    // Insert test API key with clear test identification
    const testApiKey = 'rp_test_1C_integration_key_for_testing_only';
    await DatabaseManager.query(`
      INSERT INTO api_keys (name, key_hash, permissions, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (key_hash) DO NOTHING
    `, [
      'TEST: 1C Integration Test Key', // Clear test prefix
      testApiKey,
      ['*'] // Full permissions for testing
    ]);

    console.log('Test database setup completed');
  } catch (error) {
    console.error('Test setup error:', error);
  }
});

afterAll(async () => {
  // Clean up only recent test data (added in last 30 seconds)
  try {
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    
    // Delete only recent test data, not the entire tables
    await DatabaseManager.query('DELETE FROM connection_health_logs WHERE checked_at > $1', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM branch_product_pricing WHERE created_at > $1', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM branch_inventory WHERE last_movement_at > $1 OR updated_at > $1', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM branch_servers WHERE created_at > $1', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM onec_sync_logs WHERE started_at > $1', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM employees WHERE created_at > $1', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM products WHERE created_at > $1', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM categories WHERE created_at > $1', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM branches WHERE created_at > $1', [thirtySecondsAgo]);
    
    // For API keys, only delete test keys (those with clear test markers or recent)
    await DatabaseManager.query(`DELETE FROM api_keys WHERE 
      (created_at > $1 OR name LIKE 'TEST:%' OR name LIKE '%test%' OR name LIKE '%Test%' OR key_hash LIKE '%test%')`, 
      [thirtySecondsAgo]);
      
    console.log('✅ Test data cleanup completed (recent data only)');
  } catch (error) {
    console.error('Test cleanup error:', error);
  }
  
  // Close database connection
  await DatabaseManager.close();
});

// Global test utilities
global.testApiKey = 'rp_test_1C_integration_key_for_testing_only';
