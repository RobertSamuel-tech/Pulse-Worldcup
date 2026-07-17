import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config';
import { getPrisma } from '../config/database';
import { CACHE_KEYS, getRedis } from '../config/redis';
import { matchService, countersAt } from './match.service';
import type { ScoreCounters } from './match.service';
import { emitToUser } from '../socket/emitter';
import { logger } from '../utils/logger';
import { MatchNotLiveError, NotFoundError, PulseError } from '../utils/errors';
import type {
  ScratchCard as DbScratchCard,
  ScratchPrediction as DbScratchPrediction,
  ScratchTier,
} from '../generated/prisma/client';

/** The observation window: lock-in → +2 minutes of real match action. */
export const SCRATCH_WINDOW_MS = 2 * 60_000;
/** An unlocked card goes stale after this long (no points at risk pre-lock). */
export const SCRATCH_EXPIRY_MS = 10 * 60_000;

// ── Tier configuration ──────────────────────────────────────────────────────

interface TierConfig {
  panels: number;
  cost: number;
  /** correct-count → payout; highest matching threshold wins. */
  payouts: ReadonlyArray<{ minCorrect: number; points: number }>;
  /** Consolation refund when below the lowest payout threshold. */
  refundBelow?: { threshold: number; refund: number };
}

export const TIER_CONFIG: Record<ScratchTier, TierConfig> = {
  COMMON: {
    panels: 6,
    cost: 0,
    payouts: [
      { minCorrect: 6, points: 500 },
      { minCorrect: 5, points: 300 },
      { minCorrect: 4, points: 150 },
      { minCorrect: 3, points: 50 },
    ],
  },
  RARE: {
    panels: 9,
    cost: 100,
    payouts: [
      { minCorrect: 9, points: 2000 },
      { minCorrect: 8, points: 1000 },
      { minCorrect: 7, points: 500 },
      { minCorrect: 6, points: 200 },
      { minCorrect: 5, points: 100 },
      { minCorrect: 4, points: 50 },
    ],
    refundBelow: { threshold: 6, refund: 50 },
  },
  LEGENDARY: {
    panels: 12,
    cost: 500,
    payouts: [
      { minCorrect: 12, points: 10000 },
      { minCorrect: 11, points: 5000 },
      { minCorrect: 10, points: 2000 },
      { minCorrect: 9, points: 1000 },
      { minCorrect: 8, points: 500 },
    ],
    refundBelow: { threshold: 8, refund: 250 },
  },
};

// ── Panel catalogue ──────────────────────────────────────────────────────────

export type PanelType =
  | 'GOAL'
  | 'TWO_GOALS'
  | 'YELLOW_CARD'
  | 'TWO_YELLOWS'
  | 'RED_CARD'
  | 'ANY_CARD'
  | 'CORNER'
  | 'TWO_CORNERS'
  | 'THREE_CORNERS'
  | 'ANY_EVENT'
  | 'TWO_PLUS_EVENTS'
  | 'CALM';

interface PanelSpec {
  type: PanelType;
  icon: string;
  label: string;
  /** Baseline probability the event occurs in a 2-minute window (soccer averages). */
  baseProbability: number;
}

/**
 * Baselines from per-90 averages (~2.7 goals, ~3.8 yellows, ~0.2 reds,
 * ~10 corners) scaled to a 2-minute slice. Order = escalating tier pools.
 */
