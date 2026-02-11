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

vi.mock('../../database.js', () => ({
  query: dbMocks.query,
  get: dbMocks.get,
  run: dbMocks.run,
  withTransaction: dbMocks.withTransaction,
}));

import reportsRoutes from '../../routes/reports.js';

const getRouteHandlers = (method, path) => {
  const layer = reportsRoutes.stack.find(
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
  };
  return res;
};

describe('Reports Routes (transaction flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when provided planId is not owned by current user', async () => {
    const handlers = getRouteHandlers('post', '/');
    dbMocks.tx.get.mockResolvedValueOnce(undefined);

    const req = {
      user: { id: 'user-1' },
      body: {
        reportId: 'RPT-404',
        dateLabel: '11 fev. 2026, 09:30',
        siteName: 'Chantier A',
        imageDataUrl: 'data:image/jpeg;base64,abc',
        priority: 'high',
        category: 'anomaly',
        planId: '99ef8f99-6d74-4a9d-9f72-b7f0f03609f1',
      },
    };
    const res = createMockRes();

    await executeHandlers(handlers, req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Plan non trouvé.');
    expect(dbMocks.withTransaction).toHaveBeenCalledTimes(1);
    expect(dbMocks.tx.run).not.toHaveBeenCalled();
  });

  it('creates report and extra works in one transaction', async () => {
    const handlers = getRouteHandlers('post', '/');
    const createdReport = {
      id: 'rep-1',
      reportId: 'RPT-100',
      siteName: 'Chantier B',
    };
    const extraWorks = [
      { id: 'ew-1', reportId: 'rep-1', description: 'Fix A' },
      { id: 'ew-2', reportId: 'rep-1', description: 'Fix B' },
    ];

    dbMocks.tx.get
      .mockResolvedValueOnce({ id: 'plan-1', siteId: 'site-1' })
      .mockResolvedValueOnce(createdReport);
    dbMocks.tx.run.mockResolvedValue({ changes: 1 });
    dbMocks.tx.query.mockResolvedValue(extraWorks);

    const req = {
      user: { id: 'user-1' },
      body: {
        reportId: 'RPT-100',
        dateLabel: '11 fev. 2026, 09:45',
        siteName: 'Chantier B',
        imageDataUrl: 'data:image/jpeg;base64,abc',
        priority: 'medium',
        category: 'progress',
        planId: '89ef8f99-6d74-4a9d-9f72-b7f0f03609f1',
        extraWorks: [
          { description: 'Fix A', estimatedCost: 100, urgency: 'high', category: 'urgent' },
          { description: 'Fix B', estimatedCost: 50, urgency: 'medium', category: 'other' },
        ],
      },
    };
    const res = createMockRes();

    await executeHandlers(handlers, req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.report.id).toBe('rep-1');
    expect(res.body.data.report.extraWorks).toHaveLength(2);

    expect(dbMocks.withTransaction).toHaveBeenCalledTimes(1);
    expect(dbMocks.tx.run).toHaveBeenCalledTimes(3);
    expect(dbMocks.tx.run.mock.calls[0][0]).toContain('INSERT INTO reports');
    expect(dbMocks.tx.run.mock.calls[1][0]).toContain('INSERT INTO extra_works');
  });
});
