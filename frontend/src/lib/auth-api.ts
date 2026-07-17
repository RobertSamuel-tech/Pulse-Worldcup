import { API_BASE_URL } from './constants';
import type { User } from '@/types/user';

const ACCESS_KEY = 'pulse_access_token';
const REFRESH_KEY = 'pulse_refresh_token';

/**
 * Message the wallet signs during login. MUST stay byte-identical to the
 * backend copy in server/src/utils/auth.ts.
 */
export function loginMessage(walletAddress: string, nonce: string): string {
  return `PULSE wants you to sign in.\n\nWallet: ${walletAddress}\nNonce: ${nonce}`;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? 'Something went wrong. Please try again.');
  }
  return json.data;
}

export function getNonce(walletAddress: string): Promise<{ nonce: string }> {
  return request(`/api/auth/nonce?walletAddress=${encodeURIComponent(walletAddress)}`);
}

export async function login(
  walletAddress: string,
  signature: string,
  nonce: string,
): Promise<{ user: User }> {
  const data = await request<TokenPair & { user: User }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, signature, nonce }),
  });
  saveTokens(data.accessToken, data.refreshToken);
  return { user: data.user };
}

export function fetchMe(token: string): Promise<{ user: User }> {
  return request('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
}

/** Logout / wallet disconnect (SECTION 12): revokes refresh tokens server-side. */
export async function logout(): Promise<void> {
  const token = getAccessToken();
  clearSession();
  if (!token) return;
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

// ── Session persistence (access: 15min, refresh: 7day — SECTION 12) ────────

export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

/** Back-compat alias — most call sites just need "is there a session". */
export const getSession = getAccessToken;

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshInFlight: Promise<string | null> | null = null;

/** Single-flight silent refresh — concurrent 401s share one refresh call. */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return null;
      try {
        const tokens = await request<TokenPair>('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        saveTokens(tokens.accessToken, tokens.refreshToken);
        return tokens.accessToken;
      } catch {
        clearSession();
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Authenticated fetch used by prediction-api.ts and leaderboard-api.ts: adds
 * the Bearer token and transparently retries once via silent refresh on 401.
 */
export async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new Error('Please sign in first.');

  const doFetch = (accessToken: string): Promise<Response> =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...init?.headers },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (!fresh) throw new Error('Session expired. Please sign in again.');
    res = await doFetch(fresh);
  }
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? 'Something went wrong. Please try again.');
  }
  return json.data;
}
