import type { MatchEvent } from '@/types/match';

interface EventFeedProps {
  events: MatchEvent[];
}

const EVENT_ICONS: Record<MatchEvent['type'], string> = {
  goal: '⚽',
  red_card: '🟥',
  yellow_card: '🟨',
  corner: '🚩',
  penalty: '⚠️',
  substitution: '🔄',
};

/** TODO(Step: UI polish): staggered slide-in animation for new events. */
export function EventFeed({ events }: EventFeedProps) {
  if (events.length === 0) {
    return (
      <p className="rounded-xl border-2 border-dashed border-black bg-white/50 p-4 text-center text-sm font-bold">
        No events yet — stay sharp.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="Match events">
      {events.map((event) => (
        <li
          key={event.id}
          className="flex items-center gap-3 rounded-xl border-2 border-black bg-white/70 px-3 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          <span aria-hidden>{EVENT_ICONS[event.type]}</span>
          <span className="rounded border border-black bg-amber-300 px-1 font-mono text-xs font-bold">
            {event.minute}&apos;
          </span>
          <span className="text-sm font-medium">{event.description}</span>
        </li>
      ))}
    </ul>
  );
}
