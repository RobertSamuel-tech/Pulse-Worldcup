'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/useUIStore';

/**
 * Watches browser connectivity and shows the offline banner (SECTION 10).
 * The app keeps rendering last-known data underneath (cache-first).
 */
export function OfflineBanner() {
  const connectionState = useUIStore((s) => s.connectionState);
  const setConnectionState = useUIStore((s) => s.setConnectionState);

  useEffect(() => {
    const onOnline = (): void => setConnectionState('connected');
    const onOffline = (): void => setConnectionState('offline');
    if (typeof navigator !== 'undefined' && !navigator.onLine) setConnectionState('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [setConnectionState]);

  if (connectionState !== 'offline') return null;
  return (
    <div
      role="status"
      className="border-b-4 border-black bg-amber-300 px-4 py-2 text-center text-sm font-black"
    >
      You&apos;re offline. Showing last known data.
    </div>
  );
}
