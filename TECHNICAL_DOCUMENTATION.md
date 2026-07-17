# PULSE — Technical Documentation
## World Cup Hackathon hosted by TxODDS — Consumer and Fan Experiences track

**Live application:** https://pulse-worldcup.vercel.app
**Live API:** https://pulse-api-1eoa.onrender.com
**Repository:** https://github.com/RobertSamuel-tech/Pulse-Worldcup
**Author:** Robert Samuel (robertsamuel.27it@licet.ac.in)

---

## 1. Executive Summary

PULSE is a real-time intuition platform for the FIFA World Cup 2026. Instead of predicting final scores (slow) or wagering money (illegal in most jurisdictions, exclusionary everywhere), fans predict the **next 60 seconds** of a live match — and a second game mode, **Pulse Scratch**, turns the next **2 minutes** into a provably-fair digital scratch card whose panels are generated from TxODDS market odds and judged by TxODDS live data.

The core claim, and the reason this entry wins the Consumer and Fan Experiences track: **PULSE invents a new interaction category — moment-to-moment intuition validation — and TxODDS TxLINE data is structurally irreplaceable in it.** The data is not displayed next to the game; the data *is* the referee, the card printer, and the payout engine.

Everything described below is deployed, functional, and independently verifiable at the live URLs above.

---

## 2. The Problem and the Insight

| Existing product | Why it fails the in-stadium moment |
|---|---|
| Fantasy football | Season-long feedback loop; nothing to do during a match |
| Sports betting | Real money; age-gated; illegal or restricted in most of the world; excludes the majority of fans |
| Live-score apps | Passive consumption; zero skin in the game |
| Social media | Commentary after the moment, not anticipation before it |

The insight: the most intense fan experience is the **10 seconds before something happens** — the crowd rising before a corner, the collective breath before a counterattack. No product has ever captured, validated, or gamified that instinct. PULSE does, with a free, legal, skill-based loop that resolves in real time.

**Legal positioning (deliberate and load-bearing):** PULSE is a free skill game. No entry fees, no real-money prizes, no odds-taking from users, no financial contracts. Points are virtual and unpurchasable. This makes the product shippable worldwide on day one — including to minors and in betting-prohibited jurisdictions — which no wagering product can claim.

---

## 3. System Architecture

```
Browser (Next.js 16, App Router, Turbopack)
   |  HTTPS JSON (REST)            |  WebSocket (Socket.io)
   v                               v
Fastify 5 API (Node 20/24, TypeScript strict) ---- SSE ----> TxODDS TxLINE API
   |            |            |                                (fixtures, scores,
   v            v            v                                 StablePrice odds)
PostgreSQL   Upstash      Solana devnet
(Prisma 7)   Redis        (wallet auth, on-chain TxLINE subscription)
```

**Production topology (all free-tier, all live):**

| Component | Host | Detail |
|---|---|---|
| Frontend | Vercel | `pulse-worldcup.vercel.app`, production build, edge-served |
| Backend | Render (Docker) | `pulse-api-1eoa.onrender.com`, health-checked at `/health` |
| PostgreSQL | Railway | Prisma 7 schema, connection over TLS public endpoint |
| Redis | Upstash | Cache, auth nonces, rotating refresh tokens, TxLINE API token |
| Chain | Solana devnet | Wallet sign-in; server-side TxLINE subscription transaction |

Design rule enforced throughout: **TxODDS credentials never reach the browser.** Every TxLINE call is proxied through the backend; the frontend consumes normalized DTOs only.

### 3.1 Backend layering

- `routes/` — thin Fastify handlers: Zod validation, auth extraction, one service call, unified `{ success, data | error }` envelope.
- `services/` — all business logic: `txline.service` (TxODDS client with guest-JWT + API-token header pair), `match.service` (fixture/score normalization, event derivation, odds), `prediction.service` (60-second lifecycle), `scratch.service` (card lifecycle), `leaderboard.service`, `user.service`, `solana-subscription.service` (Anchor `subscribe` transaction + activation signature).
- `workers/` — a 3-second DB-poll resolution sweeper (deliberately chosen over a Bull queue: crash-safe because PostgreSQL is the source of truth, zero extra infrastructure, and every read path can also resolve on demand so the UI never waits on the sweeper).
- `socket/` — Socket.io attached to the Fastify HTTP server via a custom plugin (rooms `match:{id}` and `user:{id}`), plus a TxLINE SSE bridge fanning live rows out to match rooms.

### 3.2 Frontend structure

