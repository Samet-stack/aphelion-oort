import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Cache Service (memory mode)', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CACHE_MODE = 'memory';
    delete process.env.REDIS_URL;
  });

  it('stores and reads JSON values', async () => {
    const { setCachedJson, getCachedJson } = await import('../../services/cache.js');

    await setCachedJson('test:key', { hello: 'world' }, 60);
    const value = await getCachedJson('test:key');

    expect(value).toEqual({ hello: 'world' });
  });

  it('returns cache hit after first loader call', async () => {
    const { getOrSetCache } = await import('../../services/cache.js');

    let calls = 0;
    const loader = async () => {
      calls += 1;
      return { success: true, data: { v: 123 } };
    };

    const first = await getOrSetCache({ key: 'cache:hit:test', ttlSeconds: 60, loader });
    const second = await getOrSetCache({ key: 'cache:hit:test', ttlSeconds: 60, loader });

    expect(first.hit).toBe(false);
    expect(second.hit).toBe(true);
    expect(calls).toBe(1);
    expect(second.data.data.v).toBe(123);
  });

  it('does not cache payloads tagged with __statusCode', async () => {
    const { getOrSetCache } = await import('../../services/cache.js');

    let calls = 0;
    const loader = async () => {
      calls += 1;
      return { success: false, message: 'Not found', __statusCode: 404 };
    };

    const first = await getOrSetCache({ key: 'cache:404:test', ttlSeconds: 60, loader });
    const second = await getOrSetCache({ key: 'cache:404:test', ttlSeconds: 60, loader });

    expect(first.hit).toBe(false);
    expect(second.hit).toBe(false);
    expect(calls).toBe(2);
  });

  it('invalidates keys only for selected user/namespace', async () => {
    const { cacheKeys, setCachedJson, getCachedJson, invalidateUserCache } = await import('../../services/cache.js');

    const userAKey = cacheKeys.reportsList({ userId: 'user-a', mode: 'summary', limit: 20, offset: 0 });
    const userBKey = cacheKeys.reportsList({ userId: 'user-b', mode: 'summary', limit: 20, offset: 0 });

    await setCachedJson(userAKey, { user: 'a' }, 60);
    await setCachedJson(userBKey, { user: 'b' }, 60);

    await invalidateUserCache('user-a', ['reports']);

    const userAValue = await getCachedJson(userAKey);
    const userBValue = await getCachedJson(userBKey);

    expect(userAValue).toBeUndefined();
    expect(userBValue).toEqual({ user: 'b' });
  });
});
