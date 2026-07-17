---
name: realtime-data
description: Real-time data handling expertise — WebSocket architecture, clock sync, caching, prediction resolution
---

# Real-Time Data Expertise

Target: judges score Real-Time Responsiveness 20/20. End-to-end event latency <200ms.

## Data flow
TxLINE WS → Fastify → Socket.io rooms (per match) → Zustand store → components.
Polling (`GET /scores/soccer/{id}` every 60s) is the fallback, never the primary path.

## Clock synchronization (interpolate, don't jump)
- Server clock updates arrive every second via WS
- Between updates, interpolate locally with `requestAnimationFrame`
- If no update for >3s, freeze the clock (never guess ahead)
- Handle stoppage time (+45:00) and period transitions (1H/HT/2H/FT)

## Prediction resolution (the core loop)
- Prediction window = exactly 60s from creation timestamp
- Resolve on: (a) matching event arriving within window → immediately; (b) window expiry with no event → Bull delayed job
- Guard against double resolution (idempotent, check `resolved` flag inside a transaction)
- Emit result to the user's socket the moment it resolves

## Caching (Redis)
- Match snapshots TTL 55s; leaderboard TTL 60s; user stats TTL 5 min
- Invalidate on: resolvedPrediction → leaderboard + userStats + userStreak; newEvent → match
- Fall back to Postgres if Redis is down — degrade, don't crash

## UI aliveness rules
- Pulse-glow animation on every data refresh
- Connection status indicator always visible (connected/reconnecting/offline)
- "Last updated Xs ago" when data could be stale; >5s stale = error state
- Optimistic updates for user actions; reconcile on server confirmation
- Pause timers/animations when tab hidden (Page Visibility API)
