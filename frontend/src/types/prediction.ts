import type { EventType } from './match';

/** TRUE = "Something's brewing" (event expected), FALSE = "Calm before storm" */
export type PredictedAction = boolean;

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  predictedAction: PredictedAction;
  matchMinute: number;
  resolved: boolean;
  wasCorrect?: boolean;
  eventOccurred?: boolean;
  eventType?: EventType | 'none';
  pointsEarned: number;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface ResolutionResult {
  predictionId: string;
  wasCorrect: boolean;
  eventOccurred: boolean;
  eventType: EventType | 'none';
  pointsEarned: number;
  newStreak: number;
  newTotalPoints: number;
}
