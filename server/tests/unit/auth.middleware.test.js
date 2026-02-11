import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../database.js', () => ({
  get: vi.fn(),
}));

import { get } from '../../database.js';
import { authMiddleware, generateToken, verifyToken } from '../../middleware/auth.js';

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const userId = 'test-user-id';
      const token = generateToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const userId = 'test-user-id';
      const token = generateToken(userId);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(userId);
    });

    it('should return null for invalid token', () => {
      const decoded = verifyToken('invalid-token');
      expect(decoded).toBeNull();
    });

    it('should return null for expired token', () => {
      const expiredToken = jwt.sign(
        { userId: 'test' },
        process.env.JWT_SECRET || 'fallback-secret-for-testing-only',
        { expiresIn: '-1h' }
      );

      const decoded = verifyToken(expiredToken);
      expect(decoded).toBeNull();
    });
  });

  describe('authMiddleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
      mockReq = { headers: {} };
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      mockNext = vi.fn();
    });

    it('should call next() for valid token', async () => {
      const user = { id: 'user-123', email: 'test@example.com', role: 'user' };
      const token = generateToken(user.id);
      mockReq.headers.authorization = `Bearer ${token}`;
      vi.mocked(get).mockResolvedValue(user);

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(get).toHaveBeenCalledWith(
        'SELECT id, email, first_name, last_name, company_name, role FROM users WHERE id = ?',
        [user.id]
      );
      expect(mockReq.user).toEqual(user);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should return 401 when Authorization header is missing', async () => {
      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Accès non autorisé. Token manquant.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token format is invalid', async () => {
      mockReq.headers.authorization = 'InvalidFormat token123';

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token invalide ou expiré.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is valid but user no longer exists', async () => {
      const token = generateToken('deleted-user-id');
      mockReq.headers.authorization = `Bearer ${token}`;
      vi.mocked(get).mockResolvedValue(undefined);

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Utilisateur non trouvé.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
