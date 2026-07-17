import { create } from 'zustand';
import type { MatchClock, MatchEvent, PulseMatch } from '@/types/match';
import type { Prediction, ResolutionResult } from '@/types/prediction';

interface MatchState {
  currentMatch: PulseMatch | null;
  isLive: boolean;
  clock: MatchClock | null;
  currentPrediction: Prediction | null;
  timeRemaining: number; // seconds left in prediction window
  recentEvents: MatchEvent[];
  lastResolution: ResolutionResult | null;

  setCurrentMatch: (match: PulseMatch | null) => void;
  setPrediction: (prediction: Prediction | null) => void;
  setResolution: (result: ResolutionResult) => void;
  updateClock: (clock: MatchClock) => void;
  setTimeRemaining: (seconds: number) => void;
  addEvent: (event: MatchEvent) => void;
}

export const useMatchStore = create<MatchState>((set) => ({
  currentMatch: null,
  isLive: false,
  clock: null,
  currentPrediction: null,
  timeRemaining: 0,
  recentEvents: [],
  lastResolution: null,

  setCurrentMatch: (match) =>
    set({
      currentMatch: match,
      isLive: match?.status === 'live',
      clock: match?.clock ?? null,
      recentEvents: match?.events ?? [],
    }),
  setPrediction: (prediction) => set({ currentPrediction: prediction }),
  setResolution: (result) =>
    set({ lastResolution: result, currentPrediction: null, timeRemaining: 0 }),
  updateClock: (clock) => set({ clock }),
  setTimeRemaining: (seconds) => set({ timeRemaining: seconds }),
  addEvent: (event) =>
    set((state) => ({ recentEvents: [event, ...state.recentEvents].slice(0, 50) })),
}));
