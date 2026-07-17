'use client';

import { useUIStore, type ConnectionState } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';

const LABELS: Record<ConnectionState, string> = {
  connected: 'Live',
  reconnecting: 'Reconnecting…',
  offline: 'Offline (cached data)',
};

const DOT_CLASSES: Record<ConnectionState, string> = {
  connected: 'bg-emerald-500',
  reconnecting: 'bg-amber-500 animate-pulse',
  offline: 'bg-red-500',
};

/** Always-visible connection health indicator (trust signal for judges). */
export function ConnectionStatus() {
  const state = useUIStore((s) => s.connectionState);
  return (
    <div
      className="flex items-center gap-2 rounded-full border-2 border-black bg-white/60 px-3 py-1 text-xs font-bold"
      role="status"
    >
      <span className={cn('h-2 w-2 rounded-full border border-black', DOT_CLASSES[state])} aria-hidden />
      {LABELS[state]}
    </div>
  );
}
