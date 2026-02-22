import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  query: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

const cacheMocks = vi.hoisted(() => ({
  CACHE_TTLS: {
    sitesList: 90,
    siteDetail: 90,
  },
  cacheKeys: {
    sitesList: vi.fn(() => 'sites:list'),
    siteDetail: vi.fn(() => 'sites:detail'),
  },
  getOrSetCache: vi.fn(async ({ loader }) => ({ data: await loader(), hit: false })),
  invalidateUserCache: vi.fn(),
}));

vi.mock('../../database.js', () => ({
  query: dbMocks.query,
  get: dbMocks.get,
  run: dbMocks.run,
}));

vi.mock('../../services/cache.js', () => ({
  CACHE_TTLS: cacheMocks.CACHE_TTLS,
  cacheKeys: cacheMocks.cacheKeys,
  getOrSetCache: cacheMocks.getOrSetCache,
  invalidateUserCache: cacheMocks.invalidateUserCache,
}));

import sitesRoutes from '../../routes/sites.js';

const getRouteHandlers = (method, path) => {
  const layer = sitesRoutes.stack.find(
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

describe('Sites Routes (ordering)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads sites ordered by updated_at then created_at', async () => {
    const handlers = getRouteHandlers('get', '/');
    dbMocks.query.mockResolvedValue([]);

    const req = { user: { id: 'user-1' } };
    const res = createMockRes();

    await executeHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(dbMocks.query).toHaveBeenCalledTimes(1);
    expect(dbMocks.query.mock.calls[0][0]).toContain('order by s.updated_at desc, s.created_at desc');
  });
});
