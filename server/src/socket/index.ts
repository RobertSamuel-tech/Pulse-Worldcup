import { Server } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { setIo } from './emitter';
import { registerMatchHandlers } from './handlers/match.handler';
import { registerPredictionHandlers } from './handlers/prediction.handler';
import { logger } from '../utils/logger';

/**
 * Socket.io attached to Fastify's HTTP server. Rooms:
 *  - `match:{id}`  — everyone watching a match (match-event / clock-update)
 *  - `user:{id}`   — personal channel (prediction-result / user-stats-update)
 * Global emits: leaderboard-update.
 */
export function setupSocket(app: FastifyInstance): Server {
  const io = new Server(app.server, {
    cors: { origin: config.CORS_ORIGIN, credentials: true },
  });
  setIo(io);

  io.on('connection', (socket) => {
    logger.info('socket_connected', { socketId: socket.id });
    registerMatchHandlers(io, socket);
    registerPredictionHandlers(io, socket);
    socket.on('disconnect', () => logger.info('socket_disconnected', { socketId: socket.id }));
  });

  app.addHook('onClose', async () => {
    await io.close();
  });

  return io;
}
