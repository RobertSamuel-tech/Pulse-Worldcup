import { API_BASE_URL } from './constants';
import { getSession, refreshAccessToken } from './auth-api';

export interface UserStats {
  totalPoints: number;
  currentStreak: number;
  bestStreak: number;
}

/** Wire DTO from the backend prediction routes. */
export interface PredictionDto {
  id: string;
  matchId: string;
  predictedAction: boolean;
  matchMinute: number;
  createdAt: string;
  resolveAt: string;
  resolved: boolean;
  wasCorrect: boolean | null;
  eventOccurred: boolean | null;
  eventType: string | null;
  pointsEarned: number;
  user?: UserStats;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function doFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<{ res: Response; json: { success: boolean; data: T; error?: { code: string; message: string } } }> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const json = (await res.json()) as {
    success: boolean;
    data: T;
    error?: { code: string; message: string };
  };
  return { res, json };
}

/** Retries once via silent token refresh on 401 (SECTION 12: short-lived access tokens). */
async function authed<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSession();
  if (!token) throw new ApiError('Please sign in first.', 'UNAUTHORIZED', 401);

  let { res, json } = await doFetch<T>(path, token, init);
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      ({ res, json } = await doFetch<T>(path, fresh, init));
    }
  }
  if (!res.ok || !json.success) {
    throw new ApiError(
      json.error?.message ?? 'Something went wrong. Please try again.',
      json.error?.code ?? 'UNKNOWN',
      res.status,
    );
  }
  return json.data;
}

export async function createPrediction(
  matchId: string,
  predictedAction: boolean,
): Promise<PredictionDto> {
  const { prediction } = await authed<{ prediction: PredictionDto; message: string }>(
    '/api/predictions',
    {
      method: 'POST',
      body: JSON.stringify({ matchId, predictedAction }),
    },
  );
  return prediction;
}

export function getPrediction(id: string): Promise<PredictionDto> {
  return authed(`/api/predictions/${id}`);
}

export function getActivePrediction(): Promise<PredictionDto | null> {
  return authed('/api/predictions/active');
}

export function getMatchOdds(
  matchId: string,
): Promise<{ probabilityPct: number; basedOn: 'txline' | 'model'; sourceCount: number }> {
  return authedless(`/api/matches/${matchId}/odds`);
}

async function authedless<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  const json = (await res.json()) as { success: boolean; data: T };
  if (!res.ok || !json.success) throw new ApiError('Request failed', 'UNKNOWN', res.status);
  return json.data;
}
