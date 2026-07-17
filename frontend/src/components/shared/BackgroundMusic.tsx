'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  MUSIC_TOGGLE_EVENT,
  isMusicEnabled,
  startMusic,
  stopMusic,
} from '@/utils/background-music';

/** Routes where the stadium loop plays — everywhere else stays silent. */
function isMusicRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith('/match/') || pathname.startsWith('/scratch');
}

/**
 * Mounted once in the (main) layout: fades the background music in on match
 * and scratch pages, out everywhere else, and reacts live to the settings
 * toggle. Renders nothing.
 */
export function BackgroundMusic() {
  const pathname = usePathname();

  useEffect(() => {
    const sync = (): void => {
      if (isMusicRoute(pathname) && isMusicEnabled()) startMusic();
      else stopMusic();
    };
    sync();
    window.addEventListener(MUSIC_TOGGLE_EVENT, sync);
    return () => {
      window.removeEventListener(MUSIC_TOGGLE_EVENT, sync);
    };
  }, [pathname]);

  // Fade out if the whole app shell unmounts.
  useEffect(() => stopMusic, []);

  return null;
}
