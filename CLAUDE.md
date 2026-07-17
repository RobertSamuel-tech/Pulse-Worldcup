# 🎯 PULSE - World Cup Intuition Platform
## Claude Code Agent Master Rulebook

---

## 🚨 IDENTITY & MISSION

**You are building "PULSE"** - A real-time match intuition platform for the FIFA World Cup 2026.

### Core Value Proposition:
> "Pulse transforms every World Cup match into a real-time intuition game where fans predict the NEXT 60 seconds of action—not the final result."

### What Makes Us Different:
- NOT fantasy sports (too slow, season-long)
- NOT betting (no real money, legal globally)
- NOT a dashboard (boring, already exists)
- **IS moment-to-moment intuition validation** (NEW category)

---

## ⚖️ LEGAL COMPLIANCE (CRITICAL - READ FIRST)

### ✅ What We ARE:
- **Skill-based prediction game** (like trivia, not gambling)
- **Free to play** (no entry fees, no purchases required)
- **Entertainment product** (virtual points only)
- **Global availability** (works in all jurisdictions)

### ❌ What We Are NOT:
- Gambling platform (NO real money wagers)
- Sportsbook (NO odds-taking from users)
- Prediction market (NO financial contracts)
- Lottery (NO chance-based prizes with value)

### Required Disclaimers:
```
"This is a free skill game for entertainment purposes only.
No real money is involved. This is not gambling.
Success in this game does not guarantee success in real sports betting."
```

### Hackathon Rules Compliance:
- Must use TxLINE data as PRIMARY input ✓
- Must sign up through Solana ✓
- Product must be FUNCTIONAL (not mockup) ✓
- Demo video required (up to 5 minutes) ✓
- Public repo required ✓

---

## 🏆 JUDGING CRITERIA (Optimization Targets)

We are optimizing for MAXIMUM scores across ALL 5 criteria:

### 1. Fan Accessibility & UX (Target: 19-20/20)
**Rules:**
- My mom must understand it in 10 seconds
- Mobile-first design (thumb-zone optimized)
- Maximum 2 taps to start predicting
- No jargon, no crypto terminology on frontend
- Instant feedback (<100ms response time)
- Beautiful animations (Framer Motion required)

**Anti-Patterns:**
- Complex onboarding flows (>3 screens)
- Desktop-only layouts
- Cryptocurrency wallet connection visible to users
- Forms with >3 fields
- Loading spinners >2 seconds

### 2. Real-Time Responsiveness (Target: 20/20)
**Rules:**
- Data updates every 60 seconds (TxLINE polling)
- WebSocket for live event push (goals/cards/corners)
- Visual "pulse" animation when data refreshes
- Match clock perfectly synchronized with TxLINE
- No stale data ever shown (>5 seconds old = error state)
- Graceful offline handling ("Reconnecting...")

**Technical Requirements:**
- Use TxLINE streaming endpoint for events
- Cache layer with TTL = 55 seconds
- Optimistic UI updates (show prediction immediately)
- Background sync with conflict resolution

### 3. Originality & Value Creation (Target: 19-20/20)
**Our Innovation:**
- **Micro-prediction paradigm**: Predicting MOMENTS, not outcomes
- **Intuition profiling**: Behavioral analytics on prediction patterns
- **Viral mechanics**: Streak sharing, "I called it!" moments
- **New data category**: Moment-to-moment fan sentiment

**What We Must Avoid:**
- Copying example ideas from hackathon prompt (sweepstake, bot, hi-lo)
- Building another live score app
- Creating a fantasy clone
- Repackaging existing TxLINE feeds without added value

### 4. Commercial Viability (Target: 18-19/20)
**Monetization Story (for judges):**
- Freemium: Free basic / Premium analytics ($4.99/mo)
- Brand sponsorship: "Budweiser Pulse Moments"
- Affiliate revenue: Link to regulated bookmakers
- Data licensing: Sell intuition datasets
- NFT badges: Achievement tokens on Solana

**Unit Economics (Include in demo):**
- CAC: $0.75 (viral-driven)
- LTV: $35 (7-month retention @ $5/mo)
- LTV:CAC ratio: 46:1 (extremely healthy)

### 5. Completeness & Execution (Target: 18-19/20)
**Minimum Viable Product Definition:**
- [x] Wallet connect + TxLINE auth working
- [x] Live match list from TxLINE schedule
- [x] Prediction UI (YES/NO buttons, 60s timer)
- [x] Resolution logic (did event occur?)
- [x] Points + streak tracking
- [x] Leaderboard (top 10 + personal rank)
- [x] Mobile responsive (iOS Safari tested)
- [x] Error handling + loading states
- [x] Demo replay mode (simulated matches)
- [x] Social share functionality

**Scope Boundaries (DO NOT EXCEED):**
- No admin dashboard
- No user-to-user chat
- No complex analytics (basic only)
- No multi-language support (English only)
- No push notifications (Phase 2)

---

## 🛠️ TECHNICAL STACK (Non-Negotiable)

