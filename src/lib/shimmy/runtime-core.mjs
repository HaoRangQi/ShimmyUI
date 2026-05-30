import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { arch, homedir, platform } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const versionProbeTimeoutMs = 5_000;

export class RuntimeOperationBusyError extends Error {
  constructor(activeOperation) {
    super(`Runtime operation "${activeOperation}" is already running`);
    this.name = "RuntimeOperationBusyError";
  }
}

let activeRuntimeOperation = null;

export async function withRuntimeOperationLock(operation, callback) {
  if (activeRuntimeOperation) {
    throw new RuntimeOperationBusyError(activeRuntimeOperation);
  }

  activeRuntimeOperation = operation;
  try {
    return await callback();
  } finally {
    activeRuntimeOperation = null;
  }
}

export function defaultShimmyUiHome() {
  return process.env.SHIMMY_UI_HOME || path.join(homedir(), ".shimmy-ui");
}

function defaultRuntimeMetaPath(homePath) {
  return process.env.SHIMMY_UI_RUNTIME_PATH || path.join(homePath, "runtime.json");
}

function defaultManagedBinaryPath(homePath) {
  return path.join(homePath, "bin", platform() === "win32" ? "shimmy.exe" : "shimmy");
}

async function fileExists(filePath) {
  return stat(filePath)
    .then((info) => info.isFile())
    .catch(() => false);
}

async function executable(filePath) {
  try {
    const mode = platform() === "win32" ? constants.F_OK : constants.X_OK;
    await access(filePath, mode);
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function candidate(filePath) {
  const exists = await fileExists(filePath);
  const isExec = exists ? await executable(filePath) : false;
  const result = { path: filePath, exists, executable: isExec, source: "managed" };
  if (isExec) {
    try {
      const { stdout, stderr } = await execFileAsync(filePath, ["--version"], {
        timeout: versionProbeTimeoutMs,
        shell: false,
      });
      result.version = (stdout || stderr).trim();
    } catch {
      result.version = undefined;
    }
  }
  return result;
}

export function platformAssetNames(osName = platform(), cpu = arch()) {
  if (osName === "darwin" && cpu === "arm64") return ["shimmy-macos-arm64", "shimmy"];
  if (osName === "darwin") return ["shimmy-macos-intel", "shimmy"];
  if (osName === "linux" && cpu === "arm64") return ["shimmy-linux-aarch64", "shimmy"];
  if (osName === "linux") return ["shimmy-linux-x86_64", "shimmy"];
  if (osName === "win32") return ["shimmy-windows-x86_64.exe", "shimmy.exe"];
  return platform() === "win32" ? ["shimmy.exe"] : ["shimmy"];
}

function normalizeAsset(asset) {
  return {
    id: asset.id,
    name: asset.name,
    size: asset.size,
    digest: asset.digest || null,
    downloadUrl: asset.browser_download_url,
  };
}

export function selectReleaseAsset(release, osName = platform(), cpu = arch()) {
  const names = platformAssetNames(osName, cpu);
  const assets = (release.assets || []).map(normalizeAsset);
  return names.map((name) => assets.find((asset) => asset.name === name)).find(Boolean) || null;
}

async function fetchJsonWithHeaders(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), 10_000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "shimmy-ui",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        throw new Error(`GitHub rate limit or access failure: ${response.status} ${response.statusText}`);
      }
      throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason === "timeout") {
      throw new Error("GitHub request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

let latestReleaseCache = null;
const latestReleaseCacheMs = 5 * 60 * 1000;

export async function latestShimmyRelease({ refresh = false } = {}) {
  if (!refresh && latestReleaseCache && latestReleaseCache.expiresAt > Date.now()) {
    return latestReleaseCache.value;
  }
  const release = await fetchJsonWithHeaders(
    "https://api.github.com/repos/Michael-A-Kuykendall/shimmy/releases/latest",
  );
  const asset = selectReleaseAsset(release);
  if (!asset) throw new Error(`No shimmy release asset for ${platform()}/${arch()}`);
  const normalizedRelease = {
    tagName: release.tag_name,
    name: release.name,
    htmlUrl: release.html_url,
    publishedAt: release.published_at,
    prerelease: Boolean(release.prerelease),
    asset,
    assets: (release.assets || []).map(normalizeAsset),
  };
  latestReleaseCache = {
    expiresAt: Date.now() + latestReleaseCacheMs,
    value: normalizedRelease,
  };
  return normalizedRelease;
}

export function verifySha256(buffer, digest, label = "Release asset") {
  if (!digest?.startsWith("sha256:")) {
    throw new Error(`${label} is missing a sha256 digest`);
  }
  const expected = digest.slice("sha256:".length).toLowerCase();
  const actual = createHash("sha256").update(buffer).digest("hex");
  if (actual !== expected) {
    throw new Error(`Checksum mismatch: expected ${expected}, got ${actual}`);
  }
  return actual;
}

async function downloadBuffer(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "shimmy-ui" },
  });
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function readVerifiedRuntimeFile(
  filePath,
  digest,
  missingMessage = "Runtime file is missing",
) {
  if (!(await fileExists(filePath))) throw new Error(missingMessage);
  const buffer = await readFile(filePath);
  verifySha256(buffer, digest, missingMessage.replace(/ is missing$/, ""));
  return buffer;
}

