'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { formatKickoff } from '@/utils/formatting';
import { teamFlag } from '@/utils/flags';
import type { PulseMatch } from '@/types/match';

interface MatchCardProps {
  match: PulseMatch;
  /** Increment to trigger the data-refresh pulse-glow. */
  refreshTick?: number;
}

function TeamBadge({ name, code }: { name: string; code: string }) {
  const flag = teamFlag(name);
  return (
    <span className="text-2xl" aria-hidden>
      {flag ?? (
        <span className="rounded border-2 border-black bg-white px-1 font-mono text-xs font-bold">
          {code}
        </span>
      )}
    </span>
  );
}

export function MatchCard({ match, refreshTick = 0 }: MatchCardProps) {
  const isLive = match.status === 'live' || match.status === 'halftime';
  const started = isLive || match.status === 'finished';

  // Pulse-glow when fresh data arrives (skip the initial render).
  const [glowing, setGlowing] = useState(false);
  const firstTick = useRef(true);
  useEffect(() => {
    if (firstTick.current) {
      firstTick.current = false;
      return;
    }
    setGlowing(true);
    const timer = setTimeout(() => setGlowing(false), 1_300);
    return () => clearTimeout(timer);
  }, [refreshTick]);

  const footerParts = [
    isLive && match.minute !== undefined ? `${match.minute}'` : null,
    match.stage ?? match.competition ?? null,
    match.venue ?? null,
  ].filter(Boolean);

  return (
    <Link
      href={`/match/${match.id}`}
      aria-label={`${match.homeTeam} vs ${match.awayTeam}`}
      className="block"
    >
      <Card
        className={cn(
          'flex flex-col gap-3 transition-all hover:-translate-y-0.5',
          'active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
          glowing && 'pulse-glow',
        )}
      >
        {/* Status badge */}
        <div className="flex items-center justify-between text-xs font-bold">
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded-full border-2 border-black bg-red-400 px-2 py-0.5">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-black" />
              </span>
              {match.status === 'halftime' ? 'HALF-TIME' : 'LIVE'}
            </span>
          ) : match.status === 'finished' ? (
            <span className="rounded-full border-2 border-black bg-emerald-300 px-2 py-0.5">
              ✅ FULL-TIME
            </span>
          ) : match.status === 'postponed' ? (
            <span className="rounded-full border-2 border-black bg-amber-300 px-2 py-0.5">
              POSTPONED
            </span>
          ) : (
            <span className="rounded-full border-2 border-black bg-white/70 px-2 py-0.5">
              📅 {formatKickoff(match.kickoffTime)}
            </span>
          )}
        </div>

        {/* Teams + score */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <TeamBadge name={match.homeTeam} code={match.homeTeamCode} />
            <span className="truncate font-bold">{match.homeTeam}</span>
          </div>
          <div
            className={cn(
              'shrink-0 font-mono text-xl font-black',
              started ? 'text-black' : 'text-black/40',
            )}
          >
            {started ? `${match.homeScore} – ${match.awayScore}` : 'vs'}
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <span className="truncate text-right font-bold">{match.awayTeam}</span>
            <TeamBadge name={match.awayTeam} code={match.awayTeamCode} />
          </div>
        </div>

        {/* Footer: minute | stage | venue */}
        {footerParts.length > 0 && (
          <div className="text-center text-xs font-medium text-black/60">
            {footerParts.join('  |  ')}
          </div>
        )}

        {isLive && (
          <div className="rounded-lg border-2 border-black bg-indigo-400 py-1 text-center text-sm font-bold text-white">
            Tap to predict →
          </div>
        )}
      </Card>
    </Link>
  );
}