### Frontend:
```yaml
Framework: Next.js 14 (App Router, strict mode enabled)
Language: TypeScript (strict mode, no `any` types)
Styling: Tailwind CSS v3.4+ (custom design tokens)
State: Zustand (lightweight, perfect for real-time)
Animations: Framer Motion v11+
Charts: Recharts (intuition profile visualizations)
Wallet: @solana/wallet-adapter-react (Phantom, Backpack)
Icons: Lucide React (consistent icon set)
Fonts: Inter (Google Fonts, next/font)
```

### Backend:
```yaml
Runtime: Node.js 20 LTS
Framework: Fastify v4 (faster than Express)
Language: TypeScript (strict mode)
Real-time: Socket.io v4 (WebSocket server)
ORM: Prisma (type-safe database access)
Cache: Redis (match state, leaderboards)
Queue: Bull (background jobs)
Validation: Zod (runtime type checking)
```

### Database:
```yaml
Engine: PostgreSQL 16 (via Supabase or Neon)
Migrations: Prisma schema
Connection: Connection pooling (pgbouncer)
Backup: Daily automated backups
```

### Infrastructure:
```yaml
Frontend Hosting: Vercel (edge functions, auto-SSL)
Backend Hosting: Railway or Fly.io (Docker containers)
Database: Supabase (managed PostgreSQL)
Cache: Upstash (serverless Redis)
CDN: Cloudflare (static assets, API caching)
Monitoring: Sentry (errors) + LogRocket (sessions)
Domain: pulse.live (or similar short domain)
```

### TxLINE Integration:
```yaml
Auth: Guest JWT → On-chain subscription (free tier)
Data Sources:
  - GET /scores/soccer/{matchId} (snapshot every 60s)
  - WS /stream/scores (live event push)
  - GET /odds/stableprice/{matchId} (consensus odds)
  - GET /scores/schedule (match listings)
Network: Devnet for testing, Mainnet for production
Service Level: 12 (World Cup Real-time FREE tier)
```

---

## 📐 ARCHITECTURE PRINCIPLES

### 1. Separation of Concerns
```
Frontend (Next.js) ←→ Backend API (Fastify) ←→ TxLINE API
                      ↓
               PostgreSQL Database
               Redis Cache
               Bull Queue
```

### 2. Real-Time Data Flow
```
TxLINE WebSocket → Backend Socket.io → Frontend Zustand Store → React Components
                   ↓
              PostgreSQL (persist events)
              Redis (cache leaderboards)
```

### 3. State Management Strategy
```
Zustand Stores:
  - useMatchStore: Current match state, predictions in progress
  - useUserStore: User profile, streaks, points
  - useLeaderboardStore: Top 10 rankings
  - useUIStore: Modals, toasts, loading states
```

### 4. Error Handling Philosophy
```
User-Facing Errors:
  - Show friendly message ("Having trouble connecting...")
  - Auto-retry with exponential backoff
  - Never show stack traces or raw errors

Developer Errors:
  - Log to Sentry with full context
  - Include TxLINE request/response in logs
  - Alert on critical failures (auth, subscription)
```

---

## 🎨 DESIGN SYSTEM (Strict Adherence Required)

### Color Palette:
```css
/* Primary Colors */
--pulse-primary: #6366F1;      /* Indigo - Trust, Intelligence */
--pulse-primary-dark: #4F46E5;
--pulse-primary-light: #818CF8;

/* Accent Colors */
--pulse-accent: #F59E0B;       /* Amber - Energy, Excitement */
--pulse-accent-dark: #D97706;
--pulse-accent-light: #FCD34D;

/* Status Colors */
--pulse-success: #10B981;      /* Emerald - Correct predictions */
--pulse-danger: #EF4444;       /* Red - Wrong predictions, Urgency */
--pulse-warning: #F59E0B;      /* Amber - Caution */
--pulse-info: #3B82F6;         /* Blue - Information */

/* Neutral Colors */
--pulse-dark: #0F172A;         /* Slate 900 - Premium dark mode */
--pulse-dark-light: #1E293B;   /* Slate 800 */
--pulse-gray: #64748B;         /* Slate 500 */
--pulse-gray-light: #94A3B8;   /* Slate 400 */
--pulse-light: #F8FAFC;        /* Slate 50 - Clean backgrounds */
--pulse-white: #FFFFFF;
```

### Typography Scale:
```css
/* Font Family */
font-family: 'Inter', sans-serif;

/* Sizes (Mobile-first) */
--text-xs: 0.75rem;      /* 12px - Labels, timestamps */
--text-sm: 0.875rem;     /* 14px - Body text, buttons */
--text-base: 1rem;       /* 16px - Default body */
--text-lg: 1.125rem;     /* 18px - Subheadings */
--text-xl: 1.25rem;      /* 20px - Section headers */
--text-2xl: 1.5rem;      /* 24px - Page titles */
--text-3xl: 1.875rem;    /* 30px - Hero text */
--text-4xl: 2.25rem;     /* 36px - Big numbers (streaks, points) */

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Monospace (for numbers/stats) */
font-family: 'JetBrains Mono', monospace;
```

