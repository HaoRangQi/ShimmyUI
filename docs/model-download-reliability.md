# Model Download Reliability

Date: 2026-05-30

## Scope

This note documents Shimmy UI model download reliability behavior for the Hugging Face path.

Owner files:

- `src/lib/model-library/model-store.ts`
- `src/lib/model-library/download-progress.ts`
- `src/app/api/model-library/huggingface/download/route.ts`
- `src/app/page.tsx`
- `src/components/dashboard/models-panel.tsx`

## Reliability Controls

1. Streaming write instead of full-buffer download.
   - Avoids memory spikes on large GGUF files.
2. Persistent async job snapshots.
   - Download state is stored under `SHIMMY_UI_HOME/download-jobs`.
   - UI can restore active progress after refresh.
3. Same-file async lock and job reuse.
   - Keyed by `repoId + fileName`.
   - Repeated async start requests return the same `jobId` (`reused: true`) while active.
4. Resume from partial file.
   - Uses local `.partial` size as offset.
   - Sends `Range: bytes=<offset>-` when offset exists.

## HTTP Range Behavior

- `206 Partial Content`:
  - Append mode.
  - Continue download from existing partial size.
- `200 OK` with existing partial:
  - Remote ignored range.
  - Fallback to full re-download from 0.
- `416 Range Not Satisfiable`:
  - If remote total equals local partial size, skip transfer and continue validation.
  - Else delete stale partial and retry from 0.

## Failure Policy

- Transfer-stage failures:
  - Keep `.partial` to maximize chance of resume on next attempt.
- Validation/probing failures:
  - Clean invalid `.partial` or final file to avoid registering broken models.
- Stale active jobs:
  - Marked as interrupted after timeout and surfaced to UI.

## User-Visible UX Contract

Models page shows:

- phase (`downloading/validating/probing/done`)
- percent (when total known)
- downloaded bytes / total bytes
- ETA estimate during active transfer

Async status endpoints:

- `POST /api/model-library/huggingface/download` with `{ async: true }`
- `GET /api/model-library/huggingface/download?jobId=...`
- `GET /api/model-library/huggingface/download?list=active`

## Validation

Primary automated checks:

- `src/lib/model-library/model-library.test.ts`
  - 206 resume append
  - 200 fallback full download
  - 416 fast-finish path
  - transfer interruption partial retention
- `src/app/api/api-contracts.test.ts`
  - async job start/poll
  - active jobs listing
  - same-file async reuse lock

Run:

```bash
npm run test -- src/lib/model-library/model-library.test.ts src/app/api/api-contracts.test.ts
npm run typecheck
npm run lint
```
