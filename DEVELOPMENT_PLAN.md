# 📅 PULSE Development Plan - 3-Week Sprint

> ⚠️ **Timeline note:** Original plan assumed a June 24 start. Adjust day numbers to the
> actual remaining runway before the submission deadline (July 19, 23:59 UTC). The
> priorities and ordering below still apply — compress, don't reorder.

## Timeline Overview

```
WEEK 1: Foundation & Core Integration
├── Day 1-2: Project Setup + TxLINE Auth
├── Day 3-4: Match Data Integration
├── Day 5-6: Prediction Engine (Core Logic)
└── Day 7: Testing + Bug Fixes

WEEK 2: Polish & Engagement Features
├── Day 8-9: Database + User Accounts
├── Day 10-11: Leaderboard + Gamification
├── Day 12-13: UI Polish + Animations
└── Day 14: Mobile Optimization + Testing

WEEK 3: Ship & Differentiation
├── Day 15-16: Advanced Features (Profile, Share)
├── Day 17-18: Demo Replay Mode + Docs + Demo Video
├── Day 19: Final Code Review
├── Day 20: Submission Dry-Run
└── Day 21: Final Polish + Submission
```

---

## WEEK 1: FOUNDATION (Days 1-7)

### Day 1-2: Project Scaffold + TxLINE Authentication

**Goal:** Working development environment with TxLINE API connected

- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Install core dependencies (zustand, framer-motion, recharts, lucide-react, wallet-adapter, tailwind)
- [ ] Configure Tailwind with custom design tokens (from CLAUDE.md)
- [ ] Set up ESLint + Prettier + TypeScript strict mode
- [ ] Create base folder structure (as defined in ARCHITECTURE.md)
- [ ] Set up Fastify backend project (fastify, @fastify/cors, socket.io, prisma, ioredis, bull, zod)
- [ ] Configure TypeScript for backend
- [ ] Set up Prisma with PostgreSQL (Supabase or local Docker)
- [ ] Create initial database schema; run `npx prisma migrate dev --name init`
- [ ] Implement TxLINE authentication service (guest session → subscription → activate token)
- [ ] Create backend route `POST /api/txline/auth` and frontend hook `useTxlineAuth()`
- [ ] Test full auth flow end-to-end; write unit tests for auth service

**Deliverables:** Running Next.js + Fastify monorepo; TxLINE auth working; database migrated; tests passing.

### Day 3-4: Match Data Integration

**Goal:** Display live match listings with real TxLINE data

- [ ] Fetch `GET /scores/schedule`, transform to Match interface, cache in Redis (TTL 5 min)
- [ ] Backend route `GET /api/matches?status=live|upcoming|completed` with rate limiting
- [ ] MatchCard component (logos, status indicator, score, kickoff time)
- [ ] Match listing page: tabs LIVE | TODAY | COMPLETED, empty states, loading skeletons, 60s polling
- [ ] Match detail view via `GET /scores/soccer/{matchId}`: score, clock, possession, shots, corners, cards
- [ ] MatchClock component (smooth ticking, stoppage time, period indicators)
- [ ] WebSocket connection to `/stream/scores` with auto-reconnect (exponential backoff) + connection status indicator
- [ ] EventFeed component (timeline, icons per event type, entrance animations)

**Deliverables:** Match listing + detail pages, real-time event feed, mobile-responsive.

### Day 5-6: Prediction Engine (CORE FEATURE)

**Goal:** Users can make predictions and see them resolved