const PANEL_CATALOGUE: readonly PanelSpec[] = [
  { type: 'GOAL', icon: '⚽', label: 'GOAL?', baseProbability: 0.06 },
  { type: 'YELLOW_CARD', icon: '🟨', label: 'YELLOW CARD?', baseProbability: 0.08 },
  { type: 'CORNER', icon: '🚩', label: 'CORNER?', baseProbability: 0.2 },
  { type: 'TWO_CORNERS', icon: '🚩🚩', label: '2+ CORNERS?', baseProbability: 0.05 },
  { type: 'ANY_EVENT', icon: '⚡', label: 'ANY ACTION?', baseProbability: 0.3 },
  { type: 'CALM', icon: '😴', label: 'ALL QUIET?', baseProbability: 0.7 },
  // RARE adds ↓
  { type: 'RED_CARD', icon: '🟥', label: 'RED CARD?', baseProbability: 0.006 },
  { type: 'ANY_CARD', icon: '🃏', label: 'ANY CARD?', baseProbability: 0.085 },
  { type: 'TWO_PLUS_EVENTS', icon: '🎪', label: '2+ EVENTS?', baseProbability: 0.08 },
  // LEGENDARY adds ↓
  { type: 'TWO_GOALS', icon: '⚽⚽', label: '2+ GOALS?', baseProbability: 0.005 },
  { type: 'TWO_YELLOWS', icon: '🟨🟨', label: '2+ YELLOWS?', baseProbability: 0.01 },
  { type: 'THREE_CORNERS', icon: '🎯', label: '3+ CORNERS?', baseProbability: 0.012 },
];

const PANEL_SPEC_BY_TYPE = new Map(PANEL_CATALOGUE.map((spec) => [spec.type, spec]));

/** Window counter diffs each panel type is judged against. */
interface WindowDiffs {
  goals: number;
  yellows: number;
  reds: number;
  corners: number;
  events: number;
}

function diffCounters(start: ScoreCounters, end: ScoreCounters): WindowDiffs {
  const d = (pick: (c: ScoreCounters) => number): number => Math.max(0, pick(end) - pick(start));
  const goals = d((c) => c.participant1.goals + c.participant2.goals);
  const yellows = d((c) => c.participant1.yellowCards + c.participant2.yellowCards);
  const reds = d((c) => c.participant1.redCards + c.participant2.redCards);
  const corners = d((c) => c.participant1.corners + c.participant2.corners);
  return { goals, yellows, reds, corners, events: goals + yellows + reds + corners };
}

function panelOccurred(type: PanelType, diffs: WindowDiffs): { occurred: boolean; count: number } {
  switch (type) {
    case 'GOAL':
      return { occurred: diffs.goals >= 1, count: diffs.goals };
    case 'TWO_GOALS':
      return { occurred: diffs.goals >= 2, count: diffs.goals };
    case 'YELLOW_CARD':
      return { occurred: diffs.yellows >= 1, count: diffs.yellows };
    case 'TWO_YELLOWS':
      return { occurred: diffs.yellows >= 2, count: diffs.yellows };
    case 'RED_CARD':
      return { occurred: diffs.reds >= 1, count: diffs.reds };
    case 'ANY_CARD':
      return { occurred: diffs.yellows + diffs.reds >= 1, count: diffs.yellows + diffs.reds };
    case 'CORNER':
      return { occurred: diffs.corners >= 1, count: diffs.corners };
    case 'TWO_CORNERS':
      return { occurred: diffs.corners >= 2, count: diffs.corners };
    case 'THREE_CORNERS':
      return { occurred: diffs.corners >= 3, count: diffs.corners };
    case 'ANY_EVENT':
      return { occurred: diffs.events >= 1, count: diffs.events };
    case 'TWO_PLUS_EVENTS':
      return { occurred: diffs.events >= 2, count: diffs.events };
    case 'CALM':
      return { occurred: diffs.events === 0, count: diffs.events };
  }
}

// ── Wire DTOs ────────────────────────────────────────────────────────────────

export interface ScratchPanelDto {
  panelNumber: number;
  panelType: PanelType;
  icon: string;
  label: string;
  /** null until the panel is scratched (server-side reveal). */
  prediction: boolean | null;
  /** Commitment hash — proves the value existed before the reveal. */
  valueHash: string;
  revealed: boolean;
  isCorrect: boolean | null;
  actual: { occurred: boolean; count: number } | null;
  pointsEarned: number;
}

