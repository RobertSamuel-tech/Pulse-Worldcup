'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useMatches } from '@/hooks/useMatches';
import { useUserStore } from '@/stores/useUserStore';
import { cn } from '@/lib/utils';
import { teamFlag } from '@/utils/flags';
import { formatKickoff } from '@/utils/formatting';
import type { PulseMatch } from '@/types/match';

export type TierChoice = 'common' | 'rare' | 'legendary';

interface TierOption {
  id: TierChoice;
  name: string;
  cost: number;
  panels: number;
  swatch: string;
  tagline: string;
}

const TIERS: TierOption[] = [
  {
    id: 'common',
    name: 'Common',
    cost: 0,
    panels: 6,
    swatch: 'bg-gradient-to-br from-slate-200 to-slate-400',
    tagline: 'FREE • 6 panels • up to +500',
  },
  {
    id: 'rare',
    name: 'Rare',
    cost: 100,
    panels: 9,
    swatch: 'bg-gradient-to-br from-amber-200 to-amber-400',
    tagline: '100 pts • 9 panels • up to +2,000',
  },
  {
    id: 'legendary',
    name: 'Legendary',
    cost: 500,
    panels: 12,
    swatch: 'holo-shimmer',
    tagline: '500 pts • 12 panels • up to +10,000',
  },
];

interface ScratchCardSelectorProps {
  onConfirm: (matchId: string, tier: TierChoice) => void;
  isCreating: boolean;
}

function MatchRow({
  match,
  selected,
  onSelect,
}: {
  match: PulseMatch;
  selected: boolean;
  onSelect: () => void;
}) {
  const isLive = match.status === 'live' || match.status === 'halftime';
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border-2 border-black px-3 py-3 text-left font-bold transition-all',
        'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
        selected ? 'bg-indigo-400 text-white' : 'bg-white/60 hover:bg-white/90',
      )}
    >
      <span className="text-xl" aria-hidden>
        {teamFlag(match.homeTeam) ?? match.homeTeamCode}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">
        {match.homeTeam} vs {match.awayTeam}
      </span>
      {isLive ? (
        <>
          <span className="font-mono text-sm font-black">
            {match.homeScore}–{match.awayScore}
          </span>
          {match.minute !== undefined && (
            <span className="font-mono text-xs">{match.minute}&apos;</span>
          )}
          <span className="flex items-center gap-1 rounded-full border-2 border-black bg-red-400 px-2 py-0.5 text-[10px] text-black">
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute h-full w-full animate-ping rounded-full bg-black opacity-75" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-black" />
            </span>
            LIVE
          </span>
        </>
      ) : (
        <span
          className={cn(
            'rounded-full border-2 border-black px-2 py-0.5 text-[10px]',
            selected ? 'bg-white text-black' : 'bg-amber-300 text-black',
          )}
        >
          📅 {formatKickoff(match.kickoffTime)}
        </span>
      )}
      <span className="text-xl" aria-hidden>
        {teamFlag(match.awayTeam) ?? match.awayTeamCode}
      </span>
    </button>
  );
}

/** Step 1 of /scratch: pick a match, pick a tier, confirm. */
export function ScratchCardSelector({ onConfirm, isCreating }: ScratchCardSelectorProps) {
  const { matches, isLoading, error } = useMatches();
  const balance = useUserStore((s) => s.stats.totalPoints);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [tier, setTier] = useState<TierChoice>('common');

  // Live matches first; scheduled ones are playable too (pre-live windows).
  const playable = useMemo(
    () => matches.filter((m) => m.status !== 'finished' && m.status !== 'postponed'),
    [matches],
  );

  const chosenTier = TIERS.find((t) => t.id === tier);
  const canAfford = (cost: number): boolean => balance >= cost;
  const ready = matchId !== null && chosenTier !== undefined && canAfford(chosenTier.cost);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="scratch-pick-match">
        <h2 id="scratch-pick-match" className="mb-2 text-sm font-black uppercase tracking-tight">
          1 · Pick a match
        </h2>
        {error && (
          <p className="mb-2 rounded-xl border-2 border-black bg-amber-300 px-3 py-2 text-xs font-bold">
            {error}
          </p>
        )}
        {playable.length === 0 ? (
          <div className="rounded-xl border-4 border-dashed border-black bg-white/50 px-4 py-10 text-center text-sm font-bold text-black/60">
            No live matches right now. Come back during World Cup game time! 🏆
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {playable.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                selected={matchId === match.id}
                onSelect={() => setMatchId(match.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="scratch-pick-tier">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="scratch-pick-tier" className="text-sm font-black uppercase tracking-tight">
            2 · Pick your card
          </h2>
          <span className="rounded-full border-2 border-black bg-amber-300 px-3 py-0.5 font-mono text-xs font-black">
            💎 {balance.toLocaleString()} pts
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Card tier">
          {TIERS.map((option) => {
            const affordable = canAfford(option.cost);
            const active = tier === option.id;
            return (
              <button
                key={option.id}
                role="radio"
                aria-checked={active}
                disabled={!affordable}
                onClick={() => setTier(option.id)}
                className={cn(
                  'flex flex-col gap-1 rounded-xl border-2 border-black p-3 text-left transition-all',
                  'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
                  active ? 'ring-4 ring-black' : '',
                  affordable ? 'bg-white/60 hover:bg-white/90' : 'cursor-not-allowed opacity-40',
                )}
              >
                <span className={cn('h-4 w-full rounded border-2 border-black', option.swatch)} aria-hidden />
                <span className="text-sm font-black uppercase">
                  {option.name} {active && '✓'}
                </span>
                <span className="text-[11px] font-bold text-black/60">{option.tagline}</span>
                {!affordable && (
                  <span className="text-[11px] font-bold text-red-500">
                    Need {option.cost - balance} more pts
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <Button
        variant="primary"
        className="w-full text-base"
        disabled={!ready}
        isLoading={isCreating}
        onClick={() => {
          if (matchId && chosenTier) onConfirm(matchId, tier);
        }}
      >
        {matchId === null
          ? 'Pick a match to scratch'
          : chosenTier && !canAfford(chosenTier.cost)
            ? 'Not enough points for this tier'
            : '🎴 Get my scratch card'}
      </Button>
    </div>
  );
}
