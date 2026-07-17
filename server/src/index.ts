import * as Sentry from '@sentry/node';
import { buildApp } from './app';
import { config } from './config';

if (config.SENTRY_DSN) {
  Sentry.init({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV });
}
import { disconnectDatabase } from './config/database';
import { disconnectRedis } from './config/redis';
import { logger } from './utils/logger';
import { startPredictionWorker } from './workers/prediction.worker';
import { startLeaderboardWorker } from './workers/leaderboard.worker';
import { startTxLineBridge, stopTxLineBridge } from './socket/txline-bridge';

async function main(): Promise<void> {
  const app = await buildApp();

  startPredictionWorker();
  startLeaderboardWorker();

  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  startTxLineBridge();
  logger.info('server_started', { port: config.PORT, env: config.NODE_ENV });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('server_shutting_down', { signal });
    stopTxLineBridge();
    await app.close();
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.error('server_start_failed', {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
