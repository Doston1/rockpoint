/**
 * Jest Test Setup
 * 
 * This file runs before all tests to set up the testing environment.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/rockpoint_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use DB 1 for tests

// Suppress console warnings in tests
const originalWarn = console.warn;
console.warn = (message: any, ...args: any[]) => {
  if (typeof message === 'string' && message.includes('deprecat')) {
    return;
  }
  originalWarn(message, ...args);
};
