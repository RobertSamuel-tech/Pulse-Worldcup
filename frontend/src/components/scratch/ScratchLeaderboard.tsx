'use client';

import { useEffect, useState } from 'react';
import { getScratchLeaderboard, type ScratchLeaderboardEntry } from '@/lib/scratch-api';
import { cn } from '@/lib/utils';

function shortWallet(address: string): string {
  return address.length > 8 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

const MEDALS = ['🥇', '🥈', '🥉'];

/** Accuracy-ranked top scratchers — separate from the points leaderboard. */
export function ScratchLeaderboard() {
  const [entries, setEntries] = useState<ScratchLeaderboardEntry[] | null>(null);

  useEffect(() => {
    getScratchLeaderboard(10)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  if (entries === null) {
    return <div className="h-32 w-full animate-pulse rounded-xl border-4 border-black/20 bg-white/50" />;
  }
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border-4 border-dashed border-black bg-white/50 px-4 py-6 text-center text-sm font-bold text-black/60">
        No scratchers on the board yet — your card could be first! 🎴
      </div>
    );
  }

  return (
    <section aria-labelledby="scratch-leaderboard-title">
      <h2 id="scratch-leaderboard-title" className="mb-2 text-sm font-black uppercase tracking-tight">
        🏆 Top scratchers
      </h2>
      <div className="overflow-hidden rounded-xl border-4 border-black bg-white/60 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] backdrop-blur-md">
        {entries.map((entry, index) => (
          <div
            key={entry.walletAddress}
            className={cn(
              'flex items-center gap-3 px-3 py-2 text-sm font-bold',
              index > 0 && 'border-t-2 border-black/20',
              index < 3 && 'bg-amber-200/50',
            )}
          >
            <span className="w-7 text-center font-mono font-black">
              {MEDALS[index] ?? entry.rank}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {entry.username ?? shortWallet(entry.walletAddress)}
            </span>
            <span className="font-mono text-xs text-black/60">{entry.totalCards} cards</span>
            <span className="rounded-full border-2 border-black bg-emerald-300 px-2 py-0.5 font-mono text-xs font-black">
              {Math.round(entry.avgAccuracy * 100)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
