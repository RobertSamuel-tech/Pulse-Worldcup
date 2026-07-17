# 🏗️ PULSE System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     USER'S BROWSER                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Next.js App   │  │  Wallet Adapter │  │ Socket.io    │ │
│  │  (React + TSX)  │  │  (Solana)       │  │ Client       │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
│           │ HTTPS/WSS          │                  │ WSS     │
└───────────┼────────────────────┼──────────────────┼─────────┘
            ▼                    ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │   Vercel     │  │   Railway    │  │    Supabase        │ │
│  │  (Edge CDN)  │  │  (Backend)   │  │  (PostgreSQL)      │ │
│  └──────────────┘  └──────┬───────┘  └────────────────────┘ │
│                    ┌──────┴───────┐                         │
│                    │  Fastify     │                         │
│                    │  Server      │                         │
│                    └──┬───┬───┬───┘                         │
│           ┌───────────┘   │   └───────────┐                 │
│           ▼               ▼               ▼                 │
│    ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│    │  REST API  │  │ Socket.io  │  │   Bull     │           │
│    │  Routes    │  │ Server     │  │   Queue    │           │
│    └─────┬──────┘  └─────┬──────┘  └─────┬──────┘           │
└──────────┼───────────────┼───────────────┼──────────────────┘
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │   Redis    │  │   TxLINE   │  │   Solana   │
    │   Cache    │  │    API     │  │ Blockchain │
    └────────────┘  └────────────┘  └────────────┘
```

## Component Details

### 1. Frontend Application (Next.js 14)

#### Directory Structure:
```
src/app/
├── (auth)/
│   └── login/
│       └── page.tsx              # Wallet connection screen
├── (main)/
│   ├── layout.tsx                # Main layout with navigation
│   ├── page.tsx                  # Home / Match selection
│   ├── match/
│   │   └── [id]/
│   │       └── page.tsx          # Live prediction screen
│   ├── profile/
│   │   └── page.tsx              # User profile + intuition stats
│   ├── leaderboard/
│   │   └── page.tsx              # Global leaderboard
│   └── replay/
│       └── page.tsx              # Demo replay mode
├── api/
│   ├── txline/
│   │   ├── auth/route.ts         # Proxy TxLINE auth
│   │   ├── matches/route.ts      # Fetch match schedule
│   │   └── [matchId]/
│   │       └── route.ts          # Fetch match data
│   └── predictions/
│       └── route.ts              # Submit/resolve predictions
└── globals.css                   # Tailwind imports + custom styles
```

#### Key Components:
```
src/components/
├── ui/                           # Base UI primitives
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Modal.tsx
│   ├── Toast.tsx
│   ├── Timer.tsx                 # 60-second countdown
│   └── LoadingSpinner.tsx
├── match/                        # Match-specific components
│   ├── MatchCard.tsx             # Match listing card
│   ├── LiveScore.tsx             # Score display
│   ├── MatchClock.tsx            # Synchronized clock
│   ├── PredictionButtons.tsx     # YES/NO buttons
│   ├── EventFeed.tsx             # Live event timeline
│   └── OddsDisplay.tsx           # Consensus odds
├── user/                         # User-specific components
│   ├── UserProfile.tsx
│   ├── StreakCounter.tsx
│   ├── PointsDisplay.tsx
│   ├── IntuitionProfile.tsx      # Accuracy breakdown chart
│   └── BadgeCollection.tsx
├── leaderboard/
│   ├── LeaderboardTable.tsx
│   └── RankBadge.tsx
└── shared/
    ├── ConfettiEffect.tsx
    ├── ShareButton.tsx
    └── ErrorBoundary.tsx
```

#### State Management (Zustand):
```typescript
// src/stores/useMatchStore.ts
interface MatchState {
  currentMatch: Match | null;
  isLive: boolean;
  matchClock: number;
  currentPrediction: Prediction | null;
  timeRemaining: number;
  recentEvents: Event[];

