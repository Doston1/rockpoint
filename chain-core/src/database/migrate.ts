import { readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseManager } from './manager';

async function migrate() {
  try {
    console.log('🔄 Starting database migration...');
    
    // Initialize database connection
    await DatabaseManager.initialize();
    console.log('✅ Database connection established');
    
    // Read and execute schema
    const schemaPath = join(__dirname, 'queries', 'complete_schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    console.log('📄 Executing database schema...');
    await DatabaseManager.query(schema);
    console.log('✅ Database schema applied successfully');
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
