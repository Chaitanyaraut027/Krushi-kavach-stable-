import redisClient, { isRedisReady } from '../config/redis.js';

/**
 * Cache Service (Redis with graceful bypass)
 * ───────────────────────────────────────────
 * Caches expensive LLM responses and repetitive queries.
 * When Redis is offline or disabled, it cleanly returns null / false
 * allowing callers to fetch fresh data with zero errors.
 */

// Retrieve parsed JSON value from cache
export const getCache = async (key) => {
  if (!isRedisReady()) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    return null;
  }
};

// Store JSON value in cache with expiration (default: 24h = 86400s)
export const setCache = async (key, value, ttlSeconds = 86400) => {
  if (!isRedisReady()) return false;
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redisClient.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await redisClient.set(key, serialized);
    }
    return true;
  } catch (err) {
    return false;
  }
};

// Invalidate a specific cache key
export const deleteCache = async (key) => {
  if (!isRedisReady()) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    return false;
  }
};
