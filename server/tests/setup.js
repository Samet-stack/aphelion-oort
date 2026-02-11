import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { afterAll } from 'vitest';
import { closeDb } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-jwt-secret';

// Clean up DB pool after all tests
afterAll(async () => {
  await closeDb();
});
