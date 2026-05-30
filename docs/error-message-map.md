# Error Message Map

Date: 2026-05-29

## Purpose

Shimmy UI should translate common local runtime failures into user-facing Chinese guidance. The source strings live in `src/lib/i18n.ts`; mapping logic lives in `src/app/page.tsx`.

## Mapping Rules

| Error signal | User-facing title | Advice | Primary recovery |
| --- | --- | --- | --- |
| `already running` | `操作失败` | `请等待当前运行时操作完成。` | Wait for the current runtime operation to finish. |
| `download failed`, `network`, `fetch`, `ECONNREFUSED`, `503` | `网络请求失败` | `检查网络连接后重试。` | Retry after network or Shimmy endpoint recovers. |
| `Download task interrupted or worker restarted` | `下载已中断` | `请重新发起下载，系统会优先从已下载部分继续。` | Restart the same Hugging Face file download job. |
| `checksum`, `sha256`, `digest` | `校验失败` | `删除已下载文件后重新下载。` | Redownload the managed runtime asset. |
| `missing`, `not found`, `ENOENT` with Shimmy binary context | `运行时文件缺失` or `未找到 Shimmy` | `重新下载或安装托管运行时。` / `在配置中选择 shimmy，或在运行时页面安装。` | Install managed runtime or select existing binary. |
| `EADDRINUSE`, `port`, `address already in use` | `端口可能已被占用` | `停止占用该端口的进程，或选择其他绑定地址。` | Change bind address or stop the conflicting process. |
| no model / empty model state | `操作失败` | `配置可读取的模型目录后重新发现。` | Add a readable GGUF directory and run Discover. |
| chat body larger than 256 KB | API `413` | `Chat request body is too large` | Send a shorter request. |
| chat upstream timeout | API `504` | `Shimmy chat request timed out` | Retry after Shimmy responds or reduce request size. |
| GitHub API timeout | Runtime status error | `GitHub request timed out` | Retry later; status checks use a short cache. |
| GitHub rate-limit/access failure | Runtime status error | `GitHub rate limit or access failure` | Retry after rate limit reset or use an existing download. |

## UI Surfaces

- Runtime download/install/update/uninstall/rollback show Snackbar success/failure and disable repeated actions while busy.
- Start and stop show Snackbar success/failure.
- Save settings and set default model show success/failure feedback.
- Discover shows model count and elapsed time, or records failure in the discovery summary.
- Chat shows success/failure feedback, supports cancellation, and writes successful responses to history.
- Hugging Face model download shows phase, downloaded bytes, total bytes, and ETA; active tasks are reloaded after refresh.

## API Boundaries

- Runtime busy returns `409`.
- Invalid settings return `400`.
- Models/discover upstream failures return `502` with an empty model list.
- Missing gpu-info binary returns `404`.
- gpu-info execution failure returns `500`.
- Chat upstream failure returns `502`.
- Chat timeout returns `504`.
- Oversized chat body returns `413`.
- `POST /api/model-library/huggingface/download` with `async: true` returns `202` and `jobId`.
- Repeated async download requests for the same `repoId + fileName` while active return the same `jobId` with `reused: true`.

## Verification

Primary coverage:

- `src/app/page.test.tsx`
- `src/app/api/api-contracts.test.ts`
- `tests/e2e/shimmy-ui.spec.ts`
