import { DatabaseManager } from './manager';

async function resetDatabase(): Promise<void> {
  try {
    console.log('🔄 Starting database reset...');
    
    // Initialize database connection
    await DatabaseManager.initialize();
    
    console.log('🗑️ Dropping existing tables...');
    
    // Drop tables in reverse dependency order
    const dropQueries = [
      'DROP TABLE IF EXISTS sync_logs CASCADE',
      'DROP TABLE IF EXISTS employee_time_logs CASCADE',
      'DROP TABLE IF EXISTS stock_movements CASCADE',
      'DROP TABLE IF EXISTS payments CASCADE',
      'DROP TABLE IF EXISTS transaction_items CASCADE',
      'DROP TABLE IF EXISTS transactions CASCADE',
      'DROP TABLE IF EXISTS customers CASCADE',
      'DROP TABLE IF EXISTS products CASCADE',
      'DROP TABLE IF EXISTS employees CASCADE'
    ];
    
    for (const query of dropQueries) {
      await DatabaseManager.query(query);
    }
    
    console.log('✅ Database reset completed successfully');
    console.log('💡 Run "npm run db:migrate" to recreate the schema');
    console.log('💡 Run "npm run db:seed" to populate with sample data');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  } finally {
    await DatabaseManager.close();
  }
}

// Run reset if this file is executed directly
if (require.main === module) {
  // Confirm before reset
  const confirmReset = process.argv.includes('--confirm');
  
  if (!confirmReset) {
    console.log('⚠️  This will permanently delete all data in the database!');
    console.log('   Add --confirm flag to proceed: npm run db:reset -- --confirm');
    process.exit(0);
  }
  
  resetDatabase()
    .then(() => {
      console.log('🎉 Database reset completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database reset failed:', error);
      process.exit(1);
    });
}

export { resetDatabase };
