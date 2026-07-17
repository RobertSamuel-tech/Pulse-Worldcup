'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface ConfettiEffectProps {
  isActive: boolean;
}

const COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#FCD34D', '#818CF8'];
const PARTICLE_COUNT = 54;

interface Particle {
  x: number;
  y: number;
  rotate: number;
  color: string;
  delay: number;
}

/** Celebration burst on correct predictions. Respects prefers-reduced-motion. */
export function ConfettiEffect({ isActive }: ConfettiEffectProps) {
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 120 + Math.random() * 160;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 80,
          rotate: Math.random() * 720 - 360,
          color: COLORS[i % COLORS.length] as string,
          delay: Math.random() * 0.15,
        };
      }),
    // regenerate a fresh burst each activation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isActive],
  );

  if (!isActive) return null;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
    >
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: p.x, y: p.y + 200, opacity: 0, rotate: p.rotate, scale: 0.6 }}
          transition={{ duration: 1.2, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
