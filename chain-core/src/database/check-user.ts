import bcrypt from 'bcryptjs';
import { DatabaseManager } from './manager';

async function checkUser() {
  try {
    await DatabaseManager.initialize();
    const result = await DatabaseManager.query(
      'SELECT email, password_hash FROM users WHERE email = $1',
      ['admin@rockpoint.com']
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isValid = await bcrypt.compare('admin123', user.password_hash);
      console.log('User found:', user.email);
      console.log('Password valid:', isValid);
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkUser();
