import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../config/database';
import { requireAuth } from '../utils/auth';
import { NotFoundError } from '../utils/errors';

const historyQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  filter: z.enum(['today', 'week', 'all']).default('all'),
});

const settingsBody = z.object({
  username: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[\w .-]+$/, 'Letters, numbers, spaces, dots, dashes only')
    .optional(),
  favoriteTeam: z.string().trim().min(2).max(30).optional(),
});

function filterSince(filter: 'today' | 'week' | 'all'): Date | undefined {
  if (filter === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (filter === 'week') return new Date(Date.now() - 7 * 86_400_000);
  return undefined;
}

interface TypeBucket {
  total: number;
  correct: number;
}

function pct(bucket: TypeBucket | undefined): number {
  if (!bucket || bucket.total === 0) return 0;
  return Math.round((bucket.correct / bucket.total) * 100);
}

/** Aggregated user statistics incl. the intuition profile (accuracy by event type). */
export async function userRoutes(app: FastifyInstance): Promise<void> {
  /** Profile bundle: identity + headline stats + global rank in one round trip. */
  app.get('/api/user/profile', async (request) => {
    const { userId } = requireAuth(request);
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        walletAddress: true,
        username: true,
        favoriteTeam: true,
        createdAt: true,
        totalPoints: true,
        currentStreak: true,
        bestStreak: true,
      },
    });
    if (!user) throw new NotFoundError('User');

    const [resolved, correct, ahead] = await prisma.$transaction([
      prisma.prediction.count({ where: { userId, resolved: true } }),
      prisma.prediction.count({ where: { userId, resolved: true, wasCorrect: true } }),
      // Leaderboard rank: same ordering as the leaderboard (points DESC, createdAt ASC)
      prisma.user.count({
        where: {
          OR: [
            { totalPoints: { gt: user.totalPoints } },
            { totalPoints: user.totalPoints, createdAt: { lt: user.createdAt } },
          ],
        },
      }),
    ]);

    return {
      success: true,
      data: {
        user: {
          walletAddress: user.walletAddress,
          username: user.username,
          favoriteTeam: user.favoriteTeam,
          createdAt: user.createdAt.toISOString(),
        },
        stats: {
          totalPredictions: resolved,
          accuracy: resolved > 0 ? Math.round((correct / resolved) * 1000) / 10 : 0,
          currentStreak: user.currentStreak,
          bestStreak: user.bestStreak,
          totalPoints: user.totalPoints,
          rank: ahead + 1,
        },
      },
    };
  });

  /** Prediction history with match context — powers the profile history list. */
  app.get('/api/user/predictions', async (request) => {
    const { userId } = requireAuth(request);
    const { limit, offset, filter } = historyQuery.parse(request.query);
    const prisma = getPrisma();

    const since = filterSince(filter);
    const where = {
      userId,
      resolved: true,
      ...(since ? { createdAt: { gte: since } } : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.prediction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          match: {
            select: {
              homeTeam: true,
              awayTeam: true,
              homeTeamCode: true,
              awayTeamCode: true,
              homeScore: true,
              awayScore: true,
            },
          },
        },
      }),
      prisma.prediction.count({ where }),
    ]);

    return {
      success: true,
      data: {
        predictions: rows.map((p) => ({
          id: p.id,
          predictedAction: p.predictedAction,
          matchMinute: p.matchMinute,
          wasCorrect: p.wasCorrect,
          eventOccurred: p.eventOccurred,
          eventType: p.eventType,
          pointsEarned: p.pointsEarned,
          createdAt: p.createdAt.toISOString(),
          match: p.match
            ? {
                homeTeam: p.match.homeTeam,
                awayTeam: p.match.awayTeam,
                homeTeamCode: p.match.homeTeamCode,
                awayTeamCode: p.match.awayTeamCode,
                homeScore: p.match.homeScore,
                awayScore: p.match.awayScore,
              }
            : null,
        })),
        total,
      },
    };
  });

  /** Achievement badges computed from prediction history. */
  app.get('/api/user/achievements', async (request) => {
    const { userId } = requireAuth(request);
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { bestStreak: true },
    });
    if (!user) throw new NotFoundError('User');

    const [total, correctGoals, correctCards, perMatch] = await prisma.$transaction([
      prisma.prediction.count({ where: { userId, resolved: true } }),
      prisma.prediction.count({
        where: { userId, resolved: true, wasCorrect: true, eventType: 'GOAL' },
      }),
      prisma.prediction.count({
        where: {
          userId,
          resolved: true,
          wasCorrect: true,
          eventType: { in: ['RED_CARD', 'YELLOW_CARD'] },
        },
      }),
      prisma.prediction.groupBy({
        by: ['matchId', 'wasCorrect'],
        where: { userId, resolved: true },
        _count: { _all: true },
      }),
    ]);

    // Perfect Game: a match with 5+ predictions and zero wrong answers.
    const byMatch = new Map<string, { correct: number; wrong: number }>();
    for (const row of perMatch) {
      const bucket = byMatch.get(row.matchId) ?? { correct: 0, wrong: 0 };
      if (row.wasCorrect === true) bucket.correct += row._count._all;
      else bucket.wrong += row._count._all;
      byMatch.set(row.matchId, bucket);
    }
    const perfectGame = [...byMatch.values()].some((b) => b.correct >= 5 && b.wrong === 0);

    const achievements = [
      { id: 'first_prediction', name: 'First Prediction', rarity: 'common', description: 'Make your first prediction', earned: total >= 1 },
      { id: 'streak_3', name: 'Hat-Trick', rarity: 'uncommon', description: 'Get a 3-prediction streak', earned: user.bestStreak >= 3 },
      { id: 'streak_5', name: 'On Fire', rarity: 'rare', description: 'Get a 5-prediction streak', earned: user.bestStreak >= 5 },
      { id: 'streak_10', name: 'Clairvoyant', rarity: 'epic', description: 'Get a 10-prediction streak', earned: user.bestStreak >= 10 },
      { id: 'goal_whisperer', name: 'Goal Whisperer', rarity: 'rare', description: 'Predict 10 goals correctly', earned: correctGoals >= 10 },
      { id: 'card_master', name: 'Card Master', rarity: 'rare', description: 'Predict 20 cards correctly', earned: correctCards >= 20 },
      { id: 'perfect_game', name: 'Perfect Game', rarity: 'epic', description: '5+ predictions in one match, all correct', earned: perfectGame },
      { id: 'century_club', name: 'Century Club', rarity: 'legendary', description: 'Make 100 predictions', earned: total >= 100 },
    ];
    return { success: true, data: { achievements } };
  });

  /** Update editable profile fields (username, favorite team). */
  app.post(
    '/api/user/settings',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const { userId } = requireAuth(request);
      const body = settingsBody.parse(request.body);
      const prisma = getPrisma();
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(body.username !== undefined ? { username: body.username } : {}),
          ...(body.favoriteTeam !== undefined ? { favoriteTeam: body.favoriteTeam } : {}),
        },
        select: { username: true, favoriteTeam: true },
      });
      return { success: true, data: { user } };
    },
  );

  app.get('/api/user/stats', async (request) => {
    const { userId } = requireAuth(request);
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalPoints: true, currentStreak: true, bestStreak: true },
    });
    if (!user) throw new NotFoundError('User');

    const grouped = await prisma.prediction.groupBy({
      by: ['eventType', 'wasCorrect'],
      where: { userId, resolved: true },
      _count: { _all: true },
    });

    let totalPredictions = 0;
    let correctPredictions = 0;
    const byType = new Map<string, TypeBucket>();
    for (const row of grouped) {
      const count = row._count._all;
      totalPredictions += count;
      if (row.wasCorrect === true) correctPredictions += count;
      const key = row.eventType ?? 'NONE';
      const bucket = byType.get(key) ?? { total: 0, correct: 0 };
      bucket.total += count;
      if (row.wasCorrect === true) bucket.correct += count;
      byType.set(key, bucket);
    }

    return {
      success: true,
      data: {
        totalPredictions,
        correctPredictions,
        accuracy:
          totalPredictions > 0
            ? Math.round((correctPredictions / totalPredictions) * 1000) / 10
            : 0,
        currentStreak: user.currentStreak,
        bestStreak: user.bestStreak,
        totalPoints: user.totalPoints,
        intuitionProfile: {
          goalAccuracy: pct(byType.get('GOAL')),
          cardAccuracy: pct({
            total: (byType.get('RED_CARD')?.total ?? 0) + (byType.get('YELLOW_CARD')?.total ?? 0),
            correct:
              (byType.get('RED_CARD')?.correct ?? 0) + (byType.get('YELLOW_CARD')?.correct ?? 0),
          }),
          cornerAccuracy: pct(byType.get('CORNER')),
          calmAccuracy: pct(byType.get('NONE')),
        },
      },
    };
  });
}
