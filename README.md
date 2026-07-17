# PULSE — World Cup Intuition Platform

> **Prove you can feel the game.** PULSE turns every FIFA World Cup 2026 match into a real-time intuition game where fans predict the **next 60 seconds** of live action — not the final score.

Built for the **World Cup Hackathon hosted by TxODDS**, competing in the **Consumer and Fan Experiences** track — powered end-to-end by **TxODDS TxLINE** live sports data on **Solana**.

---

## Legal

> This is a **free skill game for entertainment purposes only**. No real money is involved. This is **not gambling**. Success in this game does not guarantee success in real sports betting.

- Skill-based prediction game (like trivia) — virtual points only
- No wagers, no odds-taking, no financial contracts, no paid entry

---

## What is PULSE?

Fantasy is too slow. Betting is not for everyone. Dashboards are boring. PULSE creates a new category for the Consumer and Fan Experiences track: **moment-to-moment intuition validation**.

| Mode | What you do |
|---|---|
| **Live Pulse** | Watch a live match, feel a goal coming, tap **YES** — the next 60 seconds of real TxODDS TxLINE data decide if you were right |
| **Pulse Scratch** | Scratch a digital lottery-style card with your coin — each panel hides a prediction about the **next 2 minutes** of the match, generated from TxODDS TxLINE odds and validated against TxODDS TxLINE events |
| **Replay Mode** | No live match right now? Re-live recorded scenarios minute-by-minute and train your instinct |
| **Leaderboards** | Points leaderboard for predictors plus a separate accuracy leaderboard for scratchers |
| **Intuition Profile** | Your personal accuracy fingerprint: are you a Goal Whisperer or a Card Master? |

Everything is validated server-side against **real TxODDS TxLINE match data** — no self-reporting, no trust required.

---

## Powered by TxODDS TxLINE (deep integration)

TxODDS TxLINE is not a data garnish here — it is the engine of every game mechanic:

1. **Authentication** — the server opens a TxLINE guest session, then activates a real **on-chain Solana subscription** (Anchor `subscribe(serviceLevel, weeks)` transaction, TxL token ATA) and signs the activation payload with its wallet.
2. **Match discovery** — fixtures come from `/api/fixtures/snapshot` (World Cup + friendlies on devnet).
3. **Live state** — score snapshots (`/api/scores/snapshot/{fixtureId}`) drive the match clock, score, status and the event feed (goals / cards / corners derived from counter diffs).
4. **Prediction generation** — Pulse Scratch panels are weighted by **TxODDS StablePrice** consensus odds: the market's implied probability shapes what your card predicts.
5. **Resolution** — every prediction and every scratch panel is judged by comparing TxODDS TxLINE score counters at the start vs the end of its window. The data is the referee.
6. **Real-time push** — a TxLINE SSE bridge fans events out to clients over Socket.io.

TxLINE tokens **never reach the browser** — all TxODDS calls are proxied through the Fastify backend.

---

## Quick Start

### Prerequisites

- Node.js 20+
- A Solana devnet wallet for the server (auto-funded via faucet) — used for the TxODDS TxLINE on-chain subscription
- Upstash Redis URL (free tier is fine)

### 1. Install

```bash
git clone https://github.com/RobertSamuel-tech/Pulse-Worldcup.git
cd Pulse-Worldcup
cd server && npm install
cd ../frontend && npm install
```

### 2. Configure

```bash
cp .env.example .env   # repo root — fill in the values
```

Key variables (see `.env.example` for the full list):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL (local dev: `npx prisma dev` serves one automatically) |
| `REDIS_URL` | Upstash Redis TCP endpoint |
| `TXLINE_BASE_URL` | `https://txline-dev.txodds.com` (TxODDS devnet) |
| `TXLINE_WALLET_PATH` | Server keypair used for the on-chain TxLINE subscription |
| `JWT_SECRET` | Session token signing secret |

### 3. Database

```bash
cd server
npx prisma dev          # terminal 1: local Postgres (keep running)
npx prisma db push      # terminal 2: apply schema
npx prisma generate
```

### 4. Run

```bash
cd server && npm run dev      # Fastify API + Socket.io on :4000
cd frontend && npm run dev    # Next.js on :3000
```

Open **http://localhost:3000**

---

## How to Use

1. **Enter** — enjoy the golden-ball logo reveal, then hit **Connect Wallet** (Phantom / Backpack, Solana devnet). Sign one message — that's your whole account.
2. **Pick a match** — live matches pulse red at the top of the home screen.
3. **Predict** — feel something coming? Tap **YES – action!** (or **NO – calm**). A 60-second timer starts. Real TxODDS TxLINE data resolves it: goal = 3x points, red card = 2.5x, yellow = 2x, corner = 1.5x. Streaks stack bonuses.
4. **Scratch** — open the **Scratch** tab. Choose a tier:
   - **Common** (free, 6 panels, up to +500)
   - **Rare** (100 pts, 9 panels, up to +2,000)
   - **Legendary** (500 pts, 12 panels, up to +10,000)

   Rub each panel with your coin to reveal the card's predictions, **Lock In**, then watch 2 minutes of the real match decide your fate. Panel values are committed with SHA-256 hashes *before* you scratch — provably fair.
