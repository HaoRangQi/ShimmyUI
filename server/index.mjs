import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RuntimeOperationBusyError,
  ShimmyManager,
  readConfig,
  writeConfig,
} from "./shimmy-manager.mjs";
import {
  downloadRuntime,
  installRuntime,
  rollbackRuntime,
  runtimeStatus,
  uninstallRuntime,
  updateRuntime,
} from "./shimmy-manager.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const manager = new ShimmyManager();
const defaultUiPort = 37645;
const port = Number(process.env.PORT || defaultUiPort);
const host = process.env.HOST || "127.0.0.1";
const maxChatBodyBytes = 256 * 1024;
const chatProxyTimeoutMs = Number(process.env.SHIMMY_UI_CHAT_TIMEOUT_MS || 30_000);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function readJson(req) {
  const raw = await readRawBody(req);
  return raw ? JSON.parse(raw) : {};
}

async function readRawBody(req, maxBytes = Number.POSITIVE_INFINITY) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw new BodyTooLargeError();
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

class BodyTooLargeError extends Error {
  constructor() {
    super("Chat request body is too large");
    this.name = "BodyTooLargeError";
  }
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendError(res, error, status = 500) {
  sendJson(res, { ok: false, error: error instanceof Error ? error.message : String(error) }, status);
}

async function proxyChat(req, res) {
  const config = await readConfig();
  let body;
  try {
    body = await readRawBody(req, maxChatBodyBytes);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      sendError(res, error, 413);
      return;
    }
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), chatProxyTimeoutMs);
  const abortFromClient = () => controller.abort("client-abort");
  req.on("close", abortFromClient);

  let response;
  try {
    response = await fetch(`http://${config.bindAddress}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason === "timeout") {
      sendError(res, "Shimmy chat request timed out", 504);
      return;
    }
    if (controller.signal.aborted) {
      sendError(res, "Shimmy chat request was cancelled", 499);
      return;
    }
    sendError(res, error, 502);
    return;
  } finally {
    clearTimeout(timeout);
    req.off("close", abortFromClient);
  }

  if (!response.ok || !response.body) {
    sendError(res, `Shimmy chat request failed: ${response.status} ${response.statusText}`, response.status || 502);
    return;
  }
  res.writeHead(response.status, {
    "content-type": response.headers.get("content-type") || "text/event-stream",
    "cache-control": "no-store",
  });
  for await (const chunk of response.body) res.write(chunk);
  res.end();
}

async function api(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/app/status") {
      sendJson(res, await manager.status());
    } else if (req.method === "POST" && url.pathname === "/api/app/settings") {
      sendJson(res, { ok: true, config: await writeConfig(await readJson(req)) });
    } else if (req.method === "POST" && url.pathname === "/api/shimmy/start") {
      sendJson(res, { ok: true, ...(await manager.start()) });
    } else if (req.method === "POST" && url.pathname === "/api/shimmy/stop") {
      sendJson(res, { ok: true, ...(await manager.stop()) });
    } else if (req.method === "GET" && url.pathname === "/api/shimmy/logs") {
      sendJson(res, { logs: manager.logs.list() });
    } else if (req.method === "DELETE" && url.pathname === "/api/shimmy/logs") {
      manager.logs.clear();
      sendJson(res, { ok: true });
    } else if (req.method === "GET" && url.pathname === "/api/shimmy/models") {
      sendJson(res, { ok: true, models: await manager.models() });
    } else if (req.method === "POST" && url.pathname === "/api/shimmy/discover") {
      sendJson(res, { ok: true, models: await manager.discover() });
    } else if (req.method === "POST" && url.pathname === "/api/shimmy/probe") {
      const body = await readJson(req);
      sendJson(res, await manager.probe(body.model));
    } else if (req.method === "GET" && url.pathname === "/api/shimmy/gpu-info") {
      sendJson(res, { ok: true, ...(await manager.gpuInfo()) });
    } else if (req.method === "GET" && url.pathname === "/api/runtime/status") {
      sendJson(res, await runtimeStatus());
    } else if (req.method === "POST" && url.pathname === "/api/runtime/download") {
      sendJson(res, await downloadRuntime());
    } else if (req.method === "POST" && url.pathname === "/api/runtime/install") {
      sendJson(res, await installRuntime(await readJson(req)));
    } else if (req.method === "POST" && url.pathname === "/api/runtime/update") {
      sendJson(res, await updateRuntime());
    } else if (req.method === "POST" && url.pathname === "/api/runtime/uninstall") {
      sendJson(res, await uninstallRuntime());
    } else if (req.method === "POST" && url.pathname === "/api/runtime/rollback") {
      const body = await readJson(req);
      sendJson(res, await rollbackRuntime(body.backupPath));
    } else if (req.method === "POST" && url.pathname === "/api/chat") {
      await proxyChat(req, res);
    } else {
      sendError(res, "Not found", 404);
    }
  } catch (error) {
    sendError(res, error, error instanceof RuntimeOperationBusyError ? 409 : 500);
  }
}

async function staticFile(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) {
    sendError(res, "Forbidden", 403);
    return;
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not found");
    res.writeHead(200, { "content-type": mime[path.extname(filePath)] || "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  } catch {
    const fallback = await readFile(path.join(publicDir, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fallback);
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
  if (url.pathname.startsWith("/api/")) {
    await api(req, res, url);
    return;
  }
  await staticFile(req, res, url);
}).listen(port, host, () => {
  console.log(`Shimmy UI listening on http://${host}:${port}`);
});