- [ ] Prediction data model (TypeScript interfaces + Prisma migration)
- [ ] PredictionButtons component: large YES/NO ("Something's brewing" vs "Calm before storm"), haptic feedback, disabled state
- [ ] Timer component: 60s circular countdown, green→yellow→red, pause when tab hidden
- [ ] Prediction creation: `POST /api/predictions`, validate no active prediction, 60s resolution timer
- [ ] Resolution logic: backend worker checks events in window, calculates points, updates streak/points, emits via Socket.io
- [ ] Result display: confetti + sound on correct, gentle shake on wrong, 3s cooldown
- [ ] Scoring algorithm:
  - Base: 100 points
  - Multipliers: Goal ×3.0, Red Card ×2.5, Yellow Card ×2.0, Corner ×1.5, Calm ×1.0
  - Streak bonus: 3+ = +50, 5+ = +100, 10+ = +250
  - Perfect game (90%+ accuracy in one match): +500
- [ ] End-to-end test: predict → wait 60s → see result (correct + wrong paths, streaks, points)

**Deliverables:** Fully functional prediction feature with resolution, points, streaks, celebrations.

### Day 7: Testing & Bug Fixes

- [ ] Unit tests (prediction service, scoring), integration tests (TxLINE mocked, API routes), E2E (Playwright)
- [ ] Fix race conditions, WebSocket reconnection, time sync, memory leaks
- [ ] Performance: React Profiler, bundle analysis, image optimization, query optimization
- [ ] Code quality: ESLint clean, Prettier, no `any`, JSDoc on public functions
- [ ] Tag `v0.1.0-week1-complete`

---

## WEEK 2: ENGAGEMENT (Days 8-14)

### Day 8-9: Database + User Accounts

- [ ] Wallet signature verification → JWT sessions → user records; reconnection flow
- [ ] User profile page (shortened wallet, optional username, favorite team, join date)
- [ ] Migrate localStorage data to database
- [ ] Settings: sound toggle, haptics toggle, theme (default dark)
- [ ] Stats dashboard: totals, accuracy %, current streak 🔥, best streak, points, rank
- [ ] Prediction history (last 50, filters, color-coded)
- [ ] Achievement foundation: table + types (First Prediction, Streak 3/5/10/25, Goal Whisperer, Card Magnet, Century Club, Perfect Game) + checking service

### Day 10-11: Leaderboard + Gamification

- [ ] Global leaderboard: top 100 by points, Redis cache (60s), medals 🥇🥈🥉, highlight current user, animated rank changes
- [ ] Leaderboard API: `GET /api/leaderboard?scope=global&limit=100` with pagination + rate limiting
- [ ] Achievement system complete: check on resolution, toast notification, badge grid (locked grayed out), confetti for rare
- [ ] Streak visualization: calendar heatmap (GitHub-style)
- [ ] Points breakdown: pie chart by event type, bar chart over time, accuracy trend line

### Day 12-13: UI Polish + Animations

- [ ] Motion design: page transitions, staggered list entrances, button ripples, skeleton shimmer, toasts, modal scale+fade, number count-ups
- [ ] Micro-interactions: card hover lift, button glow pulse, timer urgency, rank change arrows, achievement celebration
- [ ] Sound design (optional): tick, whoosh, ding, buzz, fanfare; volume control; respect mute switch
- [ ] Mobile pass: real devices (iOS Safari, Android Chrome), notch/safe areas, 44×44px touch targets, keyboard avoidance, pull-to-refresh
- [ ] Accessibility: screen reader, keyboard nav, focus indicators, ARIA labels, WCAG AA contrast, reduced motion
- [ ] Performance: Lighthouse >90 all categories, Web Vitals, next/image, code splitting, next/font

### Day 14: Testing + Buffer Day

- [ ] Full manual QA pass; fix critical/high bugs
- [ ] Load test 100 concurrent users; check DB pool, Redis memory, WebSocket limits
- [ ] Cross-browser: Chrome, Safari, Firefox, Edge, Mobile Safari (iOS 15+), Mobile Chrome (Android 12+)
- [ ] Error scenarios: TxLINE downtime, network loss, wallet disconnect, DB timeout, Redis failure
- [ ] Tag `v0.2.0-week2-complete`

---

## WEEK 3: SHIP (Days 15-21)