### Spacing System:
```css
/* Base unit: 4px */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### Border Radius:
```css
--radius-sm: 0.375rem;   /* 6px - Buttons, inputs */
--radius-md: 0.5rem;     /* 8px - Cards, modals */
--radius-lg: 0.75rem;    /* 12px - Large cards */
--radius-xl: 1rem;       /* 16px - Hero sections */
--radius-full: 9999px;   /* Pills, avatars */
```

### Animation Guidelines:
```typescript
// Timer countdown: Smooth circular progress (not jarring ticks)
// Correct prediction: Confetti burst + screen shake (celebratory)
// Wrong prediction: Subtle fade (not punishing, encouraging retry)
// Leaderboard update: Slide animation (gamified feel)
// Data refresh: Pulse glow effect (shows aliveness)
// Button press: Scale down 95% + haptic feedback (mobile)

// Timing (milliseconds):
const animations = {
  fast: 150,      // Button presses, micro-interactions
  normal: 300,    // Transitions, modals
  slow: 500,      // Page transitions
  celebration: 1000, // Confetti, achievements
};
```

---

## 🚫 ANTI-PATTERNS (Never Do These)

### Architecture Anti-Patterns:
❌ Putting TxLINE API keys in client-side code
❌ Direct database queries from frontend
❌ Monolithic components (>200 lines)
❌ Circular dependencies between stores
❌ Ignoring TypeScript errors (`@ts-ignore`, `as any`)
❌ Hardcoding values that should be configurable

### UX Anti-Patterns:
❌ Asking users to understand blockchain/wallet concepts
❌ Showing raw JSON or technical errors
❌ Requiring account creation before trying the product
❌ Using generic placeholder images
❌ Inconsistent button styles across pages
❌ Missing mobile viewport meta tag

### Performance Anti-Patterns:
❌ Unoptimized images (use next/image always)
❌ Bundle size >200KB initial JS
❌ Rendering >100 items without virtualization
❌ Missing React.memo on expensive components
❌ Synchronous blocking operations in main thread
❌ Not implementing code splitting for routes

### Security Anti-Patterns:
❌ Storing secrets in environment files committed to Git
❌ SQL injection vulnerabilities (always use parameterized queries)
❌ XSS vulnerabilities (sanitize all user input)
❌ CORS misconfiguration (restrict origins explicitly)
❌ Missing rate limiting on API endpoints
❌ Exposing internal API structure in error messages

---

## ✅ SUCCESS DEFINITION (When Are We Done?)

### Week 1 MVP (Foundation):
- [ ] TxLINE authentication flow complete (guest JWT + subscription)
- [ ] Match listing page shows live/upcoming/completed matches
- [ ] Live prediction screen with 60-second timer
- [ ] Basic resolution logic (event detection within window)
- [ ] Local storage persistence (no database yet)

### Week 2 Polish (Engagement):
- [ ] PostgreSQL database integrated with Prisma
- [ ] User accounts linked to Solana wallets
- [ ] Streak tracking + points calculation
- [ ] Real-time leaderboard (refreshed every 60s)
- [ ] Odds display from TxLINE StablePrice feed
- [ ] Sound effects + haptic feedback (mobile)
- [ ] iOS Safari tested and bug-free

### Week 3 Ship (Differentiation):
- [ ] Intuition Profile page (accuracy by event type)
- [ ] Achievement badges + Solana NFT minting (optional bonus)
- [ ] Social share image generation (canvas-based)
- [ ] Match Replay Mode (simulate historical matches)
- [ ] Demo video recorded (4-5 minutes, follows script)
- [ ] README documentation complete
- [ ] Deployed to production (Vercel + Railway)
- [ ] Error monitoring configured (Sentry)
- [ ] Performance audit passed (Lighthouse >90)

---

## 🎯 DAILY STANDUP QUESTIONS (Self-Check)

Before committing code each day, answer:

1. **Does this work on mobile?** (Test on iOS Safari)
2. **Is this understandable by a non-technical fan?** (Show to someone)
3. **Does this use TxLINE data correctly?** (Check API integration)
4. **Is this performant?** (Lighthouse audit)
5. **Does this move us closer to submission?** (Prioritize ruthlessly)

---

## 📞 ESCALATION PROTOCOL

### If You Get Stuck:
1. **Check TxLINE documentation first** (links in TXLINE_INTEGRATION_GUIDE.md)
2. **Search TxLINE Discord** (active community, helpful devs)
3. **Review example code** (GitHub repos mentioned in docs)
4. **Simplify the problem** (can you do it without that feature?)
5. **Move on and come back later** (don't block progress)

### When to Ask for Help:
- TxLINE API returns unexpected errors
- Solana transaction fails consistently
- Performance is unusably slow (>3s load time)
- You've spent >2 hours on a single bug

---

## 🏁 FINAL REMINDER

**We are not building a prototype. We are building a WINNER.**

Every line of code should answer: *"Does this help us win?"*

If yes → Ship it.
If no → Cut it.

**Now go build something amazing.** 🚀
