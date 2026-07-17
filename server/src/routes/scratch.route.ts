import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../utils/auth';
import { scratchService } from '../services/scratch.service';

const createBodySchema = z.object({
  matchId: z.string().min(1).max(30),
  tier: z.enum(['common', 'rare', 'legendary']),
});

const cardIdSchema = z
  .string()
  .min(20)
  .max(30)
  .regex(/^[a-z0-9]+$/, 'Invalid card id');

const revealBodySchema = z.object({
  cardId: cardIdSchema,
  /** Omit to reveal the whole card (SPACE auto-scratch accessibility path). */
  panelNumbers: z.array(z.number().int().min(1).max(12)).max(12).optional(),
});

const lockInBodySchema = z.object({ cardId: cardIdSchema });

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

const TIER_MAP = { common: 'COMMON', rare: 'RARE', legendary: 'LEGENDARY' } as const;

/** Pulse Scratch: scratch-card lifecycle. */
export async function scratchRoutes(app: FastifyInstance): Promise<void> {
  // One card in play at a time is the real throttle; this blocks abuse of the
  // rejection path (same posture as /api/predictions).
  app.post(
    '/api/scratch/create',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const { userId } = requireAuth(request);
      const body = createBodySchema.parse(request.body);
      const card = await scratchService.generateScratchCard(
        userId,
        body.matchId,
        TIER_MAP[body.tier],
      );
      return {
        success: true,
        data: {
          card,
          message: 'Scratch carefully! Lock in when every panel is revealed.',
        },
      };
    },
  );

  /** Server-side panel reveal — values stay hidden until scratched. */
  app.post(
    '/api/scratch/reveal',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request) => {
      const { userId } = requireAuth(request);
      const body = revealBodySchema.parse(request.body);
      const card = await scratchService.revealPanels(userId, body.cardId, body.panelNumbers);
      return { success: true, data: { card } };
    },
  );

  /** Deducts the wager (rare/legendary) and starts the 2-minute window. */
  app.post(
    '/api/scratch/lock-in',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const { userId } = requireAuth(request);
      const body = lockInBodySchema.parse(request.body);
      const card = await scratchService.lockIn(userId, body.cardId);
      return {
        success: true,
        data: {
          card,
          resolveAt: card.resolveAt,
          message: 'Card locked! Good luck watching the match!',
          timerStarted: true,
        },
      };
    },
  );

  /** The caller's card currently in play, if any (page-refresh recovery). */
  app.get('/api/scratch/active', async (request) => {
    const { userId } = requireAuth(request);
    const card = await scratchService.getActive(userId);
    return { success: true, data: card };
  });

  app.get('/api/scratch/history', async (request) => {
    const { userId } = requireAuth(request);
    const { limit, offset } = historyQuerySchema.parse(request.query);
    const history = await scratchService.getScratchHistory(userId, limit, offset);
    return { success: true, data: history };
  });

  /** Public — accuracy-ranked, separate from the points leaderboard. */
  app.get('/api/scratch/leaderboard', async (request) => {
    const { limit } = leaderboardQuerySchema.parse(request.query);
    const leaderboard = await scratchService.getScratchLeaderboard(limit);
    return { success: true, data: { leaderboard } };
  });

  /** Poll target after lock-in — resolves on-demand when the window closes. */
  app.get('/api/scratch/:id', async (request) => {
    const { userId } = requireAuth(request);
    const { id } = z.object({ id: cardIdSchema }).parse(request.params);
    const card = await scratchService.getById(userId, id);
    return { success: true, data: card };
  });
}
