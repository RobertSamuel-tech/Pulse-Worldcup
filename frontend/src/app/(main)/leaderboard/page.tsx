'use client';

import { useState } from 'react';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { formatPoints } from '@/utils/formatting';

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg border-2 border-black/20 bg-white/50" />
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const { entries, myRank, isLoading, error, hasMore, refresh, loadMore } = useLeaderboard();
  const [loadingMore, setLoadingMore] = useState(false);

  const meInList = myRank !== null && entries.some((e) => e.userId === myRank.userId);

  return (
    <PullToRefresh onRefresh={refresh}>
      <section className="flex flex-col gap-4 py-4">
        <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Leaderboard</h1>

        {/* Personal rank — sticky so it stays visible while scrolling the table */}
        {myRank && !meInList && (
          <div className="sticky top-2 z-10 flex items-center justify-between rounded-xl border-2 border-black bg-indigo-400 px-4 py-3 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] backdrop-blur">
            <span className="text-sm font-bold">
              Your rank: #{myRank.rank.toLocaleString('en-US')}
            </span>
            <span className="font-mono text-sm font-bold">
              {formatPoints(myRank.points)} pts
            </span>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl border-2 border-black bg-amber-300 px-3 py-2 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            {error}
          </p>
        )}

        {isLoading ? <SkeletonRows /> : <LeaderboardTable entries={entries} />}

        {!isLoading && hasMore && entries.length > 0 && (
          <button
            className="rounded-xl border-2 border-black bg-white/60 py-3 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-white/90 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
            disabled={loadingMore}
            onClick={() => {
              setLoadingMore(true);
              void loadMore().finally(() => setLoadingMore(false));
            }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </section>
    </PullToRefresh>
  );
}