function backupName(version) {
  return `shimmy-${String(version || "unknown").replace(/[^\w.-]+/g, "_")}-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}${platform() === "win32" ? ".exe" : ""}`;
}

export function createRuntimeManager({
  readConfig,
  writeConfig,
  shimmyUiHome = defaultShimmyUiHome,
  runtimeMetaPath,
}) {
  const managedBinaryPath = () => defaultManagedBinaryPath(shimmyUiHome());
  const metaPath = () =>
    runtimeMetaPath ? runtimeMetaPath() : defaultRuntimeMetaPath(shimmyUiHome());

  async function readRuntimeMeta() {
    try {
      return JSON.parse(await readFile(metaPath(), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return { downloads: [], backups: [] };
      throw error;
    }
  }

  async function writeRuntimeMeta(meta) {
    const next = { downloads: [], backups: [], ...meta };
    await mkdir(path.dirname(metaPath()), { recursive: true });
    await writeFile(metaPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  }

  async function backupManagedRuntime(meta) {
    const source = managedBinaryPath();
    if (!(await fileExists(source))) return null;
    const targetDir = path.join(shimmyUiHome(), "backups");
    await mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, backupName(meta.installedVersion));
    await copyFile(source, targetPath);
    if (platform() !== "win32") await chmod(targetPath, 0o755);
    return {
      version: meta.installedVersion || null,
      assetName: meta.installedAssetName || null,
      digest: meta.installedDigest || null,
      path: targetPath,
      createdAt: new Date().toISOString(),
    };
  }

  async function runtimeStatus() {
    const [config, meta, release] = await Promise.all([
      readConfig(),
      readRuntimeMeta(),
    latestShimmyRelease().catch((error) => ({ error: error.message })),
    ]);
    const managedPath = managedBinaryPath();
    const managedCandidate = await candidate(managedPath);
    const installed = managedCandidate.exists;
    const latestVersion = release.error ? null : release.tagName;
    const installedByUi =
      installed && (config.shimmyPath === managedPath || meta.managedPath === managedPath);
    return {
      managedPath,
      installed,
      installedByUi,
      currentVersion: managedCandidate.version || meta.installedVersion || null,
      installedVersion: meta.installedVersion || null,
      installedDigest: meta.installedDigest || null,
      installedAssetName: meta.installedAssetName || null,
      installedAt: meta.installedAt || null,
      latestRelease: release.error ? null : release,
      releaseError: release.error || null,
      updateAvailable: Boolean(
        installed && latestVersion && meta.installedVersion && meta.installedVersion !== latestVersion,
      ),
      downloads: meta.downloads || [],
      backups: meta.backups || [],
      canUninstall: installedByUi,
      canRollback: Boolean((meta.backups || []).length),
    };
  }

  async function downloadRuntimeUnlocked() {
    const release = await latestShimmyRelease({ refresh: true });
    const asset = release.asset;
    const buffer = await downloadBuffer(asset.downloadUrl);
    const sha256 = verifySha256(buffer, asset.digest);
    const targetDir = path.join(shimmyUiHome(), "downloads", release.tagName);
    await mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, asset.name);
    await writeFile(targetPath, buffer);
    if (platform() !== "win32") await chmod(targetPath, 0o755);
    const meta = await readRuntimeMeta();
    const download = {
      version: release.tagName,
      assetName: asset.name,
      digest: `sha256:${sha256}`,
      path: targetPath,
      downloadedAt: new Date().toISOString(),
    };
    await writeRuntimeMeta({
      ...meta,
      downloads: [download, ...(meta.downloads || []).filter((item) => item.path !== targetPath)].slice(0, 20),
    });
    return { ok: true, release, download };
  }

  async function installRuntimeUnlocked({ useExistingDownload = false } = {}) {
    const meta = await readRuntimeMeta();
    const downloadResult =
      useExistingDownload && meta.downloads?.[0]
        ? { download: meta.downloads[0] }
        : await downloadRuntimeUnlocked();
    const download = downloadResult.download;
    const buffer = await readVerifiedRuntimeFile(
      download.path,
      download.digest,
      "Downloaded shimmy binary is missing",
    );

    const backup = await backupManagedRuntime(meta);
    const managedPath = managedBinaryPath();
    await mkdir(path.dirname(managedPath), { recursive: true });
    const tempPath = `${managedPath}.tmp`;
    await writeFile(tempPath, buffer);
    if (platform() !== "win32") await chmod(tempPath, 0o755);
    await rename(tempPath, managedPath);

    const nextMeta = await writeRuntimeMeta({
      ...meta,
      managedPath,
      installedVersion: download.version,
      installedAssetName: download.assetName,
      installedDigest: download.digest,
      installedAt: new Date().toISOString(),
      backups: backup ? [backup, ...(meta.backups || [])].slice(0, 10) : meta.backups || [],
    });
    const config = await readConfig();
    await writeConfig({ ...config, shimmyPath: managedPath });
    return { ok: true, managedPath, installedVersion: nextMeta.installedVersion, backup };
  }

  async function uninstallRuntimeUnlocked() {
    const meta = await readRuntimeMeta();
    const config = await readConfig();
    const managedPath = managedBinaryPath();
    const installedByUi = config.shimmyPath === managedPath || meta.managedPath === managedPath;
    if (!installedByUi) {
      throw new Error("Refusing to uninstall a shimmy binary not installed by Shimmy UI");
    }
    if (await fileExists(managedPath)) await unlink(managedPath);
    await writeRuntimeMeta({
      ...meta,
      installedVersion: null,
      installedAssetName: null,
      installedDigest: null,
      installedAt: null,
    });
    if (config.shimmyPath === managedPath) {
      const nextConfig = { ...config };
      delete nextConfig.shimmyPath;
      await writeConfig(nextConfig);
    }
    return { ok: true, uninstalled: true };
  }

  async function rollbackRuntimeUnlocked(backupPath) {
    const meta = await readRuntimeMeta();
    const backup = backupPath
      ? (meta.backups || []).find((item) => item.path === backupPath)
      : (meta.backups || [])[0];
    if (!backup) throw new Error("No Shimmy UI backup is available for rollback");
    const buffer = await readVerifiedRuntimeFile(
      backup.path,
      backup.digest,
      "Selected backup file is missing",
    );
    const managedPath = managedBinaryPath();
    const currentBackup = await backupManagedRuntime(meta);
    await mkdir(path.dirname(managedPath), { recursive: true });
    const tempPath = `${managedPath}.rollback.tmp`;
    await writeFile(tempPath, buffer);
    if (platform() !== "win32") await chmod(tempPath, 0o755);
    await rename(tempPath, managedPath);
    await writeRuntimeMeta({
      ...meta,
      managedPath,
      installedVersion: backup.version,
      installedAssetName: backup.assetName,
      installedDigest: backup.digest,
      installedAt: new Date().toISOString(),
      backups: currentBackup ? [currentBackup, ...(meta.backups || [])].slice(0, 10) : meta.backups || [],
    });
    const config = await readConfig();
    await writeConfig({ ...config, shimmyPath: managedPath });
    return { ok: true, rolledBackTo: backup };
  }

  return {
    managedBinaryPath,
    runtimeStatus,
    downloadRuntime: () => withRuntimeOperationLock("download", downloadRuntimeUnlocked),
    installRuntime: ({ useExistingDownload = false } = {}) =>
      withRuntimeOperationLock("install", () => installRuntimeUnlocked({ useExistingDownload })),
    updateRuntime: () => withRuntimeOperationLock("update", () => installRuntimeUnlocked()),
    uninstallRuntime: () => withRuntimeOperationLock("uninstall", uninstallRuntimeUnlocked),
    rollbackRuntime: (backupPath) =>
      withRuntimeOperationLock("rollback", () => rollbackRuntimeUnlocked(backupPath)),
  };
}
