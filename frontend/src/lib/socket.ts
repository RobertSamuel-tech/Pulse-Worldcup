'use client';

import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './constants';
import { getSession } from './auth-api';

/**
 * Singleton Socket.io connection. Authenticates the personal channel with the
 * session JWT on (re)connect so prediction results arrive as pushes.
 */
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      const token = getSession();
      if (token) socket?.emit('authenticate', token);
    });
  }
  return socket;
}

export function joinMatch(matchId: string): void {
  getSocket().emit('join-match', matchId);
}

export function leaveMatch(matchId: string): void {
  getSocket().emit('leave-match', matchId);
}