- App Router routes: `/` (match list), `/match/[id]` (live prediction screen), `/scratch` (Pulse Scratch), `/replay` + `/replay/[id]` (offline demo scenarios), `/leaderboard`, `/profile`, `/login`.
- State: four small Zustand stores (match, user, leaderboard, UI) — no server-state library needed because polling hooks own their caches.
- Every real-time surface has a **polling backstop**: if the WebSocket drops, the 60-second match poll and the 5-second resolution poll keep the game fully playable. Degradation is invisible, not catastrophic.

---

## 4. TxODDS TxLINE Integration (depth, not decoration)

This section is the heart of the submission. TxLINE is used at **six distinct integration points**, two of which (generation and resolution) make the data load-bearing for gameplay itself.

1. **Guest session + on-chain activation.** The server opens a TxLINE guest session (`POST /auth/guest/start`), then performs a real Solana devnet transaction against the txoracle Anchor program — `subscribe(serviceLevel, weeks)` with the TxL token ATA (Token-2022) — and signs `txSig:leagues:jwt` with its wallet for `POST /api/token/activate`. The resulting API token is cached in Redis and reused across restarts and hosts. Every data call carries **both** `Authorization: Bearer <jwt>` and `X-Api-Token`.
2. **Fixture discovery.** `/api/fixtures/snapshot` provides the match list (World Cup fixtures on devnet during the hackathon window, e.g. France–England, Spain–Argentina).
3. **Live match state.** `/api/scores/snapshot/{fixtureId}` rows drive score, status (full `statusSoccerId` code mapping: NS/H1/HT/H2/ET/PE/F variants), and the match clock.
4. **Event derivation.** PULSE reconstructs the event feed (goals, red/yellow cards, corners) by diffing cumulative TxLINE counters between consecutive score rows — no third-party event feed involved.
5. **Odds-weighted generation.** Scratch panels are generated using the market-implied activity level from TxODDS StablePrice consensus: a hot match produces cards that predict more action; a cold one produces calm-leaning cards. The market prints the ticket.
6. **Resolution as referee.** Every 60-second prediction and every scratch panel is judged by comparing TxLINE counters at window start vs window end (`countersAt(rows, t)`), with a strict dominance order (goal > red > yellow > corner) for scoring multipliers. No human input, no self-reporting — TxODDS data decides who was right.

**Failure honesty:** if TxLINE is unreachable at resolution time, the window is scored as calm rather than blocking user funds/points forever, and the failure is logged and Sentry-captured. Stale-data rules from the spec are enforced with a two-layer cache (below) so no client ever renders data older than its freshness contract.

---

## 5. Game Mechanics and Scoring Mathematics

### 5.1 Live micro-predictions (60-second windows)

- Binary call: "something happens" (goal/card/corner) vs "calm" in the next 60 seconds.
- One active prediction per user (DB-enforced), which is also the natural rate limiter.
- Points: `floor(100 × multiplier) + streakBonus`, with multipliers GOAL/PENALTY 3.0, RED 2.5, YELLOW 2.0, CORNER 1.5; streak bonuses +50/+100/+250/+500 at streaks 3/5/10/20.
- Wrong answers award nothing but **do not break the streak** — a deliberate retention decision (punishing streak loss measurably suppresses retry behavior; PULSE only ever rewards).

### 5.2 Pulse Scratch (the flagship)

A digital scratch card whose panels each hide a YES/NO prediction about the next 2 minutes.

| Tier | Cost | Panels | Top payout | Consolation |
|---|---|---|---|---|
| Common | free | 6 | +500 (6/6) | — |
| Rare | 100 pts | 9 | +2,000 (9/9) | 50 pts back below 6/9 |
| Legendary | 500 pts | 12 | +10,000 (12/12) | 250 pts back below 8/12 |

Panel catalogue (12 types, all resolvable purely from TxLINE counter diffs): GOAL, TWO_GOALS, YELLOW_CARD, TWO_YELLOWS, RED_CARD, ANY_CARD, CORNER, TWO_CORNERS, THREE_CORNERS, ANY_EVENT, TWO_PLUS_EVENTS, CALM. Baseline probabilities derive from per-90 soccer averages (≈2.7 goals, ≈3.8 yellows, ≈0.2 reds, ≈10 corners) scaled to 2-minute slices, then multiplied by the TxODDS market-implied activity factor.

**Lifecycle:** `ACTIVE` (scratching) → `LOCKED` (wager deducted atomically with a guarded decrement; 2-minute window starts; match minute recorded) → `RESOLVED` (judged, paid, streak updated) — plus `EXPIRED` for abandoned cards. Resolution is idempotent and race-safe: a conditional update (`WHERE status = 'LOCKED'`) means concurrent sweepers cannot double-pay.

### 5.3 Provable fairness protocol

The single most common attack on a scratch-card product is "the house switched the values." PULSE makes that cryptographically impossible:

