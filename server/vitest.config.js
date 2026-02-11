import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

dotenv.config({ path: './.env' });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-jwt-secret';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs}'],
    testTimeout: 15000,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.js',
      ],
      include: [
        'routes/auth.js',
        'middleware/auth.js',
        'middleware/validation.js',
      ],
    },
    setupFiles: ['./tests/setup.js'],
  },
});
