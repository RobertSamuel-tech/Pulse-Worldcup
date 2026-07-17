# 🔬 How PULSE Works — Full System Diagrams

Every diagram below reflects the actual implementation. Data source of truth everywhere: **TxODDS TxLINE**.

---

## 1. System Architecture

```mermaid
flowchart LR
    subgraph Client["📱 Browser (Next.js 16)"]
        UI[React UI<br/>Tailwind + Framer Motion]
        Z[Zustand stores]
        WA[Solana Wallet Adapter<br/>Phantom / Backpack]
        SIO_C[Socket.io client]
        AUD[Audio engines<br/>WebAudio SFX + music]
        UI <--> Z
        UI --> WA
        UI --> AUD
    end

    subgraph Server["🖥️ Backend (Fastify 5 · Node 20)"]
        API[REST routes<br/>auth · matches · predictions · scratch · leaderboard]
        SVC[Services<br/>match · prediction · scratch · leaderboard]
        TXS[TxLINE service<br/>TxODDS API client]
        SUB[Solana subscription service<br/>on-chain subscribe tx]
        SIO_S[Socket.io server]
        BRIDGE[TxLINE SSE bridge]
        SWEEP[Resolution sweeper<br/>3s DB poll]
        API --> SVC
        SVC --> TXS
        SWEEP --> SVC
        BRIDGE --> SIO_S
        TXS --> SUB
    end

    subgraph Data["💾 Data layer"]
        PG[(PostgreSQL 16<br/>Prisma 7)]
        RD[(Upstash Redis<br/>cache · nonces · tokens)]
    end

    subgraph External["🌐 External"]
        TX[TxODDS TxLINE API<br/>fixtures · scores · StablePrice odds · SSE]
        SOL[Solana devnet<br/>wallet auth · TxL subscription]
    end

    UI -- HTTPS JSON --> API
    SIO_C <-- WebSocket --> SIO_S
    SVC --> PG
    SVC --> RD
    TXS -- "Bearer JWT + X-Api-Token" --> TX
    BRIDGE -- SSE stream --> TX
    SUB --> SOL
    WA -- signMessage --> SOL
```

---

## 2. Wallet Sign-In (passwordless, no email)

```mermaid
sequenceDiagram
    autonumber
    participant U as Fan
    participant F as Frontend
    participant W as Solana Wallet
    participant B as Backend
    participant R as Redis
    participant DB as PostgreSQL

    U->>F: Connect Wallet
    F->>B: GET /api/auth/nonce?walletAddress
    B->>R: SET auth:nonce:{wallet} (TTL 5min, single-use)
    B-->>F: { nonce }
    F->>W: signMessage("PULSE wants you to sign in…")
    W-->>F: ed25519 signature
    F->>B: POST /api/auth/login { wallet, signature, nonce }
    B->>R: GETDEL nonce (replay-proof)
    B->>B: nacl.verify(signature, wallet pubkey)
    B->>DB: upsert User
    B-->>F: access token (15 min) + rotating refresh token (7 days)
    F->>F: store session → user is in
```

---

## 3. TxODDS TxLINE Activation (server-side, on-chain)

```mermaid
sequenceDiagram
    autonumber
    participant B as Backend
    participant TX as TxODDS TxLINE API
    participant S as Solana devnet
    participant R as Redis

    B->>TX: POST /auth/guest/start
    TX-->>B: guest JWT (30-day)
    B->>S: Anchor subscribe(serviceLevel, weeks)<br/>TxL token ATA (Token-2022)
    S-->>B: transaction signature
    B->>B: nacl sign "txSig:leagues:jwt" with server wallet
    B->>TX: POST /api/token/activate { txSig, signature }
    TX-->>B: API token
    B->>R: cache txline:api_token (reused across restarts)
    Note over B,TX: All data calls then send BOTH<br/>Authorization: Bearer JWT + X-Api-Token
```

---

## 4. Live Micro-Prediction Lifecycle (60-second windows)

```mermaid
sequenceDiagram
    autonumber
    participant U as Fan
    participant F as Frontend
    participant B as Backend
    participant TX as TxODDS TxLINE
    participant DB as PostgreSQL

    U->>F: taps YES ("something is coming!")
    F->>B: POST /api/predictions { matchId, predictedAction }
    B->>TX: match snapshot (is it live? current minute?)
    B->>DB: create Prediction (resolveAt = now + 60s)
    B-->>F: prediction active + countdown starts

    loop every 3s (sweeper) or on-demand poll
        B->>DB: find overdue predictions
        B->>TX: score counters at window start vs end
        B->>B: dominant event? goal > red > yellow > corner > none
        B->>DB: resolve + points (goal 3× · red 2.5× · yellow 2× · corner 1.5×)<br/>+ streak bonus (3/5/10/20 → +50/100/250/500)
        B-->>F: Socket.io "prediction-result" + stats update
    end
    F->>U: 🎉 confetti (correct) / gentle fade (wrong — streak survives)
```

---

## 5. 🎴 Pulse Scratch Lifecycle

### State machine

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: create card<br/>(panels generated from TxODDS StablePrice odds,<br/>values hidden + SHA-256 committed)
    ACTIVE --> ACTIVE: scratch panel →<br/>server-side reveal through the holes
    ACTIVE --> LOCKED: lock in<br/>(wager deducted · 2-min window starts)
    ACTIVE --> EXPIRED: abandoned 10 min
    LOCKED --> RESOLVED: window closes →<br/>judged vs TxODDS TxLINE counter diffs
    RESOLVED --> [*]: payout + streak + achievements
