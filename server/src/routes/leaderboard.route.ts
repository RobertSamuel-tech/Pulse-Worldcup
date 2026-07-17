import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../utils/auth';
import { leaderboardService } from '../services/leaderboard.service';

const querySchema = z.object({
  scope: z.enum(['global', 'friends']).default('global'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  /** Rankings + the caller's own rank in one call (myRank null when signed out). */
  app.get(
    '/api/leaderboard',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request) => {
      const { limit, offset } = querySchema.parse(request.query);
      const leaderboard = await leaderboardService.getGlobal(limit, offset);

      let myRank: number | null = null;
      let myEntry = null;
      try {
        const { userId } = requireAuth(request);
        myEntry = await leaderboardService.getPersonalRank(userId);
        myRank = myEntry?.rank ?? null;
      } catch {
        // anonymous caller — rankings only
      }

      return { success: true, data: { leaderboard, myRank, myEntry } };
    },
  );

  /** Kept for direct use; /api/leaderboard already embeds this. */
  app.get('/api/leaderboard/me', async (request) => {
    const { userId } = requireAuth(request);
    const entry = await leaderboardService.getPersonalRank(userId);
    return { success: true, data: entry };
  });
}
