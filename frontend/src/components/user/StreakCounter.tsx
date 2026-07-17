interface StreakCounterProps {
  streak: number;
}

/** TODO(Step: UI polish): flame animation + count-up on increment. */
export function StreakCounter({ streak }: StreakCounterProps) {
  return (
    <div className="flex items-center gap-1" aria-label={`Current streak: ${streak}`}>
      <span className="rounded-lg border-2 border-black bg-amber-300 px-2 font-mono text-2xl font-black">
        {streak}
      </span>
      <span aria-hidden>🔥</span>
    </div>
  );
}
