# Model library CRUD and Ollama operations - Intent

## TaskIntentDraft

- Requested outcome: Make model download simple through searchable GGUF catalog, managed model CRUD, and dedicated Ollama start/search/pull/delete controls.
- Goal: Users can search/select downloadable models, manage installed models, and operate Ollama from a dedicated card without manual downloads.
- Success evidence:
- Core tests, API contract tests, page tests, full tests, typecheck, lint, build, E2E, and browser verification show searchable catalog, managed delete, Ollama start/search/pull/delete controls.
- Stop condition: Done when model acquisition and CRUD workflows are implemented and verified; blocked only by repeated external dependency impasse; scope-exceeded if implementing full remote registry crawling.
- Non-goals:
- Full web-wide model registry crawling and arbitrary Hugging Face search.
- Scope: Catalog search/list, managed model delete, Ollama recommended search, custom pull, local model delete, start Ollama, UI integration, tests, docs evidence.
- Change kinds:
- feature
- Risk hints:
- Model acquisition must remain compatible: Shimmy GGUF cannot be confused with Ollama packages.

## BaselineReadSetHint

- docs/phase-2-roadmap.md
- docs/aegis/plans/2026-05-29-model-library-downloads.md

## ImpactStatementDraft

- Compatibility boundary: Existing /api/shimmy/* and config shape remain unchanged; Ollama packages are not registered as Shimmy GGUF models.
- Affected layers:
- model-library owner, Next API routes, dashboard Models UI
- Owners:
- src/lib/model-library/** owns acquisition and Ollama operation rules
- Invariants:
- Shimmy downloads remain curated GGUF with checksum and probe boundary; Ollama pull remains independent from Shimmy model registration.
- Non-goals:
- Full web-wide model registry crawling and arbitrary Hugging Face search.

These records are Method Pack drafts / hints, not authoritative runtime decisions.