export interface ScratchCardDto {
  id: string;
  matchId: string; // public fixture id
  tier: ScratchTier;
  status: 'ACTIVE' | 'LOCKED' | 'RESOLVED' | 'EXPIRED';
  cost: number;
  startMinute: number | null;
  pointsWagered: number;
  pointsEarned: number;
  panels: ScratchPanelDto[];
  createdAt: string;
  lockedAt: string | null;
  /** When the 2-minute window closes and results become available. */
  resolveAt: string | null;
  expiresAt: string;
  result: {
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    pointsEarned: number;
    unlockedAchievements: string[];
  } | null;
  user?: { totalPoints: number; currentStreak: number; bestStreak: number };
}

type CardWithPanels = DbScratchCard & {
  panels: DbScratchPrediction[];
  match?: { txlineMatchId: string };
};

function predictionOf(panel: DbScratchPrediction): boolean {
  return (panel.predictedValue as { prediction: boolean }).prediction;
}

function toPanelDto(panel: DbScratchPrediction, exposeValues: boolean): ScratchPanelDto {
  const spec = PANEL_SPEC_BY_TYPE.get(panel.panelType as PanelType);
  const visible = exposeValues || panel.revealed;
  return {
    panelNumber: panel.panelNumber,
    panelType: panel.panelType as PanelType,
    icon: spec?.icon ?? '❓',
    label: spec?.label ?? panel.panelType,
    prediction: visible ? predictionOf(panel) : null,
    valueHash: panel.valueHash,
    revealed: panel.revealed,
    isCorrect: panel.isCorrect,
    actual: (panel.actualValue as { occurred: boolean; count: number } | null) ?? null,
    pointsEarned: panel.pointsEarned,
  };
}

function toDto(
  card: CardWithPanels,
  extras?: {
    result?: ScratchCardDto['result'];
    user?: ScratchCardDto['user'];
  },
): ScratchCardDto {
  const resolved = card.status === 'RESOLVED';
  return {
    id: card.id,
    matchId: card.match?.txlineMatchId ?? '',
    tier: card.tier,
    status: card.status,
    cost: TIER_CONFIG[card.tier].cost,
    startMinute: card.startMinute,
    pointsWagered: card.pointsWagered,
    pointsEarned: card.pointsEarned,
    panels: [...card.panels]
      .sort((a, b) => a.panelNumber - b.panelNumber)
      .map((panel) => toPanelDto(panel, resolved)),
    createdAt: card.createdAt.toISOString(),
    lockedAt: card.lockedAt?.toISOString() ?? null,
    resolveAt: card.resolveAt?.toISOString() ?? null,
    expiresAt: new Date(card.createdAt.getTime() + SCRATCH_EXPIRY_MS).toISOString(),
    result: extras?.result ?? null,
    ...(extras?.user ? { user: extras.user } : {}),
  };
}

function hashValue(value: { prediction: boolean }, salt: string, panelNumber: number): string {
  // panelNumber in the preimage keeps equal-valued panels from sharing a hash
  // (identical digests would leak "these panels match" before any scratch).
  return createHash('sha256')
    .update(`${JSON.stringify(value)}:${salt}:${panelNumber}`)
    .digest('hex');
}

// ── Errors ───────────────────────────────────────────────────────────────────

class InsufficientPointsError extends PulseError {
  constructor(needed: number, has: number) {
    super(
      `Not enough points for this card — it costs ${needed} and you have ${has}.`,
      'INSUFFICIENT_POINTS',
      400,
    );
    this.name = 'InsufficientPointsError';
  }
}

