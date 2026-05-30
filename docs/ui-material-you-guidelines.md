# Material You UI Guidelines

Date: 2026-05-29

## Product Tone

Shimmy UI is a local runtime control plane. The interface should stay operational, dense enough for repeated use, and calm under failure. Avoid marketing-style hero sections, decorative cards, and oversized explanatory text.

## Design Tokens

Tokens are defined as RGB triplets in `src/app/globals.css`.

Core surface tokens:

- `--surface`
- `--surface-dim`
- `--surface-container-low`
- `--surface-container`
- `--surface-container-high`
- `--surface-variant`
- `--panel`
- `--panel-2`

Content and outline tokens:

- `--text`
- `--muted`
- `--outline`
- `--outline-variant`
- `--line`

Semantic tokens:

- `--primary`
- `--on-primary`
- `--primary-container`
- `--on-primary-container`
- `--secondary-container`
- `--on-secondary-container`
- `--tertiary`
- `--tertiary-container`
- `--error`
- `--on-error`
- `--error-container`
- `--success`
- `--warn`

Theme behavior:

- Default config is dark.
- `.light` overrides all color tokens for light mode.
- `theme: "system"` follows `prefers-color-scheme` and updates when the media query changes.

## Components

Shared primitives live in `src/components/ui.tsx`.

- `Panel`: framed repeated tool surfaces.
- `Button`: primary, secondary, danger, and ghost actions.
- `Field`: form labels without uppercase transformation.
- `LinearProgress`: indeterminate operation feedback.
- `Snackbar`: success, info, and error feedback with `aria-live`.
- `ConfirmDialog`: destructive and non-destructive confirmations.
- `StatusPill`: compact status marker.

Runtime path and checksum values must be truncatable, copyable, and allowed to wrap in diagnostic reports.

## Motion

Use short transitions and small active-state scale only for control feedback. Long-running operations use `LinearProgress`.

The global stylesheet includes a `prefers-reduced-motion: reduce` fallback that disables long animations and transitions for users who request reduced motion.

## Accessibility

Required behavior:

- Interactive controls must have a visible `focus-visible` outline.
- Error Snackbar uses `role="alert"` and assertive live region behavior.
- Non-error Snackbar uses `role="status"` and polite live region behavior.
- Confirm dialogs use `role="dialog"` and `aria-modal="true"`.
- Pending operations disable repeated actions and expose pending text.

## Responsive Navigation

Desktop uses the left navigation rail in `Sidebar`.

Mobile uses `MobileNavigation`, a fixed bottom navigation with seven icon+label targets. Content panels must not widen the viewport or intercept bottom navigation clicks. Long diagnostics output must stay inside scrollable/wrapping containers.

## Visual Regression Checks

Before release, verify these surfaces on desktop and 390 px mobile:

- Overview first setup.
- Runtime operation area with long managed path/checksum.
- Models with discovery summary.
- Chat with history and presets.
- Logs with filters and export controls.
- Diagnostics report with long paths.

The current E2E suite covers desktop and mobile viewports through `tests/e2e/shimmy-ui.spec.ts`.
