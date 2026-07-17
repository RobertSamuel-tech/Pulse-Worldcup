import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { demoService } from '../services/demo.service';

const demoIdParams = z.object({ id: z.string().min(1).max(64) });

/**
 * Replay/Demo mode endpoints — recorded scenarios, clearly separated from
 * live TxLINE data (COMPLIANCE: /api/matches stays TxLINE-only).
 */
export async function demoRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/demo/matches',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async () => {
      const matches = await demoService.getDemoMatches();
      return { success: true, data: { matches } };
    },
  );

  app.get(
    '/api/demo/matches/:id',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request) => {
      const { id } = demoIdParams.parse(request.params);
      const detail = await demoService.getDemoMatch(id);
      return { success: true, data: detail };
    },
  );

  /**
   * Regenerate scenarios via OpenRouter. Guarded: open in development;
   * in production requires x-admin-key matching ADMIN_SEED_KEY.
   */
  app.post(
    '/api/admin/seed-demo-data',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      if (config.isProduction) {
        const key = request.headers['x-admin-key'];
        if (!config.ADMIN_SEED_KEY || key !== config.ADMIN_SEED_KEY) {
          return reply.code(403).send({ success: false, error: 'Forbidden' });
        }
      }
      const result = await demoService.seedFromOpenRouter();
      return { success: true, data: result };
    },
  );
}