5. **Climb** — check the leaderboards, grow your streak, unlock achievements, and share your "I called it!" card to challenge friends.
6. **Replay** — between matches, open **Replay** and play historical scenarios at 1x/2x/4x speed. No sign-in needed.

Stadium background music plays on match and scratch screens (default on — toggle in Profile, Settings).

---

## Architecture

Full diagrams (system, auth, prediction lifecycle, scratch lifecycle, data model): **[HOW_IT_WORKS.md](./HOW_IT_WORKS.md)** — Deep-dive: **[ARCHITECTURE.md](./ARCHITECTURE.md)**

```
Next.js 16 (frontend) <-HTTP/Socket.io-> Fastify 5 (backend) <-HTTPS/SSE-> TxODDS TxLINE API
                                            |
                            PostgreSQL (Prisma 7) - Redis (Upstash) - Solana devnet
```

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), TypeScript, Tailwind, Zustand, Framer Motion, Solana wallet-adapter |
| Backend | Node 20, Fastify 5, Socket.io, Zod, JWT (15-min access + rotating 7-day refresh) |
| Data | PostgreSQL 16 + Prisma 7, Upstash Redis (cache + nonces), TxODDS TxLINE (source of truth) |
| Chain | Solana devnet — wallet sign-in, TxLINE subscription tx (Anchor), NFT badges (roadmap) |

---

## Real-World Impact

**For fans** — 5 billion people watch football; almost none have a legal, free way to *test* their game-reading skill in the moment. PULSE gives every fan — in every jurisdiction, at any age — a skill-based stake in every minute of a match, with zero financial risk. It converts passive watching into active engagement: exactly the goal of the Consumer and Fan Experiences track.

**For responsible gaming** — PULSE demonstrates that the dopamine loop of in-play engagement does not require money at risk. The scratch-card mechanic (a $70B+ industry built on chance) is reimagined here as a **skill + data** game: provably-fair commitments, transparent resolution against public sports data, and points that cost nothing.

**For the sports-data economy** — every prediction is a labeled datapoint of *fan intuition vs. market expectation vs. reality*. Aggregated, this is a brand-new data category ("crowd instinct") that complements TxODDS's market-derived signals — valuable to broadcasters (engagement overlays), rights-holders (second-screen products), and modellers.

**For web3 UX** — a wallet signature is the entire onboarding: no email, no password, no KYC. Chain complexity (subscriptions, tokens) stays server-side. This is a template for consumer apps that use Solana without ever saying "blockchain" to the user.

**Monetization path** — freemium analytics, sponsored "Pulse Moments", affiliate hand-off to regulated operators (where legal), and intuition-dataset licensing. CAC stays near zero because every shared "I called it!" card is an acquisition loop.

---

## Project Structure

```
|-- frontend/            # Next.js app (App Router)
|   `-- src/
|       |-- app/         # routes: / (matches), /match/[id], /scratch, /replay, /leaderboard, /profile, /login
|       |-- components/  # match, scratch, user, shared, ui
|       |-- lib/         # API clients (all TxODDS TxLINE data via backend proxy)
|       |-- stores/      # Zustand
|       `-- utils/       # scoring, share-image, audio engines
|-- server/              # Fastify API
|   `-- src/
|       |-- routes/      # auth, matches, predictions, scratch, leaderboard, user, demo, txline
|       |-- services/    # txline (TxODDS client), match, prediction, scratch, leaderboard, solana-subscription
|       |-- socket/      # Socket.io + TxLINE SSE bridge
|       `-- workers/     # resolution sweeper, leaderboard refresher
|-- prisma/              # schema (users, matches, predictions, scratch cards, demo scenarios)
|-- HOW_IT_WORKS.md      # full mermaid diagrams
`-- ARCHITECTURE.md      # design deep-dive
```

---

## Roadmap

- NFT achievement badges minted on Solana
- Head-to-head scratch duels (challenge a friend on the same card)
- TxODDS StablePrice-calibrated dynamic payout tables
- Multi-language support for World Cup 2026's global audience

---

## Author

**Robert Samuel** — [robertsamuel.27it@licet.ac.in](mailto:robertsamuel.27it@licet.ac.in)

Built solo for the World Cup Hackathon hosted by TxODDS — Consumer and Fan Experiences track.
