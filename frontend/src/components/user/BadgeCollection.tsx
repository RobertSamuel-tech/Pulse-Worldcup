import { cn } from '@/lib/utils';
import type { AchievementBadge } from '@/types/user';

interface BadgeCollectionProps {
  badges: AchievementBadge[];
}

/** Earned badges in color; locked badges grayed out. */
export function BadgeCollection({ badges }: BadgeCollectionProps) {
  if (badges.length === 0) {
    return (
      <p className="rounded-xl border-2 border-dashed border-black bg-white/50 p-4 text-sm font-bold">
        No badges yet — make your first prediction!
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-3 gap-3">
      {badges.map((badge) => (
        <li
          key={badge.id}
          className={cn(
            'flex flex-col items-center gap-1 rounded-xl border-2 border-black bg-amber-200 p-3 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
            !badge.earnedAt && 'opacity-40 shadow-none grayscale',
          )}
          title={badge.description}
        >
          <span className="text-sm font-bold">{badge.name}</span>
          <span className="text-xs font-medium text-black/60">{badge.rarity}</span>
        </li>
      ))}
    </ul>
  );
}