### Day 15-16: Advanced Features

- [ ] Intuition Profile page: accuracy by event type, radar chart (Recharts), vs global average, personalized insights ("You're a Goal Whisperer!")
- [ ] Social sharing: generated share image (Canvas/HTML-to-image) with stats + branding; Twitter/X, WhatsApp, Telegram, copy link; track shares
- [ ] Demo Replay Mode (CRITICAL — matches end before judging):
  - Pre-recorded TxLINE data sequences, real-time or 2x/4x playback
  - Predictions during replay resolved against recorded events
  - Scenarios: high-scoring, tense late-winner, card-heavy
  - "Demo Mode" banner; pre-loaded on startup
- [ ] TxLINE odds integration: StablePrice consensus, "Market thinks: 23% chance of goal", user vs market accuracy

### Day 17-18: Documentation + Demo Prep

- [ ] Comprehensive README: tagline, screenshots/GIFs, features, stack, getting started, TxLINE integration table, deployment, credits, MIT license
- [ ] Technical docs: API reference, schema diagram, component map, troubleshooting
- [ ] Record demo video (script):
  ```
  [0:00-0:30] Problem Hook
  [0:30-1:15] Product Demo (Live Feel)
  [1:15-2:00] TxLINE Integration Showcase
  [2:00-2:45] Engagement Features
  [2:45-3:30] Replay Mode Demonstration
  [3:30-4:15] Business Model Slide
  [4:15-5:00] Closing + Call to Action
  ```
- [ ] Upload to YouTube/Loom; verify playback
- [ ] Prepare submission materials: video URL, live URL, public repo, team info

### Day 19-21: Final Polish + Submission

- [ ] Final review: remove console.logs/TODOs/debug code, no secrets, npm audit, license check
- [ ] Lighthouse >90 all categories; bundle <200KB; load test
- [ ] Cross-check all 5 judging criteria
- [ ] Submission dry-run in fresh incognito: connect wallet → browse → replay → predict → profile → leaderboard → share; fix everything found
- [ ] Prepare Q&A answers (approach, TxLINE usage, monetization, roadmap, challenges)
- [ ] **Deadline July 19, 23:59 UTC:** deploy latest, verify live URL + video + public repo, submit via Superteam Earn, screenshot confirmation

---

## RISK MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| TxLINE API changes/downtime | Low | High | Graceful degradation, cached data, clear error messaging |
| Scope creep | HIGH | Medium | Strict feature freeze after Day 18, cut ruthlessly |
| Team member unavailability | Medium | Medium | Modular architecture, clear ownership, documentation |
| Critical bug found late | Medium | High | Buffer days, prioritize fixes |
| Demo video technical issues | Low | High | Record early, backup recording tools |
| Submission portal issues | Low | Medium | Submit early, screenshot confirmation |
| Judging criteria misunderstanding | Medium | HIGH | Re-read criteria weekly, align features explicitly |

### Escalation Protocol:
1. **Blocked for >2 hours** → Ask for help in TxLINE Discord
2. **Critical bug Day 20+** → Cut feature, ship without it
3. **Team conflict** → Refer to this document, decide by majority vote
4. **Health/emergency issue** → Ship what you have, partial credit > no submission

---

## SUCCESS METRICS

### Quantitative:
- [ ] >90 Lighthouse score (all categories)
- [ ] <100ms API response time (p50)
- [ ] 0 critical bugs in production
- [ ] 100% test coverage on core services
- [ ] Demo video 4-5 minutes
- [ ] README >500 words, well-structured

### Qualitative:
- [ ] Non-technical user completes flow without help
- [ ] Judges say "Wow, this is different"
- [ ] Demo video makes product feel alive
- [ ] Code is clean, readable, maintainable

---

**Follow this plan exactly. Deviate only if absolutely necessary.**

**Build to win. Ship to impress. Dominate the competition.** 🚀
