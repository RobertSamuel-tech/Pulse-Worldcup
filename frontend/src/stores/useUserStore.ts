import { create } from 'zustand';
import type { User, UserStats } from '@/types/user';

interface UserState {
  user: User | null;
  isConnected: boolean;
  stats: UserStats;

  setUser: (user: User | null) => void;
  setStats: (stats: Partial<UserStats>) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
  addPoints: (points: number) => void;
}

const EMPTY_STATS: UserStats = {
  totalPredictions: 0,
  correctPredictions: 0,
  accuracy: 0,
  currentStreak: 0,
  bestStreak: 0,
  totalPoints: 0,
};

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isConnected: false,
  stats: EMPTY_STATS,

  setUser: (user) => set({ user, isConnected: user !== null }),
  setStats: (stats) => set((s) => ({ stats: { ...s.stats, ...stats } })),
  incrementStreak: () =>
    set((s) => {
      const currentStreak = s.stats.currentStreak + 1;
      return {
        stats: {
          ...s.stats,
          currentStreak,
          bestStreak: Math.max(s.stats.bestStreak, currentStreak),
        },
      };
    }),
  resetStreak: () => set((s) => ({ stats: { ...s.stats, currentStreak: 0 } })),
  addPoints: (points) =>
    set((s) => ({ stats: { ...s.stats, totalPoints: s.stats.totalPoints + points } })),
}));
