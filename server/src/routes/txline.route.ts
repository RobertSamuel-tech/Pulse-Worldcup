import type { FastifyInstance } from 'fastify';
import { txlineService } from '../services/txline.service';

/**
 * TxLINE diagnostics. Triggers the full server-side auth flow (guest JWT →
 * on-chain free-tier subscription → API token). The response carries a MASKED
 * token only — real secrets never leave the server (see CLAUDE.md).
 */
export async function txlineRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/txline/auth', async () => {
    await txlineService.authenticate();
    await txlineService.ensureApiToken();
    return {
      success: true,
      apiToken: txlineService.getMaskedToken(),
      jwtExpiresAt: txlineService.jwtExpiresAt?.toISOString() ?? null,
    };
  });
}
