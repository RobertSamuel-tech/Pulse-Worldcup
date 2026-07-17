'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Achievement } from '@/lib/profile-api';

const RARITY_STYLES: Record<Achievement['rarity'], { border: string; bg: string; label: string }> =
  {
    common: { border: 'border-slate-500', bg: 'bg-slate-200', label: 'Common' },
    uncommon: { border: 'border-emerald-600', bg: 'bg-emerald-200', label: 'Uncommon' },
    rare: { border: 'border-sky-600', bg: 'bg-sky-200', label: 'Rare' },
    epic: { border: 'border-purple-600', bg: 'bg-purple-200', label: 'Epic' },
    legendary: { border: 'border-amber-500', bg: 'bg-amber-200', label: 'Legendary' },
  };

const BADGE_ICONS: Record<string, string> = {
  first_prediction: '🎯',
  streak_3: '🎩',
  streak_5: '🔥',
  streak_10: '🔮',
  goal_whisperer: '⚽',
  card_master: '🟨',
  perfect_game: '💯',
  century_club: '🏆',
};

export function AchievementBadgesGrid({ achievements }: { achievements: Achievement[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-black uppercase tracking-wide">
        Achievements ({achievements.filter((a) => a.earned).length}/{achievements.length})
      </h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {achievements.map((badge, i) => {
          const rarity = RARITY_STYLES[badge.rarity];
          return (
            <motion.li
              key={badge.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06, duration: 0.25 }}
              title={`${badge.description}${badge.earned ? '' : ' (locked)'}`}
              className={cn(
                'group relative flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center',
                badge.earned
                  ? `${rarity.border} ${rarity.bg} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
                  : 'border-black/30 bg-white/40 opacity-60 grayscale',
              )}
            >
              <span className="text-2xl" aria-hidden>
                {badge.earned ? (BADGE_ICONS[badge.id] ?? '🏅') : '🔒'}
              </span>
              <span className="text-xs font-black">{badge.earned ? badge.name : '???'}</span>
              <span className="text-[10px] font-bold uppercase text-black/50">{rarity.label}</span>
              {/* Hover reveal: earn criteria */}
              <span className="pointer-events-none absolute inset-x-1 -bottom-1 translate-y-full rounded-lg border-2 border-black bg-black px-2 py-1 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 z-10">
                {badge.description}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
