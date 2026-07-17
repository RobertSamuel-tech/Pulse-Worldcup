import type { Server, Socket } from 'socket.io';
import { verifySession } from '../../utils/auth';
import { logger } from '../../utils/logger';

/**
 * Personal channel: client sends its session JWT once ('authenticate'), we
 * verify and join `user:{id}` — then prediction-result / user-stats-update
 * events are pushed there by the prediction service.
 */
export function registerPredictionHandlers(io: Server, socket: Socket): void {
  void io;

  socket.on('authenticate', (token: unknown) => {
    if (typeof token !== 'string') return;
    try {
      const { userId } = verifySession(token);
      void socket.join(`user:${userId}`);
      socket.emit('authenticated', { ok: true });
    } catch {
      logger.warn('socket_auth_failed', { socketId: socket.id });
      socket.emit('authenticated', { ok: false });
    }
  });
}
