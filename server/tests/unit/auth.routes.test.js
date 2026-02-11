import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database.js', () => ({
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../services/email.js', () => ({
  generateEmailVerification: vi.fn(),
  verifyEmailToken: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
}));

import authRoutes from '../../routes/auth.js';
import { get, run } from '../../database.js';

const getRouteHandlers = (method, path) => {
  const layer = authRoutes.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
  );

  if (!layer) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }

  return layer.route.stack.map((stackItem) => stackItem.handle);
};

const executeHandlers = async (handlers, req, res) => {
  let index = 0;
  const dispatch = async () => {
    const handler = handlers[index++];
    if (!handler) return;

    await new Promise((resolve, reject) => {
      let nextCalled = false;
      const next = (err) => {
        nextCalled = true;
        if (err) {
          reject(err);
          return;
        }
        resolve(dispatch());
      };

      try {
        const maybePromise = handler(req, res, next);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise
            .then(() => {
              if (!nextCalled) resolve();
            })
            .catch(reject);
          return;
        }

        // Handler without Promise: if it did not call next synchronously,
        // assume the middleware ended the response.
        if (!nextCalled) resolve();
      } catch (err) {
        reject(err);
      }
    });
  };
  await dispatch();
};

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status: vi.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((payload) => {
      res.body = payload;
      return res;
    }),
  };
  return res;
};

describe('Auth Routes (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /register', () => {
    it('creates a user when payload is valid and email is unique', async () => {
      const handlers = getRouteHandlers('post', '/register').slice(1);
      vi.mocked(get).mockResolvedValue(undefined);
      vi.mocked(run).mockResolvedValue({ changes: 1 });

      const req = {
        body: {
          email: 'new-user@example.com',
          password: 'password123',
          firstName: 'New',
          lastName: 'User',
          companyName: 'SiteFlow',
        },
      };
      const res = createMockRes();

      await executeHandlers(handlers, req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBeDefined();
      expect(run).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate emails', async () => {
      const handlers = getRouteHandlers('post', '/register').slice(1);
      vi.mocked(get).mockResolvedValue({ id: 'existing-user-id' });

      const req = {
        body: {
          email: 'already-used@example.com',
          password: 'password123',
        },
      };
      const res = createMockRes();

      await executeHandlers(handlers, req, res);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(run).not.toHaveBeenCalled();
    });
  });

  describe('POST /login', () => {
    it('returns token and user for valid credentials', async () => {
      const handlers = getRouteHandlers('post', '/login').slice(1);
      const plainPassword = 'correctpassword';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      vi.mocked(get).mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        password: hashedPassword,
        firstName: 'User',
        lastName: 'Example',
        companyName: 'SiteFlow',
        role: 'user',
        emailVerified: true,
        createdAt: new Date().toISOString(),
      });
      vi.mocked(run).mockResolvedValue({ changes: 1 });

      const req = {
        body: {
          email: 'user@example.com',
          password: plainPassword,
        },
      };
      const res = createMockRes();

      await executeHandlers(handlers, req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('user@example.com');
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('rejects wrong password', async () => {
      const handlers = getRouteHandlers('post', '/login').slice(1);
      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      vi.mocked(get).mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        password: hashedPassword,
      });

      const req = {
        body: {
          email: 'user@example.com',
          password: 'wrongpassword',
        },
      };
      const res = createMockRes();

      await executeHandlers(handlers, req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Email ou mot de passe incorrect.');
    });

    it('returns 400 when required fields are missing', async () => {
      const handlers = getRouteHandlers('post', '/login').slice(1);

      const req = { body: { email: 'user@example.com' } };
      const res = createMockRes();

      await executeHandlers(handlers, req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(get).not.toHaveBeenCalled();
    });
  });
});
