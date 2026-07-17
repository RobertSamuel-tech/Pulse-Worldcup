# Deployment Guide

## Environments
- **Frontend:** Vercel (Next.js, edge network, auto-SSL). Preview deploys per branch; production on main.
- **Backend:** Railway or Fly.io (Docker, Fastify + Socket.io + Bull workers).
- **Database:** Supabase managed PostgreSQL (pgbouncer pooling, daily backups).
- **Cache/Queue:** Upstash Redis.
- **Monitoring:** Sentry (frontend + backend DSNs).

## Environment Variables

### Frontend (Vercel)
```
NEXT_PUBLIC_API_URL=          # backend base URL
NEXT_PUBLIC_SOCKET_URL=       # backend WSS URL
NEXT_PUBLIC_SOLANA_NETWORK=   # devnet | mainnet-beta
NEXT_PUBLIC_SENTRY_DSN=
```

### Backend (Railway)
```
DATABASE_URL=                 # Supabase pooled connection string
DIRECT_URL=                   # Supabase direct (for migrations)
REDIS_URL=                    # Upstash
JWT_SECRET=
TXLINE_NETWORK=devnet         # devnet | mainnet
TXLINE_BASE_URL=https://devnet-api.txline.txodds.com
SENTRY_DSN=
CORS_ORIGIN=                  # frontend URL, explicit
```

## Deploy Steps
1. Push to GitHub → CI runs tests, typecheck, lint, build.
2. Vercel auto-deploys frontend (preview → promote to production).
3. Railway deploys backend from Dockerfile on main.
4. Run migrations against production: `npx prisma migrate deploy` (uses DIRECT_URL).
5. Smoke test: `/health`, wallet connect, one demo replay prediction.

## Rules
- Secrets only in platform env settings, never in git.
- Devnet → Mainnet switch is a single env change (`TXLINE_NETWORK`, `NEXT_PUBLIC_SOLANA_NETWORK`, base URLs).
- Always smoke-test in fresh incognito after every production deploy.
