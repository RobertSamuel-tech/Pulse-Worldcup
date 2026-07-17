import { randomBytes } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { getPrisma } from '../config/database';
import { getRedis } from '../config/redis';
import { issueTokenPair, loginMessage, revokeAllRefreshTokens } from '../utils/auth';
import { PulseError, UnauthorizedError } from '../utils/errors';

const NONCE_TTL_SECONDS = 300;

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  /** Legacy alias for accessToken — older clients read this field. */
  token: string;
  user: {
    id: string;
    walletAddress: string;
    username: string | null;
    totalPoints: number;
    currentStreak: number;
    bestStreak: number;
    createdAt: Date;
  };
}

const USER_SELECT = {
  id: true,
  walletAddress: true,
  username: true,
  totalPoints: true,
  currentStreak: true,
  bestStreak: true,
  createdAt: true,
} as const;

function nonceKey(walletAddress: string): string {
  return `auth:nonce:${walletAddress}`;
}

function parseWallet(walletAddress: string): PublicKey {
  try {
    return new PublicKey(walletAddress);
  } catch {
    throw new PulseError('Invalid wallet address.', 'BAD_REQUEST', 400);
  }
}

/**
 * Wallet-signature auth: single-use nonce challenge (Redis, 5min TTL) →
 * ed25519 verification → user upsert → 7-day JWT session.
 */
export class UserService {
  async issueNonce(walletAddress: string): Promise<string> {
    parseWallet(walletAddress);
    const nonce = randomBytes(16).toString('hex');
    await getRedis().set(nonceKey(walletAddress), nonce, 'EX', NONCE_TTL_SECONDS);
    return nonce;
  }

  async verifyAndLogin(
    walletAddress: string,
    signature: string,
    nonce: string,
  ): Promise<SessionResult> {
    const publicKey = parseWallet(walletAddress);

    // Single-use challenge: GETDEL so a replayed signature can never log in twice.
    const stored = await getRedis().getdel(nonceKey(walletAddress));
    if (!stored || stored !== nonce) {
      throw new UnauthorizedError('Sign-in challenge expired. Please try again.');
    }

    let signatureBytes: Uint8Array;
    try {
      signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));
    } catch {
      throw new UnauthorizedError('Invalid signature.');
    }
    const message = new TextEncoder().encode(loginMessage(walletAddress, nonce));
    const valid = nacl.sign.detached.verify(message, signatureBytes, publicKey.toBytes());
    if (!valid) {
      throw new UnauthorizedError('Signature verification failed.');
    }

    const user = await getPrisma().user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
      select: USER_SELECT,
    });

    const tokens = await issueTokenPair(user.id, walletAddress);
    return { ...tokens, user };
  }

  async getById(userId: string): Promise<SessionResult['user'] | null> {
    return getPrisma().user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });
  }

  /** Logout / wallet disconnect (SECTION 12): revokes all refresh tokens. */
  async logout(userId: string): Promise<void> {
    await revokeAllRefreshTokens(userId);
  }
}

export const userService = new UserService();
