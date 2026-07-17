# TxLINE Endpoint Reference (Quick Table)

Full details: ../TXLINE_INTEGRATION_GUIDE.md

| Endpoint | Method | Auth | Purpose | Cadence |
|----------|--------|------|---------|---------|
| `/auth/guest-session` | POST | none | Get guest JWT | Once per session |
| `/auth/activate-token` | POST | guest JWT | Get API token (after on-chain sub) | Once per session |
| `/scores/schedule` | GET | API token | All 104 WC matches | Cache 5 min |
| `/scores/soccer/{matchId}` | GET | API token | Live snapshot (clock/score/stats/events) | Poll 60s, cache 55s |
| `/odds/stableprice/{matchId}` | GET | API token | Consensus odds (250+ books) | Poll 60s |
| `/stream/scores` | WS | API token | Push: event / clock_update / stat_update / status_change | Persistent |
| `/validation/score-proof/{matchId}` | GET | API token | On-chain data proof (optional) | On demand |

Base URLs: devnet `https://devnet-api.txline.txodds.com`, mainnet `https://api.txline.txodds.com`.

# PULSE Backend API (our Fastify server)

| Endpoint | Method | Auth | Rate limit |
|----------|--------|------|------------|
| `/health` | GET | public | — |
| `/api/auth/nonce` | GET | public | 5/min |
| `/api/auth/login` | POST | signature | 5/min |
| `/api/matches?status=` | GET | public | 30/min |
| `/api/matches/:id` | GET | public | 30/min |
| `/api/predictions` | POST | JWT | 1/min |
| `/api/predictions/history` | GET | JWT | 60/min |
| `/api/leaderboard?scope=global&limit=100` | GET | public | 60/min |
| `/api/users/me` | GET/PATCH | JWT | 60/min |
