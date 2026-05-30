import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, chmod } from "node:fs/promises";
import { test } from "node:test";
import os from "node:os";
import path from "node:path";
import {
  detectShimmyBinary,
  LogBuffer,
  normalizeConfig,
  serveCommand,
  ShimmyManager,
  downloadRuntime,
  installRuntime,
  managedBinaryPath,
  rollbackRuntime,
  RuntimeOperationBusyError,
  runtimeStatus,
  selectReleaseAsset,
  uninstallRuntime,
  verifySha256,
  withRuntimeOperationLock,
  writeConfig,
} from "../../server/shimmy-manager.mjs";

test("normalizeConfig applies safe defaults and validates context", () => {
  assert.equal(normalizeConfig({}).bindAddress, "127.0.0.1:11435");
  assert.equal(normalizeConfig({}).language, "zh");
  assert.equal(normalizeConfig({ maxCtx: 512 }).maxCtx, 512);
  assert.throws(() => normalizeConfig({ maxCtx: 131073 }), /maxCtx/);
});

test("normalizeConfig keeps UI settings and clamps unsafe enum values", () => {
  const config = normalizeConfig({
    language: "zh",
    theme: "system",
    defaultModel: "tinyllama-1.1b",
    gpuBackend: "cuda",
  });

  assert.equal(config.language, "zh");
  assert.equal(config.theme, "system");
  assert.equal(config.defaultModel, "tinyllama-1.1b");
  assert.equal(config.gpuBackend, "cuda");
  assert.equal(normalizeConfig({ language: "invalid" }).language, "zh");
  assert.equal(normalizeConfig({ gpuBackend: "bogus" }).gpuBackend, "auto");
});

test("serveCommand uses argument arrays and whitelisted env", () => {
  const command = serveCommand("/bin/shimmy", {
    bindAddress: "127.0.0.1:11436",
    modelDirs: ["/models/a", "/models/b"],
    baseGguf: "/models/base.gguf",
    maxCtx: 4096,
    gpuBackend: "vulkan",
  });
  assert.deepEqual(command.args, [
    "serve",
    "--bind",
    "127.0.0.1:11436",
    "--gpu-backend",
    "vulkan",
  ]);
  assert.equal(command.env.SHIMMY_MODEL_PATHS, "/models/a;/models/b");
  assert.equal(command.env.SHIMMY_BASE_GGUF, "/models/base.gguf");
});

test("LogBuffer evicts old entries", () => {
  const logs = new LogBuffer(2);
  logs.push("stdout", "one");
  logs.push("stdout", "two");
  logs.push("stderr", "three");
  assert.deepEqual(logs.list().map((entry) => entry.message), ["two", "three"]);
});

test("detectShimmyBinary selects configured executable", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-node-test-"));
  const bin = path.join(dir, "shimmy");
  await writeFile(bin, "#!/usr/bin/env node\nconsole.log('shimmy 2.0.1 test')\n");
  await chmod(bin, 0o755);
  const result = await detectShimmyBinary(
    {
      bindAddress: "127.0.0.1:11435",
      modelDirs: [],
      gpuBackend: "auto",
      language: "en",
      theme: "dark",
      shimmyPath: bin,
    },
    dir,
  );
  assert.equal(result.selected.path, bin);
  assert.match(result.selected.version, /shimmy 2\.0\.1 test/);
});

test("start does not take ownership of an already healthy external service", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-node-test-"));
  const configFile = path.join(dir, "config.json");
  const previousConfigPath = process.env.SHIMMY_UI_CONFIG_PATH;
  const previousFetch = globalThis.fetch;
  process.env.SHIMMY_UI_CONFIG_PATH = configFile;
  const bin = path.join(dir, "shimmy");
  await writeFile(bin, "#!/usr/bin/env node\nsetInterval(() => {}, 1000)\n");
  await chmod(bin, 0o755);

  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/health")) {
      return Response.json({ status: "ok", service: "shimmy" });
    }
    return Response.json({});
  };

  try {
    await writeConfig({
      bindAddress: "127.0.0.1:11435",
      modelDirs: [],
      gpuBackend: "auto",
      language: "en",
      theme: "dark",
      shimmyPath: bin,
    });
    const manager = new ShimmyManager();

    assert.deepEqual(await manager.start(), {
      state: "running-external",
      external: true,
    });
    assert.equal(manager.pid, undefined);
  } finally {
    if (previousConfigPath === undefined) {
      delete process.env.SHIMMY_UI_CONFIG_PATH;
    } else {
      process.env.SHIMMY_UI_CONFIG_PATH = previousConfigPath;
    }
    globalThis.fetch = previousFetch;
  }
});

test("selectReleaseAsset picks the current platform asset", () => {
  const release = {
    assets: [
      { name: "shimmy", browser_download_url: "generic" },
      { name: "shimmy-macos-arm64", browser_download_url: "arm" },
      { name: "shimmy-linux-x86_64", browser_download_url: "linux" },
    ],
  };

  assert.equal(selectReleaseAsset(release, "darwin", "arm64").downloadUrl, "arm");
  assert.equal(selectReleaseAsset(release, "linux", "x64").downloadUrl, "linux");
});

