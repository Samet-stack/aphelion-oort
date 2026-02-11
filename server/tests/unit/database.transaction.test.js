import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const clientQuery = vi.fn();
  const clientRelease = vi.fn();
  const client = {
    query: clientQuery,
    release: clientRelease,
  };
  const poolConnect = vi.fn(async () => client);
  const poolQuery = vi.fn();
  const poolEnd = vi.fn();
  const Pool = vi.fn(() => ({
    connect: poolConnect,
    query: poolQuery,
    end: poolEnd,
  }));

  return {
    client,
    clientQuery,
    clientRelease,
    poolConnect,
    poolQuery,
    poolEnd,
    Pool,
  };
});

vi.mock('pg', () => ({
  default: {
    Pool: mocks.Pool,
  },
}));

describe('withTransaction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/siteflow_test';
  });

  it('starts and commits transaction when callback succeeds', async () => {
    mocks.clientQuery.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 1 };
    });

    const { withTransaction } = await import('../../database.js');

    const result = await withTransaction(async (tx) => {
      await tx.run('insert into reports (id) values (?)', ['rep-1']);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(mocks.clientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mocks.clientQuery).toHaveBeenNthCalledWith(
      2,
      'insert into reports (id) values ($1)',
      ['rep-1']
    );
    expect(mocks.clientQuery).toHaveBeenNthCalledWith(3, 'COMMIT');
    expect(mocks.clientRelease).toHaveBeenCalledTimes(1);
  });

  it('rolls back transaction when callback throws', async () => {
    mocks.clientQuery.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (sql.startsWith('insert into')) {
        throw new Error('insert failed');
      }
      return { rows: [], rowCount: 0 };
    });

    const { withTransaction } = await import('../../database.js');

    await expect(
      withTransaction(async (tx) => {
        await tx.run('insert into plans (id) values (?)', ['plan-1']);
      })
    ).rejects.toThrow('insert failed');

    expect(mocks.clientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mocks.clientQuery).toHaveBeenNthCalledWith(
      2,
      'insert into plans (id) values ($1)',
      ['plan-1']
    );
    expect(mocks.clientQuery).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(mocks.clientRelease).toHaveBeenCalledTimes(1);
  });
});
