import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { matchService } from '../services/match.service';

const matchIdParams = z.object({ id: z.string().regex(/^\d+$/, 'Invalid match id') });

/**
 * Match data proxy (TxLINE tokens never leave the server). List is cached 55s,
 * detail (match + events + odds in one round trip) 30s.
 */
export async function matchesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/matches',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async () => {
      const matches = await matchService.getMatches();
      return { success: true, data: { matches } };
    },
  );

  app.get(
    '/api/matches/:id',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request) => {
      const { id } = matchIdParams.parse(request.params);
      const detail = await matchService.getMatchDetail(id);
      return { success: true, data: detail };
    },
  );

  /** Kept for direct polling; the detail endpoint already embeds this. */
  app.get(
    '/api/matches/:id/odds',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request) => {
      const { id } = matchIdParams.parse(request.params);
      const match = await matchService.getMatch(id);
      const odds = await matchService.getOddsSummary(match);
      return { success: true, data: odds };
    },
  );
}
