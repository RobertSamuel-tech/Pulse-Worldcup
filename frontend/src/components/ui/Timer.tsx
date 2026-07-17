'use client';

import { motion } from 'framer-motion';
import { PREDICTION_WINDOW_SECONDS } from '@/lib/constants';

interface TimerProps {
  /** Seconds remaining in the prediction window (fractional for smoothness). */
  secondsRemaining: number;
  totalSeconds?: number;
}

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * 60-second circular countdown. Smooth stroke animation, color shifts
 * green (40s+) → amber (20–40s) → red (<20s), pulses when under 10s.
 */
export function Timer({ secondsRemaining, totalSeconds = PREDICTION_WINDOW_SECONDS }: TimerProps) {
  const fraction = Math.max(0, Math.min(1, secondsRemaining / totalSeconds));
  const color =
    secondsRemaining > totalSeconds * (2 / 3)
      ? '#10B981'
      : secondsRemaining > totalSeconds / 3
        ? '#F59E0B'
        : '#EF4444';
  // Urgency tiers (SECTION 9): calm → subtle pulse → fast pulse + scale → rapid pulse + glow
  const tier =
    secondsRemaining > 40 ? 0 : secondsRemaining > 20 ? 1 : secondsRemaining > 10 ? 2 : 3;
  const pulse = [
    { animate: { scale: 1 }, transition: { duration: 0.2 } },
    { animate: { scale: [1, 1.02, 1] }, transition: { duration: 1.2, repeat: Infinity } },
    { animate: { scale: [1, 1.05, 1] }, transition: { duration: 0.7, repeat: Infinity } },
    { animate: { scale: [1, 1.08, 1] }, transition: { duration: 0.4, repeat: Infinity } },
  ][tier]!;

  return (
    <motion.div
      className="relative h-28 w-28"
      role="timer"
      aria-label={`${Math.ceil(secondsRemaining)} seconds remaining`}
      animate={pulse.animate}
      transition={pulse.transition}
      style={tier === 3 ? { filter: 'drop-shadow(0 0 14px rgba(239, 68, 68, 0.7))' } : undefined}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 100ms linear, stroke 300ms ease' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono text-3xl font-bold"
        style={{ color }}
      >
        {Math.ceil(secondsRemaining)}
      </span>
    </motion.div>
  );
}
