import { logger } from './logger.js';
const CACHE_PREFIX = process.env.CACHE_PREFIX || 'siteflow';

const parsePositiveInt = (value, fallback) => {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

export const CACHE_TTLS = {
  reportsList: parsePositiveInt(process.env.CACHE_TTL_REPORTS_SECONDS, 90),
  reportDetail: parsePositiveInt(process.env.CACHE_TTL_REPORT_DETAIL_SECONDS, 120),
  reportStats: parsePositiveInt(process.env.CACHE_TTL_REPORT_STATS_SECONDS, 90),
  sitesList: parsePositiveInt(process.env.CACHE_TTL_SITES_SECONDS, 90),
  siteDetail: parsePositiveInt(process.env.CACHE_TTL_SITE_DETAIL_SECONDS, 120),
  plansList: parsePositiveInt(process.env.CACHE_TTL_PLANS_SECONDS, 90),
  planDetail: parsePositiveInt(process.env.CACHE_TTL_PLAN_DETAIL_SECONDS, 120),
};

const memoryStore = new Map();

let redisClient;
let redisInitPromise;
let redisUnavailableReason = null;
let printedFallbackInfo = false;

const getRequestedMode = () => (process.env.CACHE_MODE || 'auto').toLowerCase();

const resolveCacheMode = () => {
  const mode = getRequestedMode();
  if (mode === 'off' || mode === 'none') return 'off';
  if (mode === 'memory') return 'memory';
  if (mode === 'redis') return 'redis';
  return process.env.REDIS_URL ? 'redis' : 'memory';
};

let activeMode = resolveCacheMode();

const toRegexFromWildcard = (pattern) => {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
};

const logFallbackToMemory = (reason) => {
  if (printedFallbackInfo) return;
  printedFallbackInfo = true;
  logger.warn('Redis unavailable, memory cache fallback enabled', { reason });
};

const getRedisClient = async () => {
  if (activeMode !== 'redis') return null;
  if (redisClient) return redisClient;
  if (redisInitPromise) return redisInitPromise;

  redisInitPromise = (async () => {
    try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error('REDIS_URL absent');
      }

      const redisModule = await import('ioredis');
      const Redis = redisModule.default;
      const client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });

      client.on('error', (err) => {
        redisUnavailableReason = err.message;
      });

      await client.connect();
      redisClient = client;
      return redisClient;
    } catch (error) {
      redisUnavailableReason = error.message;
      activeMode = 'memory';
      logFallbackToMemory(error.message);
      return null;
    } finally {
      redisInitPromise = undefined;
    }
  })();

  return redisInitPromise;
};

const getMemoryRaw = (key) => {
  const item = memoryStore.get(key);
  if (!item) return null;

  if (item.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }

  return item.value;
};

const setMemoryRaw = (key, value, ttlSeconds) => {
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
};

const deleteMemoryByPattern = (pattern) => {
  const matcher = toRegexFromWildcard(pattern);
  let deleted = 0;

  for (const key of memoryStore.keys()) {
    if (matcher.test(key)) {
      memoryStore.delete(key);
      deleted += 1;
    }
  }

  return deleted;
};

const getRaw = async (key) => {
  if (activeMode === 'off') return null;

  const redis = await getRedisClient();
  if (redis) {
    return redis.get(key);
  }

  return getMemoryRaw(key);
};

const setRaw = async (key, value, ttlSeconds) => {
  if (activeMode === 'off') return;

  const redis = await getRedisClient();
  if (redis) {
    await redis.set(key, value, 'EX', ttlSeconds);
    return;
  }

  setMemoryRaw(key, value, ttlSeconds);
};

const deleteByPattern = async (pattern) => {
  if (activeMode === 'off') return 0;

  const redis = await getRedisClient();
  if (redis) {
    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '200');
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');

    return deleted;
  }

  return deleteMemoryByPattern(pattern);
};

const baseKeyForUser = (namespace, userId) => `${CACHE_PREFIX}:${namespace}:user:${userId}`;

const appendParams = (key, params) => {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${encodeURIComponent(String(value))}`);

  if (entries.length === 0) return key;
  return `${key}:${entries.join(':')}`;
};

export const cacheKeys = {
  reportsList: ({ userId, mode, limit, offset }) =>
    appendParams(`${baseKeyForUser('reports', userId)}:list`, { mode, limit, offset }),
  reportDetail: ({ userId, reportId }) =>
    `${baseKeyForUser('reports', userId)}:detail:${reportId}`,
  reportStats: ({ userId }) =>
    `${baseKeyForUser('reports', userId)}:stats:summary`,
  sitesList: ({ userId }) =>
    `${baseKeyForUser('sites', userId)}:list`,
  siteDetail: ({ userId, siteId }) =>
    `${baseKeyForUser('sites', userId)}:detail:${siteId}`,
  plansList: ({ userId, siteId }) =>
    appendParams(`${baseKeyForUser('plans', userId)}:list`, { siteId }),
  planDetail: ({ userId, planId }) =>
    `${baseKeyForUser('plans', userId)}:detail:${planId}`,
};

export const getCachedJson = async (key) => {
  try {
    const raw = await getRaw(key);
    if (raw == null) return undefined;
    return JSON.parse(raw);
  } catch (error) {
    logger.warn('getCachedJson failed', { key, reason: error.message });
    return undefined;
  }
};

export const setCachedJson = async (key, value, ttlSeconds) => {
  try {
    await setRaw(key, JSON.stringify(value), ttlSeconds);
  } catch (error) {
    logger.warn('setCachedJson failed', { key, reason: error.message });
  }
};

export const getOrSetCache = async ({ key, ttlSeconds, loader }) => {
  const cached = await getCachedJson(key);
  if (cached !== undefined) {
    return { data: cached, hit: true };
  }

  const data = await loader();
  if (!data || !data.__statusCode) {
    await setCachedJson(key, data, ttlSeconds);
  }
  return { data, hit: false };
};

export const invalidateUserCache = async (userId, namespaces) => {
  for (const namespace of namespaces) {
    const pattern = `${baseKeyForUser(namespace, userId)}:*`;
    try {
      await deleteByPattern(pattern);
    } catch (error) {
      logger.warn('Cache invalidation failed', { pattern, reason: error.message });
    }
  }
};

export const initializeCache = async () => {
  if (activeMode !== 'redis') return;
  await getRedisClient();
};

export const getCacheStatus = () => ({
  mode: activeMode,
  redisConfigured: Boolean(process.env.REDIS_URL),
  redisConnected: Boolean(redisClient),
  redisUnavailableReason,
  memoryEntries: memoryStore.size,
});
