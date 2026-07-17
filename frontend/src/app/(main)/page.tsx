'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MatchCard } from '@/components/match/MatchCard';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { cn } from '@/lib/utils';
import { useMatches } from '@/hooks/useMatches';
import type { PulseMatch } from '@/types/match';

type Tab = 'live' | 'upcoming' | 'completed';

const TAB_LABELS: Record<Tab, string> = {
  live: '🔴 LIVE',
  upcoming: '📅 UPCOMING',
  completed: '✅ COMPLETED',
};

const EMPTY_MESSAGES: Record<Tab, string> = {
  live: 'No live matches right now. Check back soon!',
  upcoming: 'No upcoming matches on the schedule yet.',
  completed: 'No completed matches yet — the action is still to come.',
};

function bucketOf(match: PulseMatch): Tab {
  if (match.status === 'live' || match.status === 'halftime') return 'live';
  if (match.status === 'finished') return 'completed';
  return 'upcoming'; // scheduled + postponed
}

// Staggered list entrance (SECTION 9)
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border-4 border-black/20 bg-white/50 p-4">
      <div className="mb-3 h-3 w-16 rounded bg-black/10" />
      <div className="mb-2 flex items-center justify-between">
        <div className="h-5 w-24 rounded bg-black/10" />
        <div className="h-5 w-10 rounded bg-black/10" />
        <div className="h-5 w-24 rounded bg-black/10" />
      </div>
      <div className="mx-auto h-3 w-32 rounded bg-black/10" />
    </div>
  );
}

export default function HomePage() {
  const { matches, isLoading, error, refreshTick, refresh } = useMatches();
  const [tab, setTab] = useState<Tab>('live');
  const userPickedTab = useRef(false);

  const buckets = useMemo(() => {
    const result: Record<Tab, PulseMatch[]> = { live: [], upcoming: [], completed: [] };
    for (const match of matches) {
      result[bucketOf(match)].push(match);
    }
    return result;
  }, [matches]);

  // Don't land visitors on an empty LIVE tab — fall back to UPCOMING until they choose.
  useEffect(() => {
    if (!isLoading && !userPickedTab.current && buckets.live.length === 0) {
      setTab(buckets.upcoming.length > 0 ? 'upcoming' : 'completed');
    }
  }, [isLoading, buckets]);

  const visible = buckets[tab];

  return (
    <PullToRefresh onRefresh={refresh}>
      <section className="flex flex-col gap-4 py-4">
        <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Matches</h1>

        {/* Tab navigation */}
        <div className="flex gap-2" role="tablist" aria-label="Match filters">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                userPickedTab.current = true;
                setTab(t);
              }}
              className={cn(
                'rounded-xl border-2 border-black px-3 py-2 text-xs font-bold transition-colors',
                tab === t
                  ? 'bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white/50 hover:bg-white/80',
              )}
            >
              {TAB_LABELS[t]} ({buckets[t].length})
            </button>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border-2 border-black bg-amber-300 px-3 py-2 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            {error}
          </p>
        )}

        {/* Card grid: 1 col mobile / 2 tablet / 3 desktop */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border-4 border-dashed border-black bg-white/50 px-6 py-12 text-center">
            <span className="text-3xl" aria-hidden>
              ⚽
            </span>
            <p className="text-sm font-bold">{EMPTY_MESSAGES[tab]}</p>
            {tab === 'live' && (
              <a href="/replay" className="text-sm font-bold underline decoration-2 underline-offset-4">
                Try Replay Mode →
              </a>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              key={tab}
              className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {visible.map((match) => (
                <motion.div key={match.id} layout variants={itemVariants} exit={{ opacity: 0 }}>
                  <MatchCard match={match} refreshTick={refreshTick} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </section>
    </PullToRefresh>
  );
}
