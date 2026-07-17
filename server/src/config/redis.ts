import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

let redis: Redis | null = null;

/** Lazy Redis singleton. Callers must tolerate Redis being down (fall back to DB). */
export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
    redis.on('error', (err) => logger.warn('redis_error', { message: err.message }));
  }
  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    redis.disconnect();
    redis = null;
  }
}

export const CACHE_KEYS = {
  match: (matchId: string) => `match:${matchId}`,
  matchDetail: (matchId: string) => `match:${matchId}:detail`,
  matchList: 'matches:live',
  leaderboard: 'leaderboard:global',
  userStats: (userId: string) => `user:${userId}:stats`,
  userStreak: (userId: string) => `user:${userId}:streak`,
} as const;

export const CACHE_TTL_SECONDS = {
  match: 55,
  matchDetail: 30,
  matchList: 300,
  leaderboard: 60,
  userStats: 300,
} as const;
