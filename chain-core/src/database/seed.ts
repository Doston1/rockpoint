import bcrypt from 'bcryptjs';
import { DatabaseManager } from './manager';

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Initialize database connection
    await DatabaseManager.initialize();
    console.log('✅ Database connection established');
    
    // Check if admin user already exists
    const existingAdmin = await DatabaseManager.query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@rockpoint.com']
    );
    
    if (existingAdmin.rows.length > 0) {
      console.log('ℹ️  Admin user already exists, skipping creation');
      return;
    }
    
    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = await DatabaseManager.query(`
      INSERT INTO users (username, email, password_hash, name, role, permissions, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, email, role
    `, [
      'admin',
      'admin@rockpoint.com',
      hashedPassword,
      'System Administrator',
      'super_admin',
      ['*'], // All permissions
      true
    ]);
    
    console.log('👤 Created admin user:', adminUser.rows[0]);
    
    // Create default chain
    const existingChain = await DatabaseManager.query(
      'SELECT id FROM chains WHERE code = $1',
      ['ROCKPOINT']
    );
    
    if (existingChain.rows.length === 0) {
      const chain = await DatabaseManager.query(`
        INSERT INTO chains (name, code, description, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, code
      `, [
        'RockPoint Chain',
        'ROCKPOINT',
        'Main RockPoint restaurant chain',
        true
      ]);
      
      console.log('🏢 Created default chain:', chain.rows[0]);
    } else {
      console.log('ℹ️  Default chain already exists, skipping creation');
    }
    
    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