class ScratchConflictError extends PulseError {
  constructor() {
    super(
      'You already have a scratch card in play. Finish or resolve it first.',
      'SCRATCH_CONFLICT',
      409,
    );
    this.name = 'ScratchConflictError';
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Pulse Scratch lifecycle: generate (hidden, hash-committed) → scratch panels
 * (server-side reveals) → lock in (wager deducted, 2-min window starts) →
 * resolve against TxLINE counter diffs → payout per tier table.
 *
 * Fairness design: panel predictions are decided at creation, stored server-
 * side, and committed via SHA-256(value:salt) sent to the client BEFORE any
 * reveal — the salt is disclosed at resolution so anyone can verify nothing
 * was switched after the fact.
 */
export class ScratchService {
  async generateScratchCard(
    userId: string,
    matchId: string,
    tier: ScratchTier,
  ): Promise<ScratchCardDto> {
    const cfg = TIER_CONFIG[tier];
    const match = await matchService.getMatch(matchId);
    const isLive = match.status === 'live' || match.status === 'halftime';
    if (!isLive && !config.ALLOW_PREDICTIONS_PRELIVE) {
      throw new MatchNotLiveError(matchId);
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalPoints: true },
    });
    if (!user) throw new NotFoundError('User');
    if (user.totalPoints < cfg.cost) throw new InsufficientPointsError(cfg.cost, user.totalPoints);

    await this.expireStale(userId);
    const inPlay = await prisma.scratchCard.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'LOCKED'] } },
      select: { id: true },
    });
    if (inPlay) throw new ScratchConflictError();

    const dbMatch = await matchService.upsertMatchRecord(match);

    // Smart generation: market-implied activity scales every panel's YES rate.
    const odds = await matchService.getOddsSummary(match);
    const activity = odds.probabilityPct / 18; // 18% = model baseline
    const salt = randomBytes(16).toString('hex');
    const pool = PANEL_CATALOGUE.slice(0, cfg.panels);

    const card = await prisma.scratchCard.create({
      data: {
        userId,
        matchId: dbMatch.id,
        tier,
        revealSalt: salt,
        panels: {
          create: pool.map((spec, index) => {
            // CALM moves inversely with activity — a hot match is less likely calm.
            const p =
              spec.type === 'CALM'
                ? Math.min(0.95, Math.max(0.05, 1 - (1 - spec.baseProbability) * activity))
                : Math.min(0.95, Math.max(0.005, spec.baseProbability * activity));
            const value = { prediction: Math.random() < p };
            return {
              panelNumber: index + 1,
              panelType: spec.type,
              predictedValue: value,
              valueHash: hashValue(value, salt, index + 1),
            };
          }),
        },
      },
      include: { panels: true, match: { select: { txlineMatchId: true } } },
    });

    logger.info('scratch_card_created', { cardId: card.id, userId, matchId, tier });
    return toDto(card);
  }

  /** Server-side reveal: marks panels scratched and returns their values. */
  async revealPanels(
    userId: string,
    cardId: string,
    panelNumbers?: number[],
  ): Promise<ScratchCardDto> {
    const prisma = getPrisma();
    const card = await this.getOwnedCard(userId, cardId);
    if (card.status === 'EXPIRED') {
      throw new PulseError('This card has expired. Grab a fresh one!', 'SCRATCH_EXPIRED', 410);
    }
    await prisma.scratchPrediction.updateMany({
      where: {
        cardId,
        revealed: false,
        ...(panelNumbers ? { panelNumber: { in: panelNumbers } } : {}),
      },
      data: { revealed: true },
    });
    const fresh = await this.getOwnedCard(userId, cardId);
    return toDto(fresh);
  }

  /** Locks the card: wager is deducted and the 2-minute window starts NOW. */
  async lockIn(userId: string, cardId: string): Promise<ScratchCardDto> {
    const prisma = getPrisma();
    const card = await this.getOwnedCard(userId, cardId);
    if (card.status !== 'ACTIVE') {
      throw new PulseError('This card is already locked or finished.', 'SCRATCH_NOT_ACTIVE', 409);
    }
    if (card.createdAt.getTime() + SCRATCH_EXPIRY_MS < Date.now()) {
      await prisma.scratchCard.update({ where: { id: cardId }, data: { status: 'EXPIRED' } });
      throw new PulseError('This card has expired. Grab a fresh one!', 'SCRATCH_EXPIRED', 410);
    }

    const cost = TIER_CONFIG[card.tier].cost;
    const match = await matchService
      .getMatch(card.match?.txlineMatchId ?? '')
      .catch(() => null);
    const now = new Date();

    try {
      await prisma.$transaction(async (tx) => {
        if (cost > 0) {
          // Guarded decrement — fails (P2025) if the balance dropped below cost.
          await tx.user.update({
            where: { id: userId, totalPoints: { gte: cost } },
            data: { totalPoints: { decrement: cost } },
          });
        }
        await tx.scratchCard.update({
          where: { id: cardId, status: 'ACTIVE' }, // idempotency guard
          data: {
            status: 'LOCKED',
            pointsWagered: cost,
            lockedAt: now,
            resolveAt: new Date(now.getTime() + SCRATCH_WINDOW_MS),
            startMinute: match?.minute ?? null,
          },
        });
        // Locking implies the card is fully revealed.
        await tx.scratchPrediction.updateMany({
          where: { cardId, revealed: false },
          data: { revealed: true },
        });
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        const balance = await prisma.user.findUnique({
          where: { id: userId },
          select: { totalPoints: true },
        });
        throw new InsufficientPointsError(cost, balance?.totalPoints ?? 0);
      }
      throw err;
    }

    logger.info('scratch_card_locked', { cardId, userId, cost });
    const fresh = await this.getOwnedCard(userId, cardId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalPoints: true, currentStreak: true, bestStreak: true },
    });
    return toDto(fresh, { user: user ?? undefined });
  }

  /**
   * Idempotent resolution: TxLINE counters at window start vs end decide each
   * panel; payout from the tier table; consolation refund below threshold.
   * Called by the sweeper and on-demand from GET /api/scratch/:id.
   */
  async resolveScratchCard(cardId: string): Promise<ScratchCardDto> {
    const prisma = getPrisma();
    const card = await prisma.scratchCard.findUnique({
      where: { id: cardId },
      include: {
        panels: true,
        match: { select: { txlineMatchId: true } },
        user: { select: { id: true, totalPoints: true, currentStreak: true, bestStreak: true } },
        result: true,
      },
    });
    if (!card) throw new NotFoundError('Scratch card');

    if (card.status !== 'LOCKED' || !card.resolveAt || Date.now() < card.resolveAt.getTime()) {
      return toDto(card, {
        result: card.result
          ? {
              totalPredictions: card.result.totalPredictions,
              correctPredictions: card.result.correctPredictions,
              accuracy: card.result.accuracy,
              pointsEarned: card.result.pointsEarned,
              unlockedAchievements:
                (card.result.resolutionDetails as { unlockedAchievements?: string[] })
                  .unlockedAchievements ?? [],
            }
          : null,
        user: {
          totalPoints: card.user.totalPoints,
          currentStreak: card.user.currentStreak,
          bestStreak: card.user.bestStreak,
        },
      });
    }

    // Judge the window against TxLINE counters. Unreachable data = calm window.
    let diffs: WindowDiffs = { goals: 0, yellows: 0, reds: 0, corners: 0, events: 0 };
    try {
      const rows = await matchService.getScoreRows(Number(card.match?.txlineMatchId));
      diffs = diffCounters(
        countersAt(rows, card.lockedAt?.getTime() ?? card.resolveAt.getTime() - SCRATCH_WINDOW_MS),
        countersAt(rows, card.resolveAt.getTime()),
      );
    } catch (err) {
      logger.error('scratch_resolution_data_failed', {
        cardId,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const judged = card.panels.map((panel) => {
      const actual = panelOccurred(panel.panelType as PanelType, diffs);
      return { panel, actual, isCorrect: predictionOf(panel) === actual.occurred };
    });
    const correct = judged.filter((j) => j.isCorrect).length;
    const total = judged.length;

    const cfg = TIER_CONFIG[card.tier];
    const payout = cfg.payouts.find((p) => correct >= p.minCorrect)?.points ?? 0;
    const refund =
      payout === 0 && cfg.refundBelow && correct < cfg.refundBelow.threshold
        ? cfg.refundBelow.refund
        : 0;
    const earned = payout + refund;
    const accuracy = total > 0 ? correct / total : 0;
    const won = payout > 0;
    // Per-panel display split; card-level total remains authoritative.
    const perPanel = correct > 0 ? Math.floor(payout / correct) : 0;

    const firstScratch =
      (await prisma.scratchCard.count({ where: { userId: card.userId, status: 'RESOLVED' } })) === 0;
    const unlockedAchievements = [
      ...(firstScratch ? ['First Scratch!'] : []),
      ...(accuracy === 1 ? ['Perfect Card!'] : []),
      ...(card.tier === 'LEGENDARY' && won ? ['Legendary Scratcher!'] : []),
    ];

    try {
      await prisma.$transaction([
        prisma.scratchCard.update({
          where: { id: cardId, status: 'LOCKED' }, // racing-sweeper idempotency guard
          data: { status: 'RESOLVED', resolvedAt: new Date(), pointsEarned: earned },
        }),
        ...judged.map(({ panel, actual, isCorrect }) =>
          prisma.scratchPrediction.update({
            where: { id: panel.id },
            data: {
              revealed: true,
              actualValue: actual,
              isCorrect,
              pointsEarned: isCorrect ? perPanel : 0,
            },
          }),
        ),
        prisma.scratchResult.create({
          data: {
            cardId,
            totalPredictions: total,
            correctPredictions: correct,
            pointsEarned: earned,
            accuracy,
            resolutionDetails: {
              diffs: { ...diffs },
              payout,
              refund,
              revealSalt: card.revealSalt, // discloses the commitment salt
              unlockedAchievements,
            },
          },
        }),
        prisma.user.update({
          where: { id: card.userId },
          data: {
            ...(earned > 0 ? { totalPoints: { increment: earned } } : {}),
            // A winning card extends the streak; a losing one leaves it be
            // (same forgiving design as micro-predictions).
            ...(won
              ? {
                  currentStreak: { increment: 1 },
                  bestStreak: Math.max(card.user.bestStreak, card.user.currentStreak + 1),
                }
              : {}),
          },
        }),
      ]);
    } catch (err) {
      // P2025: another resolver won the race — serve its result.
      if ((err as { code?: string }).code === 'P2025') {
        return this.resolveScratchCard(cardId);
      }
      throw err;
    }

    try {
      await getRedis().del(CACHE_KEYS.leaderboard);
    } catch {
      // cache invalidation is best-effort
    }

    logger.info('scratch_card_resolved', { cardId, correct, total, earned, tier: card.tier });
    const dto = await this.getById(card.userId, cardId);
    emitToUser(card.userId, 'scratch-result', dto);
    if (dto.user) emitToUser(card.userId, 'user-stats-update', dto.user);
    return dto;
  }

  /** A user's card by id — resolving it first if its window has closed. */
  async getById(userId: string, cardId: string): Promise<ScratchCardDto> {
    const prisma = getPrisma();
    const card = await this.getOwnedCard(userId, cardId);
    if (card.status === 'LOCKED' && card.resolveAt && Date.now() >= card.resolveAt.getTime()) {
      return this.resolveScratchCard(cardId);
    }
    const result = await prisma.scratchResult.findUnique({ where: { cardId } });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalPoints: true, currentStreak: true, bestStreak: true },
    });
    return toDto(card, {
      result: result
        ? {
            totalPredictions: result.totalPredictions,
            correctPredictions: result.correctPredictions,
            accuracy: result.accuracy,
            pointsEarned: result.pointsEarned,
            unlockedAchievements:
              (result.resolutionDetails as { unlockedAchievements?: string[] })
                .unlockedAchievements ?? [],
          }
        : null,
      user: user ?? undefined,
    });
  }

  /** The user's card currently in play (ACTIVE or LOCKED), if any. */
  async getActive(userId: string): Promise<ScratchCardDto | null> {
    await this.expireStale(userId);
    const card = await getPrisma().scratchCard.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'LOCKED'] } },
      include: { panels: true, match: { select: { txlineMatchId: true } } },
    });
    return card ? toDto(card) : null;
  }

  async getScratchHistory(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{
    cards: Array<
      ScratchCardDto & {
        matchInfo: { homeTeam: string; awayTeam: string; homeTeamCode: string; awayTeamCode: string } | null;
      }
    >;
    total: number;
  }> {
    const prisma = getPrisma();
    const [rows, total] = await prisma.$transaction([
      prisma.scratchCard.findMany({
        where: { userId, status: 'RESOLVED' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          panels: true,
          result: true,
          match: {
            select: {
              txlineMatchId: true,
              homeTeam: true,
              awayTeam: true,
              homeTeamCode: true,
              awayTeamCode: true,
            },
          },
        },
      }),
      prisma.scratchCard.count({ where: { userId, status: 'RESOLVED' } }),
    ]);
    return {
      cards: rows.map((row) => ({
        ...toDto(row, {
          result: row.result
            ? {
                totalPredictions: row.result.totalPredictions,
                correctPredictions: row.result.correctPredictions,
                accuracy: row.result.accuracy,
                pointsEarned: row.result.pointsEarned,
                unlockedAchievements: [],
              }
            : null,
        }),
        matchInfo: row.match
          ? {
              homeTeam: row.match.homeTeam,
              awayTeam: row.match.awayTeam,
              homeTeamCode: row.match.homeTeamCode,
              awayTeamCode: row.match.awayTeamCode,
            }
          : null,
      })),
      total,
    };
  }

  /** Top scratchers ranked by average accuracy (min 1 resolved card). */
  async getScratchLeaderboard(limit = 100): Promise<
    Array<{
      rank: number;
      username: string | null;
      walletAddress: string;
      totalCards: number;
      avgAccuracy: number;
      totalPointsEarned: number;
      bestCard: number;
    }>
  > {
    const prisma = getPrisma();
    const grouped = await prisma.scratchCard.groupBy({
      by: ['userId'],
      where: { status: 'RESOLVED' },
      _count: { _all: true },
      _sum: { pointsEarned: true },
      _max: { pointsEarned: true },
    });
    if (grouped.length === 0) return [];

    const accuracies = await prisma.scratchResult.findMany({
      where: { card: { userId: { in: grouped.map((g) => g.userId) } } },
      select: { accuracy: true, card: { select: { userId: true } } },
    });
    const accByUser = new Map<string, { sum: number; n: number }>();
    for (const row of accuracies) {
      const bucket = accByUser.get(row.card.userId) ?? { sum: 0, n: 0 };
      bucket.sum += row.accuracy;
      bucket.n += 1;
      accByUser.set(row.card.userId, bucket);
    }

    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, username: true, walletAddress: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return grouped
      .map((g) => {
        const acc = accByUser.get(g.userId);
        const user = userById.get(g.userId);
        return {
          username: user?.username ?? null,
          walletAddress: user?.walletAddress ?? '',
          totalCards: g._count._all,
          avgAccuracy: acc && acc.n > 0 ? acc.sum / acc.n : 0,
          totalPointsEarned: g._sum.pointsEarned ?? 0,
          bestCard: g._max.pointsEarned ?? 0,
        };
      })
      .sort(
        (a, b) =>
          b.avgAccuracy - a.avgAccuracy ||
          b.totalPointsEarned - a.totalPointsEarned ||
          b.totalCards - a.totalCards,
      )
      .slice(0, limit)
      .map((entry, index) => ({ rank: index + 1, ...entry }));
  }

  /** Overdue LOCKED cards — consumed by the sweeper worker. */
  async findOverdue(): Promise<string[]> {
    const rows = await getPrisma().scratchCard.findMany({
      where: { status: 'LOCKED', resolveAt: { lte: new Date() } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private async getOwnedCard(userId: string, cardId: string): Promise<CardWithPanels> {
    const card = await getPrisma().scratchCard.findUnique({
      where: { id: cardId },
      include: { panels: true, match: { select: { txlineMatchId: true } } },
    });
    if (!card || card.userId !== userId) throw new NotFoundError('Scratch card');
    return card;
  }

  /** Marks the user's abandoned (never-locked) cards expired. */
  private async expireStale(userId: string): Promise<void> {
    await getPrisma().scratchCard.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
        createdAt: { lte: new Date(Date.now() - SCRATCH_EXPIRY_MS) },
      },
      data: { status: 'EXPIRED' },
    });
  }
}

export const scratchService = new ScratchService();
