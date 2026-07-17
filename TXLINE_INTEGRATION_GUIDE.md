# 🔌 TxLINE API Integration Guide

## Overview

TxLINE is a high-performance data layer providing real-time sports data and consensus betting odds. It features a single, normalized JSON schema across all competitions.

**Official Documentation:** https://txline-docs.txodds.com/documentation/quickstart

**API Base URLs:**
```
Mainnet:   https://api.txline.txodds.com
Devnet:    https://devnet-api.txline.txodds.com
WebSocket: wss://api.txline.txodds.com/stream (mainnet)
WebSocket: wss://devnet-api.txline.txodds.com/stream (devnet)
```

---

## Authentication Flow

### 1. Start Guest Session

**Endpoint:** `POST /auth/guest-session`

```typescript
const response = await fetch(`${TXLINE_BASE_URL}/auth/guest-session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
const { jwt } = await response.json();
// Returns: { jwt: "eyJhbGciOiJIUzI1NiIs...", expiresAt: "..." }
```

- Store JWT in memory (not localStorage for security)
- Use for subsequent API calls; refresh before expiration

### 2. Activate On-Chain Subscription (Free World Cup Tier)

**Service Level Options:**
- **Level 1:** World Cup & International Friendlies — 60-second delay — **FREE**
- **Level 12:** World Cup & International Friendlies — **Real-time** — **FREE** ← use this

```typescript
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

// Program IDs (check official docs for latest)
const TXLINE_PROGRAM_ID_DEVNET = new PublicKey('YOUR_DEVNET_PROGRAM_ID');
const SERVICE_LEVEL_REALTIME_FREE = 12;

async function subscribeToFreeTier(wallet: any, connection: Connection) {
  const tx = new Transaction();
  // Add subscribe instruction (see TxLINE program reference for exact format)
  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(signature);
  return signature;
}
```

Use **Devnet** for testing; switch to **Mainnet** for production demo.

### 3. Activate API Token

**Endpoint:** `POST /auth/activate-token`

```typescript
const activateResponse = await fetch(`${TXLINE_BASE_URL}/auth/activate-token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${guestJwt}`,
  },
});
const { apiToken } = await activateResponse.json();
// Returns: { apiToken: "txl_live_abc123...", permissions: [...], expiresAt: "..." }
```

Include in `Authorization: Bearer {apiToken}` on all subsequent calls.

### Complete Auth Class:

```typescript
// lib/txline-auth.ts
export class TxLineAuth {
  private baseUrl: string;
  private guestJwt: string | null = null;
  private apiToken: string | null = null;

  constructor(network: 'mainnet' | 'devnet' = 'devnet') {
    this.baseUrl = network === 'mainnet'
      ? 'https://api.txline.txodds.com'
      : 'https://devnet-api.txline.txodds.com';
  }

  async authenticate(): Promise<string> {
    const guestSession = await fetch(`${this.baseUrl}/auth/guest-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const { jwt } = await guestSession.json();
    this.guestJwt = jwt;

    const activateToken = await fetch(`${this.baseUrl}/auth/activate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
    });
    const { apiToken } = await activateToken.json();
    this.apiToken = apiToken;
    return apiToken;
  }

  getApiToken(): string {
    if (!this.apiToken) throw new Error('Not authenticated. Call authenticate() first.');
    return this.apiToken;
  }

  getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getApiToken()}`,
    };
  }
}
```

---

## API Endpoints Reference

### 1. Match Schedule — `GET /scores/schedule`

Lists all 104 World Cup matches.

**Response:**
```json
{
  "matches": [
    {
      "id": "wc2026_match_001",
      "competition": "FIFA World Cup 2026",
      "homeTeam": "Brazil",
      "awayTeam": "Argentina",
      "homeTeamCode": "BRA",
      "awayTeamCode": "ARG",
      "kickoffTime": "2026-06-12T20:00:00Z",
      "status": "upcoming",
      "venue": "MetLife Stadium",
      "stage": "Group Stage",
      "group": "Group F"
    }
  ],
  "pagination": { "total": 104, "page": 1, "perPage": 50 }
}
```

