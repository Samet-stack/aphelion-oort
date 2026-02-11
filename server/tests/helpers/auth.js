import jwt from 'jsonwebtoken';

// Use a test secret (must match or be compatible with the app's JWT_SECRET in test env)
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-secret-minimum-32-characters-long';

/**
 * Generate a test JWT token
 * @param {string} userId - User ID to encode in token
 * @param {Object} overrides - Additional claims
 * @returns {string} JWT token
 */
export const generateTestToken = (userId, overrides = {}) => {
  return jwt.sign(
    { userId, ...overrides },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
};

/**
 * Create authenticated request headers
 * @param {string} userId - User ID
 * @returns {Object} Headers object with Authorization
 */
export const authHeaders = (userId) => ({
  Authorization: `Bearer ${generateTestToken(userId)}`,
});

/**
 * Create an expired token for testing
 * @param {string} userId - User ID
 * @returns {string} Expired JWT token
 */
export const generateExpiredToken = (userId) => {
  return jwt.sign(
    { userId },
    TEST_JWT_SECRET,
    { expiresIn: '-1h' } // Already expired
  );
};
