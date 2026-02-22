import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => {
  const tx = {
    get: vi.fn(),
    run: vi.fn(),
    query: vi.fn(),
  };

  return {
    query: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
    withTransaction: vi.fn(async (callback) => callback(tx)),
    tx,
  };
});

const cacheMocks = vi.hoisted(() => ({
  CACHE_TTLS: {
    plansList: 60,
    planDetail: 60,
  },
  cacheKeys: {
    plansList: vi.fn(() => 'plans:list'),
    planDetail: vi.fn(() => 'plans:detail'),
  },
  getOrSetCache: vi.fn(),
  invalidateUserCache: vi.fn(),
}));

vi.mock('../../database.js', () => ({
  query: dbMocks.query,
  get: dbMocks.get,
  run: dbMocks.run,
  withTransaction: dbMocks.withTransaction,
}));

vi.mock('../../services/cache.js', () => ({
  CACHE_TTLS: cacheMocks.CACHE_TTLS,
  cacheKeys: cacheMocks.cacheKeys,
  getOrSetCache: cacheMocks.getOrSetCache,
  invalidateUserCache: cacheMocks.invalidateUserCache,
}));

import plansRoutes from '../../routes/plans.js';

const getRouteHandlers = (method, path) => {
  const layer = plansRoutes.stack.find(
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
    set: vi.fn(() => res),
  };
  return res;
};

describe('Plans Routes (site activity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheMocks.getOrSetCache.mockReset();
    cacheMocks.invalidateUserCache.mockReset();
  });

  it('bumps site updated_at after adding a point', async () => {
    const handlers = getRouteHandlers('post', '/:id/points').slice(1);

    dbMocks.tx.get
      .mockResolvedValueOnce({ id: 'plan-1', siteId: 'site-1' })
      .mockResolvedValueOnce({ maxNum: 4 })
      .mockResolvedValueOnce({ id: 'point-1' });
    dbMocks.tx.run.mockResolvedValue({ changes: 1 });

    const req = {
      user: { id: 'user-1' },
      params: { id: 'plan-1' },
      body: {
        positionX: 12,
        positionY: 38,
        title: 'Point test',
        photoDataUrl: 'data:image/jpeg;base64,abc',
        dateLabel: '14/02/2026',
      },
    };
    const res = createMockRes();

    await executeHandlers(handlers, req, res);

    expect(res.statusCode).toBe(201);
    expect(dbMocks.tx.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sites SET updated_at = now()'),
      ['site-1', 'user-1']
    );
    expect(cacheMocks.invalidateUserCache).toHaveBeenCalledWith('user-1', ['plans', 'sites', 'reports']);
  });

  it('bumps site updated_at after updating a point', async () => {
    const handlers = getRouteHandlers('put', '/:id/points/:pointId').slice(1);

    dbMocks.get
      .mockResolvedValueOnce({ id: 'point-1', siteId: 'site-1' })
      .mockResolvedValueOnce({ id: 'point-1', title: 'Point maj' });
    dbMocks.run.mockResolvedValue({ changes: 1 });

    const req = {
      user: { id: 'user-1' },
      params: { id: 'plan-1', pointId: 'point-1' },
      body: {
        title: 'Point maj',
        status: 'en_cours',
      },
    };
    const res = createMockRes();

    await executeHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(dbMocks.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sites SET updated_at = now()'),
      ['site-1', 'user-1']
    );
    expect(cacheMocks.invalidateUserCache).toHaveBeenCalledWith('user-1', ['plans', 'sites', 'reports']);
  });

  it('bumps site updated_at after deleting a plan', async () => {
    const handlers = getRouteHandlers('delete', '/:id');

    dbMocks.get.mockResolvedValueOnce({ id: 'plan-1', siteId: 'site-1' });
    dbMocks.run.mockResolvedValue({ changes: 1 });

    const req = {
      user: { id: 'user-1' },
      params: { id: 'plan-1' },
    };
    const res = createMockRes();

    await executeHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(dbMocks.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sites SET updated_at = now()'),
      ['site-1', 'user-1']
    );
    expect(cacheMocks.invalidateUserCache).toHaveBeenCalledWith('user-1', ['plans', 'sites', 'reports']);
  });
});
