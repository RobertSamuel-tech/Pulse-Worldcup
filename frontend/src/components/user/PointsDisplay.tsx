import { formatPoints } from '@/utils/formatting';

interface PointsDisplayProps {
  points: number;
}

/** TODO(Step: UI polish): animated count-up when points change. */
export function PointsDisplay({ points }: PointsDisplayProps) {
  return (
    <span className="font-mono text-2xl font-black" aria-label={`${points} points`}>
      {formatPoints(points)} pts
    </span>
  );
}
