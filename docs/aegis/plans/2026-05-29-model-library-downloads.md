# Model Library Downloads Plan

## Goal

Implement the first model acquisition slice for Shimmy UI: users can acquire Shimmy-compatible GGUF models without manually editing model directories.

## Architecture

Add a dedicated model-library owner instead of putting model download/import behavior into runtime management.

Primary owner:

- `src/lib/model-library/**`

Consumers:

- Next API routes under `src/app/api/model-library/**`
- Models UI under `src/components/dashboard/models-panel.tsx`
- Home orchestration in `src/app/page.tsx`

## Tech Stack

- Next API routes with Node runtime.
- Local filesystem under `~/.shimmy-ui/models`.
- `fetch` for catalog downloads.
- `execFile` for Ollama CLI detection only when needed.
- Existing `configStore`, `detectShimmyBinary`, and `shimmyProcessManager.probe`.

## Baseline/Authority Refs

- `docs/phase-2-roadmap.md`: model directory health and first-run success.
- `docs/setup-flow-spec.md`: setup path includes model directory, discovery, and smoke chat.
- User-approved direction: compatible model acquisition through curated GGUF, Ollama Bridge, and local import.

## Compatibility Boundary

- Do not add non-local/cloud behavior.
- Do not treat Ollama pull success as Shimmy compatibility.
- Only GGUF files that pass local compatibility checks can be registered for Shimmy.
- Preserve existing `/api/shimmy/models`, `/api/shimmy/discover`, and config shape.
- Keep fallback server unchanged in this first slice unless core behavior must be shared.

## Verification

Required commands:

- `npm run test -- src/lib/model-library src/app/api/api-contracts.test.ts`
- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

E2E should be added if UI behavior proves stable within this slice.

## Plan Basis

Facts:

- Current app already scans configured model directories for `.gguf`.
- Current app can probe a model through Shimmy.
- Ollama CLI exists on this machine, but Ollama service is not currently reachable.

Assumptions:

- First implementation can ship with a small curated catalog entry surface and tests using fixture URLs.
- Local import can accept explicit paths typed/pasted by the user; native file picker can follow later.

Unknowns:

- Whether Shimmy supports every GGUF architecture exposed by popular catalogs.
- Whether Ollama's local model store layout is stable enough for direct blob import across versions.

## Files

Create:

- `src/lib/model-library/types.ts`
- `src/lib/model-library/catalog.ts`
- `src/lib/model-library/gguf.ts`
- `src/lib/model-library/model-store.ts`
- `src/lib/model-library/ollama.ts`
- `src/lib/model-library/model-library.test.ts`
- `src/app/api/model-library/catalog/route.ts`
- `src/app/api/model-library/installed/route.ts`
- `src/app/api/model-library/import-local/route.ts`
- `src/app/api/model-library/download/route.ts`
- `src/app/api/model-library/ollama/status/route.ts`
- `src/app/api/model-library/ollama/models/route.ts`

Modify:

- `src/app/page.tsx`
- `src/components/dashboard/models-panel.tsx`
- `src/lib/i18n.ts`
- `src/app/api/api-contracts.test.ts`

## Plan-Time Complexity Check

- Target files: `page.tsx`, `models-panel.tsx`, API routes, new model-library owner.
- Existing pressure: `page.tsx` is orchestration-heavy; avoid adding model filesystem rules there.
- Owner fit: model acquisition belongs in new `src/lib/model-library`.
- Add-in-place risk: high if added to runtime manager or Models UI directly.
- Recommendation: add owner files and keep UI/API thin.

## Tasks

### Task 1: Core Model Library Rules

Files:

- `src/lib/model-library/types.ts`
- `src/lib/model-library/catalog.ts`
- `src/lib/model-library/gguf.ts`
- `src/lib/model-library/model-store.ts`
- `src/lib/model-library/model-library.test.ts`

Steps:

1. Write tests for GGUF magic validation, catalog compatibility filtering, path containment, local import copy, and config model directory registration.
2. Verify RED with `npm run test -- src/lib/model-library/model-library.test.ts`.
3. Implement minimal core library.
4. Verify GREEN with the same command.
5. Run `npm run typecheck`.

### Task 2: Ollama Detection Boundary

Files:

- `src/lib/model-library/ollama.ts`
- `src/lib/model-library/model-library.test.ts`

Steps:

1. Write tests for Ollama unavailable, version parse, tags filtering, and non-GGUF rejection.
2. Verify RED.
3. Implement status and model listing using `fetch` to `http://127.0.0.1:11434/api/version`, `/api/tags`, and `/api/show`.
4. Verify GREEN.
5. Keep pull/import disabled unless the source can be proven GGUF-compatible.

### Task 3: API Routes

Files:

- `src/app/api/model-library/**/route.ts`
- `src/app/api/api-contracts.test.ts`

Steps:

1. Write API contract tests for catalog, installed list, local import success/failure, catalog download checksum/GGUF failure, and Ollama unavailable.
2. Verify RED.
3. Implement routes as thin wrappers around model-library owner.
4. Verify GREEN.
5. Run `npm run test -- src/app/api/api-contracts.test.ts`.

### Task 4: Models UI Integration

Files:

- `src/components/dashboard/models-panel.tsx`
- `src/app/page.tsx`
- `src/lib/i18n.ts`

Steps:

1. Add component tests or page tests for visible model library controls and import/download actions.
2. Verify RED.
3. Add a compact Model Library section to Models page.
4. Wire API calls, Snackbar feedback, and model refresh/discover invalidation.
5. Verify GREEN and run `npm run test -- src/app/page.test.tsx src/components/dashboard/chat-panel.test.tsx`.

### Task 5: Final Verification

Run:

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

If E2E scope is touched enough to justify it, also run:

- `PLAYWRIGHT_PORT=3103 npm run test:e2e`

## Risks

- Ollama model storage may not expose a stable GGUF file. First slice must show those models as not importable rather than guessing.
- Huge real downloads are unsuitable for automated tests. Tests must use small fixture buffers with GGUF magic and mocked fetch.
- Probe requires Shimmy binary; first slice can register verified GGUF and surface probe status separately when no binary exists.

## Retirement

- Manual model directory editing remains supported.
- Future slice can add Ollama pull/import once direct GGUF source extraction is proven stable.