  // Actions
  setCurrentMatch: (match: Match) => void;
  makePrediction: (action: boolean) => void;
  resolvePrediction: (result: ResolutionResult) => void;
  updateClock: (time: number) => void;
  addEvent: (event: Event) => void;
}

// src/stores/useUserStore.ts
interface UserState {
  user: User | null;
  isConnected: boolean;
  streak: number;
  bestStreak: number;
  totalPoints: number;
  todayPredictions: number;

  // Actions
  setUser: (user: User) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
  addPoints: (points: number) => void;
}
```

### 2. Backend Server (Fastify)

#### Directory Structure:
```
server/
├── src/
│   ├── index.ts                  # Server entry point
│   ├── app.ts                    # Fastify app configuration
│   ├── config/
│   │   ├── index.ts              # Environment config
│   │   ├── database.ts           # Prisma client
│   │   └── redis.ts              # Redis client
│   ├── routes/
│   │   ├── health.route.ts       # Health check
│   │   ├── auth.route.ts         # Authentication
│   │   ├── matches.route.ts      # Match data proxy
│   │   ├── predictions.route.ts  # CRUD operations
│   │   └── leaderboard.route.ts  # Rankings
│   ├── services/
│   │   ├── txline.service.ts     # TxLINE API integration
│   │   ├── prediction.service.ts # Business logic
│   │   ├── leaderboard.service.ts # Ranking calculations
│   │   └── user.service.ts       # User management
│   ├── socket/
│   │   ├── index.ts              # Socket.io setup
│   │   ├── handlers/
│   │   │   ├── match.handler.ts  # Match event broadcasting
│   │   │   └── prediction.handler.ts # Real-time updates
│   │   └── middleware/
│   │       └── auth.middleware.ts # Socket authentication
│   ├── workers/
│   │   ├── prediction.worker.ts  # Resolve pending predictions
│   │   ├── leaderboard.worker.ts # Refresh cache
│   │   └── cleanup.worker.ts     # Cleanup old data
│   └── utils/
│       ├── logger.ts             # Structured logging
│       ├── errors.ts             # Custom error classes
│       └── validators.ts         # Zod schemas
├── prisma/
│   └── schema.prisma             # Database schema
└── tests/
    ├── integration/
    └── unit/
```

#### Key Services:

##### TxLINE Service (Core Integration):
```typescript
// server/src/services/txline.service.ts
class TxLineService {
  private baseUrl: string;
  private guestJwt: string;
  private apiToken: string;

