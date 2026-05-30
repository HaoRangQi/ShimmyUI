# Model library downloads - Checkpoint

- Task ID: 2026-05-29-model-library-downloads
- Current todo: Complete model-library UI integration verification and prepare follow-up hardening.
- Completed todos:
  - Core model-library GGUF/catalog/model-store tests and implementation.
  - Ollama status/model listing boundary tests and implementation.
  - Next API contract tests and model-library routes.
  - Models page model-library section with curated catalog, local GGUF import, and Ollama status display.
  - Catalog compatibility filter now requires a 64-character sha256 before a model is shown as downloadable.
  - Local import and catalog download run Shimmy probe when a Shimmy binary is available; probe failure prevents metadata/config registration and removes copied/downloaded files.
  - Binary version probe timeout widened in Next and fallback runtime owners to keep full parallel test runs stable.
- Active slice: evidence and handoff
- Blocked on: none
- Next step: Follow-up hardening can add progress/cancel UX for large downloads and richer probe result display.

## DriftCheckDraft

- Scope status: aligned with the first model acquisition slice from `docs/aegis/plans/2026-05-29-model-library-downloads.md`.
- Compatibility status: preserved existing `/api/shimmy/models`, `/api/shimmy/discover`, and config shape; no fallback server behavior was changed.
- Ollama boundary: still detection/listing only; no blind `ollama pull` or direct Ollama blob import was added.
- Compatibility boundary: local/imported files must be GGUF; catalog downloads require sha256; available Shimmy binary must probe the managed model successfully before registration.
- New owner status: model acquisition rules remain under `src/lib/model-library/**`; UI/API stay thin.
- Decision: continue / verification-complete-for-current-slice.
