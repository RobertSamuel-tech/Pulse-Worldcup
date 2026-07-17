import { create } from 'zustand';
import type { LeaderboardEntry } from '@/types/user';

interface LeaderboardState {
  entries: LeaderboardEntry[];
  personalRank: LeaderboardEntry | null;
  lastUpdated: Date | null;
  isLoading: boolean;

  setEntries: (entries: LeaderboardEntry[], personalRank?: LeaderboardEntry) => void;
  setLoading: (loading: boolean) => void;
}

export const useLeaderboardStore = create<LeaderboardState>((set) => ({
  entries: [],
  personalRank: null,
  lastUpdated: null,
  isLoading: false,

  setEntries: (entries, personalRank) =>
    set({ entries, personalRank: personalRank ?? null, lastUpdated: new Date(), isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));
