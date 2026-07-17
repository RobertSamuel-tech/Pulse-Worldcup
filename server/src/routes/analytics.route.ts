import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { logger } from '../utils/logger';

const eventSchema = z.object({
  type: z.string().min(1).max(64),
  properties: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Minimal analytics sink: events land in structured logs for now.
 * TODO(Step: monitoring): forward to a real analytics store.
 */
export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/analytics/events', async (request) => {
    const event = eventSchema.parse(request.body);
    logger.info('analytics_event', { type: event.type, ...event.properties });
    return { success: true, data: null };
  });
}
