'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMatches } from '@/lib/txline';
import type { PulseMatch } from '@/types/match';

const REFRESH_INTERVAL_MS = 60_000;

interface UseMatchesResult {
  matches: PulseMatch[];
  isLoading: boolean;
  error: string | null;
  /** Increments on every successful refresh — drives the pulse-glow effect. */
  refreshTick: number;
  refresh: () => Promise<void>;
}

/** Match list with 60s auto-refresh (matches the backend's 55s cache TTL). */
export function useMatches(): UseMatchesResult {
  const [matches, setMatches] = useState<PulseMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getMatches();
      if (!mounted.current) return;
      setMatches(data);
      setRefreshTick((t) => t + 1);
      setError(null);
    } catch {
      if (!mounted.current) return;
      setError('Having trouble loading matches. Retrying…');
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  return { matches, isLoading, error, refreshTick, refresh };
}