1. At creation, every panel's value is decided server-side and stored.
2. The client receives **masked** panels plus `SHA-256(JSON(value) : cardSalt : panelNumber)` per panel — a commitment made *before* any scratch. (Panel number in the preimage prevents equal-valued panels from sharing a digest, which would itself leak information.)
3. Scratching triggers a server-side reveal per panel — values are never present in the client until physically scratched.
4. At resolution, the card's salt is disclosed in `resolutionDetails`, letting anyone recompute every hash and verify nothing changed after the fact.

### 5.4 The scratch interaction (why judges will remember it)

Custom HTML5 canvas per panel — no library: a metallic foil coating (tier-colored gradients, diagonal shine bands, grain, embossed lettering; the Legendary tier is an animated holographic shimmer) that the user scratches with a **coin cursor** (rendered at runtime from an emoji to a data-URI). Strokes are interpolated every 6px so fast swipes carve continuous grooves; holes are punched with radial-gradient falloff for torn-foil edges; the value is fetched on the first coin contact so content is genuinely visible *through* the holes; the coating dissolves only after ~85% is physically removed. Synthesized WebAudio sound (filtered noise "zzzip", reveal chime, win fanfare — zero audio-asset latency), haptic ticks on mobile, a stadium music bed with fade-in/out on game screens, and a keyboard/screen-reader path (SPACE reveals all; every panel is ARIA-labeled).

---

## 6. Security Model

| Surface | Control |
|---|---|
| Authentication | Wallet-signature login: single-use nonce (Redis `GETDEL`, 5-min TTL) → ed25519 verification (tweetnacl) → user upsert. No passwords, no email, nothing to phish. |
| Sessions | 15-minute access JWT + 7-day **rotating, single-use** refresh tokens (Redis-tracked; reuse of a rotated token revokes the family). Frontend refreshes silently with single-flight de-duplication. |
| TxODDS credentials | Server-side only, never shipped to the browser. |
| Input | Zod schemas on every route; unified error envelope; stack traces never leak (Sentry captures internally). |
| Abuse | Global 120 req/min rate limit with ban escalation + stricter per-route limits on hot endpoints; helmet headers; 1 MB body cap; CORS locked to the exact production origin. |
| Economy integrity | Guarded point decrements (`WHERE totalPoints >= cost`), transactional resolution, idempotency guards against racing resolvers — no negative balances, no double payouts. |
| Fairness | The commitment scheme in §5.3. |

---

## 7. Performance Engineering (measured, not aspirational)

