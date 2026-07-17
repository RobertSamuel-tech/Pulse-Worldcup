'use client';

import { motion } from 'framer-motion';
import { RankBadge } from './RankBadge';
import { formatPoints, formatAccuracy } from '@/utils/formatting';
import { cn, shortenAddress } from '@/lib/utils';
import type { LeaderboardEntryVm } from '@/hooks/useLeaderboard';

interface LeaderboardTableProps {
  entries: LeaderboardEntryVm[];
}

function Movement({ movement }: { movement: LeaderboardEntryVm['movement'] }) {
  if (!movement) return null;
  return (
    <motion.span
      initial={{ opacity: 0, y: movement === 'up' ? 6 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('ml-1 text-xs font-bold', movement === 'up' ? 'text-emerald-600' : 'text-red-600')}
      aria-label={movement === 'up' ? 'moved up' : 'moved down'}
    >
      {movement === 'up' ? '▲' : '▼'}
    </motion.span>
  );
}

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border-2 border-dashed border-black bg-white/50 p-4 text-center text-sm font-bold">
        No players yet — make a prediction to claim the top spot!
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border-4 border-black bg-white/60 backdrop-blur-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-black text-xs font-black uppercase">
            <th className="px-3 py-2">#</th>
            <th>Player</th>
            <th className="text-right">Points</th>
            <th className="text-right">Acc.</th>
            <th className="pr-3 text-right">🔥 Best</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <motion.tr
              key={entry.userId}
              layout
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={cn(
                'border-t-2 border-black/10',
                entry.isCurrentUser && 'bg-indigo-400/30 font-bold',
              )}
            >
              <td className="whitespace-nowrap px-3 py-2.5">
                <RankBadge rank={entry.rank} />
                <Movement movement={entry.movement} />
              </td>
              <td className="font-medium">
                {entry.username || shortenAddress(entry.walletAddress)}
                {entry.isCurrentUser && (
                  <span className="ml-1 text-xs font-bold text-indigo-700">(you)</span>
                )}
              </td>
              <td className="text-right font-mono font-bold">{formatPoints(entry.points)}</td>
              <td className="text-right font-mono text-black/60">
                {formatAccuracy(entry.accuracy)}
              </td>
              <td className="pr-3 text-right font-mono text-black/60">{entry.bestStreak}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