  async authenticate(): Promise<void> {
    // Step 1: Start guest session
    const response = await fetch(`${this.baseUrl}/auth/guest-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const { jwt } = await response.json();
    this.guestJwt = jwt;

    // Step 2: Activate subscription (free World Cup tier)
    // ... subscription logic
  }

  async getMatchSchedule(): Promise<Match[]> {
    const response = await fetch(`${this.baseUrl}/scores/schedule`, {
      headers: { 'Authorization': `Bearer ${this.apiToken}` }
    });
    return response.json();
  }

  async getLiveMatch(matchId: string): Promise<MatchSnapshot> {
    const response = await fetch(`${this.baseUrl}/scores/soccer/${matchId}`, {
      headers: { 'Authorization': `Bearer ${this.apiToken}` }
    });
    return response.json();
  }

  async getOdds(matchId: string): Promise<OddsSnapshot> {
    const response = await fetch(`${this.baseUrl}/odds/stableprice/${matchId}`, {
      headers: { 'Authorization': `Bearer ${this.apiToken}` }
    });
    return response.json();
  }

  // WebSocket connection for real-time events
  connectStream(matchId: string): EventEmitter {
    const socket = new WebSocket(
      `${this.wsBase}/stream/scores?token=${this.apiToken}`
    );
    // ... event handling
  }
}
```

##### Prediction Service (Business Logic):
```typescript
// server/src/services/prediction.service.ts
class PredictionService {
  async createPrediction(
    userId: string,
    matchId: string,
    predictedAction: boolean,
    matchMinute: number
  ): Promise<Prediction> {
    // Validate user can predict (not already in progress)
    // Create prediction record
    // Set expiration timer (60 seconds from now)
    // Emit to socket room for real-time tracking
  }

  async resolvePrediction(
    predictionId: string,
    eventData: MatchEvent
  ): Promise<ResolutionResult> {
    // Check if event occurred within prediction window
    // Calculate points earned
    // Update user streak
    // Update leaderboard cache
    // Emit result to user via socket
    // Trigger achievement check
  }

  calculatePoints(
    predictedAction: boolean,
    eventOccurred: boolean,
    eventType: EventType
  ): number {
    const basePoints = 100;
    const eventMultiplier = {
      goal: 3.0,      // Goals are hardest to predict
      card: 2.0,      // Cards are medium difficulty
      corner: 1.5,    // Corners are easier
      none: 1.0       // Correctly predicting calm period
    };

    if (predictedAction === eventOccurred) {
      return Math.floor(basePoints * eventMultiplier[eventType]);
    }
    return 0; // Wrong prediction = 0 points (but don't break streak)
  }
}
```

### 3. Database Schema (PostgreSQL + Prisma)

See `prisma/schema.prisma` for the authoritative schema (User, Match, Prediction, MatchEvent, Achievement models + MatchStatus/EventType enums).

### 4. Real-Time Data Flow:

```
┌─────────────┐     1. Connect      ┌─────────────┐
│   Client    │ ──────────────────► │  Socket.io  │
│  (Browser)  │ ◄────────────────── │   Server    │
└─────────────┘     2. Events       └──────┬──────┘
                                           │
                                    3. Subscribe to match
                                           │
                    ┌─────────────┐  ┌─────┴───────┐
                    │   TxLINE    │  │  Database   │
                    │  WebSocket  │  │ (PostgreSQL)│
                    └──────┬──────┘  └──────┬──────┘
                           │ 4. Push events │ 5. Persist
                           ▼                ▼
                    ┌─────────────────────────────┐
                    │     Prediction Engine       │
                    │  - Resolve active predictions│
                    │  - Calculate points         │
                    │  - Update leaderboards      │
                    │  - Check achievements       │
                    └─────────────┬───────────────┘
                                  │ 6. Broadcast results
                                  ▼
                           ┌─────────────┐
                           │   Client    │
                           │ (Update UI) │
                           └─────────────┘
```

### 5. Caching Strategy (Redis):

```typescript
// Cache keys pattern
const CACHE_KEYS = {
  // Match data (TTL: 55 seconds, refresh every 60s)
  match: (matchId: string) => `match:${matchId}`,
  matchList: 'matches:live',

  // Leaderboards (TTL: 60 seconds)
  leaderboard: 'leaderboard:global',
  leaderboardFriends: (userId: string) => `leaderboard:friends:${userId}`,

  // User stats (TTL: 5 minutes)
  userStats: (userId: string) => `user:${userId}:stats`,
  userStreak: (userId: string) => `user:${userId}:streak`,

  // TxLINE rate limiting (TTL: 60 seconds)
  rateLimit: (endpoint: string) => `ratelimit:${endpoint}`,
};

// Cache invalidation strategy
const INVALIDATION_TRIGGERS = {
  newPrediction: ['userStats', 'userStreak'],
  resolvedPrediction: [
    'leaderboard',
    'leaderboardFriends',
    'userStats',
    'userStreak'
  ],
  newEvent: ['match'],
  matchEnd: ['match', 'leaderboard', 'userStats'],
};
```

---

## Security Model

### Authentication Flow:
```
1. User connects Solana wallet (Phantom/Backpack)
2. Sign message challenge (nonce from backend)
3. Verify signature on backend
4. Issue JWT session token (15-minute expiry)
5. Refresh token (7-day expiry, rotated on use)
6. All subsequent requests use Bearer token
```

### Authorization Levels:
```
PUBLIC:
  - View match listings
  - View public leaderboards
  - Read documentation

AUTHENTICATED:
  - Make predictions
  - View personal stats
  - Earn achievements

ADMIN (future):
  - Manage matches
  - View analytics
  - Moderate content
```

### Rate Limiting:
```
Endpoint                Limit        Window
-------------------------------------------
POST /predictions       1/min        60s (one per match cycle)
GET /matches            30/min       60s
GET /leaderboard        60/min       60s
POST /auth/login        5/min        60s
All other endpoints     120/min      60s
```

---

## Performance Targets

### Frontend Metrics:
| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | <1.5s | Lighthouse |
| Largest Contentful Paint | <2.5s | Lighthouse |
| Time to Interactive | <3.0s | Lighthouse |
| Cumulative Layout Shift | <0.1 | Lighthouse |
| Bundle Size (initial) | <200KB | webpack-bundle-analyzer |

### Backend Metrics:
| Metric | Target | Tool |
|--------|--------|------|
| API Response Time (p50) | <100ms | Datadog |
| API Response Time (p99) | <500ms | Datadog |
| Error Rate | <0.1% | Sentry |
| Uptime | 99.9% | Pingdom |
| WebSocket Latency | <50ms | Custom monitoring |

### Database Metrics:
| Metric | Target | Tool |
|--------|--------|------|
| Query Time (p95) | <50ms | pg_stat_statements |
| Connection Pool Usage | <80% | PgBouncer metrics |
| Cache Hit Rate | >90% | Redis INFO |

---

## Deployment Architecture

### Environments:
```
Development (Local):
  - Next.js dev server :3000
  - Fastify dev server :4000
  - PostgreSQL :5432 (Docker)
  - Redis :6379 (Docker)

Staging (Cloud):
  - Vercel Preview Deployments
  - Railway staging instance
  - Supabase staging database
  - Upstash staging Redis

Production (Cloud):
  - Vercel Edge Network (global CDN)
  - Railway (2 instances, auto-scaling)
  - Supabase Pro (automatic backups)
  - Upstash Pro (global replication)
  - Cloudflare DNS + SSL
```

### CI/CD Pipeline:
```
Git Push → GitHub Actions
  ├→ Run Tests (unit + integration)
  ├→ Type Checking (TypeScript strict)
  ├→ Linting (ESLint + Prettier)
  ├→ Build (Next.js + Fastify)
  ├→ Security Audit (npm audit + Snyk)
  ├→ Docker Build & Push to GHCR
  └→ Deploy to Staging (auto)
       └→ Manual approval → Deploy to Production
```

---

## Monitoring & Observability

### Logging (Structured JSON):
```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: 'frontend' | 'backend' | 'worker';
  requestId: string; // Correlation ID
  userId?: string;
  walletAddress?: string;
  action: string;
  duration_ms?: number;
  error?: {
    message: string;
    stack: string;
    code: string;
  };
  metadata: Record<string, any>;
}
```

### Alerts (PagerDuty/Slack):
```
CRITICAL (page immediately):
  - Down detection (uptime check failure)
  - Error rate >5%
  - Authentication system down
  - Database connection failure

WARNING (Slack notification):
  - Error rate >1%
  - Response time p99 >2s
  - Cache hit rate <70%
  - Disk usage >80%

INFO (daily digest):
  - Active users count
  - Predictions per hour
  - Leaderboard changes
  - TxLINE API latency
```

---

This architecture is designed to be:
✅ Scalable (handle 10K concurrent users)
✅ Performant (<100ms p50 response times)
✅ Reliable (99.9% uptime target)
✅ Secure (enterprise-grade auth + encryption)
✅ Maintainable (clean code, good tests)
✅ Cost-effective (<$100/month at scale)

Build it exactly as specified. No shortcuts. No compromises.

