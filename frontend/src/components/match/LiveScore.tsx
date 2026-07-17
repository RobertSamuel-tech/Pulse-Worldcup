import type { PulseMatch } from '@/types/match';

interface LiveScoreProps {
  match: PulseMatch;
}

export function LiveScore({ match }: LiveScoreProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span className="text-lg font-bold">{match.homeTeamCode}</span>
      <span className="rounded-xl border-2 border-black bg-black px-3 py-1 font-mono text-4xl font-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {match.homeScore} - {match.awayScore}
      </span>
      <span className="text-lg font-bold">{match.awayTeamCode}</span>
    </div>
  );
}
