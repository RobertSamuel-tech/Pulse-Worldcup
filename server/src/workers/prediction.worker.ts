import { predictionService } from '../services/prediction.service';
import { scratchService } from '../services/scratch.service';
import { logger } from '../utils/logger';

const SWEEP_INTERVAL_MS = 3_000;

let sweeping = false;

/**
 * Resolution sweeper: every 3s, resolves predictions whose 60s window expired.
 * DB is the source of truth so this is crash-safe and needs no queue infra —
 * chosen over Bull to keep Upstash command volume low. GET /api/predictions/:id
 * also resolves on-demand, so the UI never waits on the sweeper.
 */
export function startPredictionWorker(): void {
  setInterval(() => {
    if (sweeping) return;
    sweeping = true;
    void (async () => {
      try {
        const overdue = await predictionService.findOverdue();
        for (const id of overdue) {
          await predictionService.resolvePrediction(id).catch((err: unknown) => {
            logger.error('prediction_sweep_resolve_failed', {
              predictionId: id,
              message: err instanceof Error ? err.message : String(err),
            });
          });
        }
        // Scratch cards share the sweeper — same crash-safe DB-poll design.
        const overdueCards = await scratchService.findOverdue();
        for (const id of overdueCards) {
          await scratchService.resolveScratchCard(id).catch((err: unknown) => {
            logger.error('scratch_sweep_resolve_failed', {
              cardId: id,
              message: err instanceof Error ? err.message : String(err),
            });
          });
        }
      } catch (err) {
        logger.warn('prediction_sweep_failed', {
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        sweeping = false;
      }
    })();
  }, SWEEP_INTERVAL_MS).unref();
  logger.info('prediction_worker_started', { sweepIntervalMs: SWEEP_INTERVAL_MS });
}
