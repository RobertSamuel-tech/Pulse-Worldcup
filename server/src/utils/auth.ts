import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { FastifyRequest } from 'fastify';
import { config } from '../config';
import { getRedis } from '../config/redis';
import { UnauthorizedError } from './errors';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15min (SECTION 12)
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600; // 7 days

export interface SessionInfo {
  userId: string;
  walletAddress: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Legacy alias for accessToken — kept for clients not yet on the refresh flow. */
  token: string;
}

/**
 * Message the wallet signs during login. MUST stay byte-identical to the
 * frontend copy in frontend/src/lib/auth-api.ts.
 */
export function loginMessage(walletAddress: string, nonce: string): string {
  return `PULSE wants you to sign in.\n\nWallet: ${walletAddress}\nNonce: ${nonce}`;
}

function refreshKey(userId: string, jti: string): string {
  return `auth:refresh:${userId}:${jti}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function signAccessToken(userId: string, walletAddress: string): string {
  return jwt.sign({ wallet: walletAddress, type: 'access' }, config.JWT_SECRET, {
    subject: userId,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

/**
 * Issues a refresh token and records its hash in Redis so it can be revoked
 * (logout) and rotated (single-use: consumed and replaced on every refresh).
 */
async function signRefreshToken(userId: string, walletAddress: string): Promise<string> {
  const jti = randomUUID();
  const token = jwt.sign({ wallet: walletAddress, type: 'refresh', jti }, config.JWT_SECRET, {
    subject: userId,
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  });
  try {
    await getRedis().set(refreshKey(userId, jti), hashToken(token), 'EX', REFRESH_TOKEN_TTL_SECONDS);
  } catch {
    // Redis down — refresh tokens degrade to stateless (can't be revoked until it's back).
  }
  return token;
}

export async function issueTokenPair(userId: string, walletAddress: string): Promise<TokenPair> {
  const accessToken = signAccessToken(userId, walletAddress);
  const refreshToken = await signRefreshToken(userId, walletAddress);
  return { accessToken, refreshToken, token: accessToken };
}

/** Verifies an access token. Throws UnauthorizedError on expiry/tampering. */
export function verifySession(token: string): SessionInfo {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload & {
      wallet?: string;
      type?: string;
    };
    if (!payload.sub || !payload.wallet || payload.type !== 'access') {
      throw new UnauthorizedError();
    }
    return { userId: payload.sub, walletAddress: payload.wallet };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Session expired. Please sign in again.');
  }
}

/**
 * Rotates a refresh token: verifies it, checks it hasn't been revoked/reused,
 * deletes it (single-use), and issues a fresh pair.
 */
export async function rotateRefreshToken(refreshToken: string): Promise<TokenPair> {
  let payload: jwt.JwtPayload & { wallet?: string; type?: string; jti?: string };
  try {
    payload = jwt.verify(refreshToken, config.JWT_SECRET) as typeof payload;
  } catch {
    throw new UnauthorizedError('Refresh token expired. Please sign in again.');
  }
  if (!payload.sub || !payload.wallet || payload.type !== 'refresh' || !payload.jti) {
    throw new UnauthorizedError();
  }

  const key = refreshKey(payload.sub, payload.jti);
  const stored = await getRedis()
    .get(key)
    .catch(() => null);
  if (!stored || stored !== hashToken(refreshToken)) {
    throw new UnauthorizedError('Refresh token already used or revoked.');
  }
  await getRedis()
    .del(key)
    .catch(() => undefined); // single-use: burn it immediately

  return issueTokenPair(payload.sub, payload.wallet);
}

/** Revokes every refresh token for a user (logout / wallet disconnect). */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    const keys = await redis.keys(`auth:refresh:${userId}:*`);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // best-effort
  }
}

/** Extracts and verifies the Bearer access token from a request. */
export function requireAuth(request: FastifyRequest): SessionInfo {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }
  return verifySession(header.slice('Bearer '.length));
}
