import type { Server } from 'socket.io';

/**
 * Process-wide Socket.io handle so services can push events without importing
 * the Fastify app (avoids circular deps). No-ops until the server attaches it.
 */
let io: Server | null = null;

export function setIo(server: Server): void {
  io = server;
}

export function getIo(): Server | null {
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToMatch(matchId: string, event: string, payload: unknown): void {
  io?.to(`match:${matchId}`).emit(event, payload);
}

export function emitGlobal(event: string, payload: unknown): void {
  io?.emit(event, payload);
}
