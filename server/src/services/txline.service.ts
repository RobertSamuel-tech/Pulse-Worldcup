import { config } from '../config';
import { getRedis } from '../config/redis';
import { solanaSubscriptionService } from './solana-subscription.service';
import { TxLineAuthError } from '../utils/errors';
import { logger } from '../utils/logger';
import type {
  GuestSessionResponse,
  StreamCallbacks,
  StreamHandle,
  TxLineRecord,
} from '../types/txline.types';

const JWT_TTL_MS = 30 * 24 * 3600_000; // guest JWT lives 30 days
const JWT_REFRESH_MARGIN_MS = 24 * 3600_000; // renew 1 day before expiry
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1_000;
const MAX_SSE_RECONNECT_ATTEMPTS = 10;
const REDIS_API_TOKEN_KEY = 'txline:api_token';
/** Free World Cup tier uses the standard bundle: empty leagues array. */
const SELECTED_LEAGUES: number[] = [];

class TxLineHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TxLineHttpError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * TxLINE API client (OpenAPI: https://txline.txodds.com/docs/docs.yaml).
 * Auth: POST /auth/guest/start → 30-day JWT; on-chain subscribe (free World Cup
 * tier) → POST /api/token/activate → long-lived API token. Data calls send BOTH
 * `Authorization: Bearer <jwt>` and `X-Api-Token`. Streaming is SSE, not WebSocket.
 * Tokens live ONLY on the server — never sent to clients.
 */
export class TxLineClient {
  private readonly baseUrl: string;
  private jwt: string | null = null;
  private jwtExpiry: Date | null = null;
  private apiToken: string | null = null;
  private authInFlight: Promise<string> | null = null;
  private activationInFlight: Promise<string> | null = null;

  constructor(network: 'devnet' | 'mainnet' = config.TXLINE_NETWORK) {
    this.baseUrl = network === 'mainnet' ? 'https://txline.txodds.com' : config.TXLINE_BASE_URL;
  }

  // ── Guest JWT ─────────────────────────────────────────────────────────────

  /** Obtains (or reuses) the guest JWT. Single-flight: concurrent callers share one call. */
  authenticate(): Promise<string> {
    if (!this.authInFlight) {
      this.authInFlight = this.startGuestSession().finally(() => {
        this.authInFlight = null;
      });
    }
    return this.authInFlight;
  }

  private async startGuestSession(): Promise<string> {
    const res = await this.fetchWithRetry(`${this.baseUrl}/auth/guest/start`, { method: 'POST' });
    if (!res.ok) {
      throw new TxLineAuthError(`Guest session failed: ${res.status}`);
    }
    const body = (await res.json()) as GuestSessionResponse;
    if (!body.token) {
      throw new TxLineAuthError('Guest session returned no token.');
    }
    this.jwt = body.token;
    this.jwtExpiry = new Date(Date.now() + JWT_TTL_MS);
    logger.info('txline_guest_session_started', { expiresAt: this.jwtExpiry.toISOString() });
    return this.jwt;
  }

  /** Renews the guest JWT when missing or within the refresh margin of expiry. */
  async refreshIfNeeded(): Promise<void> {
    const expiringSoon =
      !this.jwtExpiry || this.jwtExpiry.getTime() - Date.now() < JWT_REFRESH_MARGIN_MS;
    if (!this.jwt || expiringSoon) {
      await this.authenticate();
    }
  }

  // ── API token (requires on-chain subscription) ────────────────────────────

  /**
   * Returns the long-lived API token, activating the free-tier subscription when
   * needed: Redis cache → on-chain subscribe → POST /api/token/activate.
   */
  ensureApiToken(): Promise<string> {
    if (this.apiToken) return Promise.resolve(this.apiToken);
    if (!this.activationInFlight) {
      this.activationInFlight = this.activate().finally(() => {
        this.activationInFlight = null;
      });
    }
    return this.activationInFlight;
  }

  private async activate(): Promise<string> {
    // Activation costs an on-chain tx — reuse a previously issued token across restarts.
    try {
      const cached = await getRedis().get(REDIS_API_TOKEN_KEY);
      if (cached) {
        this.apiToken = cached;
        logger.info('txline_api_token_from_cache');
        return cached;
      }
    } catch {
      // Redis down — proceed with fresh activation.
    }

    await this.refreshIfNeeded();
    const jwt = this.jwt as string;
    const txSig = await solanaSubscriptionService.subscribeFreeTier();
    const walletSignature = solanaSubscriptionService.signActivationMessage(
      txSig,
      SELECTED_LEAGUES,
      jwt,
    );

    const res = await this.fetchWithRetry(`${this.baseUrl}/api/token/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ txSig, walletSignature, leagues: SELECTED_LEAGUES }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new TxLineAuthError(`Token activation failed: ${res.status} ${detail}`.trim());
    }

    // The endpoint replies text/plain with the raw token (or {token} in JSON mode).
    const raw = await res.text();
    let token = raw.trim();
    try {
      const parsed = JSON.parse(raw) as { token?: string };
      if (parsed.token) token = parsed.token;
    } catch {
      // plain-text token — keep as is
    }
    if (!token) {
      throw new TxLineAuthError('Token activation returned an empty token.');
    }

    this.apiToken = token;
    try {
      await getRedis().set(REDIS_API_TOKEN_KEY, token);
    } catch {
      // Cache write is best-effort.
    }
    logger.info('txline_activated', { tokenPreview: this.getMaskedToken() });
    return token;
  }

  // ── Headers / diagnostics ─────────────────────────────────────────────────

  getHeaders(): Record<string, string> {
    if (!this.jwt || !this.apiToken) {
      throw new TxLineAuthError('Not authenticated. Call authenticate()/ensureApiToken() first.');
    }
    return {
      Authorization: `Bearer ${this.jwt}`,
      'X-Api-Token': this.apiToken,
    };
  }

  get jwtExpiresAt(): Date | null {
    return this.jwtExpiry;
  }

  get isActivated(): boolean {
    return this.apiToken !== null;
  }

  /** Masked token for diagnostics — safe to show, never the full secret. */
  getMaskedToken(): string | null {
    if (!this.apiToken) return null;
    return `${this.apiToken.slice(0, 12)}…`;
  }

  // ── HTTP plumbing ─────────────────────────────────────────────────────────

  /** Retries network errors, 429 and 5xx with exponential backoff. */
  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: Error = new Error('Max retries exceeded');
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, init);
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('retry-after') ?? '5');
          logger.warn('txline_rate_limited', { url, retryAfter, attempt });
          await sleep(Math.min(retryAfter, 30) * 1000);
          continue;
        }
        if (res.status >= 500) {
          lastError = new TxLineHttpError(`TxLINE server error: ${res.status}`, res.status);
          await sleep(BASE_RETRY_DELAY_MS * 2 ** attempt);
          continue;
        }
        // SECTION 10: log every TxLINE call for debugging.
        logger.debug('txline_call', { url, method: init.method ?? 'GET', status: res.status });
        return res;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn('txline_network_error', { url, attempt, message: lastError.message });
        await sleep(BASE_RETRY_DELAY_MS * 2 ** attempt);
      }
    }
    throw lastError;
  }

  /** Authenticated GET on /api with auto-refresh and one JWT renewal on 401. */
  private async get<T>(path: string): Promise<T> {
    await this.refreshIfNeeded();
    await this.ensureApiToken();
    let res = await this.fetchWithRetry(`${this.baseUrl}/api${path}`, {
      headers: this.getHeaders(),
    });
    if (res.status === 401) {
      // Guest JWT rejected — renew it; the long-lived API token stays valid.
      await this.authenticate();
      res = await this.fetchWithRetry(`${this.baseUrl}/api${path}`, {
        headers: this.getHeaders(),
      });
    }
    if (!res.ok) {
      throw new TxLineHttpError(`TxLINE ${path} failed: ${res.status}`, res.status);
    }
    return res.json() as Promise<T>;
  }

  // ── Data methods ──────────────────────────────────────────────────────────

  /** Fixtures at/after the given epoch day (defaults to today, UTC). */
  getFixtures(params?: { startEpochDay?: number; competitionId?: number }): Promise<
    TxLineRecord[]
  > {
    const qs = new URLSearchParams();
    if (params?.startEpochDay !== undefined) qs.set('startEpochDay', String(params.startEpochDay));
    if (params?.competitionId !== undefined) qs.set('competitionId', String(params.competitionId));
    const suffix = qs.size > 0 ? `?${qs.toString()}` : '';
    return this.get<TxLineRecord[]>(`/fixtures/snapshot${suffix}`);
  }

  getScores(fixtureId: number): Promise<TxLineRecord[]> {
    return this.get<TxLineRecord[]>(`/scores/snapshot/${fixtureId}`);
  }

  getOdds(fixtureId: number): Promise<TxLineRecord[]> {
    return this.get<TxLineRecord[]>(`/odds/snapshot/${fixtureId}`);
  }

  // ── SSE streams ───────────────────────────────────────────────────────────

  streamScores(callbacks: StreamCallbacks): StreamHandle {
    return this.openSse('/scores/stream', callbacks);
  }

  streamOdds(callbacks: StreamCallbacks): StreamHandle {
    return this.openSse('/odds/stream', callbacks);
  }

  /**
   * Opens a Server-Sent Events stream with auto-reconnect (exponential backoff,
   * max 10 attempts, counter reset on success). close() stops it for good.
   */
  private openSse(path: string, callbacks: StreamCallbacks): StreamHandle {
    let closedByCaller = false;
    let reconnectAttempts = 0;
    let controller: AbortController | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = async (): Promise<void> => {
      await this.refreshIfNeeded();
      await this.ensureApiToken();
      controller = new AbortController();

      let res = await fetch(`${this.baseUrl}/api${path}`, {
        headers: {
          ...this.getHeaders(),
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) {
        // Stream rejected — renew the guest JWT and retry with the same API token.
        await this.authenticate();
        res = await fetch(`${this.baseUrl}/api${path}`, {
          headers: {
            ...this.getHeaders(),
            Accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          signal: controller.signal,
        });
      }
      if (!res.ok || !res.body) {
        throw new TxLineHttpError(`SSE ${path} failed: ${res.status}`, res.status);
      }

      reconnectAttempts = 0;
      logger.info('txline_stream_open', { path });
      callbacks.onOpen?.();

      const decoder = new TextDecoder();
      let buffer = '';
      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk as Uint8Array, { stream: true });
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');

          const data = rawEvent
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n');
          if (!data) continue; // heartbeat/comment
          try {
            callbacks.onMessage(JSON.parse(data));
          } catch {
            callbacks.onMessage(data);
          }
        }
      }
    };

    const run = (): void => {
      connect()
        .catch((err: unknown) => {
          if (closedByCaller) return;
          const message = err instanceof Error ? err.message : String(err);
          logger.warn('txline_stream_error', { path, message });
          callbacks.onError?.(err instanceof Error ? err : new Error(message));
        })
        .finally(() => {
          callbacks.onClose?.();
          if (closedByCaller || reconnectAttempts >= MAX_SSE_RECONNECT_ATTEMPTS) {
            if (!closedByCaller) logger.error('txline_stream_gave_up', { path });
            return;
          }
          const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000);
          reconnectAttempts++;
          logger.warn('txline_stream_reconnecting', {
            path,
            attempt: reconnectAttempts,
            delay,
          });
          reconnectTimer = setTimeout(run, delay);
        });
    };

    run();

    return {
      close: () => {
        closedByCaller = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        controller?.abort();
      },
    };
  }
}

/** App-wide singleton. */
export const txlineService = new TxLineClient();
