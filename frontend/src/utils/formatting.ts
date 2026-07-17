import { format } from 'date-fns';
import type { MatchClock } from '@/types/match';

/** "67'" or "45+2'" style match minute display. */
export function formatMatchMinute(clock: MatchClock): string {
  if (clock.period === 'HT') return 'HT';
  if (clock.period === 'FT') return 'FT';
  if (clock.addedTime > 0) return `${clock.minute}+${clock.addedTime}'`;
  return `${clock.minute}'`;
}

/** Kickoff time in the user's local timezone, e.g. "Sat 20:00". */
export function formatKickoff(date: Date): string {
  return format(date, 'EEE HH:mm');
}

/** "1,240" style points display. */
export function formatPoints(points: number): string {
  return points.toLocaleString('en-US');
}

/** "85%" accuracy display. */
export function formatAccuracy(accuracy: number): string {
  return `${Math.round(accuracy)}%`;
}
