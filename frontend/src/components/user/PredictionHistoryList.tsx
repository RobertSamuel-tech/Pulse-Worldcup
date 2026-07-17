'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getHistory, type HistoryEntry, type HistoryFilter } from '@/lib/profile-api';

const PAGE_SIZE = 20;

const FILTER_LABELS: Record<HistoryFilter, string> = {
  today: 'Today',
  week: 'This Week',
  all: 'All Time',
};

const EVENT_LABELS: Record<string, string> = {
  GOAL: '⚽ Goal',
  RED_CARD: '🟥 Red card',
  YELLOW_CARD: '🟨 Yellow card',
  CORNER: '🚩 Corner',
  PENALTY: '⚠️ Penalty',
  SUBSTITUTION: '🔄 Substitution',
  NONE: '😴 Nothing',
};

function outcomeText(entry: HistoryEntry): string {
  if (entry.eventOccurred && entry.eventType) {
    return `${EVENT_LABELS[entry.eventType] ?? entry.eventType} in the window`;
  }
  return 'Stayed calm — no events';
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PredictionHistoryList() {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback((f: HistoryFilter) => {
    setEntries(null);
    setError(false);
    getHistory(f, PAGE_SIZE, 0)
      .then(({ predictions, total: t }) => {
        setEntries(predictions);
        setTotal(t);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  const loadMore = (): void => {
    if (!entries) return;
    setLoadingMore(true);
    getHistory(filter, PAGE_SIZE, entries.length)
      .then(({ predictions }) => setEntries([...entries, ...predictions]))
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wide">Prediction History</h2>
        <div className="flex gap-1" role="tablist" aria-label="History filter">
          {(Object.keys(FILTER_LABELS) as HistoryFilter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-lg border-2 border-black px-2 py-1 text-[11px] font-bold transition-colors',
                filter === f ? 'bg-black text-white' : 'bg-white/50 hover:bg-white/80',
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border-2 border-black bg-red-300 px-3 py-2 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          Couldn&apos;t load history.
        </p>
      ) : entries === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border-2 border-black/20 bg-white/50"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-black bg-white/50 px-6 py-8 text-center">
          <p className="text-sm font-bold">No predictions yet. Go make some!</p>
          <Link href="/" className="text-sm font-bold underline decoration-2 underline-offset-4">
            Browse matches →
          </Link>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border-2 border-black bg-white/70 px-3 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
                  'border-l-8',
                  entry.wasCorrect ? 'border-l-emerald-500' : 'border-l-red-400',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {entry.match
                      ? `${entry.match.homeTeamCode} ${entry.match.homeScore}–${entry.match.awayScore} ${entry.match.awayTeamCode}`
                      : 'Match'}
                    <span className="ml-2 font-mono text-xs text-black/50">
                      {entry.matchMinute}&apos;
                    </span>
                  </p>
                  <p className="truncate text-xs font-medium text-black/60">
                    Said {entry.predictedAction ? 'YES' : 'NO'} · {outcomeText(entry)} ·{' '}
                    {timeAgo(entry.createdAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-lg border-2 border-black px-2 py-0.5 font-mono text-sm font-black',
                    entry.wasCorrect ? 'bg-emerald-300' : 'bg-red-300',
                  )}
                >
                  {entry.wasCorrect ? `+${entry.pointsEarned}` : '0'}
                </span>
              </li>
            ))}
          </ul>
          {entries.length < total && (
            <button
              className="rounded-xl border-2 border-black bg-white/60 py-2 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-white/90 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
              disabled={loadingMore}
              onClick={loadMore}
            >
              {loadingMore ? 'Loading…' : `Load more (${total - entries.length} left)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
