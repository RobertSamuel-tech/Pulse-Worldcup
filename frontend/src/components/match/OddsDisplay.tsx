interface OddsDisplayProps {
  /** Implied probability (0-100) of an event in the next 60 seconds. */
  eventProbability: number | null;
}

/**
 * Consensus odds context from TxLINE StablePrice (250+ bookmakers).
 * TODO(Step: odds integration): tooltip explaining how to read odds.
 */
export function OddsDisplay({ eventProbability }: OddsDisplayProps) {
  if (eventProbability === null) return null;
  return (
    <p className="text-center text-sm font-medium text-black/60">
      Market thinks:{' '}
      <span className="rounded border-2 border-black bg-indigo-400 px-1.5 py-0.5 font-mono font-bold text-white">
        {Math.round(eventProbability)}%
      </span>{' '}
      chance of action
    </p>
  );
}
