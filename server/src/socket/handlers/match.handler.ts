import type { Server, Socket } from 'socket.io';

/**
 * Match room lifecycle. The TxLINE SSE bridge broadcasts `match-event` and
 * `clock-update` into `match:{id}` rooms (see ../txline-bridge.ts).
 */
export function registerMatchHandlers(io: Server, socket: Socket): void {
  void io;

  socket.on('join-match', (matchId: unknown) => {
    if (typeof matchId === 'string' && /^\d+$/.test(matchId)) {
      void socket.join(`match:${matchId}`);
    }
  });

  socket.on('leave-match', (matchId: unknown) => {
    if (typeof matchId === 'string') {
      void socket.leave(`match:${matchId}`);
    }
  });
}
