'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { getDemoMatches, type DemoMatchSummary } from '@/lib/demo-api';
import { teamFlag } from '@/utils/flags';

function Excitement({ rating }: { rating: number }) {
  return (
    <span aria-label={`Excitement ${rating} out of 5`} className="text-sm">
      {'⚡'.repeat(rating)}
      <span className="opacity-25">{'⚡'.repeat(5 - rating)}</span>
    </span>
  );
}

function Flag({ name, code }: { name: string; code: string }) {
  const flag = teamFlag(name);
  return (
    <span className="text-3xl" aria-hidden>
      {flag ?? (
        <span className="rounded border-2 border-black bg-white px-1 font-mono text-sm font-bold">
          {code}
        </span>
      )}
    </span>
  );
}

function ScenarioCard({ match, index }: { match: DemoMatchSummary; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
    >
      <Link
        href={`/replay/${match.id}`}
        aria-label={`Play replay: ${match.homeTeam} vs ${match.awayTeam}`}
        className="block"
      >
        <div className="flex flex-col gap-3 rounded-xl border-4 border-black bg-white/60 p-4 backdrop-blur-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
          <div className="flex items-center justify-between">
            <span className="rounded-full border-2 border-black bg-indigo-400 px-2 py-0.5 text-xs font-bold text-white">
              {match.label}
            </span>
            <Excitement rating={match.excitement} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <Flag name={match.homeTeam} code={match.homeTeamCode} />
              <span className="truncate text-sm font-bold">{match.homeTeam}</span>
            </div>
            <span className="rounded-xl border-2 border-black bg-black px-3 py-1 font-mono text-2xl font-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {match.homeScore} – {match.awayScore}
            </span>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <Flag name={match.awayTeam} code={match.awayTeamCode} />
              <span className="truncate text-sm font-bold">{match.awayTeam}</span>
            </div>
          </div>

          <div className="text-center text-xs font-bold text-black/60">
            {match.stage} · ⚽ {match.goalCount} Goals · 🟨 {match.cardCount} Cards
          </div>

          <motion.div
            className="rounded-lg border-2 border-black bg-emerald-400 py-2 text-center text-sm font-black uppercase"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            ▶ Play Replay
          </motion.div>
        </div>
      </Link>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border-4 border-black/20 bg-white/50 p-4">
      <div className="mb-3 h-4 w-20 rounded bg-black/10" />
      <div className="mb-3 flex items-center justify-between">
        <div className="h-10 w-16 rounded bg-black/10" />
        <div className="h-10 w-20 rounded bg-black/10" />
        <div className="h-10 w-16 rounded bg-black/10" />
      </div>
      <div className="h-9 w-full rounded bg-black/10" />
    </div>
  );
}

export default function ReplayPage() {
  const [matches, setMatches] = useState<DemoMatchSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setMatches(null);
    getDemoMatches()
      .then(setMatches)
      .catch(() => setError("Couldn't load replay scenarios. Check your connection and retry."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="flex flex-col gap-4 py-4">
      <div className="rounded-xl border-2 border-black bg-amber-300 px-3 py-2 text-center text-xs font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        🎬 DEMO MODE — replaying recorded World Cup data
      </div>
      <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Match Replay</h1>
      <p className="text-sm font-medium text-black/60">
        Pick a scenario and predict the action minute by minute — just like a live match.
      </p>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-4 border-dashed border-black bg-white/50 px-6 py-10 text-center">
          <p className="text-sm font-bold">{error}</p>
          <button
            className="rounded-xl border-2 border-black bg-black px-5 py-2 text-sm font-bold text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
            onClick={load}
          >
            ↻ Retry
          </button>
        </div>
      ) : matches === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((m, i) => (
            <ScenarioCard key={m.id} match={m} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