**Query Parameters:** `?status=live|upcoming|finished`, `?date=YYYY-MM-DD`, `?stage=Group Stage`

### 2. Soccer Feed (Live Match Data) — `GET /scores/soccer/{matchId}`

Real-time match snapshot.

**Response (key structure):**
```json
{
  "matchId": "wc2026_match_001",
  "status": "live",
  "clock": { "minute": 67, "second": 34, "period": "2H", "addedTime": 2, "running": true },
  "score": { "home": 2, "away": 1 },
  "teams": {
    "home": {
      "name": "Brazil",
      "stats": { "possession": 58, "shots": 14, "shotsOnTarget": 6, "corners": 5,
                 "fouls": 11, "offsides": 2, "yellowCards": 1, "redCards": 0 }
    },
    "away": { "name": "Argentina", "stats": { "possession": 42, "shots": 8, "shotsOnTarget": 3,
                 "corners": 3, "fouls": 9, "offsides": 1, "yellowCards": 2, "redCards": 1 } }
  },
  "events": [
    { "id": "evt_001", "type": "goal", "minute": 45, "team": "home",
      "player": "Neymar Jr", "description": "Goal! Neymar scores from outside the box",
      "timestamp": "2026-06-12T20:45:12Z" }
  ],
  "lastUpdated": "2026-06-12T20:67:34Z"
}
```

**Polling Strategy:** poll every **60 seconds**, cache **55 seconds**, use WebSocket for instant events.

### 3. StablePrice Odds Feed — `GET /odds/stableprice/{matchId}`

Consensus odds from 250+ bookmakers.

**Response:**
```json
{
  "matchId": "wc2026_match_001",
  "markets": {
    "match_winner": { "home": 2.45, "draw": 3.20, "away": 2.90 },
    "over_under_2.5": { "over": 1.85, "under": 1.95 },
    "both_teams_to_score": { "yes": 1.70, "no": 2.10 }
  },
  "impliedProbabilities": {
    "homeWin": 40.8, "draw": 31.3, "awayWin": 34.5,
    "over2_5Goals": 54.1, "goalInNext60s": 23.0
  },
  "lastUpdated": "2026-06-12T20:67:00Z",
  "sourceCount": 247,
  "consensusConfidence": 0.92
}
```

Implied probability = `100 / decimalOdds`. Used in PULSE for "Market thinks X% chance of goal in next 60s."

### 4. Streaming Data — `WS /stream/scores`

```typescript
class TxLineStream {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  connect(apiToken: string, matchId?: string) {
    let wsUrl = `${this.baseUrl.replace('https', 'wss')}/stream/scores?token=${apiToken}`;
    if (matchId) wsUrl += `&matchId=${matchId}`;

    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => { this.reconnectAttempts = 0; };
    this.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
    this.ws.onclose = () => this.scheduleReconnect(apiToken, matchId);
    this.ws.onerror = () => this.ws?.close();
  }

  private handleMessage(data: any) {
    switch (data.type) {
      case 'event':         this.emit('event', data.payload); break;   // goal/card/corner
      case 'clock_update':  this.emit('clock', data.payload); break;   // every second
      case 'stat_update':   this.emit('stats', data.payload); break;   // every 60s
      case 'status_change': this.emit('status', data.payload); break;  // live -> ht -> ft
    }
  }

  private scheduleReconnect(apiToken: string, matchId?: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(apiToken, matchId);
    }, delay);
  }
}
```

| Message type | Payload | Frequency | Usage in PULSE |
|------|---------|-----------|----------------|
| `event` | `{type, minute, team, player}` | On occurrence | Resolve predictions immediately |
| `clock_update` | `{minute, second, period}` | Every second | Sync match clock |
| `stat_update` | `{possession, shots, corners}` | Every 60s | Update statistics |
| `status_change` | `{oldStatus, newStatus}` | On change | Update UI state |

