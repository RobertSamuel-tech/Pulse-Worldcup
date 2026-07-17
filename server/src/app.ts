import * as Sentry from '@sentry/node';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
import { config } from './config';
import { PulseError } from './utils/errors';
import { logger } from './utils/logger';
import { healthRoutes } from './routes/health.route';
import { authRoutes } from './routes/auth.route';
import { matchesRoutes } from './routes/matches.route';
import { predictionsRoutes } from './routes/predictions.route';
import { leaderboardRoutes } from './routes/leaderboard.route';
import { txlineRoutes } from './routes/txline.route';
import { analyticsRoutes } from './routes/analytics.route';
import { userRoutes } from './routes/user.route';
import { demoRoutes } from './routes/demo.route';
import { scratchRoutes } from './routes/scratch.route';
import { registerTimingMiddleware } from './utils/timing';
import { setupSocket } from './socket';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // structured logging via utils/logger
    genReqId: () => randomUUID(),
    bodyLimit: 1024 * 1024, // 1MB max request body (SECTION 12)
  });

  registerTimingMiddleware(app);

  await app.register(helmet, {
    // API-only server: no HTML is served, so a default CSP would just add
    // noise to every response without protecting anything real.
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Global safety net; hot routes declare stricter per-route limits (see SECTION 7).
  // `ban: 1` means a client that keeps hammering past the 120/min limit gets a
  // hard 403 instead of a 429 on their very next request — @fastify/rate-limit
  // ties ban duration to its own store window (1min here), not a separately
  // configurable duration, so this approximates rather than exactly matches
  // "100/min sustained = 5min ban."
  await app.register(rateLimit, {
    global: true,
    max: 120,
    ban: 1,
    timeWindow: '1 minute',
  });

  // Unified error format (see CODE_STANDARDS.md) — never leak stack traces.
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;
    if (error instanceof PulseError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message, requestId },
      });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request data.', requestId },
      });
    }
    if ((error as { statusCode?: number }).statusCode === 429) {
      reply.header('retry-after', (error as { retryAfter?: number }).retryAfter ?? 60);
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Slow down! Take a breath.', requestId },
      });
    }
    // Fastify-native 4xx (oversized body, malformed JSON, bad content-type) —
    // these are client mistakes, not server failures; don't 500 or alert Sentry.
    const nativeStatus = (error as { statusCode?: number }).statusCode;
    if (nativeStatus !== undefined && nativeStatus >= 400 && nativeStatus < 500) {
      const code = nativeStatus === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
      const message =
        nativeStatus === 413
          ? 'Request body is too large.'
          : 'Invalid request. Please check your input and try again.';
      return reply.status(nativeStatus).send({ success: false, error: { code, message, requestId } });
    }
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('unhandled_error', { requestId, message: err.message, stack: err.stack });
    Sentry.captureException(err, {
      tags: { requestId },
      extra: { url: request.url, method: request.method },
    });
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
        requestId,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: request.id },
    });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(matchesRoutes);
  await app.register(predictionsRoutes);
  await app.register(leaderboardRoutes);
  await app.register(txlineRoutes);
  await app.register(analyticsRoutes);
  await app.register(userRoutes);
  await app.register(demoRoutes);
  await app.register(scratchRoutes);

  setupSocket(app);

  return app;
}
