import { getPrisma } from '../config/database';
import { CACHE_KEYS, CACHE_TTL_SECONDS, getRedis } from '../config/redis';
import { emitGlobal } from '../socket/emitter';
import { logger } from '../utils/logger';
import { memoize } from '../utils/memo-cache';

export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  walletAddress: string;
  points: number;
  accuracy: number; // 0-100
  bestStreak: number;
}

const TOP_PAGE_SIZE = 100;

/**
 * Rankings: Postgres is the source of truth (users.totalPoints maintained by
 * prediction resolution), Redis caches the top-100 page for 60s. The cache is
 * also invalidated on every resolved prediction.
 */
export class LeaderboardService {
  async getGlobal(limit = 25, offset = 0): Promise<LeaderboardRow[]> {
    // Only the canonical top page is cached; deeper pages go straight to DB.
    if (offset === 0 && limit <= TOP_PAGE_SIZE) {
      const top = await this.getTopPage();
      return top.slice(0, limit);
    }
    return this.query(limit, offset);
  }

  /**
   * L1 (in-process, 5s) in front of L2 (Redis, 60s) — see match.service.ts's
   * getMatches() for why this matters (SECTION 11: Upstash round-trip cost).
   */
  private getTopPage(): Promise<LeaderboardRow[]> {
    return memoize('leaderboard:top', 5_000, () => this.fetchTopPage());
  }

  private async fetchTopPage(): Promise<LeaderboardRow[]> {
    try {
      const cached = await getRedis().get(CACHE_KEYS.leaderboard);
      if (cached) return JSON.parse(cached) as LeaderboardRow[];
    } catch {
      // Redis down — fall through
    }
    return this.refreshCache();
  }

  /** Recomputes the top-100 page, rewrites the cache, broadcasts the top 10. */
  async refreshCache(): Promise<LeaderboardRow[]> {
    const rows = await this.query(TOP_PAGE_SIZE, 0);
    try {
      await getRedis().set(
        CACHE_KEYS.leaderboard,
        JSON.stringify(rows),
        'EX',
        CACHE_TTL_SECONDS.leaderboard,
      );
    } catch {
      // cache write is best-effort
    }
    emitGlobal('leaderboard-update', rows.slice(0, 10));
    return rows;
  }

  private async query(limit: number, offset: number): Promise<LeaderboardRow[]> {
    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      orderBy: [{ totalPoints: 'desc' }, { createdAt: 'asc' }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        username: true,
        walletAddress: true,
        totalPoints: true,
        bestStreak: true,
      },
    });
    if (users.length === 0) return [];

    const counts = await prisma.prediction.groupBy({
      by: ['userId', 'wasCorrect'],
      where: { resolved: true, userId: { in: users.map((u) => u.id) } },
      _count: { _all: true },
    });
    const totals = new Map<string, { total: number; correct: number }>();
    for (const row of counts) {
      const entry = totals.get(row.userId) ?? { total: 0, correct: 0 };
      entry.total += row._count._all;
      if (row.wasCorrect === true) entry.correct += row._count._all;
      totals.set(row.userId, entry);
    }

    return users.map((user, i) => {
      const stats = totals.get(user.id) ?? { total: 0, correct: 0 };
      return {
        rank: offset + i + 1,
        userId: user.id,
        username: user.username ?? '',
        walletAddress: user.walletAddress,
        points: user.totalPoints,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        bestStreak: user.bestStreak,
      };
    });
  }

  /** A user's own rank + row, wherever they sit. Memoized 3s — see getTopPage(). */
  getPersonalRank(userId: string): Promise<LeaderboardRow | null> {
    return memoize(`leaderboard:me:${userId}`, 3_000, () => this.fetchPersonalRank(userId));
  }

  private async fetchPersonalRank(userId: string): Promise<LeaderboardRow | null> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        walletAddress: true,
        totalPoints: true,
        bestStreak: true,
        createdAt: true,
      },
    });
    if (!user) return null;

    const ahead = await prisma.user.count({
      where: {
        OR: [
          { totalPoints: { gt: user.totalPoints } },
          { totalPoints: user.totalPoints, createdAt: { lt: user.createdAt } },
        ],
      },
    });

    const [stats] = await prisma.prediction.groupBy({
      by: ['userId'],
      where: { resolved: true, userId },
      _count: { _all: true },
    });
    const correct = await prisma.prediction.count({
      where: { resolved: true, userId, wasCorrect: true },
    });
    const total = stats?._count._all ?? 0;

    return {
      rank: ahead + 1,
      userId: user.id,
      username: user.username ?? '',
      walletAddress: user.walletAddress,
      points: user.totalPoints,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      bestStreak: user.bestStreak,
    };
  }
}

export const leaderboardService = new LeaderboardService();

export function startLeaderboardCacheWarmer(intervalMs = 60_000): void {
  setInterval(() => {
    void leaderboardService.refreshCache().catch((err: unknown) => {
      logger.warn('leaderboard_refresh_failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }, intervalMs).unref();
  logger.info('leaderboard_cache_warmer_started', { intervalMs });
}
