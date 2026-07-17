'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLeaderboard, type LeaderboardRowDto } from '@/lib/leaderboard-api';
import { getSocket } from '@/lib/socket';

const REFRESH_INTERVAL_MS = 60_000;
export const PAGE_SIZE = 25;

export type RankMovement = 'up' | 'down' | null;

export interface LeaderboardEntryVm extends LeaderboardRowDto {
  movement: RankMovement;
  isCurrentUser: boolean;
}

interface UseLeaderboardResult {
  entries: LeaderboardEntryVm[];
  myRank: LeaderboardRowDto | null;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Leaderboard with 60s auto-refresh, instant refresh on `leaderboard-update`
 * socket pushes, rank-movement tracking, personal rank, and pagination.
 */
export function useLeaderboard(): UseLeaderboardResult {
  const [rows, setRows] = useState<LeaderboardRowDto[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardRowDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const prevRanks = useRef<Map<string, number>>(new Map());
  const movements = useRef<Map<string, RankMovement>>(new Map());
  const loadedCount = useRef(PAGE_SIZE);
  const mounted = useRef(true);

  const applyRows = useCallback((fresh: LeaderboardRowDto[]) => {
    const next = new Map<string, RankMovement>();
    for (const row of fresh) {
      const prev = prevRanks.current.get(row.userId);
      if (prev !== undefined && prev !== row.rank) {
        next.set(row.userId, row.rank < prev ? 'up' : 'down');
      }
    }
    movements.current = next;
    prevRanks.current = new Map(fresh.map((r) => [r.userId, r.rank]));
    setRows(fresh);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await getLeaderboard(loadedCount.current, 0);
      if (!mounted.current) return;
      applyRows(data.leaderboard);
      setMyRank(data.myEntry);
      setHasMore(data.leaderboard.length >= loadedCount.current);
      setError(null);
    } catch {
      if (mounted.current) setError('Having trouble loading the leaderboard. Retrying…');
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [applyRows]);

  const loadMore = useCallback(async () => {
    try {
      const more = await getLeaderboard(PAGE_SIZE, rows.length);
      if (!mounted.current) return;
      loadedCount.current = rows.length + more.leaderboard.length;
      setHasMore(more.leaderboard.length === PAGE_SIZE);
      const combined = [...rows, ...more.leaderboard];
      prevRanks.current = new Map(combined.map((r) => [r.userId, r.rank]));
      setRows(combined);
    } catch {
      // leave as-is; user can tap again
    }
  }, [rows]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);

    const socket = getSocket();
    const onUpdate = (): void => void refresh();
    socket.on('leaderboard-update', onUpdate);

    return () => {
      mounted.current = false;
      clearInterval(interval);
      socket.off('leaderboard-update', onUpdate);
    };
  }, [refresh]);

  const entries: LeaderboardEntryVm[] = rows.map((row) => ({
    ...row,
    movement: movements.current.get(row.userId) ?? null,
    isCurrentUser: myRank !== null && row.userId === myRank.userId,
  }));

  return { entries, myRank, isLoading, error, hasMore, refresh, loadMore };
}
