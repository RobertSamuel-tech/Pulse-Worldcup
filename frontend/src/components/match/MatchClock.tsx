'use client';

import { formatMatchMinute } from '@/utils/formatting';
import type { MatchClock as MatchClockType } from '@/types/match';

interface MatchClockProps {
  clock: MatchClockType | null;
}

/**
 * Synchronized match clock.
 * TODO(Step: real-time integration): interpolate between server ticks with
 * requestAnimationFrame; freeze if no update for >3s (see realtime-data skill).
 */
export function MatchClock({ clock }: MatchClockProps) {
  if (!clock) return <span className="font-mono text-black/40">--:--</span>;
  return (
    <span
      className="rounded-lg border-2 border-black bg-amber-300 px-2 py-0.5 font-mono text-xl font-black"
      aria-live="polite"
    >
      {formatMatchMinute(clock)}
    </span>
  );
}
