# Runtime Core Architecture

Date: 2026-05-29

## Purpose

Shimmy UI has two local server surfaces:

- Next API routes under `src/app/api/**`.
- The zero-dependency fallback server under `server/**`.

Phase 2 makes runtime lifecycle behavior share one canonical implementation so download, install, update, uninstall, rollback, checksum verification, and concurrency rules do not drift between those two surfaces.

## Canonical Owner

`src/lib/shimmy/runtime-core.mjs` owns the runtime lifecycle core.

It provides:

- `withRuntimeOperationLock` and `RuntimeOperationBusyError` for one-at-a-time runtime operations.
- GitHub release lookup with timeout, rate-limit/access errors, and short status cache.
- Platform asset selection.
- SHA-256 verification and verified runtime file reads.
- Managed runtime metadata read/write.
- Download, install, update, uninstall, and rollback operations.

`src/lib/shimmy/runtime-core.d.mts` is the TypeScript declaration surface used by the Next wrapper.

## Next Wrapper

`src/lib/shimmy/runtime-manager.ts` imports the shared ESM core and binds it to Next-side config storage:

- `configStore.read`
- `configStore.write`

Next API routes in `src/app/api/runtime/**` call this wrapper and translate thrown runtime errors to HTTP responses.

## Fallback Wrapper

`server/shimmy-manager.mjs` imports the same runtime core and binds it to fallback-local config helpers:

- `readConfig`
- `writeConfig`
- `shimmyUiHome`
- `runtimeMetaPath`

The fallback server keeps ownership of process management, logs, config normalization, model directory inspection, and HTTP routing because those pieces are intentionally zero-dependency and server-local.

## Compatibility Boundary

Runtime lifecycle behavior must stay shared. Future changes to download, install, update, uninstall, rollback, checksum, release metadata, or runtime operation locking belong in `runtime-core.mjs` first.

Process start/stop, log buffering, settings validation, model discovery HTTP calls, and UI presentation may remain in their current owners unless they start duplicating lifecycle behavior.

## Failure Semantics

- Concurrent runtime operations throw `RuntimeOperationBusyError` and API routes return `409`.
- Missing or corrupt downloaded files fail before install or rollback writes the managed binary.
- Uninstall refuses to remove binaries not installed by Shimmy UI.
- Downloads and updates request fresh release metadata; status checks may use the short cache.
- GitHub timeout, access failure, and rate-limit failure are preserved as user-visible runtime status errors.

## Verification

Required verification when editing this owner:

- `npm run test`
- `node --test tests/node/shimmy-manager.test.mjs`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

For API route behavior changes, also run the contract tests in `src/app/api/api-contracts.test.ts`.
