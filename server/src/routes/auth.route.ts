import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { loginSchema } from '../utils/validators';
import { requireAuth, rotateRefreshToken } from '../utils/auth';
import { NotFoundError } from '../utils/errors';
import { userService } from '../services/user.service';

const nonceQuerySchema = z.object({
  walletAddress: z.string().min(32).max(44),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/**
 * Wallet-signature auth: GET /api/auth/nonce → wallet signs → POST /api/auth/login.
 * Sessions use short-lived access tokens (15min) + rotating refresh tokens (7day,
 * single-use — SECTION 12) via POST /api/auth/refresh.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/auth/nonce',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const { walletAddress } = nonceQuerySchema.parse(request.query);
      const nonce = await userService.issueNonce(walletAddress);
      return { success: true, data: { nonce } };
    },
  );

  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request) => {
      const body = loginSchema.parse(request.body);
      const session = await userService.verifyAndLogin(
        body.walletAddress,
        body.signature,
        body.nonce,
      );
      return { success: true, data: session };
    },
  );

  app.post(
    '/api/auth/refresh',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      const { refreshToken } = refreshSchema.parse(request.body);
      const tokens = await rotateRefreshToken(refreshToken);
      return { success: true, data: tokens };
    },
  );

  /** Logout / wallet disconnect (SECTION 12): revokes all refresh tokens. */
  app.post('/api/auth/logout', async (request) => {
    const { userId } = requireAuth(request);
    await userService.logout(userId);
    return { success: true, data: null };
  });

  /** Session restore: validates the Bearer token and returns the user. */
  app.get('/api/auth/me', async (request) => {
    const { userId } = requireAuth(request);
    const user = await userService.getById(userId);
    if (!user) throw new NotFoundError('User');
    return { success: true, data: { user } };
  });
}
