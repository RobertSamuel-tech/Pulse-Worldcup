---
name: ui-ux-polish
description: Production-quality UI/UX expertise — design tokens, motion, mobile-first, emotional design for PULSE
---

# UI/UX Polish Expertise

Target: judges score Fan Accessibility & UX 19-20/20. "My mom understands it in 10 seconds."

## Design system (strict — tokens in CLAUDE.md)
- Colors: `--pulse-primary` #6366F1, accent #F59E0B, success #10B981, danger #EF4444, dark bg #0F172A
- Inter for text, JetBrains Mono for numbers/stats
- 4px spacing scale; radii sm 6px / md 8px / lg 12px / xl 16px
- Dark mode is the default look

## Motion (Framer Motion, 60fps)
- Timing: fast 150ms (presses), normal 300ms (transitions/modals), slow 500ms (pages), celebration 1000ms
- Correct prediction: green flash → confetti → points count-up → streak animation → sound
- Wrong prediction: gentle red flash + subtle shake → "Try again" (encouraging, never punishing)
- Skeleton shimmer for loading; staggered list entrances; number count-ups
- Respect `prefers-reduced-motion`

## Mobile-first rules
- Actions in the bottom half (thumb zone); touch targets ≥48×48px
- Test at 375px, 390px, 430px; safe-area insets for notch/home indicator
- Haptic feedback (`navigator.vibrate(50)`) on prediction press
- Pull-to-refresh; keyboard avoidance on inputs

## Copy voice
- Fun, energetic, zero jargon: "Something's brewing!" / "Calm before storm" / "You're a Goal Whisperer!"
- Errors are friendly + actionable: "Having trouble connecting..." never stack traces
- No crypto terminology visible to users, ever

## Every screen must have
Loading state, empty state ("No live matches right now"), error state with a retry action, and a polished happy path. If any is missing, the screen is not done.
