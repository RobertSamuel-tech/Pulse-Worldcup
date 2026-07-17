import { config } from '../config';
import { getPrisma } from '../config/database';
import { CACHE_KEYS, getRedis } from '../config/redis';
import { matchService, countersAt } from './match.service';
import type { ScoreCounters } from './match.service';
import { emitToUser } from '../socket/emitter';
import { logger } from '../utils/logger';
import {
  MatchNotLiveError,
  NotFoundError,
  PredictionConflictError,
} from '../utils/errors';
import type { EventType as DbEventType, Prediction as DbPrediction } from '../generated/prisma/client';

export const PREDICTION_WINDOW_MS = 60_000;

const BASE_POINTS = 100;

const EVENT_MULTIPLIERS: Record<string, number> = {
  GOAL: 3.0,
  PENALTY: 3.0,
  RED_CARD: 2.5,
  YELLOW_CARD: 2.0,
  CORNER: 1.5,
  SUBSTITUTION: 1.0,
  NONE: 1.0,
};

const STREAK_BONUSES: ReadonlyArray<{ minStreak: number; bonus: number }> = [
  { minStreak: 20, bonus: 500 },
  { minStreak: 10, bonus: 250 },
  { minStreak: 5, bonus: 100 },
  { minStreak: 3, bonus: 50 },
];

export interface PredictionDto {
  id: string;
  matchId: string; // public fixture id
  predictedAction: boolean;
  matchMinute: number;
  createdAt: string;
  resolveAt: string;
  /** Spec alias of resolveAt — when the 60s window closes. */
  expiresAt: string;
  resolved: boolean;
  wasCorrect: boolean | null;
  eventOccurred: boolean | null;
  eventType: DbEventType | null;
  pointsEarned: number;
  user?: { totalPoints: number; currentStreak: number; bestStreak: number };
}

function toDto(
  prediction: DbPrediction & { match?: { txlineMatchId: string } },
  userStats?: { totalPoints: number; currentStreak: number; bestStreak: number },
): PredictionDto {
  const resolveAt = new Date(prediction.createdAt.getTime() + PREDICTION_WINDOW_MS).toISOString();
  return {
    id: prediction.id,
    matchId: prediction.match?.txlineMatchId ?? '',
    predictedAction: prediction.predictedAction,
    matchMinute: prediction.matchMinute,
    createdAt: prediction.createdAt.toISOString(),
    resolveAt,
    expiresAt: resolveAt,
    resolved: prediction.resolved,
    wasCorrect: prediction.wasCorrect,
    eventOccurred: prediction.eventOccurred,
    eventType: prediction.eventType,
    pointsEarned: prediction.pointsEarned,
    ...(userStats ? { user: userStats } : {}),
  };
}

/** Strongest event in the window wins the multiplier (goal > red > yellow > corner). */
function dominantEvent(start: ScoreCounters, end: ScoreCounters): DbEventType {
  const diff = (pick: (c: ScoreCounters) => number): number => pick(end) - pick(start);
  const goals = diff((c) => c.participant1.goals + c.participant2.goals);
  const reds = diff((c) => c.participant1.redCards + c.participant2.redCards);
  const yellows = diff((c) => c.participant1.yellowCards + c.participant2.yellowCards);
  const corners = diff((c) => c.participant1.corners + c.participant2.corners);
  if (goals > 0) return 'GOAL';
  if (reds > 0) return 'RED_CARD';
  if (yellows > 0) return 'YELLOW_CARD';
  if (corners > 0) return 'CORNER';
  return 'NONE';
}

/**
 * Prediction lifecycle: create → 60s window → resolve → score.
 * Server is the single source of truth for points and streaks.
 * Design decision: wrong predictions do NOT break the streak (see spec) —
 * only correct ones extend it.
 */
export class PredictionService {
  async createPrediction(
    userId: string,
    matchId: string,
    predictedAction: boolean,
  ): Promise<PredictionDto> {
    const match = await matchService.getMatch(matchId);
    const isLive = match.status === 'live' || match.status === 'halftime';
    if (!isLive && !config.ALLOW_PREDICTIONS_PRELIVE) {
      throw new MatchNotLiveError(matchId);
    }

    const dbMatch = await matchService.upsertMatchRecord(match);
    const prisma = getPrisma();

    const active = await prisma.prediction.findFirst({
      where: { userId, resolved: false },
    });
    if (active) throw new PredictionConflictError();

    const prediction = await prisma.prediction.create({
      data: {
        userId,
        matchId: dbMatch.id,
        predictedAction,
        matchMinute: match.minute ?? 0,
      },
      include: { match: { select: { txlineMatchId: true } } },
    });
    logger.info('prediction_created', { predictionId: prediction.id, userId, matchId });
    return toDto(prediction);
  }

