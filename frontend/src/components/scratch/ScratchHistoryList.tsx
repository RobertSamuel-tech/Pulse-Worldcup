'use client';

import { useEffect, useState } from 'react';
import { getScratchHistory, type ScratchHistoryEntry } from '@/lib/scratch-api';
import { cn } from '@/lib/utils';

const TIER_CHIP: Record<string, string> = {
  COMMON: 'bg-slate-300',
  RARE: 'bg-amber-300',
  LEGENDARY: 'bg-fuchsia-300',
};

/** Resolved scratch cards, newest first — shown on the profile page. */
export function ScratchHistoryList() {
  const [entries, setEntries] = useState<ScratchHistoryEntry[] | null>(null);

  useEffect(() => {
    getScratchHistory(10)
      .then(({ cards }) => setEntries(cards))
      .catch(() => setEntries([]));
  }, []);

  if (entries === null) {
    return <div className="h-24 w-full animate-pulse rounded-xl border-4 border-black/20 bg-white/50" />;
  }

  return (
    <section aria-labelledby="scratch-history-title">
      <h2 id="scratch-history-title" className="mb-2 text-lg font-black uppercase tracking-tight">
        🎴 Scratch history
      </h2>
      {entries.length === 0 ? (
        <div className="rounded-xl border-4 border-dashed border-black bg-white/50 px-4 py-6 text-center text-sm font-bold text-black/60">
          No scratch cards yet — try your intuition on the Scratch tab!
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 rounded-xl border-2 border-black bg-white/60 px-3 py-2 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              <span
                className={cn(
                  'rounded-full border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase',
                  TIER_CHIP[entry.tier] ?? 'bg-slate-300',
                )}
              >
                {entry.tier.toLowerCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs">
                {entry.matchInfo
                  ? `${entry.matchInfo.homeTeamCode} vs ${entry.matchInfo.awayTeamCode}`
                  : 'Match'}
              </span>
              {entry.result && (
                <span className="font-mono text-xs">
                  {entry.result.correctPredictions}/{entry.result.totalPredictions}
                </span>
              )}
              <span
                className={cn(
                  'rounded-full border-2 border-black px-2 py-0.5 font-mono text-xs font-black',
                  entry.pointsEarned > 0 ? 'bg-emerald-300' : 'bg-red-300',
                )}
              >
                {entry.pointsEarned > 0 ? `+${entry.pointsEarned}` : '0'}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
