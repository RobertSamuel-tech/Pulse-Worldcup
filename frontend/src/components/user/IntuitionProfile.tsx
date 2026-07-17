'use client';

export interface IntuitionCategory {
  label: string; // e.g. "Goal Detection"
  accuracy: number; // 0-100
  globalAverage: number; // 0-100
}

interface IntuitionProfileProps {
  categories: IntuitionCategory[];
}

/**
 * Accuracy-by-event-type breakdown vs global average.
 * TODO(Step: intuition profile): Recharts radar chart + personalized insights
 * ("You're a GOAL WHISPERER!").
 */
export function IntuitionProfile({ categories }: IntuitionProfileProps) {
  return (
    <ul className="flex flex-col gap-2">
      {categories.map((c) => (
        <li
          key={c.label}
          className="flex items-center justify-between rounded-xl border-2 border-black bg-white/70 px-3 py-2 text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          <span className="font-bold">{c.label}</span>
          <span className="font-mono font-bold">
            {Math.round(c.accuracy)}%{' '}
            <span className="font-medium text-black/50">(avg {Math.round(c.globalAverage)}%)</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
