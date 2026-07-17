# 📏 PULSE Code Standards

## Philosophy

> "Code is read 10x more than it's written. Write for humans, optimize for machines."

---

## TypeScript Configuration

### Strict Mode (Non-Negotiable)

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/stores/*": ["./src/stores/*"],
      "@/types/*": ["./src/types/*"],
      "@/utils/*": ["./src/utils/*"]
    }
  }
}
```

---

## Naming Conventions

### Files
```
Components: PascalCase.tsx (e.g., PredictionButtons.tsx)
Hooks: camelCase.ts (e.g., usePrediction.ts)
Utilities: camelCase.ts (e.g., formatDate.ts)
Types: PascalCase.ts (e.g., MatchInterface.ts)
Constants: UPPER_SNAKE_CASE.ts (e.g., API_ENDPOINTS.ts)
Pages: kebab-case directory (e.g., match/[id]/page.tsx)
```

### Variables & Functions
```typescript
// Variables: camelCase
const currentUser = 'John';
const isActive = true;

// Constants: UPPER_SNAKE_CASE
const MAX_PREDICTIONS_PER_MATCH = 90;
const PREDICTION_WINDOW_SECONDS = 60;
const BASE_POINTS = 100;

// Functions: camelCase, verb prefix
function calculatePoints(prediction: Prediction): number { }
function isValidMatchId(id: string): boolean { }

// Classes: PascalCase
class TxLineAuthService { }
class PredictionEngine { }

// Interfaces/Types: PascalCase, descriptive
interface UserPrediction { }
type MatchStatus = 'live' | 'finished' | 'upcoming';
interface ApiResponse<T> { data: T; error: ApiError | null; }

// Enums: PascalCase
enum EventType {
  Goal = 'goal',
  RedCard = 'red_card',
  YellowCard = 'yellow_card',
  Corner = 'corner',
  None = 'none'
}

// Boolean: prefix with is/has/should/can
const isLoading = false;
const hasError = true;
const canPredict = true;
```

---

## Code Organization

### Import Order (Enforced by ESLint)

```typescript
// 1. React/Next.js imports
// 2. Third-party libraries (framer-motion, zustand, @solana/web3.js)
// 3. Internal types/interfaces (@/types)
// 4. Internal components (@/components)
// 5. Hooks (@/hooks)
// 6. Stores (@/stores)
// 7. Utilities/constants (@/utils, @/constants)
// 8. Styles (CSS modules)
// 9. Relative imports (same directory)
```

### Component Structure

Every component file follows: imports → types → JSDoc'd component → handlers → render. Example pattern:

```typescript
interface PredictionButtonsProps {
  onPredict: (action: boolean) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

/**
 * Renders two large prediction buttons (YES/NO).
 * Optimized for mobile thumb-zone interaction.
 */
export function PredictionButtons({
  onPredict,
  disabled = false,
  isLoading = false,
}: PredictionButtonsProps) {
  const [pressedButton, setPressedButton] = useState<'yes' | 'no' | null>(null);

  const handlePress = (action: boolean) => {
    if (disabled || isLoading) return;
    setPressedButton(action ? 'yes' : 'no');
    if ('vibrate' in navigator) navigator.vibrate(50);
    setTimeout(() => {
      onPredict(action);
      setPressedButton(null);
    }, 150);
  };

  return (/* motion.button pair: YES "Something's brewing!" / NO "Calm before storm" */);
}
```

### Function Length & Complexity

**Rules:**
- Functions < 50 lines (extract if longer)
- Cyclomatic complexity < 10 (simplify logic)
- Nesting depth < 4 (flatten with early returns)
- Parameters < 5 (group into object if more)

**Example: decompose complex logic**

```typescript
function calculateScore(user: User, prediction: Prediction, match: Match): number {
  const baseScore = getBaseScore(prediction, match);
  const streakBonus = getStreakBonus(user.streak);
  const eventMultiplier = getEventMultiplier(getEventType(match));
  return Math.floor(baseScore * eventMultiplier) + streakBonus;
}

function getBaseScore(prediction: Prediction, match: Match): number {
  if (!prediction.wasCorrect) return 0;
  return BASE_POINTS;
}

function getStreakBonus(currentStreak: number): number {
  if (currentStreak >= 10) return 250;
  if (currentStreak >= 5) return 100;
  if (currentStreak >= 3) return 50;
  return 0;
}

function getEventMultiplier(eventType: EventType): number {
  const multipliers: Record<EventType, number> = {
    [EventType.Goal]: 3.0,
    [EventType.RedCard]: 2.5,
    [EventType.YellowCard]: 2.0,
    [EventType.Corner]: 1.5,
    [EventType.None]: 1.0,
  };
  return multipliers[eventType] ?? 1.0;
}
```

---

## Error Handling Standards

### Custom Error Classes

```typescript
// lib/errors.ts
export class PulseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'PulseError';
  }
}

export class TxLineAuthError extends PulseError {
  constructor(message: string) {
    super(message, 'TXLINE_AUTH_FAILED', 401);
    this.name = 'TxLineAuthError';
  }
}

export class PredictionConflictError extends PulseError {
  constructor() {
    super(
      'You already have an active prediction. Please wait for it to resolve.',
      'PREDICTION_CONFLICT',
      409
    );
    this.name = 'PredictionConflictError';
  }
}

export class MatchNotLiveError extends PulseError {
  constructor(matchId: string) {
    super(`Match ${matchId} is not currently live.`, 'MATCH_NOT_LIVE', 400);
    this.name = 'MatchNotLiveError';
  }
}
```

### Error Response Format

```typescript
// API responses must follow this shape
interface ErrorResponse {
  success: false;
  error: {
    code: string;      // Machine-readable error code
    message: string;   // Human-readable message (safe for UI)
    details?: string;  // Additional context (debugging)
    requestId: string; // Correlation ID for support
  };
}

// Example usage
try {
  const prediction = await createPrediction(userId, matchId, action);
  return res.status(201).json({ success: true, data: prediction });
} catch (error) {
  if (error instanceof PulseError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        requestId: req.id,
      },
    });
  }
  // Unknown error: log full detail, return generic message
  logger.error({ error, requestId: req.id });
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
      requestId: req.id,
    },
  });
}
```

**Rules:**
- Never expose stack traces or internal details to clients
- Always include a `requestId` correlation ID
- User-facing messages are friendly and actionable
- Log unknown errors with full context (Sentry)

---

## Testing Standards

- Unit tests for all core business logic (scoring, resolution, streaks) — target 100%
- Integration tests for API routes (mocked TxLINE responses)
- E2E for the critical prediction flow (Playwright)
- Test names describe behavior: `it('resets streak on wrong prediction')`
- No skipped tests in main branch

---

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Small, focused commits; commit at least at each working milestone
- Tags at milestones: `v0.1.0-week1-complete`, `v0.2.0-week2-complete`
- Never commit secrets — `.env` files stay in `.gitignore`; keep `.env.example` updated

---

## Hard Rules Summary

❌ No `any` types, no `@ts-ignore`
❌ No `console.log` in production code (use structured logger)
❌ No TODO/FIXME in shipped code (create issues instead)
❌ No secrets in git
✅ Functions <50 lines, files <200 lines
✅ JSDoc on all public functions
✅ ESLint + Prettier clean before every commit