- **Two-layer cache in front of TxODDS:** L1 in-process memo (5-second TTL — the spec's own staleness ceiling) collapsing concurrent requests, L2 Redis (55-second TTL) keeping TxLINE calls ≤1/minute. Measured effect in development: p50 API latency dropped from 250–300 ms (dominated by the geographic Upstash round trip) to **sub-millisecond** on warm paths.
- **Lighthouse 99–100** (Performance / Accessibility / Best Practices / SEO, desktop preset) on `/`, `/login`, and `/match/[id]` after optimization passes.
- **Bundle discipline:** the Solana wallet-adapter stack (~110 KB gzipped) is route-scoped to `/login` via the `(auth)` layout, so no other route ships a byte of it; a measured decision after an `next/dynamic` attempt regressed `/login` LCP to 3.2 s and was reverted.
- **Accessibility as engineering:** WCAG contrast failures found and fixed (3.75:1 → 6.96:1), `prefers-reduced-motion` honored in every animation including the splash and holographic shimmer, full keyboard path for the scratch mechanic.
- 60 fps scratch interaction: per-panel canvases, `getImageData` sampled every 8th stroke batch rather than per event, GPU-friendly transform/opacity animations only.

---

## 8. Data Model (PostgreSQL via Prisma 7)

Nine models. Key ones:

- `User` — wallet address (unique), points, current/best streak. Leaderboard index `(totalPoints, createdAt)`.
- `Match` — mirror of a TxODDS fixture (`txlineMatchId` unique) for FK integrity.
- `Prediction` — the 60-second call: predicted vs occurred, event type, points; indexes purpose-built for the active-check, history pagination, and the sweeper's overdue scan.
- `ScratchCard` / `ScratchPrediction` / `ScratchResult` — tier, status machine, wager/payout, per-card salt; per-panel type, committed value, hash, revealed flag, actual outcome; and the resolution record with full audit detail (counter diffs, payout math, disclosed salt).
- `DemoMatch` / `DemoEvent` — recorded replay scenarios, deliberately separate from live TxLINE data and clearly labeled in the UI (compliance with "TxLINE as primary input": replay mode is training/off-hours content, never presented as live).

---

## 9. Verification Evidence

All of the following were executed and passed, most recently against the **production** deployment:

1. **Automated E2E (scratch lifecycle):** synthetic wallet → nonce → sign → login → create Common card → confirmed values masked and all commitment hashes distinct → per-panel reveal isolation → lock-in → conflict on second card (409 SCRATCH_CONFLICT) → sweeper resolution → 6/6 correct paid exactly +500 with "First Scratch!" and "Perfect Card!" achievements → history and accuracy leaderboard consistent → Rare card deducted exactly 100 → fresh zero-point user correctly rejected from Legendary (INSUFFICIENT_POINTS).
2. **Crash-safety:** a locked card resolved correctly by the sweeper across a backend restart mid-window (DB-as-source-of-truth design proving itself).
3. **Production smoke:** CORS preflight from the exact Vercel origin, `/health`, live TxODDS fixture list (7 fixtures), full wallet-signature login E2E, both leaderboards — all green on the live URLs.
4. **Type safety:** `tsc --noEmit` clean on both packages (TypeScript strict, no `any`, `noUncheckedIndexedAccess`).
5. **Deployment hardening finds:** two real production-only bugs were caught and fixed during deploy (npm 10/11 lockfile drift → pinned node:24 image; Prisma 7 ESM output crashing a CommonJS `dist` → `moduleFormat = "cjs"`), each verified by running the compiled artifact locally before shipping.

---

## 10. Judging Criteria Mapping

| Criterion | How PULSE scores it |
|---|---|
| **Fan Accessibility & UX** | One-tap onboarding (a single wallet signature — no email, password, or KYC; crypto vocabulary never appears in the UI). Two taps from landing to predicting. Mobile-first neo-brutalist design, thumb-zone navigation, haptics, sound design, celebration animations, reduced-motion and screen-reader support. |
| **Real-Time Responsiveness** | 60-second data cadence with 55s/5s cache contract (stale data structurally impossible), Socket.io push with SSE bridge, polling backstops on every path, visual pulse on refresh, optimistic UI on predictions. |
| **Originality & Value Creation** | A new category (micro-moment intuition validation) plus the first-ever fusion of scratch-card mechanics with live sports data — odds-generated, event-resolved, cryptographically fair. Not a sweepstake, bot, or hi-lo clone; no example idea from the brief was reused. |
| **Commercial Viability** | Freemium analytics, sponsored moments, affiliate hand-off to regulated operators where legal, and a genuinely novel data asset: labeled fan-intuition-vs-market-vs-reality streams that complement TxODDS's own products. Viral loop built in (shareable "I called it!" result cards). |
| **Completeness & Execution** | Live production deployment across four services, two full game modes plus replay, leaderboards, profiles, achievements, share images, error/loading/empty states everywhere, measured performance, documented architecture (README, HOW_IT_WORKS diagrams, ARCHITECTURE deep-dive). |

---

## 11. Honest Limitations and Roadmap

Stated plainly, because judges respect honesty more than gloss:

- **Free-tier cold starts:** the Render backend sleeps after idle (~50 s first wake). Mitigation: warm before demos; trivially removed by any paid tier.
- **Odds refinement:** StablePrice consensus currently feeds a scalar activity factor; per-market in-running totals will calibrate per-panel probabilities and dynamic payouts (roadmap).
- **Devnet fixture pool:** gameplay is verified against the TxODDS devnet fixture set; mainnet service level 12 is a config change (`TXLINE_NETWORK`, service level), not a code change.
- **Roadmap:** Solana NFT achievement badges, head-to-head scratch duels on identical cards, StablePrice-calibrated payout tables, localization for the 2026 global audience.

---

## 12. Reproduction Guide (for judges)

1. Open **https://pulse-worldcup.vercel.app** (first load may take ~50 s if the free-tier API is cold — refresh once).
2. Connect a Solana devnet wallet (Phantom/Backpack) and approve one message signature.
3. Home: pick a fixture; on the match screen make a YES/NO call and watch the 60-second resolution.
4. Scratch tab: take the free Common card — scratch the foil with the coin cursor, lock in, wait out the 2-minute countdown, and inspect the results modal: every panel shows your prediction vs what TxODDS TxLINE recorded, and the resolution details disclose the fairness salt.
5. Verify the API directly: `GET https://pulse-api-1eoa.onrender.com/health` and `GET /api/matches`.
6. Local run: see README §Quick Start (clone → `.env` from example → `prisma dev` + `db push` → two `npm run dev`s).

---

*This document is the submission-facing technical companion to the repository's README.md, HOW_IT_WORKS.md (full mermaid diagram set), and ARCHITECTURE.md.*
