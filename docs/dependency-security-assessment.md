# Dependency Security Assessment

Date: 2026-05-29

## Scope

This assessment covers the Phase 2 P0 roadmap item for high-severity dependency audit risk.

Commands run after the dependency upgrade:

- `npm audit --audit-level=high`
- `npm outdated --long`
- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `node --test tests/node/shimmy-manager.test.mjs`
- `PLAYWRIGHT_PORT=3101 npm run test:e2e`
- `npm run build`

## Current Findings

`npm audit --audit-level=high` now exits successfully. The previous high-severity audit findings from the old Next, `eslint-config-next`, Vitest, Vite, and transitive `glob` / `esbuild` chains have been cleared by the major dependency upgrade.

Remaining audit output:

- Moderate: `postcss <8.5.10` via Next's embedded `node_modules/next/node_modules/postcss`.
- `npm audit fix --force` currently proposes an invalid downgrade path to `next@9.3.3`, so it is not an acceptable remediation.

## Upgrade Completed

The compatibility slice upgraded the high-risk dependency surface:

- `next` and `eslint-config-next` to `16.2.6`.
- `vitest` to `4.1.7`.
- `vite` to `7.3.3`.
- `@vitejs/plugin-react` to `5.1.2`.
- `@playwright/test` to `1.60.0`.
- `eslint` settled on `9.39.1` because ESLint 10 exposed an `eslint-plugin-react` flat-config compatibility issue.

The project now uses `eslint.config.mjs` for ESLint flat config. The old `.eslintrc.json` was removed as part of the Next 16 / ESLint 9 migration.

## Verification Baseline

After the dependency upgrade and the Turbopack NFT warning fix, the current codebase passes:

- Unit tests: 12 files passing, 40 tests passing.
- Fallback node tests: 10 tests passing.
- TypeScript: passing.
- ESLint: passing.
- Playwright E2E: 5 passing, 1 intentional mobile lifecycle skip.
- Production build: passing with no Turbopack NFT warnings.
- Audit gate: `npm audit --audit-level=high` passing.

Last checked: 2026-05-29 after Phase 2 runtime-core, Chat, diagnostics, API contract, dependency upgrade, and build-warning closure work.

## Residual Risk

The only remaining audit item is the moderate PostCSS advisory embedded under Next. It is retained as residual risk until the upstream Next package ships or accepts a dependency path that resolves it without downgrading Next.

The current local-only product scope reduces exposure because Shimmy UI does not use remote multi-tenant deployment or user-uploaded CSS rendering, but the advisory should remain tracked before any non-local distribution.

## Deferred Non-Security Major Upgrades

`npm outdated --long` still reports optional major upgrades outside this Phase 2 security closure, including React 19, Tailwind CSS 4, TypeScript 6, Vite 8, Zod 4, jsdom 29, and lucide-react 1.x. These are not required to clear the high-severity audit gate and should be evaluated as separate compatibility slices.
