import { readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseManager } from './manager';

async function runMigrations(): Promise<void> {
  try {
    console.log('🔧 Starting database migrations...');
    
    // Initialize database connection
    await DatabaseManager.initialize();
    
    // Read and execute schema
    const schemaPath = join(__dirname, 'schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Executing schema...');
    await DatabaseManager.query(schemaSql);
    
    console.log('✅ Database migrations completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await DatabaseManager.close();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('🎉 Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { runMigrations };
