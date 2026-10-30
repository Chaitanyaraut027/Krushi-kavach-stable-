import Redis from 'ioredis';

/**
 * Redis Configuration & Connection Manager
 * ─────────────────────────────────────────
 * Supports standard REDIS_URL (e.g. Upstash, Redis Cloud, or redis://localhost:6379).
 * Includes graceful fallback: if Redis is unavailable, the application continues
 * seamlessly without throwing or halting requests.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient = null;
let isConnected = false;

try {
  redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      // In development or when Redis isn't running, stop retrying after 2 attempts
      if (times > 2) return null;
      return 1000;
    },
    lazyConnect: true,
    connectTimeout: 2000,
    enableOfflineQueue: false,
  });

  redisClient.on('connect', () => {
    isConnected = true;
    console.log('✅ [Redis] Connected to Redis caching layer');
  });

  redisClient.on('ready', () => {
    isConnected = true;
  });

  redisClient.on('close', () => {
    isConnected = false;
  });

  redisClient.on('error', (err) => {
    isConnected = false;
    if (err.code !== 'ECONNREFUSED') {
      console.warn('[Redis] Connection warning:', err.message);
    }
  });

  // Non-blocking initialization
  redisClient.connect().catch(() => {
    console.log('ℹ️  [Redis] Server offline or not configured — running with direct query fallback');
  });
} catch (err) {
  console.warn('[Redis] Client setup skipped:', err.message);
}

export const isRedisReady = () => isConnected && redisClient?.status === 'ready';
export default redisClient;
