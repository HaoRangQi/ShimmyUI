# Shimmy UI

[中文](./README.md) | **English**

Local Web UI for managing and operating a Shimmy inference server.

## What It Does

- Detects a local `shimmy` binary from saved settings, `PATH`, project root, or `~/bin`.
- Checks the latest GitHub Release and selects the matching platform asset.
- Downloads, verifies sha256, installs, updates, uninstalls, and rolls back the Shimmy UI managed binary.
- Starts and stops only the Shimmy process launched by this UI.
- Connects to external Shimmy services without killing them.
- Reads `/health`, `/metrics`, `/api/models`, `/api/models/discover`, and proxies `/v1/chat/completions`.
- Supports setting a default model for the local chat panel.
- Provides two model download channels with compatibility controls:
  - Curated GGUF catalog (`/api/model-library/catalog` + `/api/model-library/download`): only checksum-verified and Shimmy-compatible entries are installable.
  - Ollama Bridge (`/api/model-library/ollama/*`): pulls through Ollama API, then verifies the model is GGUF + `completion`; incompatible pulls are auto-removed.
- Optional login page auth (`/login`) for server deployments, with HttpOnly cookie session.
- Stores local UI settings in `~/.shimmy-ui/config.json` by default.
- Stores managed runtime metadata under `~/.shimmy-ui/runtime.json`.

Runtime installs are intentionally scoped to `~/.shimmy-ui/bin`. Uninstall only
removes the binary managed by Shimmy UI; it will not delete a system `shimmy`
from `/usr/local/bin`, `PATH`, Homebrew, Cargo, or another external installer.

## Development

Zero-dependency local preview:

```bash
npm run web
```

Open `http://127.0.0.1:37645`.

For isolated smoke tests, point the UI config at a temporary file:

```bash
SHIMMY_UI_CONFIG_PATH=/tmp/shimmy-ui-local.json npm run web
```

Next.js development:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:37645`.

Set `PORT=...` before `npm run web`, `npm run dev`, or `npm run start` if you
need a different local UI port.

Example uncommon local port:

```bash
PORT=47831 npm run dev
```

## Docker (Linux Server Friendly)

Build image:

```bash
docker build -t shimmy-ui:local .
```

Run container:

```bash
docker run --rm \
  -p 37645:37645 \
  -v shimmy-ui-data:/data \
  -e SHIMMY_UI_USERNAME=admin \
  -e SHIMMY_UI_PASSWORD='change-me' \
  -e SHIMMY_UI_OLLAMA_BASE_URL='http://host.docker.internal:11434' \
  --add-host=host.docker.internal:host-gateway \
  shimmy-ui:local
```

Then open `http://127.0.0.1:37645`.

Compose sample:

```bash
docker compose up -d --build
```

`docker-compose.yml` already includes:

- `PORT=37645`, `HOSTNAME=0.0.0.0`
- `SHIMMY_UI_HOME=/data`
- `SHIMMY_UI_CONFIG_PATH=/data/config.json`
- `SHIMMY_UI_RUNTIME_PATH=/data/runtime.json`
- persistent volume `shimmy-ui-data:/data`

By default only UI port is published. If you need to expose Shimmy API port
`11435`, add a port mapping manually in compose.

## Runtime Environment Variables

- `SHIMMY_UI_HOME`: root data dir for model/runtime artifacts (default `~/.shimmy-ui`).
- `SHIMMY_UI_CONFIG_PATH`: UI config file path.
- `SHIMMY_UI_RUNTIME_PATH`: runtime metadata file path.
- `SHIMMY_UI_OLLAMA_BASE_URL`: external Ollama base URL (default `http://127.0.0.1:11434`).
- `SHIMMY_UI_USERNAME`: login username (required in production/server mode).
- `SHIMMY_UI_PASSWORD`: login password (required in production/server mode).
- `SHIMMY_UI_SESSION_SECRET`: optional session signing secret.
- `SHIMMY_UI_SESSION_TTL_SECONDS`: optional session ttl, default `43200` (12h).

Auth behavior:

- `NODE_ENV=production`: auth is required; missing username/password blocks protected routes.
- non-production: if username/password are not set, auth is disabled for local convenience.

## Verification

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

The E2E suite uses `tests/fixtures/fake-shimmy.js` and writes its config to
`/tmp/shimmy-ui-e2e-config.json`.

When npm packages or local port binding are unavailable, the fallback manager
can still be checked with:

```bash
node --test tests/node/shimmy-manager.test.mjs
node --check server/index.mjs
node --check server/shimmy-manager.mjs
node --check public/app.js
```
