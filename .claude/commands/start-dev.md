# 🚀 Start Development Environment

Start the full PULSE development stack:

1. Check that `.env` files exist in root and `server/` (copy from `.env.example` if missing and warn me about unfilled values).
2. Ensure PostgreSQL and Redis are reachable (local Docker or Supabase/Upstash URLs from env).
3. Run `npx prisma generate` and apply any pending migrations (`npx prisma migrate dev`).
4. Start the Fastify backend (`server/`, port 4000) in the background.
5. Start the Next.js frontend (port 3000) in the background.
6. Confirm both respond: `GET http://localhost:4000/health` and `GET http://localhost:3000`.
7. Report the URLs and any startup warnings.

If anything fails, diagnose the root cause (missing env var, port in use, DB unreachable) and fix it before reporting done.
