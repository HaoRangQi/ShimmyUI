# Model library downloads - Evidence

Recorded at: 2026-05-29 23:19:29 CST

## Files Changed

- `src/lib/model-library/catalog.ts`: built-in TinyLlama catalog entry now includes verified size and sha256; compatible catalog filtering requires GGUF, known-good flag, `.gguf` URL, and 64-character sha256.
- `src/lib/model-library/ollama.ts`: Ollama API status now falls back to `ollama --version` so installed-but-not-running can be represented.
- `src/lib/model-library/model-library.test.ts`: coverage added for checksum-required catalog filtering and installed-but-not-running Ollama CLI detection.
- `src/lib/model-library/model-store.ts`: catalog download API path rejects entries without a 64-character sha256 before any network request.
- `src/lib/model-library/model-store.ts`: local import and catalog download run optional Shimmy probe, remove copied/downloaded files on probe failure, and skip metadata/config registration.
- `src/app/api/model-library/import-local/route.ts` and `src/app/api/model-library/download/route.ts`: route-level acquisition now detects Shimmy binary and passes `shimmyProcessManager.probe` into the model-library owner when available.
- `src/app/page.tsx`: model-library catalog/installed/Ollama queries and local import/catalog download mutations wired into the dashboard.
- `src/components/dashboard/models-panel.tsx`: Models page now shows model library controls, curated GGUF download, local GGUF import, and Ollama bridge state.
- `src/components/dashboard/types.ts`: dashboard re-exports model-library DTO types.
- `src/lib/i18n.ts`: Chinese/English model-library strings added.
- `playwright.config.ts`: `PLAYWRIGHT_REUSE_SERVER=1` allows E2E to reuse a manually started server on a non-conflicting port.
- `src/lib/shimmy/binary.ts` and `src/lib/shimmy/runtime-core.mjs`: Shimmy version probe timeout widened from 2s to 5s to prevent full parallel test runs from dropping version metadata under load.

## Verification

- `npm run test -- src/app/page.test.tsx`: passed, 1 file / 7 tests.
- `npm run test -- src/lib/model-library/model-library.test.ts`: passed, covered GGUF validation, checksum validation, config registration, and probe-failure cleanup.
- `npm run test -- src/app/api/api-contracts.test.ts`: passed, 1 file / 16 tests.
- `npm run test -- src/lib/model-library/model-library.test.ts src/app/api/api-contracts.test.ts src/app/page.test.tsx`: passed, 3 files / 33 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test`: passed, 13 files / 61 tests.
- `npm run build`: passed.
- Browser verification at `http://127.0.0.1:37645`: Models page rendered `模型库`, `TinyLlama 1.1B Chat Q4_K_M`, `本地 GGUF 路径`, `导入本地 GGUF`, and `Ollama 未运行`.
- `PORT=3103 SHIMMY_UI_CONFIG_PATH=/tmp/shimmy-ui-e2e-config-3103.json npm run start`: temporary production server started on 3103 and was stopped after E2E.
- `PLAYWRIGHT_PORT=3103 PLAYWRIGHT_REUSE_SERVER=1 npx playwright test --config=playwright.config.ts`: passed, 5 passed / 1 skipped.
- Final browser verification at `http://127.0.0.1:37645`: model library, catalog card, local import controls, and Ollama bridge text all present.

## External Metadata Checked

- Hugging Face HEAD for `tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf` returned `x-linked-size: 668788096` and `x-linked-etag: 9fecc3b3cd76bba89d504f29b616eedf7da85b96540e490ca5824d3f7d2776a0`.

## EvidenceBundleDraft

- Artifact key: verification-2026-05-29
- Type: verification
- Source: docs/aegis/work/2026-05-29-model-library-downloads/90-evidence.md
- Summary: Model library core, API, UI, build, browser, and E2E verification passed for current slice.
- Verifier: npm run test; npm run typecheck; npm run lint; npm run build; PLAYWRIGHT_PORT=3103 PLAYWRIGHT_REUSE_SERVER=1 npx playwright test --config=playwright.config.ts

## EvidenceBundleDraft

- Artifact key: verification-2026-05-29-final
- Type: verification
- Source: docs/aegis/work/2026-05-29-model-library-downloads/90-evidence.md
- Summary: Final verification passed after checksum hardening and binary version probe stability repair.
- Verifier: npm run test; npm run typecheck; npm run lint; npm run build; PLAYWRIGHT_PORT=3103 PLAYWRIGHT_REUSE_SERVER=1 npx playwright test --config=playwright.config.ts

## EvidenceBundleDraft

- Artifact key: verification-2026-05-29-probe-final
- Type: verification
- Source: docs/aegis/work/2026-05-29-model-library-downloads/90-evidence.md
- Summary: Final verification passed after adding Shimmy probe enforcement to local import and catalog download.
- Verifier: npm run test -- src/lib/model-library/model-library.test.ts src/app/api/api-contracts.test.ts src/app/page.test.tsx; npm run test; npm run typecheck; npm run lint; npm run build; PLAYWRIGHT_PORT=3103 PLAYWRIGHT_REUSE_SERVER=1 npx playwright test --config=playwright.config.ts
