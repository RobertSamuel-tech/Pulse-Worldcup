'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { formatPoints } from '@/utils/formatting';
import type { ProfileBundle } from '@/lib/profile-api';

/** Animated count-up (0 → value, 800ms ease-out cubic). */
function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / 800);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

function accuracyColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-300';
  if (pct >= 60) return 'bg-amber-300';
  return 'bg-red-300';
}

interface StatCardProps {
  label: string;
  display: string;
  accent?: string;
  index: number;
  flame?: boolean;
}

function StatCard({ label, display, accent = 'bg-white/70', index, flame = false }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className={`flex flex-col items-center gap-1 rounded-xl border-2 border-black ${accent} px-3 py-3 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}
    >
      <span className="text-[11px] font-bold uppercase tracking-wide text-black/60">{label}</span>
      <span className="flex items-center gap-1 font-mono text-2xl font-black">
        {display}
        {flame && (
          <motion.span
            aria-hidden
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            🔥
          </motion.span>
        )}
      </span>
    </motion.div>
  );
}

export function StatisticsOverview({ stats }: { stats: ProfileBundle['stats'] }) {
  const predictions = useCountUp(stats.totalPredictions);
  const accuracy = useCountUp(Math.round(stats.accuracy));
  const streak = useCountUp(stats.currentStreak);
  const points = useCountUp(stats.totalPoints);
  const rank = useCountUp(stats.rank);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard index={0} label="Predictions" display={String(predictions)} />
      <StatCard
        index={1}
        label="Accuracy"
        display={`${accuracy}%`}
        accent={accuracyColor(stats.accuracy)}
      />
      <StatCard
        index={2}
        label="Streak"
        display={String(streak)}
        flame={stats.currentStreak > 5}
        accent={stats.currentStreak > 5 ? 'bg-amber-300' : 'bg-white/70'}
      />
      <StatCard index={3} label="Points" display={formatPoints(points)} />
      <StatCard index={4} label="Global Rank" display={`#${rank.toLocaleString('en-US')}`} />
    </div>
  );
}
