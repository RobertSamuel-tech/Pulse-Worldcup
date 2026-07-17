'use client';

import { useEffect } from 'react';
import { useMatchStore } from '@/stores/useMatchStore';
import { useUIStore } from '@/stores/useUIStore';

/**
 * Subscribes to the backend Socket.io room for a match: events, clock ticks,
 * stat updates, and prediction resolutions. Auto-reconnects with backoff.
 * TODO(Step: real-time integration): implement socket.io-client connection.
 */
export function useMatchStream(matchId: string | null) {
  const setConnectionState = useUIStore((s) => s.setConnectionState);
  const addEvent = useMatchStore((s) => s.addEvent);
  const updateClock = useMatchStore((s) => s.updateClock);

  useEffect(() => {
    if (!matchId) return;
    // TODO: connect socket, join room `match:${matchId}`, wire handlers:
    //   'event' -> addEvent, 'clock_update' -> updateClock,
    //   'resolution' -> useMatchStore.setResolution,
    //   connect/disconnect -> setConnectionState
    void addEvent;
    void updateClock;
    setConnectionState('connected');
    return () => {
      // TODO: leave room + disconnect
    };
  }, [matchId, addEvent, updateClock, setConnectionState]);
}