  /**
   * Idempotent resolution: compares TxLINE score counters at window start vs end.
   * Called by the sweeper worker and on-demand from GET /api/predictions/:id.
   */
  async resolvePrediction(predictionId: string): Promise<PredictionDto> {
    const prisma = getPrisma();
    const prediction = await prisma.prediction.findUnique({
      where: { id: predictionId },
      include: { match: { select: { txlineMatchId: true } }, user: true },
    });
    if (!prediction) throw new NotFoundError('Prediction');

    const windowEnd = prediction.createdAt.getTime() + PREDICTION_WINDOW_MS;
    if (prediction.resolved || Date.now() < windowEnd) {
      return toDto(prediction, {
        totalPoints: prediction.user.totalPoints,
        currentStreak: prediction.user.currentStreak,
        bestStreak: prediction.user.bestStreak,
      });
    }

    let eventType: DbEventType = 'NONE';
    try {
      const rows = await matchService.getScoreRows(Number(prediction.match.txlineMatchId));
      eventType = dominantEvent(
        countersAt(rows, prediction.createdAt.getTime()),
        countersAt(rows, windowEnd),
      );
    } catch (err) {
      // TxLINE unreachable — treat as calm window rather than blocking resolution forever.
      logger.error('prediction_resolution_data_failed', {
        predictionId,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const eventOccurred = eventType !== 'NONE';
    const wasCorrect = prediction.predictedAction === eventOccurred;
    const pointsEarned = wasCorrect
      ? this.calculatePoints(
          prediction.predictedAction,
          eventOccurred,
          eventType,
          prediction.user.currentStreak + 1,
        )
      : 0;

    let updated: DbPrediction & { match: { txlineMatchId: string } };
    let user: { totalPoints: number; currentStreak: number; bestStreak: number };
    try {
      [updated, user] = await prisma.$transaction([
        prisma.prediction.update({
          where: { id: predictionId, resolved: false }, // idempotency guard for racing sweepers
          data: {
            resolved: true,
            resolvedAt: new Date(),
            wasCorrect,
            eventOccurred,
            eventType,
            pointsEarned,
          },
          include: { match: { select: { txlineMatchId: true } } },
        }),
        prisma.user.update({
          where: { id: prediction.userId },
          data: wasCorrect
            ? {
                totalPoints: { increment: pointsEarned },
                currentStreak: { increment: 1 },
                bestStreak: Math.max(
                  prediction.user.bestStreak,
                  prediction.user.currentStreak + 1,
                ),
              }
            : {}, // wrong prediction: no points, streak untouched
        }),
      ]);
    } catch (err) {
      // P2025: another resolver won the race — return its result instead.
      if ((err as { code?: string }).code === 'P2025') {
        return this.getById(prediction.userId, predictionId);
      }
      throw err;
    }

    try {
      await getRedis().del(CACHE_KEYS.leaderboard);
    } catch {
      // cache invalidation is best-effort
    }

    logger.info('prediction_resolved', {
      predictionId,
      wasCorrect,
      eventType,
      pointsEarned,
    });
    const dto = toDto(updated, {
      totalPoints: user.totalPoints,
      currentStreak: user.currentStreak,
      bestStreak: user.bestStreak,
    });
    // Real-time push — the client also polls, so this is a latency win, not a dependency.
    emitToUser(prediction.userId, 'prediction-result', dto);
    emitToUser(prediction.userId, 'user-stats-update', dto.user);
    return dto;
  }

  /** The active (unresolved) prediction for a user, if any. */
  async getActive(userId: string): Promise<PredictionDto | null> {
    const prediction = await getPrisma().prediction.findFirst({
      where: { userId, resolved: false },
      include: { match: { select: { txlineMatchId: true } } },
    });
    return prediction ? toDto(prediction) : null;
  }

  /** A user's prediction by id — resolving it first if its window has expired. */
  async getById(userId: string, predictionId: string): Promise<PredictionDto> {
    const prediction = await getPrisma().prediction.findUnique({
      where: { id: predictionId },
      include: { match: { select: { txlineMatchId: true } }, user: true },
    });
    if (!prediction || prediction.userId !== userId) throw new NotFoundError('Prediction');
    return this.resolvePrediction(predictionId);
  }

  async getHistory(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ predictions: PredictionDto[]; total: number }> {
    const prisma = getPrisma();
    const [rows, total] = await prisma.$transaction([
      prisma.prediction.findMany({
        where: { userId, resolved: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { match: { select: { txlineMatchId: true } } },
      }),
      prisma.prediction.count({ where: { userId, resolved: true } }),
    ]);
    return { predictions: rows.map((row) => toDto(row)), total };
  }

  /** All overdue unresolved predictions — consumed by the sweeper worker. */
  async findOverdue(): Promise<string[]> {
    const rows = await getPrisma().prediction.findMany({
      where: { resolved: false, createdAt: { lte: new Date(Date.now() - PREDICTION_WINDOW_MS) } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Pure scoring function — unit-test this exhaustively. */
  calculatePoints(
    predictedAction: boolean,
    eventOccurred: boolean,
    eventType: string,
    currentStreak: number,
  ): number {
    if (predictedAction !== eventOccurred) return 0;
    const multiplier = EVENT_MULTIPLIERS[eventType] ?? 1.0;
    return Math.floor(BASE_POINTS * multiplier) + this.getStreakBonus(currentStreak);
  }

  getStreakBonus(currentStreak: number): number {
    for (const { minStreak, bonus } of STREAK_BONUSES) {
      if (currentStreak >= minStreak) return bonus;
    }
    return 0;
  }
}

export const predictionService = new PredictionService();
