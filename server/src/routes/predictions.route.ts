import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createPredictionSchema } from '../utils/validators';
import { requireAuth } from '../utils/auth';
import { predictionService } from '../services/prediction.service';

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const predictionIdParams = z.object({
  id: z
    .string()
    .min(20)
    .max(30)
    .regex(/^[a-z0-9]+$/, 'Invalid prediction id'),
});

/** Prediction lifecycle. All routes require a session token. */
export async function predictionsRoutes(app: FastifyInstance): Promise<void> {
  // The one-active-prediction rule is the real throttle (1 per 60s window);
  // this rate limit just blocks abuse of the rejection path.
  app.post(
    '/api/predictions',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const { userId } = requireAuth(request);
      const body = createPredictionSchema.parse(request.body);
      const prediction = await predictionService.createPrediction(
        userId,
        body.matchId,
        body.predictedAction,
      );
      return { success: true, data: { prediction, message: 'Prediction active!' } };
    },
  );

  /** The caller's active (unresolved) prediction, if any. */
  app.get('/api/predictions/active', async (request) => {
    const { userId } = requireAuth(request);
    const prediction = await predictionService.getActive(userId);
    return { success: true, data: prediction };
  });

  app.get('/api/predictions/my-history', async (request) => {
    const { userId } = requireAuth(request);
    const { limit, offset } = historyQuerySchema.parse(request.query);
    const history = await predictionService.getHistory(userId, limit, offset);
    return { success: true, data: history };
  });

  /** Poll target after the window ends — resolves on-demand when overdue. */
  app.get('/api/predictions/:id', async (request) => {
    const { userId } = requireAuth(request);
    const { id } = predictionIdParams.parse(request.params);
    const prediction = await predictionService.getById(userId, id);
    return { success: true, data: prediction };
  });
}