**Best practices:** reconnection logic, heartbeat/ping, buffer during disconnects, validate messages.

### 5. On-Chain Validation (Optional, Bonus) — `GET /validation/score-proof/{matchId}?seq={n}`

Cryptographic proof of match data integrity (merkleRoot, proof, signature). Use for a "Verified on Solana" badge. Advanced — implement only if time permits.

---

## Rate Limits & Error Handling

Hackathon free tier: generous limits, all 104 matches, scores + odds + proofs, $0.

```typescript
async function safeTxlineCall<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 429) {
        const retryAfter = parseInt(error.headers['retry-after'] || '60');
        await sleep(retryAfter * 1000);
        continue;
      }
      if (attempt === retries) throw error;
      await sleep(delay * 2 ** attempt);
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Data Transformation

```typescript
// types/match.ts
export interface PulseMatch {
  id: string;
  txlineMatchId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamCode: string;
  awayTeamCode: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  kickoffTime: Date;
  clock?: MatchClock;
  statistics?: MatchStatistics;
  events: MatchEvent[];
}

export interface MatchClock {
  minute: number;
  second: number;
  period: '1H' | 'HT' | '2H' | 'FT';
  addedTime: number;
  isRunning: boolean;
}

export interface TeamStats {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
}

export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed';
export type EventType = 'goal' | 'red_card' | 'yellow_card' | 'corner' | 'penalty' | 'substitution';

export function transformTxlineMatch(raw: any): PulseMatch {
  return {
    id: generateId(),
    txlineMatchId: raw.matchId,
    homeTeam: raw.teams.home.name,
    awayTeam: raw.teams.away.name,
    homeTeamCode: raw.teams.home.code || raw.homeTeamCode,
    awayTeamCode: raw.teams.away.code || raw.awayTeamCode,
    homeScore: raw.score?.home || 0,
    awayScore: raw.score?.away || 0,
    status: transformStatus(raw.status),
    kickoffTime: new Date(raw.kickoffTime),
    clock: raw.clock ? {
      minute: raw.clock.minute,
      second: raw.clock.second,
      period: raw.clock.period,
      addedTime: raw.clock.addedTime || 0,
      isRunning: raw.clock.running,
    } : undefined,
    statistics: raw.teams ? {
      home: transformTeamStats(raw.teams.home.stats),
      away: transformTeamStats(raw.teams.away.stats),
    } : undefined,
    events: (raw.events || []).map(transformEvent),
  };
}
```

---

## Troubleshooting

| Error | Causes | Solutions |
|-------|--------|-----------|
| 401 Unauthorized | Expired JWT, invalid token, subscription not active | Re-authenticate, check on-chain subscription, verify header, check system clock |
| 403 Forbidden | Wrong network (mainnet creds on devnet), missing permissions | Verify base URL matches network, review subscription permissions |
| 429 Too Many Requests | Rate limits, too many connections | Cache aggressively, use WebSocket instead of polling, exponential backoff |
| WS disconnects | Network instability, idle timeout, proxy | Reconnect with backoff, ping/pong heartbeats, use wss:// |
| Stale data | Polling too slow, WS dead, over-caching | Cache TTL ≤55s, verify WS active, "last updated" timestamp in UI |

---

## Resources & Support

- Quickstart: https://txline-docs.txodds.com/documentation/quickstart
- API Reference: https://txline-docs.txodds.com/api-reference
- Examples: https://txline-docs.txodds.com/documentation/examples
- Discord: https://discord.com/channels/1499396631278129172/1499787121060221110
- Twitter/X: @TXODDSOfficial
- Python SDK examples: https://github.com/Berektassuly/txline (Devnet)

**Master TxLINE integration. It's the backbone of PULSE. Every feature depends on reliable data flow.**
