import type { FastifyInstance } from 'fastify';
import { logger } from './logger';

/** p99 target from SECTION 11 — anything slower gets a dedicated warn log. */
const SLOW_REQUEST_THRESHOLD_MS = 200;

/**
 * Logs every request's duration (Fastify's built-in `reply.elapsedTime`) and
 * flags slow ones for investigation — the basis for tracking p50/p99 in prod.
 */
export function registerTimingMiddleware(app: FastifyInstance): void {
  app.addHook('onResponse', async (request, reply) => {
    const durationMs = Math.round(reply.elapsedTime * 100) / 100;
    logger.info('api_request', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs,
    });
    if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn('api_slow_request', {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs,
      });
    }
  });
}
