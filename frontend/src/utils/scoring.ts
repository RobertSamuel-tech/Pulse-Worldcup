import {
  BASE_POINTS,
  EVENT_MULTIPLIERS,
  STREAK_BONUSES,
} from '@/lib/constants';
import type { EventType } from '@/types/match';

type ScorableEvent = EventType | 'none';

/**
 * Points for a resolved prediction (mirrors server-side logic — server is authoritative).
 * Wrong prediction = 0 points.
 */
export function calculatePoints(
  predictedAction: boolean,
  eventOccurred: boolean,
  eventType: ScorableEvent,
  currentStreak: number,
): number {
  if (predictedAction !== eventOccurred) return 0;
  const multiplier = EVENT_MULTIPLIERS[eventType] ?? 1.0;
  return Math.floor(BASE_POINTS * multiplier) + getStreakBonus(currentStreak);
}

export function getStreakBonus(currentStreak: number): number {
  for (const { minStreak, bonus } of STREAK_BONUSES) {
    if (currentStreak >= minStreak) return bonus;
  }
  return 0;
}
