import bcrypt from 'bcryptjs';
import { DatabaseManager } from './manager';

async function updateAdminPassword() {
  try {
    await DatabaseManager.initialize();
    
    // Hash the correct password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Update the admin user's password
    const result = await DatabaseManager.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email',
      [hashedPassword, 'admin@rockpoint.com']
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Admin password updated successfully for:', result.rows[0].email);
      
      // Verify the update worked
      const user = await DatabaseManager.query(
        'SELECT password_hash FROM users WHERE email = $1',
        ['admin@rockpoint.com']
      );
      
      const isValid = await bcrypt.compare('admin123', user.rows[0].password_hash);
      console.log('🔐 Password verification:', isValid);
    } else {
      console.log('❌ Admin user not found');
    }
  } catch (error) {
    console.error('❌ Error updating password:', error);
  }
  process.exit(0);
}

updateAdminPassword();