test("verifySha256 rejects tampered downloads", () => {
  const data = Buffer.from("shimmy-binary");
  const digest = `sha256:${createHash("sha256").update(data).digest("hex")}`;
  assert.equal(verifySha256(data, digest), digest.slice("sha256:".length));
  assert.throws(() => verifySha256(Buffer.from("bad"), digest), /Checksum mismatch/);
});

test("runtime operation lock rejects concurrent fallback runtime writes", async () => {
  let releaseFirstOperation;
  const firstOperation = withRuntimeOperationLock(
    "install",
    () =>
      new Promise((resolve) => {
        releaseFirstOperation = () => resolve("installed");
      }),
  );

  await assert.rejects(
    () => withRuntimeOperationLock("rollback", async () => "rolled back"),
    RuntimeOperationBusyError,
  );

  releaseFirstOperation();
  assert.equal(await firstOperation, "installed");
  assert.equal(await withRuntimeOperationLock("rollback", async () => "rolled back"), "rolled back");
});

test("download, install, uninstall, and rollback only manage Shimmy UI runtime", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-runtime-test-"));
  const previousHome = process.env.SHIMMY_UI_HOME;
  const previousConfigPath = process.env.SHIMMY_UI_CONFIG_PATH;
  const previousRuntimePath = process.env.SHIMMY_UI_RUNTIME_PATH;
  const previousFetch = globalThis.fetch;
  process.env.SHIMMY_UI_HOME = dir;
  process.env.SHIMMY_UI_CONFIG_PATH = path.join(dir, "config.json");
  process.env.SHIMMY_UI_RUNTIME_PATH = path.join(dir, "runtime.json");

  const firstBinary = "#!/usr/bin/env node\nconsole.log('shimmy 1.0.0 test')\n";
  const secondBinary = "#!/usr/bin/env node\nconsole.log('shimmy 2.0.0 test')\n";
  let releaseVersion = "v1.0.0";
  let binary = firstBinary;
  globalThis.fetch = async (url) => {
    if (String(url).includes("api.github.com")) {
      const digest = createHash("sha256").update(Buffer.from(binary)).digest("hex");
      return Response.json({
        tag_name: releaseVersion,
        name: `Shimmy ${releaseVersion}`,
        html_url: `https://example.test/${releaseVersion}`,
        published_at: "2026-05-26T22:32:37Z",
        prerelease: false,
        assets: [
          {
            id: 1,
            name: "shimmy-macos-arm64",
            size: binary.length,
            digest: `sha256:${digest}`,
            browser_download_url: "https://example.test/shimmy",
          },
          {
            id: 2,
            name: "shimmy",
            size: binary.length,
            digest: `sha256:${digest}`,
            browser_download_url: "https://example.test/generic",
          },
        ],
      });
    }
    return new Response(binary);
  };

  try {
    await writeConfig({
      bindAddress: "127.0.0.1:11435",
      modelDirs: [],
      gpuBackend: "auto",
      language: "en",
      theme: "dark",
    });

    const downloaded = await downloadRuntime();
    assert.equal(downloaded.download.version, "v1.0.0");
    assert.match(downloaded.download.digest, /^sha256:/);

    await writeFile(downloaded.download.path, "tampered");
    await assert.rejects(
      () => installRuntime({ useExistingDownload: true }),
      /Checksum mismatch/,
    );
    await writeFile(downloaded.download.path, firstBinary);

    const installed = await installRuntime({ useExistingDownload: true });
    assert.equal(installed.installedVersion, "v1.0.0");
    assert.equal(managedBinaryPath(), path.join(dir, "bin", "shimmy"));
    assert.match(await readFile(managedBinaryPath(), "utf8"), /1\.0\.0/);

    releaseVersion = "v2.0.0";
    binary = secondBinary;
    const updated = await installRuntime();
    assert.equal(updated.installedVersion, "v2.0.0");
    assert.match(await readFile(managedBinaryPath(), "utf8"), /2\.0\.0/);
    assert.equal((await runtimeStatus()).canRollback, true);

    const [backup] = (await runtimeStatus()).backups;
    await writeFile(backup.path, "tampered");
    await assert.rejects(() => rollbackRuntime(), /Checksum mismatch/);
    await writeFile(backup.path, firstBinary);

    const rollback = await rollbackRuntime();
    assert.equal(rollback.rolledBackTo.version, "v1.0.0");
    assert.match(await readFile(managedBinaryPath(), "utf8"), /1\.0\.0/);

    await uninstallRuntime();
    assert.equal((await runtimeStatus()).installed, false);
  } finally {
    if (previousHome === undefined) delete process.env.SHIMMY_UI_HOME;
    else process.env.SHIMMY_UI_HOME = previousHome;
    if (previousConfigPath === undefined) delete process.env.SHIMMY_UI_CONFIG_PATH;
    else process.env.SHIMMY_UI_CONFIG_PATH = previousConfigPath;
    if (previousRuntimePath === undefined) delete process.env.SHIMMY_UI_RUNTIME_PATH;
    else process.env.SHIMMY_UI_RUNTIME_PATH = previousRuntimePath;
    globalThis.fetch = previousFetch;
  }
});
