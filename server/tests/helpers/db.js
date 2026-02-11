import { query, run } from '../../database.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

/**
 * Test database helpers
 * These functions help set up and tear down test data
 */

export const createTestUser = async (overrides = {}) => {
  const id = uuidv4();
  const email = overrides.email || `test-${Date.now()}@example.com`;
  const password = await bcrypt.hash(overrides.password || 'password123', 10);
  
  await run(
    `INSERT INTO users (id, email, password, first_name, last_name, company_name, email_verified) 
     VALUES (?, ?, ?, ?, ?, ?, true)`,
    [id, email, password, overrides.firstName || 'Test', overrides.lastName || 'User', overrides.companyName || null]
  );
  
  return { id, email, password: overrides.password || 'password123' };
};

export const createTestReport = async (userId, overrides = {}) => {
  const id = uuidv4();
  
  await run(
    `INSERT INTO reports (id, user_id, report_id, site_name, description, priority, image_data_url) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      overrides.reportId || `RPT-${Date.now()}`,
      overrides.siteName || 'Test Site',
      overrides.description || 'Test description',
      overrides.priority || 'medium',
      overrides.imageDataUrl || 'data:image/jpeg;base64,test'
    ]
  );
  
  return { id };
};

export const cleanupTestData = async () => {
  // Clean up in reverse order of dependencies
  await run('DELETE FROM extra_works WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)', ['test-%@example.com']);
  await run('DELETE FROM reports WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)', ['test-%@example.com']);
  await run('DELETE FROM users WHERE email LIKE ?', ['test-%@example.com']);
};

export const cleanupAllTestData = async () => {
  await run('DELETE FROM extra_works');
  await run('DELETE FROM reports');
  await run('DELETE FROM users WHERE email LIKE ?', ['test-%@example.com']);
};
