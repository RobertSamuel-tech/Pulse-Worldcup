---
name: txline-api
description: TxLINE API expertise — auth flow, endpoints, streaming, error handling for the PULSE app
---

# TxLINE API Expertise

When working on anything touching TxLINE, apply this knowledge (full detail in TXLINE_INTEGRATION_GUIDE.md — always cross-check it):

## Auth (3 steps, in order)
1. `POST /auth/guest-session` → guest JWT (keep in memory only)
2. On-chain Solana subscription — Service Level **12** (World Cup Real-time, FREE). Devnet for dev.
3. `POST /auth/activate-token` (Bearer guest JWT) → API token for all data calls

## Endpoints
- `GET /scores/schedule` — 104 WC matches; filter `?status=`, `?date=`, `?stage=`
- `GET /scores/soccer/{matchId}` — snapshot: clock, score, team stats, events[]
- `GET /odds/stableprice/{matchId}` — consensus odds; implied prob = 100/decimalOdds
- `WS /stream/scores?token=...&matchId=...` — push: `event`, `clock_update`, `stat_update`, `status_change`
- `GET /validation/score-proof/{matchId}` — optional on-chain proof (bonus feature)

## Non-negotiable rules
- API tokens NEVER reach client-side code — all TxLINE calls go through our backend
- Cache snapshots with TTL 55s; poll max every 60s; WebSocket is primary for events
- Always exponential-backoff reconnect on WS (max 10 attempts, cap 30s)
- 429 → honor `retry-after`; 401 → re-run auth flow; wrong network base URL → 403
- Transform all raw payloads through `transformTxlineMatch()` — never pass raw TxLINE JSON to the UI