```

### Full flow

```mermaid
sequenceDiagram
    autonumber
    participant U as Fan
    participant F as Frontend (canvas scratch)
    participant B as Backend
    participant TX as TxODDS TxLINE
    participant DB as PostgreSQL

    U->>F: pick match + tier (Common/Rare/Legendary)
    F->>B: POST /api/scratch/create
    B->>TX: StablePrice odds → implied activity
    B->>B: weight each panel's YES probability by the market
    B->>DB: store panels + SHA-256(value:salt:panel) commitments
    B-->>F: MASKED panels + hashes (provably fair)

    U->>F: 🪙 rubs a panel (holes reveal content)
    F->>B: POST /api/scratch/reveal { panelNumbers }
    B->>DB: mark revealed
    B-->>F: that panel's prediction (YES/NO)

    U->>F: ✓ Lock In
    F->>B: POST /api/scratch/lock-in
    B->>DB: deduct wager (guarded) · status LOCKED · resolveAt = now + 2min
    B-->>F: countdown starts

    Note over B,TX: 2 minutes of real match action…

    B->>TX: counters at lockedAt vs resolveAt
    B->>B: judge all panels · tier payout table · consolation refund
    B->>DB: RESOLVED + ScratchResult + user points/streak
    B-->>F: results modal → per-panel ✅/❌ vs reality + share card
```

### Payout tables

```mermaid
flowchart TD
    subgraph Common["COMMON — free · 6 panels"]
        C6["6/6 → +500"] ~~~ C5["5/6 → +300"] ~~~ C4["4/6 → +150"] ~~~ C3["3/6 → +50"]
    end
    subgraph Rare["RARE — 100 pts · 9 panels"]
        R9["9/9 → +2000"] ~~~ R7["7/9 → +500"] ~~~ R4["4/9 → +50"] ~~~ RB["below 6/9 → 50 pts back"]
    end
    subgraph Legendary["LEGENDARY — 500 pts · 12 panels"]
        L12["12/12 → +10000"] ~~~ L10["10/12 → +2000"] ~~~ L8["8/12 → +500"] ~~~ LB["below 8/12 → 250 pts back"]
    end
```

---

## 6. Real-Time Data Flow

```mermaid
flowchart TD
    TX[TxODDS TxLINE] -->|SSE /api/scores/stream| BRIDGE[SSE bridge]
    TX -->|snapshot poll ≤1/min| MS[Match service]
    MS --> L1[L1 in-process cache · 5s TTL]
    L1 --> L2[L2 Redis cache · 55s TTL]
    BRIDGE --> SIO[Socket.io rooms<br/>match:id · user:id]
    SIO -->|match-event · clock-update| C1[📱 clients in match room]
    SWEEP[Sweeper · 3s] -->|prediction-result · scratch-result<br/>user-stats-update| SIO
    L2 --> API[REST /api/matches] --> C2[📱 60s polling fallback]
```

> The client never depends on the socket alone — polling backstops every real-time path, so a dropped WebSocket degrades gracefully instead of breaking the game.

---

## 7. Data Model

```mermaid
erDiagram
    USER ||--o{ PREDICTION : makes
    USER ||--o{ SCRATCH_CARD : scratches
    USER ||--o{ ACHIEVEMENT : earns
    MATCH ||--o{ PREDICTION : hosts
    MATCH ||--o{ SCRATCH_CARD : hosts
    MATCH ||--o{ MATCH_EVENT : records
    SCRATCH_CARD ||--|{ SCRATCH_PREDICTION : "has panels"
    SCRATCH_CARD ||--o| SCRATCH_RESULT : "resolves to"
    DEMO_MATCH ||--o{ DEMO_EVENT : replays

    USER {
        string walletAddress UK
        int totalPoints
        int currentStreak
        int bestStreak
    }
    MATCH {
        string txlineMatchId UK "TxODDS fixture id"
        string status
        int homeScore
        int awayScore
    }
    PREDICTION {
        boolean predictedAction
        boolean wasCorrect
        string eventType
        int pointsEarned
    }
    SCRATCH_CARD {
        enum tier "COMMON | RARE | LEGENDARY"
        enum status "ACTIVE | LOCKED | RESOLVED | EXPIRED"
        string revealSalt "fairness commitment"
        int pointsWagered
        int pointsEarned
    }
    SCRATCH_PREDICTION {
        string panelType "GOAL · CARD · CORNER · CALM …"
        json predictedValue
        string valueHash "SHA-256 commitment"
        boolean isCorrect
    }
    SCRATCH_RESULT {
        int correctPredictions
        float accuracy
        json resolutionDetails "diffs + disclosed salt"
    }
```

---

## 8. Security Model (quick reference)

```mermaid
flowchart LR
    A[Wallet signature auth<br/>single-use Redis nonce] --> S((Server))
    B[15-min access JWT +<br/>rotating single-use refresh] --> S
    C[TxODDS tokens server-only<br/>never in the browser] --> S
    D[Scratch fairness:<br/>SHA-256 value:salt:panel commitments,<br/>salt disclosed at resolution] --> S
    E[Zod validation · rate limits<br/>helmet · 1MB body cap] --> S
    F[Guarded point decrements<br/>race-safe resolution transactions] --> S
```
