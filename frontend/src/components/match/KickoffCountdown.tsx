'use client';

import { useEffect, useState } from 'react';
import { formatKickoff } from '@/utils/formatting';

interface KickoffCountdownProps {
  kickoffTime: Date;
}

function parts(msLeft: number): string {
  if (msLeft <= 0) return 'Kicking off…';
  const totalSeconds = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/** Shown instead of prediction buttons when the match hasn't started (SECTION 10). */
export function KickoffCountdown({ kickoffTime }: KickoffCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="text-3xl" aria-hidden>
        ⏳
      </span>
      <p className="text-lg font-bold">This match hasn&apos;t started yet</p>
      <p className="rounded-xl border-2 border-black bg-indigo-400 px-4 py-1 font-mono text-2xl font-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {parts(kickoffTime.getTime() - now)}
      </p>
      <p className="text-sm font-medium text-black/60">
        Kickoff {formatKickoff(kickoffTime)} — come back then!
      </p>
    </div>
  );
}
