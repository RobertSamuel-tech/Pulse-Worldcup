interface RankBadgeProps {
  rank: number;
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function RankBadge({ rank }: RankBadgeProps) {
  const medal = MEDALS[rank];
  return (
    <span className="font-mono font-bold" aria-label={`Rank ${rank}`}>
      {medal ?? `#${rank}`}
    </span>
  );
}
