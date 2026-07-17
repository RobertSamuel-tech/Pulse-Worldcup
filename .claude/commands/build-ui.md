# 🎨 Build UI Component

Build or polish a UI component following the PULSE design system. Argument: component name (e.g., `/build-ui PredictionButtons`).

Rules (from CLAUDE.md Design System — read it first):
- Use the design tokens exactly (`--pulse-*` colors, Inter font, 4px spacing scale, defined radii).
- Mobile-first: thumb-zone placement for actions, ≥48×48px touch targets, test at 375/390/430px widths.
- Framer Motion for all animations; timing: fast 150ms, normal 300ms, slow 500ms, celebration 1000ms.
- TypeScript strict, no `any`; props interface + JSDoc; component <200 lines.
- Include loading, empty, error, and disabled states.
- Accessibility: ARIA labels, keyboard navigable, WCAG AA contrast, respect `prefers-reduced-motion`.

After building, render it in the app, verify it visually at mobile width, and run typecheck + lint.
